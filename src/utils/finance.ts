import { InterestType, AmortizationScheduleItem } from '@/types';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-MW', {
    style: 'currency',
    currency: 'MWK',
    minimumFractionDigits: 2,
  }).format(amount).replace('MWK', 'MK'); // Standard notation in Malawi often uses MK
};

export const calculateLoanDetails = (
  principal: number,
  rate: number, // Annual rate in percentage (e.g., 10 for 10%)
  months: number,
  type: InterestType
) => {
  const monthlyRate = rate / 100 / 12;
  
  let monthlyInstallment = 0;
  let totalInterest = 0;
  let totalPayable = 0;
  let schedule: AmortizationScheduleItem[] = [];

  if (type === 'flat') {
    // Flat Rate: Interest is calculated on the full principal for the full term
    const annualInterest = principal * (rate / 100);
    totalInterest = annualInterest * (months / 12);
    totalPayable = principal + totalInterest;
    monthlyInstallment = totalPayable / months;

    let balance = totalPayable;
    for (let i = 1; i <= months; i++) {
        balance -= monthlyInstallment;
        schedule.push({
            month: i,
            installment: monthlyInstallment,
            principal: principal / months,
            interest: totalInterest / months,
            balance: Math.max(0, balance)
        });
    }

  } else {
    // Reducing Balance (Amortization)
    if (rate === 0) {
      monthlyInstallment = principal / months;
      totalPayable = principal;
      totalInterest = 0;
    } else {
      const x = Math.pow(1 + monthlyRate, months);
      monthlyInstallment = (principal * x * monthlyRate) / (x - 1);
      totalPayable = monthlyInstallment * months;
      totalInterest = totalPayable - principal;
    }

    let balance = principal;
    for (let i = 1; i <= months; i++) {
        const interestPayment = balance * monthlyRate;
        const principalPayment = monthlyInstallment - interestPayment;
        balance -= principalPayment;
        schedule.push({
            month: i,
            installment: monthlyInstallment,
            principal: principalPayment,
            interest: interestPayment,
            balance: Math.max(0, balance)
        });
    }
  }

  return {
    monthlyInstallment,
    totalInterest,
    totalPayable,
    schedule
  };
};

export const calculateRepaymentDistribution = (
    paymentAmount: number,
    penaltyOutstanding: number,
    interestOutstanding: number,
    principalOutstanding: number
): { principalPaid: number; interestPaid: number; penaltyPaid: number } => {
    let remaining = paymentAmount;
    let penaltyPaid = 0;
    let interestPaid = 0;
    let principalPaid = 0;

    // 1. Pay Penalty First
    if (penaltyOutstanding > 0) {
        if (remaining >= penaltyOutstanding) {
            penaltyPaid = penaltyOutstanding;
            remaining -= penaltyOutstanding;
        } else {
            penaltyPaid = remaining;
            remaining = 0;
        }
    }

    // 2. Pay Interest Second
    if (remaining > 0 && interestOutstanding > 0) {
        if (remaining >= interestOutstanding) {
            interestPaid = interestOutstanding;
            remaining -= interestOutstanding;
        } else {
            interestPaid = remaining;
            remaining = 0;
        }
    }

    // 3. Pay Principal Last
    if (remaining > 0) {
        principalPaid = remaining; // Can exceed outstanding if overpayment, usually handled by UI validation
        // Cap at principal outstanding logically, but let UI handle overpayment logic
        if (principalPaid > principalOutstanding) {
             // For this helper, we just return what goes to principal
        }
    }

    return { principalPaid, interestPaid, penaltyPaid };
}