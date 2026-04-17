import { supabase } from '@/integrations/supabase/client';
import Decimal from 'decimal.js';

export interface JournalLine {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface JournalEntry {
  id: string;
  referenceNumber: string;
  referenceType: string;
  referenceId?: string;
  transactionDate: string;
  postingDate: string;
  description: string;
  status: 'draft' | 'posted' | 'reversed';
  createdBy: string;
  lines: JournalLine[];
  createdAt: string;
  postedAt?: string;
  reversedAt?: string;
  reversalReason?: string;
}

export interface AccountBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  category: string;
  debitBalance: number;
  creditBalance: number;
  netBalance: number;
}

/**
 * AccountingEngineService - Central accounting service for IFRS-compliant double-entry bookkeeping
 * 
 * Core responsibilities:
 * - Post journal entries with strict double-entry validation
 * - Reverse entries (audit-safe, no deletions)
 * - Validate accounting integrity (Debits = Credits)
 * - Recalculate account balances from journal entries
 * - Generate financial reports derived from journal entries only
 */
export class AccountingEngineService {

  /**
   * Post a journal entry with double-entry validation
   * 
   * @param input - Journal entry data
   * @returns JournalEntry with ID
   * @throws Error if validation fails
   */
  async postJournalEntry(input: {
    referenceType: string;
    referenceId?: string;
    date: string;
    description: string;
    lines: JournalLine[];
    createdBy: string;
  }): Promise<JournalEntry> {
    
    // 1. Validate double-entry principle
    this.validateDoubleEntry(input.lines);
    
    // 2. Validate that all accounts exist and are active
    await this.validateAccounts(input.lines);
    
    // 3. Generate reference number
    const referenceNumber = await this.generateReferenceNumber(input.referenceType);
    
    // 4. Post via atomic database function
    const { data, error } = await supabase.rpc('create_journal_entry_atomic', {
      p_reference_type: input.referenceType,
      p_reference_id: input.referenceId,
      p_transaction_date: input.date,
      p_description: input.description,
      p_reference_number: referenceNumber,
      p_created_by: input.createdBy,
      p_lines: input.lines.map((line, idx) => ({
        account_id: line.accountId,
        debit: line.debit,
        credit: line.credit,
        description: line.description || '',
        line_order: idx + 1
      }))
    });
    
    if (error) {
      throw new Error(`Failed to post journal entry: ${error.message}`);
    }
    
    if (!data || !data.success) {
      throw new Error(data?.error || 'Failed to post journal entry');
    }
    
    return data.journal_entry as JournalEntry;
  }

  /**
   * Validate double-entry accounting principle
   * Total Debits must equal Total Credits
   * Must have at least one debit and one credit
   * 
   * @param lines - Journal lines to validate
   * @throws Error if unbalanced
   */
  validateDoubleEntry(lines: JournalLine[]): void {
    const totalDebits = lines.reduce(
      (sum, line) => sum.add(new Decimal(line.debit)), 
      new Decimal(0)
    );
    
    const totalCredits = lines.reduce(
      (sum, line) => sum.add(new Decimal(line.credit)), 
      new Decimal(0)
    );
    
    // Check balance
    if (!totalDebits.equals(totalCredits)) {
      const diff = totalDebits.minus(totalCredits);
      throw new Error(
        `Unbalanced journal entry: Debits (${totalDebits.toString()}) ≠ Credits (${totalCredits.toString()}). Difference: ${diff.toString()}`
      );
    }
    
    // Check for zero-value entry
    if (totalDebits.isZero()) {
      throw new Error('Journal entry cannot have zero total value');
    }
    
    // Check for at least one debit and one credit
    const hasDebit = lines.some(l => l.debit > 0);
    const hasCredit = lines.some(l => l.credit > 0);
    
    if (!hasDebit || !hasCredit) {
      throw new Error('Journal entry must have at least one debit and one credit');
    }
    
    // Validate individual lines
    lines.forEach((line, index) => {
      if (line.debit < 0 || line.credit < 0) {
        throw new Error(`Line ${index + 1}: Debit and credit amounts cannot be negative`);
      }
      
      if (line.debit > 0 && line.credit > 0) {
        throw new Error(`Line ${index + 1}: Cannot have both debit and credit on same line`);
      }
      
      if (line.debit === 0 && line.credit === 0) {
        throw new Error(`Line ${index + 1}: Line must have either debit or credit`);
      }
    });
  }

  /**
   * Validate that all accounts exist and are active
   */
  private async validateAccounts(lines: JournalLine[]): Promise<void> {
    const accountIds = [...new Set(lines.map(l => l.accountId))];
    
    const { data: accounts, error } = await supabase
      .from('internal_accounts')
      .select('id, account_code, name, is_active')
      .in('id', accountIds);
    
    if (error) {
      throw new Error(`Failed to validate accounts: ${error.message}`);
    }
    
    if (!accounts || accounts.length !== accountIds.length) {
      const foundIds = new Set(accounts?.map(a => a.id) || []);
      const missingIds = accountIds.filter(id => !foundIds.has(id));
      throw new Error(`Invalid account IDs: ${missingIds.join(', ')}`);
    }
    
    const inactiveAccounts = accounts.filter(a => !a.is_active);
    if (inactiveAccounts.length > 0) {
      throw new Error(
        `Inactive accounts cannot be used: ${inactiveAccounts.map(a => a.account_code).join(', ')}`
      );
    }
  }

