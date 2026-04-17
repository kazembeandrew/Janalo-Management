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
import { Expense, InternalAccount, JournalEntry, ExpenseStatus } from '../types';
import { 
  validateRequiredFields, 
  formatCurrency, 
  formatDate 
} from './_shared/utils';
import { auditService } from './audit';
import { searchService } from './search';
import { accountsService } from './accounts';
import { journalEntriesService } from './journalEntries';
import { supabase } from '@/lib/supabase';

interface CreateExpenseInput {
  description: string;
  amount: number;
  date: string;
  category: string;
  status: ExpenseStatus;
  recorded_by?: string;
  payment_method?: string;
  reference_number?: string;
  notes?: string;
}

interface UpdateExpenseInput {
  id: string;
  description?: string;
  amount?: number;
  expense_date?: string;
  category?: string;
  payment_method?: string;
  reference_number?: string;
  notes?: string;
}

interface ExpenseFilters extends FilterParams {
  category?: string;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  payment_method?: string;
}

/**
 * Expenses Service for managing expense operations
 */
export class ExpensesService extends BaseServiceClass {
  private static instance: ExpensesService;

  /**
   * Get singleton instance
   */
  public static getInstance(): ExpensesService {
    if (!ExpensesService.instance) {
      ExpensesService.instance = new ExpensesService();
    }
    return ExpensesService.instance;
  }

  async createExpense(input: CreateExpenseInput): Promise<ServiceResult<Expense>> {
    return this.handleAsyncOperation(async () => {
      if (input.status === 'approved') {
        throw new Error('Expenses cannot be created in "approved" status directly. Please create as "pending" and then approve to ensure proper accounting.');
      }

      const { data, error } = await (supabase as any)
        .from('expenses')
        .insert([input])
        .select('*, users(full_name)')
        .single();

      if (error) throw error;
      
      const expense = data as Expense;

      // Log audit
      await this.logAudit('create_expense', 'expense', expense.id, {
        action: 'create',
        expense_id: expense.id,
        description: expense.description,
        amount: expense.amount,
        category: expense.category
      });

      // Update search index
      await searchService.indexExpense(expense);

      return expense;
    }, 'Failed to create expense');
  }

  /**
   * Update expense status or details (includes accounting integration for approvals)
   */
  async updateExpenseStatus(id: string, status: string, targetAccountId?: string): Promise<ServiceResult<Expense>> {
    return this.handleAsyncOperation(async () => {
      // 1. Get the current expense
      const expenseResult = await this.getExpenseById(id);
      if (!expenseResult.data) throw new Error('Expense not found');
      const expense = expenseResult.data;

      // Prevent duplicate approval
      if (status === 'approved' && expense.status === 'approved') {
        throw new Error('Expense is already approved');
      }

      // 2. If approving, handle the accounting movement
      if (status === 'approved') {
        if (!targetAccountId) {
          throw new Error('Target account ID (source of funds) is required for expense approval');
        }

        const targetAccountResult = await accountsService.getAccountById(targetAccountId);
        if (!targetAccountResult.data) {
          throw new Error('Target account not found. Please provide a valid source-of-funds account.');
        }

        if (!this.isValidExpenseSourceAccount(targetAccountResult.data)) {
          throw new Error('Target account must be an active asset or cash-equivalent account. Please select a cash/bank/funding account for expense payment.');
        }

        // Get the appropriate expense account based on category
        // Map expense categories to their GL accounts
        const expenseAccountCode = this.getExpenseAccountCode(expense.category);
        if (!expenseAccountCode) {
          throw new Error(`No expense account mapping exists for category "${expense.category}". Please add the account mapping before approving this expense.`);
        }

        const expenseAccResult = await accountsService.getAccountByCode(expenseAccountCode, { required: false });
        const postingDate = expense.expense_date || expense.date || new Date().toISOString().split('T')[0];

        if (!expenseAccResult.data) {
          if (expenseAccountCode !== 'OPERATIONAL') {
            throw new Error(`Expense account ${expenseAccountCode} for category "${expense.category}" not found in internal_accounts. Please create it before approving this expense.`);
          }

          const opAccResult = await accountsService.getAccountByCode('OPERATIONAL');
          if (!opAccResult.data) throw new Error('Operational account not found in system accounts');

          // Post journal entry with OPERATIONAL fallback for uncategorized expenses only
          const journalResult = await journalEntriesService.createJournalEntry({
            reference_type: 'expense',
            reference_id: expense.id,
            date: postingDate,
            description: `Expense payment: ${expense.description}`,
            journal_lines: [
              { account_id: opAccResult.data.id, debit: expense.amount, credit: 0 },
              { account_id: targetAccountId, debit: 0, credit: expense.amount }
            ]
          });

          if (!journalResult.success) {
            throw new Error('Failed to post expense journal entry: ' + journalResult.error?.message);
          }
        } else {
          // Post journal entry with category-specific expense account
          const journalResult = await journalEntriesService.createJournalEntry({
            reference_type: 'expense',
            reference_id: expense.id,
            date: postingDate,
            description: `Expense payment: ${expense.description} (${expense.category})`,
            journal_lines: [
              { account_id: expenseAccResult.data.id, debit: expense.amount, credit: 0 },
              { account_id: targetAccountId, debit: 0, credit: expense.amount }
            ]
          });

          if (!journalResult.success) {
            throw new Error('Failed to post expense journal entry: ' + journalResult.error?.message);
          }
        }
      }

      // 3. Update the status in DB
      const { data, error } = await (supabase as any)
        .from('expenses')
        .update({ status })
        .eq('id', id)
        .select('*, users(full_name)')
        .single();
      
      if (error) throw error;
      return data as Expense;
    }, 'Failed to update expense status');
  }

