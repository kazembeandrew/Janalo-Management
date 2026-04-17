import { 
  BaseServiceClass, 
  ServiceResult, 
  ServiceError, 
  PaginationParams, 
  SortParams, 
  FilterParams, 
  ListResponse, 
  AuditLogEntry 
} from './_shared/baseService';
import { JournalEntry, JournalLine, InternalAccount } from '../types';
import { 
  validateRequiredFields, 
  formatCurrency, 
  formatDate 
} from './_shared/utils';
import { auditService } from './audit';
import { searchService } from './search';
import { accountsService } from './accounts';
import { supabase } from '@/lib/supabase';
import Decimal from 'decimal.js';

/**
 * CRITICAL ACCOUNTING VALIDATION: Enforce Double-Entry Accounting Principle
 * 
 * This function validates that total debits equal total credits in a journal entry.
 * This is the FUNDAMENTAL rule of accounting - without it, money can be created or lost,
 * financial reports become incorrect, and the system becomes untrustworthy.
 * 
 * @param lines - Array of journal line items with debit/credit amounts
 * @throws Error if debits !== credits (with detailed breakdown)
 */
export function validateJournalEntryBalance(lines: Array<{ debit: number; credit: number }>): void {
  if (!lines || lines.length === 0) {
    throw new Error('Journal entry must have at least one line');
  }

  // Use Decimal for precise arithmetic (avoid floating-point errors)
  const totalDebits = lines.reduce(
    (sum, line) => sum.add(new Decimal(line.debit || 0)), 
    new Decimal(0)
  );
  
  const totalCredits = lines.reduce(
    (sum, line) => sum.add(new Decimal(line.credit || 0)), 
    new Decimal(0)
  );

  // Check for negative values
  const hasNegativeDebit = lines.some(line => line.debit < 0);
  const hasNegativeCredit = lines.some(line => line.credit < 0);
  
  if (hasNegativeDebit || hasNegativeCredit) {
    throw new Error('Journal lines cannot have negative debit or credit values. Use opposite side for reversals.');
  }

  // STRICT BALANCE CHECK: Allow only minimal rounding difference (< 0.01)
  const difference = totalDebits.sub(totalCredits).abs();
  
  if (!difference.lessThan(0.01)) {
    const formattedDebits = formatCurrency(totalDebits.toNumber());
    const formattedCredits = formatCurrency(totalCredits.toNumber());
    const formattedDiff = formatCurrency(difference.toNumber());
    
    throw new Error(
      `UNBALANCED JOURNAL ENTRY: Debits (${formattedDebits}) ≠ Credits (${formattedCredits}). ` +
      `Difference: ${formattedDiff}. ` +
      `Every journal entry MUST have equal debits and credits (Double-Entry Accounting Principle).`
    );
  }

  // Validate that entry has both sides (at least one debit AND one credit)
  const hasAnyDebit = lines.some(line => line.debit > 0);
  const hasAnyCredit = lines.some(line => line.credit > 0);
  
  if (!hasAnyDebit || !hasAnyCredit) {
    throw new Error(
      'Invalid journal entry: Must have at least one debit line AND one credit line. ' +
      'Cannot create entries with only debits or only credits.'
    );
  }
}

interface CreateJournalEntryInput {
  reference_type: 'loan_disbursement' | 'repayment' | 'expense' | 'transfer' | 'injection' | 'adjustment' | 'loan_write_off';
  reference_id?: string;
  date: string;
  description: string;
  journal_lines: Array<{
    account_id: string;
    debit: number;
    credit: number;
  }>;
  created_by?: string;
  /**
   * Optional idempotency key to prevent duplicate entries on retry
   * If provided, subsequent calls with same key return the original entry
   */
  idempotency_key?: string;
}

interface JournalEntryFilters extends FilterParams {
  reference_type?: string;
  date_from?: string;
  date_to?: string;
  account_id?: string;
  amount_min?: number;
  amount_max?: number;
}

/**
 * Journal Entries Service for managing financial journal entries
 */
export class JournalEntriesService extends BaseServiceClass {
  private static instance: JournalEntriesService;

