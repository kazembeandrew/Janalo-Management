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
import { InternalAccount, JournalEntry, JournalLine } from '../types';
import { 
  validateRequiredFields, 
  formatCurrency, 
  formatDate 
} from './_shared/utils';
import { auditService } from './audit';
import { searchService } from './search';
import { supabase } from '@/lib/supabase';

interface CreateAccountInput {
  name: string;
  account_category: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  account_code: string;
  parent_id?: string;
  description?: string;
  is_system_account?: boolean;
  account_number_display?: string;
  initial_balance?: number;
}

interface UpdateAccountInput {
  id: string;
  name?: string;
  account_category?: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  account_code?: string;
  parent_id?: string | null;
  description?: string;
  is_system_account?: boolean;
  account_number_display?: string;
}

interface AccountFilters extends FilterParams {
  account_category?: string;
  is_system_account?: boolean;
  search?: string;
}

interface TrialBalanceItem {
  account: InternalAccount;
  debit: number;
  credit: number;
  balance: number;
}

interface BalanceSheetItem {
  category: string;
  accounts: Array<{
    account: InternalAccount;
    balance: number;
  }>;
  total: number;
}

interface ProfitLossItem {
  category: string;
  accounts: Array<{
    account: InternalAccount;
    balance: number;
  }>;
  total: number;
}

/**
 * Accounts Service for managing chart of accounts and financial operations
 */
export class AccountsService extends BaseServiceClass {
  private static instance: AccountsService;

  /**
   * Get singleton instance
   */
  public static getInstance(): AccountsService {
    if (!AccountsService.instance) {
      AccountsService.instance = new AccountsService();
    }
    return AccountsService.instance;
  }