  /**
   * Get expense by ID
   */
  async getExpenseById(id: string): Promise<ServiceResult<Expense>> {
    return this.handleAsyncOperation(async () => {
      if (!id) {
        throw new Error('Expense ID is required');
      }

      // Simulate database query
      const expense = await this.fetchExpenseFromDatabase(id);
      
      if (!expense) {
        throw new Error('Expense not found');
      }

      return expense;
    }, 'Failed to get expense');
  }

  /**
   * Get all expenses with pagination and filtering
   */
  async getExpenses(
    filters?: ExpenseFilters, 
    pagination?: PaginationParams, 
    sort?: SortParams
  ): Promise<ServiceResult<ListResponse<Expense>>> {
    return this.handleAsyncOperation(async () => {
      // Simulate database query
      const result = await this.fetchExpensesFromDatabase(filters, pagination, sort);
      
      return result;
    }, 'Failed to get expenses');
  }

  /**
   * Update expense
   */
  async updateExpense(input: UpdateExpenseInput): Promise<ServiceResult<Expense>> {
    return this.handleAsyncOperation(async () => {
      if (!input.id) {
        throw new Error('Expense ID is required');
      }

      const updatePayload: any = { ...input };
      delete updatePayload.id;

      const { data, error } = await (supabase as any)
        .from('expenses')
        .update(updatePayload)
        .eq('id', input.id)
        .select('*, users(full_name)')
        .single();

      if (error) throw error;
      const updatedExpense = data as Expense;

      // Log audit
      await this.logAudit('update_expense', 'expense', input.id, {
        action: 'update',
        expense_id: input.id,
        changes: input
      });

      // Update search index
      await searchService.updateExpenseIndex(updatedExpense);

      return updatedExpense;
    }, 'Failed to update expense');
  }

