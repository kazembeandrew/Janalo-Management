import { supabase } from '../lib/supabase';

/**
 * Accounting Period Management Service
 * Handles period-end closing operations and financial summaries
 */

export interface FinancialSummary {
  period: string;
  period_start: string;
  period_end: string;
  already_closed: boolean;
  summary: {
    total_income: number;
    total_expenses: number;
    net_income: number;
    profit_margin_percent: number;
  };
  income_breakdown: Array<{
    account_name: string;
    account_code: string;
    amount: number;
  }>;
  expense_breakdown: Array<{
    account_name: string;
    account_code: string;
    amount: number;
  }>;
  recommendation: string;
}

export interface ClosingResult {
  success: boolean;
  period: string;
  period_start: string;
  period_end: string;
  journal_entry_id: string;
  total_income: number;
  total_expenses: number;
  net_income: number;
  retained_earnings_account_id: string;
  message: string;
}

/**
 * Get financial summary for a given period before closing
 * @param periodDate - Any date within the target month (e.g., '2026-04-15' for April 2026)
 * @returns Financial summary with income/expense breakdown
 */
export async function getPeriodFinancialSummary(
  periodDate: string
): Promise<FinancialSummary> {
  try {
    const { data, error } = await (supabase as any).rpc('get_period_financial_summary', {
      p_period_date: periodDate
    });

    if (error) {
      console.error('Error fetching financial summary:', error);
      throw new Error(`Failed to get financial summary: ${error.message}`);
    }

    return data as FinancialSummary;
  } catch (error) {
    console.error('Exception in getPeriodFinancialSummary:', error);
    throw error;
  }
}

/**
 * Execute period-end closing to transfer net income to Retained Earnings
 * @param periodDate - Any date within the target month to close
 * @param description - Optional custom description for the closing entry
 * @returns Closing result with journal entry details
 */
export async function closeAccountingPeriod(
  periodDate: string,
  description?: string
): Promise<ClosingResult> {
  try {
    const { data, error } = await (supabase as any).rpc('close_accounting_period', {
      p_period_date: periodDate,
      p_user_id: (await (supabase as any).auth.getUser()).data.user?.id,
      p_description: description || null
    });

    if (error) {
      console.error('Error closing accounting period:', error);
      throw new Error(`Failed to close accounting period: ${error.message}`);
    }

    return data as ClosingResult;
  } catch (error) {
    console.error('Exception in closeAccountingPeriod:', error);
    throw error;
  }
}

/**
 * Validate if a period can be closed (helper function)
 * @param periodDate - Date within the target period
 * @returns Validation result with any blocking issues
 */
export async function validatePeriodClose(periodDate: string): Promise<{
  canClose: boolean;
  issues: string[];
  summary?: FinancialSummary;
}> {
  const issues: string[] = [];

  try {
    // Get financial summary first
    const summary = await getPeriodFinancialSummary(periodDate);

    // Check if already closed
    if (summary.already_closed) {
      issues.push('This period has already been closed');
      return { canClose: false, issues, summary };
    }

    // Check for transactions
    if (summary.summary.total_income === 0 && summary.summary.total_expenses === 0) {
      issues.push('No transactions found for this period (closing optional)');
      return { canClose: true, issues, summary }; // Can still close for audit trail
    }

    // Check for reasonable profit margin (warning only)
    if (summary.summary.profit_margin_percent < 0) {
      issues.push(`Warning: Net loss of ₱${Math.abs(summary.summary.net_income).toLocaleString()} for this period`);
    }

    return { canClose: true, issues, summary };
  } catch (error) {
    issues.push(`Validation error: ${(error as Error).message}`);
    return { canClose: false, issues };
  }
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format period for display (e.g., "April 2026")
 */
export function formatPeriod(periodDate: string): string {
  const date = new Date(periodDate);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long' 
  });
}