  /**
   * Create a new account
   */
  async createAccount(input: CreateAccountInput): Promise<ServiceResult<InternalAccount>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['name', 'account_category', 'account_code'];
      const missing = validateRequiredFields(input, requiredFields);
      
      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
      }

      // Validate account category
      const validCategories = ['asset', 'liability', 'equity', 'income', 'expense'];
      if (!validCategories.includes(input.account_category)) {
        throw new Error('Invalid account category');
      }

      // Check if account code already exists
      const existingAccount = await this.getAccountByCode(input.account_code);
      if (existingAccount.data) {
        throw new Error('Account code already exists');
      }

      const inputCode = input.account_code.trim();
      const validTypes = ['bank', 'cash', 'mobile', 'equity', 'liability', 'operational', 'capital', 'asset'];
      const suggestedType = inputCode.toLowerCase();
      const finalType = validTypes.includes(suggestedType) ? suggestedType : input.account_category;

      const accountPayload = {
        name: input.name.trim(),
        account_category: input.account_category,
        account_code: inputCode,
        category: input.account_category,
        code: inputCode,
        type: finalType,
        parent_id: input.parent_id || null,
        description: input.description?.trim(),
        is_system_account: input.is_system_account || false,
        account_number_display: input.account_number_display || null,
        balance: 0
      };

      let newAcc: InternalAccount;
      const insertAttempt = await (supabase as any)
        .from('internal_accounts')
        .insert([accountPayload])
        .select()
        .single();

      if (!insertAttempt.error) {
        newAcc = insertAttempt.data;
      } else {
        // Fallback for older schemas without alias columns
        const legacyAttempt = await (supabase as any)
          .from('internal_accounts')
          .insert([{
            name: accountPayload.name,
            category: accountPayload.category,
            code: accountPayload.code,
            type: accountPayload.type,
            parent_id: accountPayload.parent_id,
            description: accountPayload.description,
            is_system_account: accountPayload.is_system_account,
            account_number_display: accountPayload.account_number_display,
            balance: 0
          }])
          .select()
          .single();

        if (legacyAttempt.error) throw legacyAttempt.error;
        newAcc = legacyAttempt.data;
      }

      // Log audit
      await this.logAudit('create_account', 'account', newAcc.id, {
        action: 'create',
        account_name: newAcc.name,
        account_code: newAcc.account_code || newAcc.code
      });

      // Update search index
      await searchService.indexAccount(newAcc);

      return newAcc;
    }, 'Failed to create account');
  }

  /**
   * Get account by ID
   */
  async getAccountById(id: string): Promise<ServiceResult<InternalAccount>> {
    return this.handleAsyncOperation(async () => {
      if (!id) throw new Error('Account ID is required');
      const account = await this.fetchAccountFromDatabase(id);
      if (!account) throw new Error('Account not found');
      return account;
    }, 'Failed to get account');
  }

  /**
   * Get account by code
   * @param code - The account code to look up
   * @param options - Optional configuration
   * @param options.required - If true (default), throws error when account not found. If false, returns null gracefully.
   */
  async getAccountByCode(code: string, options?: { required?: boolean }): Promise<ServiceResult<InternalAccount | null>> {
    const isRequired = options?.required !== false; // Default to true for backward compatibility
    
    return this.handleAsyncOperation(async () => {
      if (!code) throw new Error('Account code is required');
      const account = await this.fetchAccountByCodeFromDatabase(code);
      
      if (!account) {
        if (isRequired) {
          throw new Error(`Account with code ${code} not found`);
        } else {
          // Return null gracefully for optional lookups
          return null;
        }
      }
      
      return account;
    }, `Failed to get account with code ${code}`);
  }

  /**
   * Get all accounts with pagination and filtering
   */
  async getAccounts(
    filters?: AccountFilters, 
    pagination?: PaginationParams, 
    sort?: SortParams
  ): Promise<ServiceResult<ListResponse<InternalAccount>>> {
    return this.handleAsyncOperation(async () => {
      // Simulate database query
      const result = await this.fetchAccountsFromDatabase(filters, pagination, sort);
      
      return result;
    }, 'Failed to get accounts');
  }

  /**
   * Update account
   */
  async updateAccount(input: UpdateAccountInput): Promise<ServiceResult<InternalAccount>> {
    return this.handleAsyncOperation(async () => {
      if (!input.id) {
        throw new Error('Account ID is required');
      }

      const existingAccount = await this.getAccountById(input.id);
      if (!existingAccount.data) {
        throw new Error('Account not found');
      }

      // Check if account code is being changed and if it already exists
      if (input.account_code && input.account_code !== existingAccount.data.account_code && input.account_code !== existingAccount.data.code) {
        const existingWithCode = await this.getAccountByCode(input.account_code);
        if (existingWithCode.data && existingWithCode.data.id !== input.id) {
          throw new Error('Account code already exists');
        }
      }

      const updatePayload: any = { ...input };
      delete updatePayload.id;
      
      if (input.account_code) {
         updatePayload.code = input.account_code;
      }
      if (input.account_category) {
         updatePayload.category = input.account_category;
      }

      const { data, error } = await (supabase as any)
        .from('internal_accounts')
        .update(updatePayload)
        .eq('id', input.id)
        .select()
        .single();
        
      if (error) {
          throw error;
      }

      const updatedAccount = data as InternalAccount;

      // Log audit
      await this.logAudit('update_account', 'account', input.id, {
        action: 'update',
        account_id: input.id,
        changes: input
      });

      // Update search index
      await searchService.updateAccountIndex(updatedAccount);

      return updatedAccount;
    }, 'Failed to update account');
  }

  /**
   * Delete account
   */
  async deleteAccount(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      if (!id) {
        throw new Error('Account ID is required');
      }

      const existingAccount = await this.getAccountById(id);
      if (!existingAccount.data) {
        throw new Error('Account not found');
      }

      // Check if account has transactions - if so, don't allow deletion
      const hasTransactions = await this.accountHasTransactions(id);
      if (hasTransactions) {
        throw new Error('Cannot delete account with transactions');
      }

      // Check if account has children - if so, don't allow deletion
      const hasChildren = await this.accountHasChildren(id);
      if (hasChildren) {
        throw new Error('Cannot delete account with child accounts');
      }

      const { error } = await (supabase as any).from('internal_accounts').delete().eq('id', id);
      if (error) throw error;

      // Log audit
      await this.logAudit('delete_account', 'account', id, {
        action: 'delete',
        account_id: id,
        account_name: existingAccount.data.name,
        account_code: existingAccount.data.account_code || existingAccount.data.code
      });

      // Remove from search index
      await searchService.removeFromIndex('account', id);

      return true;
    }, 'Failed to delete account');
  }

  /**
   * Get account hierarchy (tree structure)
   */
  async getAccountHierarchy(): Promise<ServiceResult<InternalAccount[]>> {
    return this.handleAsyncOperation(async () => {
      const accountsResult = await this.getAccounts();
      const accounts = accountsResult.data?.data || [];

      // Build tree structure
      const accountMap = new Map<string, InternalAccount>();
      const rootAccounts: InternalAccount[] = [];

      // First pass: create map
      accounts.forEach(account => {
        accountMap.set(account.id, { ...account, children: [] });
      });

      // Second pass: build hierarchy
      accounts.forEach(account => {
        const accountWithChildren = accountMap.get(account.id)!;
        
        if (account.parent_id && accountMap.has(account.parent_id)) {
          const parent = accountMap.get(account.parent_id)!;
          parent.children = parent.children || [];
          parent.children.push(accountWithChildren);
        } else {
          rootAccounts.push(accountWithChildren);
        }
      });

      return rootAccounts;
    }, 'Failed to get account hierarchy');
  }

  /**
   * Get Balance Sheet as of a specific date (FIX #2: Period-specific balances)
   */
  async getBalanceSheet(asOfDate?: string): Promise<ServiceResult<{
      assets: { 
        cash_and_equivalents: number; 
        receivables: number; 
        other_assets: number;
        total: number;
      };
      liabilities: { total: number };
      equity: { baseEquity: number; total: number };
  }>> {
    return this.handleAsyncOperation(async () => {
        const { data: accounts, error: accError } = await (supabase as any).from('internal_accounts').select('*');
        if (accError) throw accError;

        const { data: loans, error: loanError } = await (supabase as any).from('loans').select('principal_outstanding').eq('status', 'active');
        if (loanError) throw loanError;

        // FIX #6: Check if PORTFOLIO account exists
        const portfolioAccount = accounts?.find(a => a.account_code === 'PORTFOLIO' || a.code === 'PORTFOLIO');
        if (!portfolioAccount) {
            console.warn('PORTFOLIO account not found - balance will show as 0');
        }

        let loanReceivables: number;
        let totalAssets: number;
        let cashAndEquivalents: number;
        let equity: number;
        let liabilities: number;

        // FIX #2: If asOfDate is provided, calculate historical balances
        if (asOfDate) {
            // Use the new database function to get balances as of specific date
            const balancePromises = accounts!.map(async (account: any) => {
                const { data, error } = await (supabase as any)
                    .rpc('get_account_balance_as_of_date', {
                        p_account_id: account.id,
                        p_as_of_date: asOfDate
                    });
                
                if (error) {
                    console.error(`Error getting balance for account ${account.id}:`, error);
                    return { ...account, balance: 0 };
                }
                
                return { ...account, balance: Number(data) || 0 };
            });

            const accountsWithBalances = await Promise.all(balancePromises);

            loanReceivables = Number(accountsWithBalances.find(a => a.account_code === 'PORTFOLIO' || a.code === 'PORTFOLIO')?.balance || 0);
            
            totalAssets = accountsWithBalances
                .filter(a => a.account_category === 'asset')
                .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

            cashAndEquivalents = accountsWithBalances
                .filter(a => a.account_category === 'asset' && a.is_cash_equivalent === true)
                .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

            equity = accountsWithBalances
                .filter(a => a.account_category === 'equity')
                .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
            
            liabilities = accountsWithBalances
                .filter(a => a.account_category === 'liability')
                .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
        } else {
            // Current balances (existing behavior)
            loanReceivables = Number(portfolioAccount?.balance || 0);
            
            totalAssets = accounts?.filter(a => a.account_category === 'asset')
                .reduce((sum, a) => sum + (Number(a.balance) || 0), 0) || 0;

            cashAndEquivalents = accounts?.filter(a => 
                a.account_category === 'asset' && a.is_cash_equivalent === true
            ).reduce((sum, a) => sum + (Number(a.balance) || 0), 0) || 0;

            equity = accounts?.filter(a => a.account_category === 'equity')
                .reduce((sum, a) => sum + (Number(a.balance) || 0), 0) || 0;
            
            liabilities = accounts?.filter(a => a.account_category === 'liability')
                .reduce((sum, a) => sum + (Number(a.balance) || 0), 0) || 0;
        }

        // Other Assets: All non-portfolio, non-cash assets
        const otherAssets = totalAssets - loanReceivables - cashAndEquivalents;

        return {
            assets: {
                cash_and_equivalents: cashAndEquivalents,
                receivables: loanReceivables,
                other_assets: otherAssets,
                total: totalAssets
            },
            liabilities: {
                total: liabilities
            },
            equity: {
                baseEquity: equity,
                total: equity
            }
        };
    }, 'Failed to generate Balance Sheet');
  }

  /**
   * Get Profit and Loss statement for a period
   */
  async getProfitLoss(period: string): Promise<ServiceResult<{
      totalRevenue: number;
      totalExpenses: number;
      netProfit: number;
      revenueByType: Record<string, number>;
      expenseByType: Record<string, number>;
  }>> {
    return this.handleAsyncOperation(async () => {
        const [year, monthNum] = period.split('-').map(Number);
        const startStr = `${period}-01`;
        const nextMonthDate = new Date(year, monthNum, 1);
        const endStr = nextMonthDate.toISOString().substring(0, 10);

        // Fetch all posted journal lines for the period
        const { data: journalEntries, error } = await (supabase as any)
            .from('journal_entries')
            .select(`
                journal_lines!inner(
                    debit,
                    credit,
                    accounts:internal_accounts(account_category, type, name)
                )
            `)
            .eq('status', 'posted')
            .gte('entry_date', startStr)
            .lt('entry_date', endStr);
            
        if (error) throw error;

        const revenueByType: Record<string, number> = {};
        const expenseByType: Record<string, number> = {};
        let totalRevenue = 0;
        let totalExpenses = 0;

        journalEntries?.forEach((entry: any) => {
            entry.journal_lines?.forEach((line: any) => {
                const account = line.accounts;
                if (account?.account_category === 'income') {
                    const type = account.name || account.type || 'Other';
                    const amount = (line.credit || 0) - (line.debit || 0);
                    revenueByType[type] = (revenueByType[type] || 0) + amount;
                    totalRevenue += amount;
                }
                if (account?.account_category === 'expense') {
                    const type = account.name || account.type || 'Other';
                    const amount = (line.debit || 0) - (line.credit || 0);
                    expenseByType[type] = (expenseByType[type] || 0) + amount;
                    totalExpenses += amount;
                }
            });
        });

        return {
            totalRevenue,
            totalExpenses,
            netProfit: totalRevenue - totalExpenses,
            revenueByType,
            expenseByType
        };
    }, 'Failed to generate Profit and Loss statement');
  }

  /**
   * Get account balance
   */
  async getAccountBalance(accountId: string, dateFrom?: string, dateTo?: string): Promise<ServiceResult<number>> {
    return this.handleAsyncOperation(async () => {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      // Simulate database query to get account balance
      const balance = await this.fetchAccountBalanceFromDatabase(accountId, dateFrom, dateTo);
      
      return balance;
    }, 'Failed to get account balance');
  }

  /**
   * Get account transactions
   */
  async getAccountTransactions(accountId: string, dateFrom?: string, dateTo?: string): Promise<ServiceResult<JournalLine[]>> {
    return this.handleAsyncOperation(async () => {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      // Simulate database query
      const transactions = await this.fetchAccountTransactionsFromDatabase(accountId, dateFrom, dateTo);
      
      return transactions;
    }, 'Failed to get account transactions');
  }

  /**
   * Check if account has transactions
   */
  private async accountHasTransactions(accountId: string): Promise<boolean> {
    const { count, error } = await (supabase as any)
      .from('journal_lines')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId);

    if (error) {
      console.error('Error checking transactions:', error);
      return false;
    }
    return (count || 0) > 0;
  }

  /**
   * Check if account has children
   */
  private async accountHasChildren(accountId: string): Promise<boolean> {
    const { count, error } = await (supabase as any)
      .from('internal_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('parent_id', accountId);
      
    if (error) {
      console.error('Error checking children:', error);
      return false;
    }
    return (count || 0) > 0;
  }

  // Private helper methods for database operations

  private async fetchAccountFromDatabase(id: string): Promise<InternalAccount | null> {
    const { data, error } = await (supabase as any)
      .from('internal_accounts')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error) {
      return null;
    }
    return data as InternalAccount;
  }

  private async fetchAccountByCodeFromDatabase(code: string): Promise<InternalAccount | null> {
    const { data, error } = await (supabase as any)
      .from('internal_accounts')
      .select('*')
      .or(`account_code.eq."${code}",code.eq."${code}"`)
      .maybeSingle();

    if (error) {
      console.error('Error fetching account by code:', error);
      return null;
    }
    return data as InternalAccount;
  }

  private async fetchAccountsFromDatabase(
    filters?: AccountFilters, 
    pagination?: PaginationParams, 
    sort?: SortParams
  ): Promise<ListResponse<InternalAccount>> {
    let query = (supabase as any).from('internal_accounts').select('*', { count: 'exact' });

    if (filters?.category) {
      query = query.eq('account_category', filters.category);
    }
    if (filters?.type) {
      query = query.eq('type', filters.type);
    }
    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }
    if (filters?.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    if (sort) {
      query = query.order(sort.sortBy || 'name', { ascending: sort.sortOrder === 'asc' });
    } else {
      query = query.order('name', { ascending: true });
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 100;
    const start = (page - 1) * limit;
    
    // Default limit if pagination is present
    if (pagination) {
      query = query.range(start, start + limit - 1);
    }

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      data: (data || []) as InternalAccount[],
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0
    };
  }

  private async fetchAccountBalanceFromDatabase(accountId: string, dateFrom?: string, dateTo?: string): Promise<number> {
    const account = await this.fetchAccountFromDatabase(accountId);
    if (!account) return 0;

    // CRITICAL FIX: Only include POSTED entries in balance calculations.
    // Draft entries are unverified and must not affect account balances or
    // the Financial Statements solvency check.
    let query = (supabase as any)
      .from('journal_lines')
      .select('debit, credit, journal_entries!inner(entry_date, status)')
      .eq('account_id', accountId)
      .eq('journal_entries.status', 'posted');

    if (dateFrom) {
      query = query.gte('journal_entries.entry_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('journal_entries.entry_date', dateTo);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error calculating account balance:', error);
      return 0;
    }

    const sums = (data as any[] || []).reduce((acc, line) => {
      acc.debit += Number(line.debit || 0);
      acc.credit += Number(line.credit || 0);
      return acc;
    }, { debit: 0, credit: 0 });

    const category = account.account_category;
    if (['asset', 'expense'].includes(category)) {
      return sums.debit - sums.credit;
    } else {
      return sums.credit - sums.debit;
    }
  }

  private async fetchAccountTransactionsFromDatabase(accountId: string, dateFrom?: string, dateTo?: string): Promise<JournalLine[]> {
    // CRITICAL FIX: Only return POSTED transactions to keep views consistent.
    let query = (supabase as any)
      .from('journal_lines')
      .select('*, journal_entries!inner(*)')
      .eq('account_id', accountId)
      .eq('journal_entries.status', 'posted');

    if (dateFrom) {
      query = query.gte('journal_entries.entry_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('journal_entries.entry_date', dateTo);
    }

    const { data, error } = await query.order('journal_entries(entry_date)', { ascending: false });

    if (error) {
      console.error('Error fetching account transactions:', error);
      return [];
    }
    return data as any[];
  }

  /**
   * Verify trial balance integrity
   */
  async verifyTrialBalance(date?: string): Promise<ServiceResult<{
    is_balanced: boolean;
    total_debits: number;
    total_credits: number;
    difference: number;
  }>> {
    return this.handleAsyncOperation(async () => {
      const p_date = date || new Date().toISOString().split('T')[0];
      const { data, error } = await (supabase as any).rpc('verify_trial_balance', { p_date });
      
      if (error) throw error;
      
      if (data && data[0]) {
        return data[0];
      }
      
      throw new Error('No data returned from verification');
    }, 'Failed to verify trial balance');
  }

  /**
   * FIX #3: Validate period before closing
   */
  async validatePeriodClosing(period: string): Promise<ServiceResult<{
    is_valid: boolean;
    error_message: string;
    details: any;
  }>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).rpc('validate_period_closing', { p_period: period });
      
      if (error) throw error;
      
      if (data && data[0]) {
        return data[0];
      }
      
      throw new Error('No validation data returned');
    }, 'Failed to validate period closing');
  }

  /**
   * FIX #1 & #4: Close period with proper validation and profit calculation
   */
  async closePeriod(period: string, closedByUserId: string): Promise<ServiceResult<{
    success: boolean;
    net_profit: number;
    journal_entry_id: string | null;
    total_assets: number;
    total_liabilities: number;
    error?: string;
    details?: any;
  }>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).rpc('close_period_with_validation', {
        p_period: period,
        p_closed_by: closedByUserId
      });
      
      if (error) throw error;
      
      if (!data) {
        throw new Error('No response from period closing function');
      }
      
      return data;
    }, 'Failed to close period');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    const auditEntry: AuditLogEntry = {
      action,
      entity_type: entityType,
      entity_id: entityId,
      details
    };

    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// Export singleton instance
export const accountsService = AccountsService.getInstance();