  /**
   * Delete expense
   */
  async deleteExpense(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      if (!id) {
        throw new Error('Expense ID is required');
      }

      const existingExpense = await this.getExpenseById(id);
      if (!existingExpense.data) {
        throw new Error('Expense not found');
      }

      // Check if expense has been reconciled - if so, don't allow deletion
      if (existingExpense.data.reconciled_by) {
        throw new Error('Cannot delete reconciled expense');
      }

      // Reverse the corresponding journal entry
      await this.reverseExpenseJournalEntry(id);

      // Log audit
      await this.logAudit('delete_expense', 'expense', id, {
        action: 'delete',
        expense_id: id,
        description: existingExpense.data.description,
        amount: existingExpense.data.amount
      });

      // Remove from search index
      await searchService.removeFromIndex('expense', id);

      // 4) Actually delete the record from Supabase
      const { error: deleteError } = await (supabase as any)
        .from('expenses')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      return true;
    }, 'Failed to delete expense');
  }

  /**
   * Get expenses by category
   */
  async getExpensesByCategory(category: string, dateFrom?: string, dateTo?: string): Promise<ServiceResult<{
    category: string;
    totalAmount: number;
    expenseCount: number;
    expenses: Expense[];
  }>> {
    return this.handleAsyncOperation(async () => {
      if (!category) {
        throw new Error('Category is required');
      }

      // Simulate database query
      const expenses = await this.fetchExpensesByCategoryFromDatabase(category, dateFrom, dateTo);
      
      const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const expenseCount = expenses.length;

      return {
        category,
        totalAmount,
        expenseCount,
        expenses
      };
    }, 'Failed to get expenses by category');
  }

  /**
   * Get expense summary by date range
   */
  async getExpenseSummary(dateFrom?: string, dateTo?: string): Promise<ServiceResult<{
    totalExpenses: number;
    totalAmount: number;
    averageExpense: number;
    categoryBreakdown: Array<{
      category: string;
      amount: number;
      count: number;
      percentage: number;
    }>;
    monthlyBreakdown: Array<{
      month: string;
      amount: number;
      count: number;
    }>;
  }>> {
    return this.handleAsyncOperation(async () => {
      // Simulate database query
      const expenses = await this.fetchExpensesByDateRangeFromDatabase(dateFrom, dateTo);
      
      const totalExpenses = expenses.length;
      const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const averageExpense = totalExpenses > 0 ? totalAmount / totalExpenses : 0;

      // Category breakdown
      const categoryMap = new Map<string, { amount: number; count: number }>();
      expenses.forEach(expense => {
        const category = expense.category;
        const existing = categoryMap.get(category) || { amount: 0, count: 0 };
        categoryMap.set(category, {
          amount: existing.amount + expense.amount,
          count: existing.count + 1
        });
      });

      const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        amount: data.amount,
        count: data.count,
        percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0
      }));

      // Monthly breakdown
      const monthMap = new Map<string, { amount: number; count: number }>();
      expenses.forEach(expense => {
        const month = new Date(expense.expense_date).toISOString().slice(0, 7); // YYYY-MM format
        const existing = monthMap.get(month) || { amount: 0, count: 0 };
        monthMap.set(month, {
          amount: existing.amount + expense.amount,
          count: existing.count + 1
        });
      });

      const monthlyBreakdown = Array.from(monthMap.entries()).map(([month, data]) => ({
        month,
        amount: data.amount,
        count: data.count
      })).sort((a, b) => a.month.localeCompare(b.month));

      return {
        totalExpenses,
        totalAmount,
        averageExpense,
        categoryBreakdown,
        monthlyBreakdown
      };
    }, 'Failed to get expense summary');
  }

  /**
   * Reconcile expense
   */
  async reconcileExpense(id: string, reconciledBy?: string): Promise<ServiceResult<Expense>> {
    return this.handleAsyncOperation(async () => {
      if (!id) {
        throw new Error('Expense ID is required');
      }

      const existingExpense = await this.getExpenseById(id);
      if (!existingExpense.data) {
        throw new Error('Expense not found');
      }

      // 1. Update the database record
      const { data, error } = await (supabase as any)
        .from('expenses')
        .update({ 
          reconciled_by: reconciledBy || (await (supabase as any).auth.getUser()).data.user?.id,
          reconciled_at: new Date().toISOString()
        })
        .eq('id', id)
        .select('*, users(full_name)')
        .single();

      if (error) throw error;
      const updatedExpense = data as Expense;

      // 2. Log audit
      await this.logAudit('reconcile_expense', 'expense', id, {
        action: 'reconcile',
        expense_id: id,
        reconciled_by: updatedExpense.reconciled_by,
        reconciled_at: updatedExpense.reconciled_at
      });

      // 3. Update search index
      await searchService.updateExpenseIndex(updatedExpense);

      return updatedExpense;
    }, 'Failed to reconcile expense');
  }

  /**
   * Search expenses
   */
  async searchExpenses(query: string, filters?: ExpenseFilters): Promise<ServiceResult<ListResponse<Expense>>> {
    return this.handleAsyncOperation(async () => {
      if (!query || query.trim() === '') {
        throw new Error('Search query is required');
      }

      // Use search service and convert to ListResponse format
      const searchResult = await searchService.searchExpenses(query, 50);
      
      if (searchResult.error) {
        throw new Error(searchResult.error.message);
      }

      // Convert search results to Expense type and create ListResponse
      const expenses: Expense[] = searchResult.data?.map(result => ({
        id: result.id || '',
        category: result.category || '',
        description: result.description || '',
        amount: result.amount || 0,
        date: result.date || '',
        recorded_by: result.recorded_by || '',
        status: (result.status as ExpenseStatus) || 'pending',
        reconciled_by: result.reconciled_by,
        reconciled_at: result.reconciled_at,
        created_at: result.created_at || ''
      })) || [];

      return {
        data: expenses,
        total: expenses.length,
        page: 1,
        limit: 50,
        totalPages: Math.ceil(expenses.length / 50)
      };
    }, 'Failed to search expenses');
  }

  /**
   * Get expense by reference number
   */
  async getExpenseByReference(referenceNumber: string): Promise<ServiceResult<Expense>> {
    return this.handleAsyncOperation(async () => {
      if (!referenceNumber) {
        throw new Error('Reference number is required');
      }

      // Simulate database query
      const expense = await this.fetchExpenseByReferenceFromDatabase(referenceNumber);
      
      return expense;
    }, 'Failed to get expense by reference');
  }

  /**
   * Reverse expense journal entry
   */
  private async reverseExpenseJournalEntry(expenseId: string): Promise<void> {
    // Find the journal entry for this expense
    const journalEntriesResult = await journalEntriesService.getJournalEntries({
      reference_type: 'expense',
      reference_id: expenseId
    });

    if (journalEntriesResult.success && journalEntriesResult.data?.data?.length > 0) {
      const journalEntry = journalEntriesResult.data.data[0];
      
      // Create reverse entry
      await journalEntriesService.reverseJournalEntry(journalEntry.id, 'Expense deleted');
    }
  }

  /**
   * Get expense account ID (this would typically be configured)
   */
  private getExpenseAccountId(): string {
    // This should return the ID of the expense account
    // In a real implementation, this would be configurable
    return 'expense-account-id';
  }

  /**
   * Map expense category to GL account code
   * @param category - The expense category from the expense record
   * @returns The corresponding GL account code
   */
  private getExpenseAccountCode(category: string): string | undefined {
    const categoryMap: Record<string, string> = {
      'Salaries/Wages': 'EXP_SALARIES',
      'Travel': 'EXP_TRAVEL',
      'Transport': 'EXP_TRANSPORT',
      'Communication': 'EXP_COMMUNICATION',
      'Office Supplies': 'EXP_OFFICE_SUPPLIES',
      'Utilities': 'EXP_UTILITIES',
      'Marketing': 'EXP_MARKETING',
      'Legal': 'EXP_LEGAL',
      'Other': 'OPERATIONAL'
    };

    return categoryMap[category];
  }

  private isValidExpenseSourceAccount(account: InternalAccount): boolean {
    const category = String(account.account_category || '').toLowerCase();
    const isActive = account.is_active !== false;

    return isActive && (
      category === 'asset' ||
      account.is_cash_equivalent === true
    );
  }

  // Private helper methods for database operations

  private async fetchExpenseFromDatabase(id: string): Promise<Expense | null> {
    const { data, error } = await (supabase as any)
      .from('expenses')
      .select('*, users(full_name)')
      .eq('id', id)
      .single();
    if (error) return null;
    return data as Expense;
  }

  private async fetchExpensesFromDatabase(
    filters?: ExpenseFilters, 
    pagination?: PaginationParams, 
    sort?: SortParams
  ): Promise<ListResponse<Expense>> {
    let query = (supabase as any).from('expenses').select('*, users(full_name)', { count: 'exact' });

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }
    if (filters?.date_from) {
      query = query.gte('date', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('date', filters.date_to);
    }

    if (sort) {
      query = query.order(sort.sortBy || 'date', { ascending: sort.sortOrder === 'asc' });
    } else {
      query = query.order('date', { ascending: false });
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const start = (page - 1) * limit;

    const { data, count, error } = await query.range(start, start + limit - 1);

    if (error) throw error;

    return {
      data: (data || []) as Expense[],
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0
    };
  }

  private async fetchExpensesByCategoryFromDatabase(category: string, dateFrom?: string, dateTo?: string): Promise<Expense[]> {
    let query = (supabase as any).from('expenses').select('*').eq('category', category);
    if (dateFrom) query = query.gte('date', dateFrom);
    if (dateTo) query = query.lte('date', dateTo);
    
    const { data, error } = await query;
    if (error) return [];
    return data as Expense[];
  }

  private async fetchExpensesByDateRangeFromDatabase(dateFrom?: string, dateTo?: string): Promise<Expense[]> {
      let query = (supabase as any).from('expenses').select('*');
      if (dateFrom) query = query.gte('date', dateFrom);
      if (dateTo) query = query.lte('date', dateTo);
      const { data, error } = await query;
      if (error) return [];
      return data as Expense[];
  }

  private async fetchExpenseByReferenceFromDatabase(referenceNumber: string): Promise<Expense | null> {
    const { data, error } = await (supabase as any)
        .from('expenses')
        .select('*, users(full_name)')
        .eq('reference_number', referenceNumber)
        .maybeSingle();
    
    if (error) return null;
    return data as Expense;
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// Export singleton instance
export const expensesService = ExpensesService.getInstance();
