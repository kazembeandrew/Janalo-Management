/**
 * Accounting Services - IFRS-Compliant Financial Management System
 * 
 * This module provides production-grade accounting services for the Janalo Management System.
 * All services implement strict double-entry accounting with accrual-based revenue recognition.
 * 
 * Architecture:
 * - AccountingEngineService: Central journal entry posting and validation
 * - InterestAccrualService: Daily interest calculation and monthly posting
 * - RepaymentServiceIFRS: IFRS-compliant repayment allocation (Penalty→Interest→Principal→Overpayment)
 * - LoanIFRSService: IFRS 9 staging and loan portfolio management
 * - PayrollAccountingService: Simplified payroll with PAYE only (no pension)
 * - FinancialReportingService: Trial Balance, P&L, Balance Sheet, Cash Flow
 * 
 * Key Principles:
 * 1. Double-Entry: Every transaction has equal debits and credits
 * 2. Accrual Accounting: Revenue recognized when earned, not when cash received
 * 3. IFRS Compliance: IFRS 9 staging, proper allocation order, allowance method for write-offs
 * 4. Audit Trail: No deletions, only reversals with full audit trail
 * 5. Single Source of Truth: All reports derived from journal entries only
 */

// Core Accounting Engine
export { 
  AccountingEngineService, 
  accountingEngineService,
  type JournalEntry,
  type JournalLine,
  type AccountBalance
} from './AccountingEngineService';

// Interest Accrual Management
export { 
  InterestAccrualService, 
  interestAccrualService,
  type AccrualCalculation,
  type AccrualResult,
  type MonthlyAccrualResult
} from './InterestAccrualService';

// IFRS-Compliant Repayment Processing
export { 
  RepaymentServiceIFRS, 
  repaymentServiceIFRS,
  type RepaymentAllocation,
  type RepaymentResult,
  type SettlementResult
} from './RepaymentServiceIFRS';

// IFRS 9 Loan Management
export { 
  LoanIFRSService, 
  loanIFRSService,
  type IFRS9Stage,
  type LoanWithIFRS9,
  type IFRS9UpdateResult
} from './LoanIFRSService';

// Payroll Accounting (Simplified - No Pension)
export { 
  PayrollAccountingService, 
  payrollAccountingService,
  type Payslip,
  type PayrollAccrualResult,
  type PayrollSettlementResult
} from './PayrollAccountingService';

// Financial Reporting
export { 
  FinancialReportingService, 
  financialReportingService,
  type TrialBalanceRow,
  type ProfitLossRow,
  type BalanceSheetRow
} from './FinancialReportingService';

/**
 * Accounting System Configuration
 */
export const ACCOUNTING_CONFIG = {
  // IFRS 9 Staging Thresholds (Days Past Due)
  IFRS9_THRESHOLDS: {
    STAGE_1_MAX: 30,   // Performing: 0-30 days
    STAGE_2_MAX: 90,   // Under-performing: 31-90 days
    STAGE_3_MIN: 91    // Non-performing: 91+ days
  },
  
  // Repayment Allocation Order (IFRS Compliant)
  ALLOCATION_ORDER: [
    'penalty',      // 1. Clear penalties first (highest risk)
    'interest',     // 2. Recognize interest revenue
    'principal',    // 3. Reduce loan asset
    'overpayment'   // 4. Track excess as liability
  ] as const,
  
  // Settlement Timing
  SETTLEMENT: {
    MOBILE_MONEY_T_PLUS: 1,  // T+1 settlement for mobile money
  },
  
  // Interest Accrual
  INTEREST: {
    CALCULATION_FREQUENCY: 'daily',    // Calculate daily
    POSTING_FREQUENCY: 'monthly',      // Post monthly
    DAYS_IN_YEAR: 365                  // Actual/365 day count convention
  },
  
  // Validation Tolerances
  VALIDATION: {
    BALANCE_TOLERANCE: 0.01,  // 1 cent tolerance for balance checks
    ROUNDING_DECIMALS: 2       // Standard currency rounding
  }
};

/**
 * Account Codes Reference
 * Use these constants for account lookups
 */
