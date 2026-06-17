import { supabase } from '../lib/supabase';
import type { JournalEntry, Loan, Repayment } from '../types/database';

/**
 * Accounting Service
 * Handles all double-entry bookkeeping operations with atomic RPC calls.
 */

export interface RepaymentResult {
  success: boolean;
  repaymentId?: number;
  journalEntryId?: number;
  error?: string;
}

export interface DisbursementResult {
  success: boolean;
  loanId?: number;
  journalEntryId?: number;
  error?: string;
}

export interface TrialBalanceCheck {
  isBalanced: boolean;
  difference: number;
  details?: any;
}

export interface ParMetrics {
  par30: number;
  par60: number;
  par90: number;
  par180: number;
  totalProvision: number;
  coverageRatio: number;
}

/**
 * Process a loan repayment atomically.
 * Creates repayment record, updates loan balance, and posts journal entries.
 */
export async function processRepayment(
  loanId: number,
  amount: number,
  paymentDate: string,
  paymentMethod: 'cash' | 'bank' | 'mobile',
  accountId: number,
  userId: string,
  notes?: string
): Promise<RepaymentResult> {
  try {
    const { data, error } = await supabase.rpc('process_repayment', {
      p_loan_id: loanId,
      p_amount: amount,
      p_payment_date: paymentDate,
      p_payment_method: paymentMethod,
      p_account_id: accountId,
      p_user_id: userId,
      p_notes: notes || null
    });

    if (error) throw error;

    return {
      success: true,
      repaymentId: data?.repayment_id,
      journalEntryId: data?.journal_entry_id
    };
  } catch (err: any) {
    console.error('Repayment processing failed:', err);
    return {
      success: false,
      error: err.message || 'Failed to process repayment'
    };
  }
}

/**
 * Disburse a loan atomically.
 * Updates loan status, creates disbursement record, and posts journal entries.
 */
export async function disburseLoan(
  loanId: number,
  disbursementDate: string,
  accountId: number,
  userId: string,
  fees?: number
): Promise<DisbursementResult> {
  try {
    const { data, error } = await supabase.rpc('disburse_loan', {
      p_loan_id: loanId,
      p_disbursement_date: disbursementDate,
      p_account_id: accountId,
      p_user_id: userId,
      p_fees: fees || 0
    });

    if (error) throw error;

    return {
      success: true,
      loanId: data?.loan_id,
      journalEntryId: data?.journal_entry_id
    };
  } catch (err: any) {
    console.error('Loan disbursement failed:', err);
    return {
      success: false,
      error: err.message || 'Failed to disburse loan'
    };
  }
}

/**
 * Bulk disburse multiple loans in a single transaction.
 * Critical for performance during batch processing.
 */
export async function bulkDisburseLoans(
  loanIds: number[],
  disbursementDate: string,
  accountId: number,
  userId: string
): Promise<{ success: boolean; processed: number; failed: number; errors?: string[] }> {
  try {
    const { data, error } = await supabase.rpc('bulk_disburse_loans', {
      p_loan_ids: loanIds,
      p_disbursement_date: disbursementDate,
      p_account_id: accountId,
      p_user_id: userId
    });

    if (error) throw error;

    return {
      success: true,
      processed: data?.processed_count || 0,
      failed: data?.failed_count || 0,
      errors: data?.errors || []
    };
  } catch (err: any) {
    console.error('Bulk disbursement failed:', err);
    return {
      success: false,
      processed: 0,
      failed: loanIds.length,
      errors: [err.message]
    };
  }
}

/**
 * Verify trial balance for a specific date.
 * Returns true if debits == credits.
 */
export async function verifyTrialBalance(date: string): Promise<TrialBalanceCheck> {
  try {
    const { data, error } = await supabase.rpc('verify_trial_balance', {
      p_date: date
    });

    if (error) throw error;

    return {
      isBalanced: data?.is_balanced || false,
      difference: data?.difference || 0,
      details: data
    };
  } catch (err: any) {
    console.error('Trial balance verification failed:', err);
    return {
      isBalanced: false,
      difference: 0,
      details: { error: err.message }
    };
  }
}

/**
 * Calculate PAR (Portfolio at Risk) metrics.
 * Triggers the provisioning calculation function.
 */
export async function calculateParMetrics(): Promise<ParMetrics | null> {
  try {
    // First, run the provisioning calculation
    const { error: calcError } = await supabase.rpc('calculate_par_and_provision');
    if (calcError) throw calcError;

    // Then fetch the aggregated metrics
    const { data, error } = await supabase
      .from('loan_portfolios')
      .select('par_30, par_60, par_90, par_180, total_provision, coverage_ratio')
      .single();

    if (error) throw error;

    return {
      par30: data?.par_30 || 0,
      par60: data?.par_60 || 0,
      par90: data?.par_90 || 0,
      par180: data?.par_180 || 0,
      totalProvision: data?.total_provision || 0,
      coverageRatio: data?.coverage_ratio || 0
    };
  } catch (err: any) {
    console.error('PAR calculation failed:', err);
    return null;
  }
}

/**
 * Get chart of accounts with balances.
 */
export async function getChartOfAccounts() {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select(`
        *,
        account_balances (
          balance,
          last_updated
        )
      `)
      .order('code');

    if (error) throw error;
    return data || [];
  } catch (err: any) {
    console.error('Failed to fetch chart of accounts:', err);
    return [];
  }
}

/**
 * Post a manual journal entry (for adjustments).
 */
export async function postManualJournalEntry(
  date: string,
  description: string,
  lines: Array<{
    accountId: number;
    debit: number;
    credit: number;
  }>,
  userId: string
): Promise<{ success: boolean; entryId?: number; error?: string }> {
  try {
    // Validate balanced entry
    const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return {
        success: false,
        error: `Journal entry not balanced. Debit: ${totalDebit}, Credit: ${totalCredit}`
      };
    }

    const { data, error } = await supabase.rpc('create_journal_entry', {
      p_date: date,
      p_description: description,
      p_lines: lines,
      p_user_id: userId,
      p_reference_type: 'manual',
      p_reference_id: null
    });

    if (error) throw error;

    return {
      success: true,
      entryId: data?.entry_id
    };
  } catch (err: any) {
    console.error('Manual journal entry failed:', err);
    return {
      success: false,
      error: err.message
    };
  }
}
