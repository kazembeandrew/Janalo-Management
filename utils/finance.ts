import { InterestType, AmortizationScheduleItem } from '@/types';
import Decimal from 'decimal.js';

// Configure Decimal for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export const formatCurrency = (amount: number | string): string => {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-MW', {
    minimumFractionDigits: 2,
  }).format(numericAmount || 0);
};

export const formatNumberWithCommas = (value: string | number): string => {
    if (value === undefined || value === null || value === '') return '';
    const stringValue = String(value).replace(/,/g, '');
    if (isNaN(Number(stringValue))) return String(value);
    
    const parts = stringValue.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
};

export const parseFormattedNumber = (value: string): number => {
    return Number(value.replace(/,/g, '')) || 0;
};

export const calculateLoanDetails = (
  principal: number,
  rate: number, 
  months: number,
  type: InterestType
) => {
  const p = new Decimal(principal);
  const r = new Decimal(rate).div(100); // Monthly rate
  const m = new Decimal(months);
  
  let monthlyInstallment = new Decimal(0);
  let totalInterest = new Decimal(0);
  let totalPayable = new Decimal(0);
  let schedule: AmortizationScheduleItem[] = [];

  if (type === 'flat') {
    totalInterest = p.mul(r).mul(m);
    totalPayable = p.add(totalInterest);
    monthlyInstallment = totalPayable.div(m);

    let balance = totalPayable;
    for (let i = 1; i <= months; i++) {
        balance = balance.sub(monthlyInstallment);
        schedule.push({
            month: i,
            installment: monthlyInstallment.toNumber(),
            principal: p.div(m).toNumber(),
            interest: totalInterest.div(m).toNumber(),
            balance: Decimal.max(0, balance).toNumber()
        });
    }
  } else {
    if (rate === 0) {
      monthlyInstallment = p.div(m);
      totalPayable = p;
      totalInterest = new Decimal(0);
    } else {
      // Formula: P * (r * (1+r)^n) / ((1+r)^n - 1)
      const onePlusR = r.add(1);
      const pow = onePlusR.pow(months);
      monthlyInstallment = p.mul(r.mul(pow)).div(pow.sub(1));
      totalPayable = monthlyInstallment.mul(m);
      totalInterest = totalPayable.sub(p);
    }

    let balance = p;
    for (let i = 1; i <= months; i++) {
        const interestPayment = balance.mul(r);
        const principalPayment = monthlyInstallment.sub(interestPayment);
        balance = balance.sub(principalPayment);
        schedule.push({
            month: i,
            installment: monthlyInstallment.toNumber(),
            principal: principalPayment.toNumber(),
            interest: interestPayment.toNumber(),
            balance: Decimal.max(0, balance).toNumber()
        });
    }
  }

  return {
    monthlyInstallment: monthlyInstallment.toDecimalPlaces(2).toNumber(),
    totalInterest: totalInterest.toDecimalPlaces(2).toNumber(),
    totalPayable: totalPayable.toDecimalPlaces(2).toNumber(),
    schedule
  };
};

/**
 * IMPORTANT: Accounting Treatment for interest_outstanding
 * 
 * This function calculates totalInterest for the ENTIRE loan term.
 * However, this value should NOT be used directly for interest_outstanding initialization.
 * 
 * - Flat-rate loans: interest_outstanding = totalInterest (all due upfront)
 * - Reducing balance loans: interest_outstanding = 0 initially (accrues over time)
 * 
 * The system uses cash-basis accounting for interest recognition:
 * - Revenue is recognized when payment is RECEIVED
 * - Not when interest accrues or becomes contractually due
 * 
 * See: INTEREST_OUTSTANDING_INITIALIZATION_ANALYSIS.md for full details
 */

export const calculateRepaymentDistribution = (
    paymentAmount: number,
    penaltyOutstanding: number,
    interestOutstanding: number,
    principalOutstanding: number
): { 
    principalPaid: number; 
    interestPaid: number; 
    penaltyPaid: number;
    overpayment: number;
    isFullyPaid: boolean;
    remainingAfterPayment: {
        penalty: number;
        interest: number;
        principal: number;
    };
} => {
    let remaining = new Decimal(paymentAmount);
    let penaltyPaid = new Decimal(0);
    let interestPaid = new Decimal(0);
    let principalPaid = new Decimal(0);

    const pO = new Decimal(penaltyOutstanding);
    const iO = new Decimal(interestOutstanding);
    const principal = new Decimal(principalOutstanding);

    // 1. Pay Penalty First
    if (pO.gt(0)) {
        if (remaining.gte(pO)) {
            penaltyPaid = pO;
            remaining = remaining.sub(pO);
        } else {
            penaltyPaid = remaining;
            remaining = new Decimal(0);
        }
    }

    // 2. Pay Interest Second
    if (remaining.gt(0) && iO.gt(0)) {
        if (remaining.gte(iO)) {
            interestPaid = iO;
            remaining = remaining.sub(iO);
        } else {
            interestPaid = remaining;
            remaining = new Decimal(0);
        }
    }

    // 3. Pay Principal Last
    if (remaining.gt(0)) {
        if (remaining.gte(principal)) {
            principalPaid = principal;
            remaining = remaining.sub(principal);
        } else {
            principalPaid = remaining;
            remaining = new Decimal(0);
        }
    }

    const totalOutstanding = pO.add(iO).add(principal);
    const isFullyPaid = paymentAmount >= totalOutstanding.toNumber();
    const overpayment = remaining.gt(0) ? remaining.toNumber() : 0;

    return { 
        principalPaid: principalPaid.toNumber(), 
        interestPaid: interestPaid.toNumber(), 
        penaltyPaid: penaltyPaid.toNumber(),
        overpayment,
        isFullyPaid,
        remainingAfterPayment: {
            penalty: pO.sub(penaltyPaid).toNumber(),
            interest: iO.sub(interestPaid).toNumber(),
            principal: principal.sub(principalPaid).toNumber()
        }
    };
};

