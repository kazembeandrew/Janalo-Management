import { describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import {
  calculateLoanDetails,
  calculateRepaymentDistribution,
  recalculateLoanSchedule,
} from '../finance';
import { AmortizationScheduleItem } from '@/types';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const createMockSchedule = (months: number, installment: number): AmortizationScheduleItem[] =>
  Array.from({ length: months }, (_, i) => ({
    month: i + 1,
    installment,
    principal: installment * 0.7,
    interest: installment * 0.3,
    balance: 100000 - installment * (i + 1) * 0.7,
  }));

// ---------------------------------------------------------------------------
// calculateLoanDetails
// ---------------------------------------------------------------------------
describe('calculateLoanDetails', () => {
  describe('flat interest', () => {
    it('calculates total interest, total payable and monthly installment', () => {
      // 100,000 @ 2% flat/month for 12 months
      // totalInterest = 100000 * 0.02 * 12 = 24,000
      // totalPayable  = 124,000
      // monthlyInstallment = 124000 / 12 ≈ 10,333.33
      const { monthlyInstallment, totalInterest, totalPayable, schedule } =
        calculateLoanDetails(100000, 2, 12, 'flat');

      expect(totalInterest).toBeCloseTo(24000, 2);
      expect(totalPayable).toBeCloseTo(124000, 2);
      expect(monthlyInstallment).toBeCloseTo(10333.33, 2);
      expect(schedule).toHaveLength(12);
    });

    it('final schedule balance is 0', () => {
      const { schedule } = calculateLoanDetails(60000, 1.5, 6, 'flat');
      expect(schedule[schedule.length - 1].balance).toBeCloseTo(0, 2);
    });

    it('each installment equals total payable / months', () => {
      const { monthlyInstallment, schedule } = calculateLoanDetails(50000, 3, 10, 'flat');
      schedule.forEach(item => {
        expect(item.installment).toBeCloseTo(monthlyInstallment, 2);
      });
    });
  });

  describe('reducing balance interest', () => {
    it('calculates correct monthly installment via annuity formula', () => {
      // P=120000, r=1%/month, n=12
      // 1.01^12 ≈ 1.126825
      // PMT = 120000 * (0.01 * 1.126825) / (1.126825 - 1) ≈ 10,661.85
      const { monthlyInstallment, schedule } = calculateLoanDetails(120000, 1, 12, 'reducing');
      expect(monthlyInstallment).toBeCloseTo(10661.85, 1);
      expect(schedule).toHaveLength(12);
    });

    it('final schedule balance is 0', () => {
      const { schedule } = calculateLoanDetails(100000, 1, 24, 'reducing');
      expect(schedule[schedule.length - 1].balance).toBeCloseTo(0, 1);
    });

    it('interest portion decreases each month', () => {
      const { schedule } = calculateLoanDetails(100000, 1, 12, 'reducing');
      for (let i = 1; i < schedule.length; i++) {
        expect(schedule[i].interest).toBeLessThan(schedule[i - 1].interest);
      }
    });

    it('handles zero interest rate (principal-only)', () => {
      const { monthlyInstallment, totalInterest, schedule } =
        calculateLoanDetails(60000, 0, 6, 'reducing');
      expect(totalInterest).toBe(0);
      expect(monthlyInstallment).toBeCloseTo(10000, 2);
      expect(schedule).toHaveLength(6);
    });

    it('each installment is the same (fixed payment)', () => {
      const { monthlyInstallment, schedule } = calculateLoanDetails(100000, 1.5, 18, 'reducing');
      schedule.forEach(item => {
        // Allow for final-payment rounding
        expect(item.installment).toBeCloseTo(monthlyInstallment, 0);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// calculateRepaymentDistribution
// ---------------------------------------------------------------------------
describe('calculateRepaymentDistribution', () => {
  it('pays penalty first, then interest, then principal', () => {
    const result = calculateRepaymentDistribution(5000, 1000, 1500, 10000);
    expect(result.penaltyPaid).toBe(1000);
    expect(result.interestPaid).toBe(1500);
    expect(result.principalPaid).toBe(2500);
    expect(result.overpayment).toBe(0);
    expect(result.isFullyPaid).toBe(false);
  });

  it('marks loan as fully paid when payment covers entire outstanding', () => {
    const result = calculateRepaymentDistribution(12500, 1000, 1500, 10000);
    expect(result.isFullyPaid).toBe(true);
    expect(result.overpayment).toBe(0);
    expect(result.penaltyPaid).toBe(1000);
    expect(result.interestPaid).toBe(1500);
    expect(result.principalPaid).toBe(10000);
  });

  it('calculates overpayment correctly', () => {
    const result = calculateRepaymentDistribution(15000, 1000, 1500, 10000);
    expect(result.isFullyPaid).toBe(true);
    expect(result.overpayment).toBeCloseTo(2500, 2);
  });

  it('handles payment that only partially covers penalty', () => {
    const result = calculateRepaymentDistribution(500, 1000, 1500, 10000);
    expect(result.penaltyPaid).toBe(500);
    expect(result.interestPaid).toBe(0);
    expect(result.principalPaid).toBe(0);
    expect(result.isFullyPaid).toBe(false);
  });

  it('skips penalty bucket when no penalty outstanding', () => {
    const result = calculateRepaymentDistribution(3000, 0, 1500, 10000);
    expect(result.penaltyPaid).toBe(0);
    expect(result.interestPaid).toBe(1500);
    expect(result.principalPaid).toBe(1500);
  });

  it('returns correct remainingAfterPayment values', () => {
    const result = calculateRepaymentDistribution(2500, 1000, 1500, 10000);
    expect(result.remainingAfterPayment.penalty).toBe(0);
    expect(result.remainingAfterPayment.interest).toBe(0);
    expect(result.remainingAfterPayment.principal).toBeCloseTo(10000, 2);
  });
});

// ---------------------------------------------------------------------------
// recalculateLoanSchedule
// NOTE: `interestRate` is a MONTHLY rate in percent (same convention as
// calculateLoanDetails). Pass 1 for 1 %/month, NOT 12 for 12 %/year.
// The returned array is the FULL schedule: paid months + recalculated months.
// ---------------------------------------------------------------------------
describe('recalculateLoanSchedule', () => {
  it('returns original schedule when principalOutstanding is 0', () => {
    const schedule = createMockSchedule(12, 10000);
    expect(recalculateLoanSchedule(schedule, 0, 1, 12)).toEqual(schedule);
  });

  it('returns original schedule when interestRate is 0', () => {
    const schedule = createMockSchedule(12, 10000);
    expect(recalculateLoanSchedule(schedule, 50000, 0, 12)).toEqual(schedule);
  });

  it('returns original schedule when currentMonthlyPayment is 0', () => {
    const schedule: AmortizationScheduleItem[] = [
      { month: 1, installment: 0, principal: 0, interest: 0, balance: 100000 },
    ];
    expect(recalculateLoanSchedule(schedule, 50000, 1, 12)).toEqual(schedule);
  });

  it('calculates correct remaining months — typical loan (P=100k, r=1%/mo, PMT=10k)', () => {
    // P·r/PMT = 100000 * 0.01 / 10000 = 0.10  →  n = ceil(-ln(0.9)/ln(1.01)) = 11
    // startMonth = 12 - 11 + 1 = 2
    // combined result = 1 paid month + 11 new months = 12 total
    const schedule = createMockSchedule(12, 10000);
    const result = recalculateLoanSchedule(schedule, 100000, 1, 12);

    expect(result).toHaveLength(12);               // 1 paid + 11 new
    expect(result[0].month).toBe(1);               // paid portion preserved
    expect(result[1].month).toBe(2);               // new portion starts at month 2
  });

  it('handles large principal with small monthly rate (P=1M, r=0.5%/mo, PMT=20k)', () => {
    // P·r/PMT = 1000000 * 0.005 / 20000 = 0.25  →  n = ceil(-ln(0.75)/ln(1.005)) = 58
    // startMonth = 60 - 58 + 1 = 3  →  paid = 2, new = 58, total = 60
    const schedule = createMockSchedule(60, 20000);
    const result = recalculateLoanSchedule(schedule, 1000000, 0.5, 60);

    expect(result).toHaveLength(60);               // 2 paid + 58 new
    expect(result[0].month).toBe(1);               // first paid month intact
  });

  it('handles near-final-payment state (P=5k, r=1%/mo, PMT=10k)', () => {
    // P·r/PMT = 0.005  →  n = ceil(0.504) = 1
    // startMonth = 12 - 1 + 1 = 12  →  paid = 11, new = 1, total = 12
    // Final installment is just principal + small interest, not full 10,000
    const schedule = createMockSchedule(12, 10000);
    const result = recalculateLoanSchedule(schedule, 5000, 1, 12);

    expect(result).toHaveLength(12);
    expect(result[11].installment).toBeLessThan(10000); // final payment < full installment
  });

  it('warns and returns original schedule when P·r/PMT >= 1', () => {
    // P·r/PMT = 100000 * 0.01 / 500 = 2  →  loan can never be repaid
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const schedule = createMockSchedule(12, 500);
    const result = recalculateLoanSchedule(schedule, 100000, 1, 12);

    expect(warn).toHaveBeenCalledWith(
      'Loan cannot be repaid: P·r/PMT >= 1. Payment is insufficient to cover interest.'
    );
    expect(result).toEqual(schedule);
    warn.mockRestore();
  });

  it('warns and returns original schedule when P·r/PMT is exactly 1', () => {
    // P·r/PMT = 100000 * 0.01 / 1000 = 1
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const schedule = createMockSchedule(12, 1000);
    const result = recalculateLoanSchedule(schedule, 100000, 1, 12);

    expect(warn).toHaveBeenCalledWith(
      'Loan cannot be repaid: P·r/PMT >= 1. Payment is insufficient to cover interest.'
    );
    expect(result).toEqual(schedule);
    warn.mockRestore();
  });

  it('handles very small remaining balance (P=100, r=1%/mo, PMT=10k)', () => {
    // P·r/PMT = 0.0001  →  n = ceil(0.01) = 1  →  total = 12
    const schedule = createMockSchedule(12, 10000);
    const result = recalculateLoanSchedule(schedule, 100, 1, 12);

    expect(result).toHaveLength(12);
    expect(result[11].installment).toBeLessThan(10000);
  });

  it('combines paid schedule with new calculated schedule (paid portion is unchanged)', () => {
    // Same params as "typical loan" test
    const schedule = createMockSchedule(12, 10000);
    const result = recalculateLoanSchedule(schedule, 100000, 1, 12);

    // Paid portion (month 1) must be the original object, not recalculated
    expect(result[0]).toEqual(schedule[0]);
    // New portion starts immediately after
    expect(result[1].month).toBe(2);
  });

  it('handles zero interest rate correctly', () => {
    const schedule = createMockSchedule(12, 10000);
    expect(recalculateLoanSchedule(schedule, 100000, 0, 12)).toEqual(schedule);
  });

  // Additional edge case tests
  it('handles very high interest rates correctly', () => {
    const schedule = createMockSchedule(12, 10000);
    const result = recalculateLoanSchedule(schedule, 50000, 5, 12);
    
    expect(result).toHaveLength(12);
    // With high interest, final payment should still be reasonable
    expect(result[11].installment).toBeGreaterThan(0);
    expect(result[11].installment).toBeLessThan(50000);
  });

  it('handles single month remaining correctly', () => {
    const schedule = createMockSchedule(12, 10000);
    const result = recalculateLoanSchedule(schedule, 10000, 1, 12);
    
    expect(result).toHaveLength(12);
    // Should have exactly one payment left
    expect(result[11].balance).toBe(0);
  });
});

// Additional comprehensive tests for calculateLoanDetails
describe('calculateLoanDetails edge cases', () => {
  it('handles very small principal amounts', () => {
    const { monthlyInstallment, totalInterest, totalPayable, schedule } =
      calculateLoanDetails(100, 1, 6, 'reducing');
    
    expect(totalInterest).toBeGreaterThan(0);
    expect(totalPayable).toBeGreaterThan(100);
    expect(monthlyInstallment).toBeGreaterThan(0);
    expect(schedule).toHaveLength(6);
    expect(schedule[5].balance).toBeCloseTo(0, 2);
  });

  it('handles very large principal amounts', () => {
    const { monthlyInstallment, totalInterest, totalPayable, schedule } =
      calculateLoanDetails(10000000, 1, 60, 'reducing');
    
    expect(totalInterest).toBeGreaterThan(0);
    expect(totalPayable).toBeGreaterThan(10000000);
    expect(monthlyInstallment).toBeGreaterThan(0);
    expect(schedule).toHaveLength(60);
    expect(schedule[59].balance).toBeCloseTo(0, 2);
  });

  it('handles very long terms', () => {
    const { monthlyInstallment, totalInterest, totalPayable, schedule } =
      calculateLoanDetails(100000, 1, 120, 'reducing');
    
    expect(totalInterest).toBeGreaterThan(0);
    expect(totalPayable).toBeGreaterThan(100000);
    expect(monthlyInstallment).toBeGreaterThan(0);
    expect(schedule).toHaveLength(120);
    expect(schedule[119].balance).toBeCloseTo(0, 2);
  });

  it('handles very short terms', () => {
    const { monthlyInstallment, totalInterest, totalPayable, schedule } =
      calculateLoanDetails(10000, 1, 2, 'reducing');
    
    expect(totalInterest).toBeGreaterThan(0);
    expect(totalPayable).toBeGreaterThan(10000);
    expect(monthlyInstallment).toBeGreaterThan(0);
    expect(schedule).toHaveLength(2);
    expect(schedule[1].balance).toBeCloseTo(0, 2);
  });
});

// Additional comprehensive tests for calculateRepaymentDistribution
describe('calculateRepaymentDistribution edge cases', () => {
  it('handles zero payment amount', () => {
    const result = calculateRepaymentDistribution(0, 1000, 1500, 10000);
    
    expect(result.penaltyPaid).toBe(0);
    expect(result.interestPaid).toBe(0);
    expect(result.principalPaid).toBe(0);
    expect(result.overpayment).toBe(0);
    expect(result.isFullyPaid).toBe(false);
    expect(result.remainingAfterPayment.penalty).toBe(1000);
    expect(result.remainingAfterPayment.interest).toBe(1500);
    expect(result.remainingAfterPayment.principal).toBe(10000);
  });

  it('handles exact payment amount (no overpayment)', () => {
    const result = calculateRepaymentDistribution(12500, 1000, 1500, 10000);
    
    expect(result.penaltyPaid).toBe(1000);
    expect(result.interestPaid).toBe(1500);
    expect(result.principalPaid).toBe(10000);
    expect(result.overpayment).toBe(0);
    expect(result.isFullyPaid).toBe(true);
  });

  it('handles very large payment amount', () => {
    const result = calculateRepaymentDistribution(100000, 1000, 1500, 10000);
    
    expect(result.penaltyPaid).toBe(1000);
    expect(result.interestPaid).toBe(1500);
    expect(result.principalPaid).toBe(10000);
    expect(result.overpayment).toBe(87500);
    expect(result.isFullyPaid).toBe(true);
  });

  it('handles payment that only covers penalty and part of interest', () => {
    const result = calculateRepaymentDistribution(2000, 1000, 1500, 10000);
    
    expect(result.penaltyPaid).toBe(1000);
    expect(result.interestPaid).toBe(1000);
    expect(result.principalPaid).toBe(0);
    expect(result.overpayment).toBe(0);
    expect(result.isFullyPaid).toBe(false);
    expect(result.remainingAfterPayment.penalty).toBe(0);
    expect(result.remainingAfterPayment.interest).toBe(500);
    expect(result.remainingAfterPayment.principal).toBe(10000);
  });

  it('handles payment that covers penalty and all interest but no principal', () => {
    const result = calculateRepaymentDistribution(2500, 1000, 1500, 10000);
    
    expect(result.penaltyPaid).toBe(1000);
    expect(result.interestPaid).toBe(1500);
    expect(result.principalPaid).toBe(0);
    expect(result.overpayment).toBe(0);
    expect(result.isFullyPaid).toBe(false);
    expect(result.remainingAfterPayment.penalty).toBe(0);
    expect(result.remainingAfterPayment.interest).toBe(0);
    expect(result.remainingAfterPayment.principal).toBe(10000);
  });
});