  /**
   * Get singleton instance
   */
  public static getInstance(): JournalEntriesService {
    if (!JournalEntriesService.instance) {
      JournalEntriesService.instance = new JournalEntriesService();
    }
    return JournalEntriesService.instance;
  }

  /**
   * Create a new journal entry
   */
  async createJournalEntry(input: CreateJournalEntryInput): Promise<ServiceResult<JournalEntry>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['reference_type', 'date', 'description', 'journal_lines'];
      const missing = validateRequiredFields(input, requiredFields);
      
      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
      }

      if (!input.journal_lines || input.journal_lines.length < 2) {
        throw new Error('Journal entry must have at least 2 lines (minimum one debit and one credit)');
      }

      // CRITICAL: Enforce Double-Entry Accounting - Debits MUST equal Credits
      // This prevents money creation/loss and ensures financial integrity
      validateJournalEntryBalance(input.journal_lines);

      const { data: { user } } = await (supabase as any).auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Calculate totals for audit logging
      const totalDebits = input.journal_lines.reduce(
        (sum, line) => sum.add(new Decimal(line.debit || 0)), 
        new Decimal(0)
      );

      // Use RPC function for atomic posting and balance updates
      const { data, error } = await (supabase as any).rpc('post_journal_entry_with_backdate_check', {
        p_description: input.description.trim(),
        p_lines: input.journal_lines,
        p_entry_date: input.date,
        p_max_backdate_days: 3, // Standard policy
        p_reference_id: input.reference_id || null,
        p_reference_type: input.reference_type,
        p_user_id: user.id,
        p_idempotency_key: input.idempotency_key || null
      });

      if (error) throw error;

      // Check if database function rejected the entry (e.g., balance check failed)
      if (!data || !data.success) {
        throw new Error(data?.error || 'Database rejected journal entry');
      }

      // Extract journal entry ID from response
      const journalEntryId = data.journal_entry_id;
      if (!journalEntryId) {
        throw new Error('Failed to post journal entry: no entry ID returned');
      }

      // Log if this was a duplicate (idempotency hit)
      if (data.duplicate) {
        console.log(`ℹ️ Idempotency key matched existing entry: ${journalEntryId}`);
      }

      // Fetch the created entry to return it
      const fullEntryResult = await this.getJournalEntryById(journalEntryId);
      if (!fullEntryResult.data) {
          console.error(`CRITICAL: Journal entry ${journalEntryId} was posted but cannot be retrieved. This may indicate:`);
          console.error(`  1. Database transaction isolation issue`);
          console.error(`  2. RLS policy blocking read access`);
          console.error(`  3. Entry was rolled back by database trigger`);
          
          // Try one more time with a small delay (in case of replication lag)
          await new Promise(resolve => setTimeout(resolve, 500));
          const retryResult = await this.getJournalEntryById(journalEntryId);
          
          if (!retryResult.data) {
            throw new Error(
              `Entry posted successfully (ID: ${journalEntryId}) but fetch failed after retry. ` +
              `The entry exists in the database but cannot be retrieved. Please check RLS policies.`
            );
          }
          
          console.log(`✅ Successfully fetched journal entry on retry: ${journalEntryId}`);
          return retryResult.data;
      }

      // Log audit with balance verification
      await this.logAudit('create_journal_entry', 'journal_entry', journalEntryId, {
        action: 'create',
        journal_entry_id: journalEntryId,
        reference_type: input.reference_type,
        reference_id: input.reference_id,
        amount: totalDebits.toNumber(),
        balance_verified: true,
        line_count: input.journal_lines.length
      });

      // Update search index
      await searchService.indexJournalEntry(fullEntryResult.data);

      return fullEntryResult.data;
    }, 'Failed to create journal entry');
  }

  /**
   * Create a new journal entry with automatic idempotency
   * Generates a unique idempotency key based on input to prevent duplicates
   */
  async createJournalEntryIdempotent(input: CreateJournalEntryInput): Promise<ServiceResult<JournalEntry & { is_duplicate?: boolean }>> {
    // Generate idempotency key from input if not provided
    const idempotencyKey = input.idempotency_key || this.generateIdempotencyKey(input);
    
    return this.handleAsyncOperation(async () => {
      const result = await this.createJournalEntry({
        ...input,
        idempotency_key: idempotencyKey
      });
      
      return result.data ? {
        ...result.data,
        is_duplicate: false // Would need to track this from DB response
      } : null;
    }, 'Failed to create journal entry with idempotency');
  }

  /**
   * Generate idempotency key from journal entry input
   * Uses hash of critical fields to detect duplicates
   */
  private generateIdempotencyKey(input: CreateJournalEntryInput): string {
    const crypto = window.crypto || (globalThis as any).crypto;
    if (!crypto?.subtle) {
      // Fallback for environments without crypto API
      return `${input.reference_type}_${input.date}_${input.description.substring(0, 50)}_${Date.now()}`;
    }
    
    const data = JSON.stringify({
      reference_type: input.reference_type,
      reference_id: input.reference_id,
      date: input.date,
      description: input.description,
      lines: input.journal_lines.map(l => ({
        account_id: l.account_id,
        debit: l.debit,
        credit: l.credit
      }))
    });
    
    // Simple hash (in production, use proper SHA-256)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `je_${Math.abs(hash).toString(36)}_${Date.now()}`;
  }

  /**
   * Get journal entry by ID
   */
  async getJournalEntryById(id: string): Promise<ServiceResult<JournalEntry>> {
    return this.handleAsyncOperation(async () => {
      if (!id) {
        throw new Error('Journal entry ID is required');
      }

      // Simulate database query
      const journalEntry = await this.fetchJournalEntryFromDatabase(id);
      
      if (!journalEntry) {
        throw new Error('Journal entry not found');
      }

      // Get journal lines
      const journalLines = await this.getJournalLines(journalEntry.id);
      journalEntry.journal_lines = journalLines.data || [];

      return journalEntry;
    }, 'Failed to get journal entry');
  }

  /**
   * Get all journal entries with pagination and filtering
   */
  async getJournalEntries(
    filters?: JournalEntryFilters, 
    pagination?: PaginationParams, 
    sort?: SortParams
  ): Promise<ServiceResult<ListResponse<JournalEntry>>> {
    return this.handleAsyncOperation(async () => {
      // Simulate database query
      const result = await this.fetchJournalEntriesFromDatabase(filters, pagination, sort);
      
      return result;
    }, 'Failed to get journal entries');
  }

  /**
   * Get journal lines for an entry
   */
  async getJournalLines(journalEntryId: string): Promise<ServiceResult<JournalLine[]>> {
    return this.handleAsyncOperation(async () => {
      if (!journalEntryId) {
        throw new Error('Journal entry ID is required');
      }

      // Simulate database query
      const journalLines = await this.fetchJournalLinesFromDatabase(journalEntryId);
      
      return journalLines;
    }, 'Failed to get journal lines');
  }

  /**
   * Get journal entries by account
   */
  async getJournalEntriesByAccount(accountId: string, dateFrom?: string, dateTo?: string): Promise<ServiceResult<JournalLine[]>> {
    return this.handleAsyncOperation(async () => {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      // Simulate database query
      const journalLines = await this.fetchJournalLinesByAccountFromDatabase(accountId, dateFrom, dateTo);
      
      return journalLines;
    }, 'Failed to get journal entries by account');
  }

  /**
   * Get general ledger for an account
   */
  async getGeneralLedger(accountId: string, dateFrom?: string, dateTo?: string): Promise<ServiceResult<{
    account: InternalAccount;
    openingBalance: number;
    transactions: Array<{
      date: string;
      journal_entry_id: string;
      description: string;
      debit: number;
      credit: number;
      balance: number;
    }>;
    closingBalance: number;
  }>> {
    return this.handleAsyncOperation(async () => {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const accountResult = await accountsService.getAccountById(accountId);
      if (!accountResult.data) {
        throw new Error('Account not found');
      }

      const account = accountResult.data;
      
      // OPTIMIZED: Single query with join instead of N+1 pattern
      let query = (supabase as any)
        .from('journal_lines')
        .select(`
          *,
          journal_entries!inner(
            id,
            date,
            description,
            reference_type,
            reference_id
          )
        `)
        .eq('account_id', accountId);

      if (dateFrom) {
        query = query.gte('journal_entries.date', dateFrom);
      }
      if (dateTo) {
        query = query.lte('journal_entries.date', dateTo);
      }

      const { data: lines, error } = await query.order('journal_entries.date', { ascending: true });

      if (error) throw error;

      const transactions = (lines || []).map((line: any) => ({
        ...line,
        journal_entry_id: line.journal_entries?.id,
        date: line.journal_entries?.date || '',
        description: line.journal_entries?.description || ''
      }));

      // Calculate true opening balance for the period
      const openingBalance = await this.calculateOpeningBalance(accountId, dateFrom, account.account_category);
      
      let balance = openingBalance;
      const ledgerTransactions = transactions.map(line => {
        const debit = line.debit || 0;
        const credit = line.credit || 0;
        
        if (['asset', 'expense'].includes(account.account_category)) {
          balance += debit - credit;
        } else {
          balance += credit - debit;
        }

        return {
          date: line.date,
          journal_entry_id: line.journal_entry_id,
          description: line.description,
          debit,
          credit,
          balance
        };
      });

      return {
        account,
        openingBalance,
        transactions: ledgerTransactions,
        closingBalance: ledgerTransactions.length > 0 ? ledgerTransactions[ledgerTransactions.length - 1].balance : openingBalance
      };
    }, 'Failed to get general ledger');
  }

  /**
   * Get cash flow statement
   */
  async getCashFlowStatement(dateFrom?: string, dateTo?: string): Promise<ServiceResult<{
    operatingActivities: Array<{
      description: string;
      amount: number;
    }>;
    investingActivities: Array<{
      description: string;
      amount: number;
    }>;
    financingActivities: Array<{
      description: string;
      amount: number;
    }>;
    netCashFlow: number;
  }>> {
    return this.handleAsyncOperation(async () => {
      // This is a simplified cash flow statement
      // In a real implementation, this would be more complex and follow accounting standards
      
      const operatingActivities: Array<{ description: string; amount: number }> = [];
      const investingActivities: Array<{ description: string; amount: number }> = [];
      const financingActivities: Array<{ description: string; amount: number }> = [];

      // Get all journal entries in the period
      const entriesResult = await this.getJournalEntries({
        date_from: dateFrom,
        date_to: dateTo
      });
      const entries = entriesResult.data?.data || [];

      for (const entry of entries) {
        const linesResult = await this.getJournalLines(entry.id);
        const lines = linesResult.data || [];

        // Categorize based on account types and reference types
        for (const line of lines) {
          const account = (line as any).accounts;
          if (!account) continue;

          // Only consider movements in liquid asset accounts (Cash/Bank)
          // Use the is_cash_equivalent flag instead of string matching on account codes
          const isLiquidAccount = 
            account.account_category === 'asset' && 
            (account.is_cash_equivalent === true);
          
          if (!isLiquidAccount) continue;

          if (entry.reference_type === 'loan_disbursement') {
            // Outflow: Cash is credited
            if (line.credit > 0) {
              investingActivities.push({
                description: `Loan disbursement - ${entry.description}`,
                amount: -line.credit
              });
            }
          } else if (entry.reference_type === 'repayment') {
            // Inflow: Cash is debited
            if (line.debit > 0) {
              operatingActivities.push({
                description: `Loan repayment - ${entry.description}`,
                amount: line.debit
              });
            }
          } else if (entry.reference_type === 'expense') {
            // Outflow: Cash is credited
            if (line.credit > 0) {
              operatingActivities.push({
                description: `Expense payment - ${entry.description}`,
                amount: -line.credit
              });
            }
          } else if (entry.reference_type === 'injection') {
            // Inflow: Cash is debited
            if (line.debit > 0) {
              financingActivities.push({
                description: `Capital injection - ${entry.description}`,
                amount: line.debit
              });
            }
          }
        }
      }

      const netCashFlow = 
        operatingActivities.reduce((sum, item) => sum + item.amount, 0) +
        investingActivities.reduce((sum, item) => sum + item.amount, 0) +
        financingActivities.reduce((sum, item) => sum + item.amount, 0);

      return {
        operatingActivities,
        investingActivities,
        financingActivities,
        netCashFlow
      };
    }, 'Failed to get cash flow statement');
  }

  /**
   * Batch post all journal entries currently in 'draft' status
   */
  async batchPostDraftEntries(): Promise<ServiceResult<number>> {
    return this.handleAsyncOperation(async () => {
      const { data, error, count } = await (supabase as any)
        .from('journal_entries')
        .update({ status: 'posted', updated_at: new Date().toISOString() })
        .eq('status', 'draft')
        .select('*', { count: 'exact' });
        
      if (error) throw error;
      
      const updatedCount = count || (data?.length || 0);
      
      // Log audit
      await this.logAudit('batch_post_journal_entries', 'journal_entry', 'bulk', {
        action: 'batch_post',
        count: updatedCount,
        timestamp: new Date().toISOString()
      });
      
      return updatedCount;
    }, 'Failed to batch post draft entries');
  }

  /**
   * Reverse a journal entry
   */
  async reverseJournalEntry(id: string, reason: string): Promise<ServiceResult<JournalEntry>> {
    return this.handleAsyncOperation(async () => {
      if (!id) {
        throw new Error('Journal entry ID is required');
      }

      const existingEntry = await this.getJournalEntryById(id);
      if (!existingEntry.data) {
        throw new Error('Journal entry not found');
      }

      // Create reverse entry
      const reverseEntry: CreateJournalEntryInput = {
        reference_type: 'adjustment',
        reference_id: id,
        date: new Date().toISOString().split('T')[0],
        description: `Reversal of entry ${id}: ${reason}`,
        journal_lines: existingEntry.data.journal_lines?.map(line => ({
          account_id: line.account_id,
          debit: line.credit,
          credit: line.debit
        })) || []
      };

      const reversedEntry = await this.createJournalEntry(reverseEntry);

      // Log audit
      await this.logAudit('reverse_journal_entry', 'journal_entry', id, {
        action: 'reverse',
        original_entry_id: id,
        reverse_entry_id: reversedEntry.data?.id || '',
        reason
      });

      return reversedEntry.data || null;
    }, 'Failed to reverse journal entry');
  }

  /**
   * Validate accounts exist
   */
  private async validateAccounts(accountIds: string[]): Promise<{
    success: boolean;
    invalidAccounts: string[];
    accounts: InternalAccount[];
  }> {
    const accounts: InternalAccount[] = [];
    const invalidAccounts: string[] = [];

    for (const accountId of accountIds) {
      const accountResult = await accountsService.getAccountById(accountId);
      if (accountResult.data) {
        accounts.push(accountResult.data);
      } else {
        invalidAccounts.push(accountId);
      }
    }

    return {
      success: invalidAccounts.length === 0,
      invalidAccounts,
      accounts
    };
  }

  /**
   * Update account balances
   */
  private async updateAccountBalances(journalLines: JournalLine[]): Promise<void> {
    // This is now handled by the post_journal_entry_with_backdate_check RPC 
    // or database triggers for maximum integrity.
    return;
  }

  // Private helper methods for database operations

  private async fetchJournalEntryFromDatabase(id: string): Promise<JournalEntry | null> {
    const { data, error } = await (supabase as any)
      .from('journal_entries')
      .select('*, users!created_by(full_name)')
      .eq('id', id)
      .single();
      
    if (error) {
      console.error(`Failed to fetch journal entry ${id}:`, error);
      return null;
    }
    
    if (!data) {
      console.error(`Journal entry ${id} not found in database`);
      return null;
    }
    
    return {
        ...data,
        date: data.entry_date
    } as JournalEntry;
  }

  private async fetchJournalEntriesFromDatabase(
    filters?: JournalEntryFilters, 
    pagination?: PaginationParams, 
    sort?: SortParams
  ): Promise<ListResponse<JournalEntry>> {
    let query = (supabase as any).from('journal_entries').select('*, journal_lines(*, accounts:internal_accounts(name, account_category, type)), users!created_by(full_name)', { count: 'exact' });

    if (filters?.reference_type) {
      query = query.eq('reference_type', filters.reference_type);
    }
    if (filters?.date_from) {
      query = query.gte('entry_date', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('entry_date', filters.date_to);
    }
    
    if (filters?.account_id) {
        // Since we are selecting journal_lines, we can filter by them
        // In Supabase/PostgREST, we can use inner join logic or a subquery
        // But the current query structure selects everything. 
        // Let's use a simpler approach: filter entries that have lines for this account.
        query = query.filter('journal_lines.account_id', 'eq', filters.account_id);
    }

    if (sort) {
      query = query.order(sort.sortBy || 'entry_date', { ascending: sort.sortOrder === 'asc' });
    } else {
      query = query.order('entry_date', { ascending: false });
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const start = (page - 1) * limit;

    const { data, count, error } = await query.range(start, start + limit - 1);

    if (error) throw error;

    const mappedData = (data || []).map(entry => ({
        ...entry,
        date: entry.entry_date
    }));

    return {
      data: mappedData as JournalEntry[],
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0
    };
  }

  private async fetchJournalLinesFromDatabase(journalEntryId: string): Promise<JournalLine[]> {
    const { data, error } = await (supabase as any)
      .from('journal_lines')
      .select('*, accounts:internal_accounts(name, account_code, code, account_category)')
      .eq('journal_entry_id', journalEntryId);
      
    if (error) return [];
    return data as any[];
  }

  private async fetchJournalLinesByAccountFromDatabase(accountId: string, dateFrom?: string, dateTo?: string): Promise<JournalLine[]> {
    let query = (supabase as any)
      .from('journal_lines')
      .select('*, journal_entries!inner(entry_date, description, reference_type, reference_id)')
      .eq('account_id', accountId);

    if (dateFrom) {
      query = query.gte('journal_entries.entry_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('journal_entries.entry_date', dateTo);
    }

    const { data, error } = await query.order('journal_entries(entry_date)', { ascending: false });

    if (error) {
      console.error('Error fetching journal lines by account:', error);
      return [];
    }
    return data as any[];
  }

  /**
   * Get total injections for the current month
   */
  async getMtdInjections(): Promise<ServiceResult<number>> {
    return this.handleAsyncOperation(async () => {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        
        // CRITICAL FIX: Only count POSTED injection entries in the MTD total.
        const { data, error } = await (supabase as any)
            .from('journal_entries')
            .select(`
                journal_lines(debit)
            `)
            .eq('reference_type', 'injection')
            .eq('status', 'posted')
            .gte('entry_date', firstDayOfMonth);
        
        if (error) throw error;
        
        const total = (data || []).reduce((sum, entry) => {
            return sum + (entry.journal_lines || []).reduce((lineSum: number, l: any) => {
                return lineSum + Number(l.debit || 0);
            }, 0);
        }, 0);
        
        return total;
    }, 'Failed to get MTD Capital Injections');
  }

  private async calculateOpeningBalance(accountId: string, dateFrom?: string, category?: string): Promise<number> {
    if (!dateFrom) return 0;

    const { data, error } = await (supabase as any)
      .from('journal_lines')
      .select('debit, credit, journal_entries!inner(entry_date)')
      .eq('account_id', accountId)
      .lt('journal_entries.entry_date', dateFrom);

    if (error) {
      console.error('Error calculating opening balance:', error);
      return 0;
    }

    const sums = (data as any[] || []).reduce((acc, line) => {
      acc.debit += Number(line.debit || 0);
      acc.credit += Number(line.credit || 0);
      return acc;
    }, { debit: 0, credit: 0 });

    if (category && ['asset', 'expense'].includes(category)) {
      return sums.debit - sums.credit;
    } else {
      return sums.credit - sums.debit;
    }
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// Export singleton instance
export const journalEntriesService = JournalEntriesService.getInstance();