export const ACCOUNT_CODES = {
  // Assets
  CASH_ON_HAND: 'CASH_ON_HAND',
  BANK_MAIN: 'BANK_MAIN',
  BANK_SAVINGS: 'BANK_SAVINGS',
  CLEARING_AIRTEL: 'CLEARING_AIRTEL',
  CLEARING_MPAMBA: 'CLEARING_MPAMBA',
  LOAN_PORTFOLIO: 'LOAN_PORTFOLIO',
  INTEREST_RECEIVABLE: 'INTEREST_RECEIVABLE',
  PENALTY_RECEIVABLE: 'PENALTY_RECEIVABLE',
  ALLOWANCE_LOAN_LOSSES: 'ALLOWANCE_LOAN_LOSSES',
  
  // Liabilities
  LIAB_SALARIES_PAYABLE: 'LIAB_SALARIES_PAYABLE',
  LIAB_WAGES_PAYABLE: 'LIAB_WAGES_PAYABLE',
  LIAB_PAYE: 'LIAB_PAYE',
  LIAB_OVERPAYMENTS: 'LIAB_OVERPAYMENTS',
  
  // Equity
  EQUITY_CAPITAL: 'EQUITY_CAPITAL',
  EQUITY_RETAINED_EARNINGS: 'EQUITY_RETAINED_EARNINGS',
  
  // Income
  INC_INTEREST_INCOME: 'INC_INTEREST_INCOME',
  INC_PENALTY_INCOME: 'INC_PENALTY_INCOME',
  INC_FEE_INCOME: 'INC_FEE_INCOME',
  
  // Expenses
  EXP_SALARIES: 'EXP_SALARIES',
  EXP_RENT: 'EXP_RENT',
  EXP_UTILITIES: 'EXP_UTILITIES',
  EXP_BANK_CHARGES: 'EXP_BANK_CHARGES',
  EXP_PROVISION_LOSSES: 'EXP_PROVISION_LOSSES',
  EXP_BAD_DEBT: 'EXP_BAD_DEBT'
} as const;

/**
 * Journal Entry Reference Types
 */
export const REFERENCE_TYPES = {
  LOAN_DISBURSEMENT: 'loan_disbursement',
  REPAYMENT: 'repayment',
  INTEREST_ACCRUAL: 'interest_accrual',
  SALARY_ACCRUAL: 'salary_accrual',
  SALARY_PAYMENT: 'salary_payment',
  TAX_REMITTANCE: 'tax_remittance',
  CLEARING_SETTLEMENT: 'clearing_settlement',
  WRITE_OFF: 'write_off',
  REVERSAL: 'reversal',
  ADJUSTMENT: 'adjustment',
  CAPITAL_INJECTION: 'capital_injection'
} as const;

/**
 * Helper function to format currency
 */
export function formatCurrency(amount: number, currency: string = 'MWK'): string {
  return `${currency} ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/**
 * Helper function to calculate IFRS 9 stage from DPD
 */
export function calculateIFRS9Stage(daysPastDue: number): 1 | 2 | 3 {
  if (daysPastDue <= ACCOUNTING_CONFIG.IFRS9_THRESHOLDS.STAGE_1_MAX) {
    return 1; // Performing
  } else if (daysPastDue <= ACCOUNTING_CONFIG.IFRS9_THRESHOLDS.STAGE_2_MAX) {
    return 2; // Under-performing
  } else {
    return 3; // Non-performing
  }
}

/**
 * Helper function to calculate interest (Actual/365)
 */
export function calculateInterest(
  principal: number,
  annualRate: number,
  days: number
): number {
  return Number(
    ((principal * annualRate / 100 * days) / ACCOUNTING_CONFIG.INTEREST.DAYS_IN_YEAR).toFixed(2)
  );
}

/**
 * Helper function to allocate payment (IFRS order)
 */
export function allocatePaymentIFRS(
  amount: number,
  penaltyDue: number,
  interestDue: number,
  principalDue: number
): {
  penaltyPaid: number;
  interestPaid: number;
  principalPaid: number;
  overpayment: number;
} {
  let remaining = amount;
  
  // Step 1: Penalty
  const penaltyPaid = Math.min(remaining, penaltyDue);
  remaining -= penaltyPaid;
  
  // Step 2: Interest
  const interestPaid = Math.min(remaining, interestDue);
  remaining -= interestPaid;
  
  // Step 3: Principal
  const principalPaid = Math.min(remaining, principalDue);
  remaining -= principalPaid;
  
  // Step 4: Overpayment
  const overpayment = remaining;
  
  return { penaltyPaid, interestPaid, principalPaid, overpayment };
}

/**
 * Version info
 */
export const ACCOUNTING_SYSTEM_VERSION = '2.0.0-IFRS';
export const ACCOUNTING_SYSTEM_DATE = '2026-04-13';