export const recalculateLoanSchedule = (
    originalSchedule: AmortizationScheduleItem[],
    principalOutstanding: number,
    interestRate: number,
    originalTerm: number
): AmortizationScheduleItem[] => {
    if (principalOutstanding <= 0 || interestRate === 0) {
        return originalSchedule;
    }

    // Calculate remaining term based on current balance
    const currentPrincipal = new Decimal(principalOutstanding);
    const monthlyRate = new Decimal(interestRate).div(100);
    
    // Estimate remaining months using current payment amount
    const currentMonthlyPayment = originalSchedule[0]?.installment || 0;
    if (currentMonthlyPayment === 0) return originalSchedule;

    // Calculate remaining months using standard annuity formula: n = -ln(1 - P·r/PMT) / ln(1+r)
    const prDivPmt = currentPrincipal.mul(monthlyRate).div(currentMonthlyPayment);
    
    // Validate that P·r/PMT < 1 (otherwise the loan can never be repaid)
    if (prDivPmt.gte(1)) {
        console.warn('Loan cannot be repaid: P·r/PMT >= 1. Payment is insufficient to cover interest.');
        return originalSchedule;
    }
    
    let remainingMonths = Math.ceil(
        new Decimal(1).sub(prDivPmt).ln().neg().div(monthlyRate.add(1).ln()).toNumber()
    );

    // Generate new schedule for remaining balance
    const newSchedule: AmortizationScheduleItem[] = [];
    let balance = currentPrincipal;
    const startMonth = originalSchedule.length - remainingMonths + 1;

    for (let i = startMonth; i <= originalTerm; i++) {
        const interestPayment = balance.mul(monthlyRate);
        const principalPayment = new Decimal(currentMonthlyPayment).sub(interestPayment);
        
        if (principalPayment.gt(balance)) {
            // Final payment
            newSchedule.push({
                month: i,
                installment: balance.add(interestPayment).toNumber(),
                principal: balance.toNumber(),
                interest: interestPayment.toNumber(),
                balance: 0
            });
            break;
        }

        balance = balance.sub(principalPayment);
        
        newSchedule.push({
            month: i,
            installment: currentMonthlyPayment,
            principal: principalPayment.toNumber(),
            interest: interestPayment.toNumber(),
            balance: Decimal.max(0, balance).toNumber()
        });

        if (balance.lte(0)) break;
    }

    // Combine original paid schedule with new calculated schedule
    const paidSchedule = originalSchedule.slice(0, startMonth - 1);
    return [...paidSchedule, ...newSchedule];
};

/**
 * Generates an auto reference number for loans using atomic DB function
 * Format: JN{YY}{MM}{NNNN} (e.g., JN2604001)
 * 
 * FIXED: Now uses database RPC function to prevent race conditions
 */
export const generateAutoReference = async (): Promise<string> => {
    // Import supabase dynamically to avoid circular dependency issues
    const { supabase } = await import('@/lib/supabase');

    try {
        // Call the atomic database function to generate reference number
        const { data, error } = await supabase.rpc('generate_loan_reference');

        if (error) {
            console.error('Error calling generate_loan_reference RPC:', error);
            throw error;
        }

        if (!data) {
            throw new Error('Failed to generate reference number');
        }

        return data as string;
    } catch (error: unknown) {
        console.error('Error generating auto reference:', error instanceof Error ? error.message : String(error));
        
        // Fallback to timestamp-based reference if database query fails
        // NOTE: This is a last resort and may still have race conditions
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const prefix = `JN${year}`;
        const timestamp = Date.now().toString().slice(-4);
        return `${prefix}${month}${timestamp}`;
    }
};

/**
 * Validates if a reference number follows the correct format
 */
export const isValidReferenceFormat = (reference: string): boolean => {
    // Must be exactly 10 characters: JN + 2 digits year + 2 digits month + 4 digits number
    const pattern = /^JN\d{2}\d{2}\d{4}$/;
    return pattern.test(reference);
};

/**
 * Checks if a reference number already exists in the database
 */
export const isReferenceUnique = async (reference: string): Promise<boolean> => {
    const { supabase } = await import('@/lib/supabase');

    try {
        const { data, error } = await supabase
            .from('loans')
            .select('id')
            .eq('reference_no', reference.toUpperCase())
            .maybeSingle();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" which is fine
            console.error('Error checking reference uniqueness:', error instanceof Error ? error.message : String(error));
            return false;
        }

        return !data; // If no data found, it's unique
    } catch (error: unknown) {
        console.error('Error checking reference uniqueness:', error instanceof Error ? error.message : String(error));
        return false;
    }
};

/**
 * Formats a date string for display
 */
export const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-MW', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};