  /**
   * Reverse a posted journal entry
   * Creates a reversing entry with opposite debits/credits
   * Original entry remains intact for audit trail
   * 
   * @param entryId - Journal entry to reverse
   * @param reason - Reason for reversal
   * @param reversedBy - User ID reversing the entry
   * @returns Reversing journal entry
   */
  async reverseEntry(
    entryId: string, 
    reason: string, 
    reversedBy: string
  ): Promise<JournalEntry> {
    
    // 1. Get original entry
    const { data: original, error: fetchError } = await supabase
      .from('journal_entries')
      .select(`
        *,
        lines:journal_lines(*)
      `)
      .eq('id', entryId)
      .single();
    
    if (fetchError || !original) {
      throw new Error(`Journal entry not found: ${entryId}`);
    }
    
    if (original.status !== 'posted') {
      throw new Error(`Cannot reverse entry with status: ${original.status}. Only posted entries can be reversed.`);
    }
    
    if (original.reversed_at) {
      throw new Error('Journal entry has already been reversed');
    }
    
    // 2. Create reversing lines (swap debits/credits)
    const reversingLines: JournalLine[] = original.lines.map((line: any) => ({
      accountId: line.account_id,
      debit: line.credit, // Swap
      credit: line.debit, // Swap
      description: `Reversal of ${original.reference_number}: ${line.description || ''}`
    }));
    
    // 3. Post reversing entry
    const reversingEntry = await this.postJournalEntry({
      referenceType: 'reversal',
      referenceId: entryId,
      date: new Date().toISOString().split('T')[0],
      description: `Reversal of ${original.reference_number}: ${original.description}. Reason: ${reason}`,
      lines: reversingLines,
      createdBy: reversedBy
    });
    
    // 4. Mark original as reversed
    const { error: updateError } = await supabase
      .from('journal_entries')
      .update({
        reversed_at: new Date().toISOString(),
        reversed_by: reversedBy,
        reversal_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', entryId);
    
    if (updateError) {
      throw new Error(`Failed to mark entry as reversed: ${updateError.message}`);
    }
    
    return reversingEntry;
  }

  /**
   * Get account balance calculated from journal entries
   * All balances derived from journal entries (single source of truth)
   * 
   * @param accountId - Account ID
   * @param asOfDate - Balance as of date (default: today)
   * @returns Net balance
   */
  async getAccountBalance(
    accountId: string, 
    asOfDate?: string
  ): Promise<number> {
    const date = asOfDate || new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase.rpc('get_account_balance', {
      p_account_id: accountId,
      p_as_of_date: date
    });
    
    if (error) {
      throw new Error(`Failed to get account balance: ${error.message}`);
    }
    
    return data || 0;
  }

  /**
   * Recalculate account balances from journal entries
   * Use this to ensure balances are in sync with journal
   * 
   * @param accountId - Specific account (optional, null = all accounts)
   */
  async recalculateBalances(accountId?: string): Promise<void> {
    const { error } = await supabase.rpc('recalculate_all_balances', {
      p_account_id: accountId || null
    });
    
    if (error) {
      throw new Error(`Failed to recalculate balances: ${error.message}`);
    }
  }

  /**
   * Generate reference number based on transaction type
   */
  private async generateReferenceNumber(type: string): Promise<string> {
    const prefixes: Record<string, string> = {
      'loan_disbursement': 'DISB',
      'repayment': 'REP',
      'interest_accrual': 'ACCR',
      'salary_accrual': 'PAY',
      'write_off': 'WO',
      'clearing_settlement': 'SETTLE',
      'reversal': 'REV',
      'adjustment': 'ADJ',
      'capital_injection': 'CAP',
      'expense': 'EXP'
    };
    
    const prefix = prefixes[type] || 'JE';
    
    const { data, error } = await supabase.rpc('generate_sequence_number', {
      p_prefix: prefix
    });
    
    if (error || !data) {
      // Fallback to timestamp-based
      return `${prefix}-${Date.now()}`;
    }
    
    return `${prefix}-${data.sequence}`;
  }

  /**
   * Generate Trial Balance
   * All accounts with debit/credit balances
   * Total Debits should equal Total Credits
   * 
   * @param asOfDate - Date for balance calculation
   * @returns Trial balance rows
   */
  async generateTrialBalance(asOfDate?: string): Promise<AccountBalance[]> {
    const date = asOfDate || new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase.rpc('get_trial_balance', {
      p_as_of_date: date
    });
    
    if (error) {
      throw new Error(`Failed to generate trial balance: ${error.message}`);
    }
    
    return (data || []) as AccountBalance[];
  }

  /**
   * Validate that trial balance reconciles (Debits = Credits)
   * 
   * @param asOfDate - Date to validate
   * @returns Validation result with totals
   */
  async validateTrialBalance(asOfDate?: string): Promise<{
    reconciles: boolean;
    totalDebits: number;
    totalCredits: number;
    difference: number;
  }> {
    const trialBalance = await this.generateTrialBalance(asOfDate);
    
    const totalDebits = trialBalance.reduce((sum, row) => sum + (row.debitBalance || 0), 0);
    const totalCredits = trialBalance.reduce((sum, row) => sum + (row.creditBalance || 0), 0);
    const difference = Math.abs(totalDebits - totalCredits);
    
    return {
      reconciles: difference < 0.01,
      totalDebits,
      totalCredits,
      difference
    };
  }

  /**
   * Get all accounts
   */
  async getAccounts(): Promise<any[]> {
    const { data, error } = await supabase
      .from('internal_accounts')
      .select('*')
      .eq('is_active', true)
      .order('account_code');
    
    if (error) {
      throw new Error(`Failed to fetch accounts: ${error.message}`);
    }
    
    return data || [];
  }

  /**
   * Get account by code
   */
  async getAccountByCode(code: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('internal_accounts')
      .select('*')
      .eq('account_code', code)
      .single();
    
    if (error) {
      return null;
    }
    
    return data;
  }
}

// Export singleton instance
export const accountingEngineService = new AccountingEngineService();
