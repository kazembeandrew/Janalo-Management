import { supabase } from '@/lib/supabase';
import { fail, ok, toServiceError } from '@/services/_shared/result';
import type {
  GlobalSearchResult,
  SearchBorrowerResult,
  SearchLoanResult,
  SearchOptions,
  ServiceResult,
} from '@/services/_shared/types';

type BorrowerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string | null;
};

type LoanBorrowerRow = {
  id: string;
  full_name: string | null;
};

type LoanRow = {
  id: string;
  borrower_id: string | null;
  loan_number: string | null;
  status: string | null;
  amount: number | null;
  created_at: string | null;
  borrower?: LoanBorrowerRow | LoanBorrowerRow[] | null;
};

function normalizeQuery(query: string): string {
  return query.trim();
}

function buildBorrowerSearchPattern(query: string): string {
  return `%${query}%`;
}

function buildLoanSearchPattern(query: string): string {
  return `%${query}%`;
}

function mapBorrowerRow(row: BorrowerRow): SearchBorrowerResult {
  return {
    id: row.id,
    full_name: row.full_name ?? 'Unknown Borrower',
    email: row.email,
    phone: row.phone,
    created_at: row.created_at,
  };
}

function getBorrowerFromLoanRow(row: LoanRow): LoanBorrowerRow | null {
  if (!row.borrower) {
    return null;
  }

  return Array.isArray(row.borrower) ? row.borrower[0] ?? null : row.borrower;
}

function mapLoanRow(row: LoanRow): SearchLoanResult | null {
  if (!row.borrower_id) {
    return null;
  }

  const borrower = getBorrowerFromLoanRow(row);

  return {
    id: row.id,
    borrower_id: row.borrower_id,
    borrower_full_name: borrower?.full_name ?? 'Unknown Borrower',
    loan_number: row.loan_number,
    status: row.status,
    amount: row.amount,
    created_at: row.created_at,
  };
}

async function searchBorrowers(query: string, limit: number): Promise<ServiceResult<SearchBorrowerResult[]>> {
  try {
    const pattern = buildBorrowerSearchPattern(query);
    const { data, error } = await (supabase as any)
      .from('borrowers')
      .select('id, full_name, email, phone, created_at')
      .or(`full_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
      .order('full_name', { ascending: true })
      .limit(limit);

    if (error) {
      return fail(error.message, error.code, error.details);
    }

    const rows = ((data ?? []) as BorrowerRow[]).map(mapBorrowerRow);

    return ok(rows);
  } catch (error) {
    const serviceError = toServiceError(error, 'Unable to search borrowers');
    return fail(serviceError.message, serviceError.code, serviceError.details);
  }
}

async function searchLoans(query: string, limit: number): Promise<ServiceResult<SearchLoanResult[]>> {
  try {
    const pattern = buildLoanSearchPattern(query);
    const { data, error } = await (supabase as any)
      .from('loans')
      .select('id, borrower_id, loan_number, status, amount, created_at, borrower:borrowers(id, full_name)')
      .or(`loan_number.ilike.${pattern},status.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return fail(error.message, error.code, error.details);
    }

    const deduped = new Map<string, SearchLoanResult>();

    for (const row of (data ?? []) as LoanRow[]) {
      const mapped = mapLoanRow(row);

      if (mapped && !deduped.has(mapped.id)) {
        deduped.set(mapped.id, mapped);
      }
    }

    return ok(Array.from(deduped.values()));
  } catch (error) {
    const serviceError = toServiceError(error, 'Unable to search loans');
    return fail(serviceError.message, serviceError.code, serviceError.details);
  }
}

/**
 * Search Service for managing search operations
 */
export class SearchService {
  private static instance: SearchService;

  /**
   * Get singleton instance
   */
  public static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  /**
   * Search borrowers
   */
  async searchBorrowers(query: string, limit: number = 8): Promise<ServiceResult<SearchBorrowerResult[]>> {
    return searchBorrowers(query, limit);
  }

  /**
   * Search loans
   */
  async searchLoans(query: string, limit: number = 8): Promise<ServiceResult<SearchLoanResult[]>> {
    return searchLoans(query, limit);
  }

  /**
   * Global search across all entities
   */
  async searchGlobal(
    query: string,
    options: SearchOptions = {},
  ): Promise<ServiceResult<GlobalSearchResult>> {
    const searchOptions = { ...options, query };
    const normalizedQuery = normalizeQuery(query);
    const limit = searchOptions.limit ?? 8;

    if (!normalizedQuery) {
      return ok({
        borrowers: [],
        loans: [],
      });
    }

    const [borrowersResult, loansResult] = await Promise.all([
      searchBorrowers(normalizedQuery, limit),
      searchLoans(normalizedQuery, limit),
    ]);

    if (borrowersResult.error && loansResult.error) {
      return fail(
        borrowersResult.error.message || loansResult.error.message,
        borrowersResult.error.code || loansResult.error.code,
        borrowersResult.error.details || loansResult.error.details,
      );
    }

    return ok({
      borrowers: borrowersResult.data ?? [],
      loans: loansResult.data ?? [],
    });
  }

  /**
   * Index a borrower for search
   */
  async indexBorrower(borrower: any): Promise<void> {
    // In a real implementation, this would index the borrower in a search engine
    // For now, we'll just return a promise that resolves immediately
    return Promise.resolve();
  }

  /**
   * Index a loan for search
   */
  async indexLoan(loan: any): Promise<void> {
    // In a real implementation, this would index the loan in a search engine
    // For now, we'll just return a promise that resolves immediately
    return Promise.resolve();
  }

  /**
   * Index a repayment for search
   */
  async indexRepayment(repayment: any): Promise<void> {
    // In a real implementation, this would index the repayment in a search engine
    // For now, we'll just return a promise that resolves immediately
    return Promise.resolve();
  }

  /**
   * Update borrower index
   */
  async updateBorrowerIndex(borrower: any): Promise<void> {
    // In a real implementation, this would update the borrower index
    // For now, we'll just return a promise that resolves immediately
    return Promise.resolve();
  }

  /**
   * Update loan index
   */
  async updateLoanIndex(loan: any): Promise<void> {
    // In a real implementation, this would update the loan index
    // For now, we'll just return a promise that resolves immediately
    return Promise.resolve();
  }

  /**
   * Update repayment index
   */
  async updateRepaymentIndex(repayment: any): Promise<void> {
    // In a real implementation, this would update the repayment index
    // For now, we'll just return a promise that resolves immediately
    return Promise.resolve();
  }

  /**
   * Remove from index
   */
  async removeFromIndex(entityType: string, entityId: string): Promise<void> {
    // In a real implementation, this would remove the entity from the search index
    // For now, we'll just return a promise that resolves immediately
    return Promise.resolve();
  }

  /**
   * Index an account for search
   */
  async indexAccount(account: any): Promise<void> {
    // In a real implementation, this would index the account in a search engine
    // For now, we'll just return a promise that resolves immediately
    return Promise.resolve();
  }

  /**
   * Update account index
   */
  async updateAccountIndex(account: any): Promise<void> {
    // In a real implementation, this would update the account index
    // For now, we'll just return a promise that resolves immediately
    return Promise.resolve();
  }

  /**
   * Index a journal entry for search
   */
  async indexJournalEntry(journalEntry: any): Promise<void> {
    // In a real implementation, this would index the journal entry in a search engine
    // For now, we'll just return a promise that resolves immediately
    return Promise.resolve();
  }

  /**
   * Index an expense for search
   */
  async indexExpense(expense: any): Promise<void> {
    // In a real implementation, this would index the expense in a search engine
    // For now, we'll just return a promise that resolves immediately
    return Promise.resolve();
  }

  /**
   * Update expense index
   */
  async updateExpenseIndex(expense: any): Promise<void> {
    // In a real implementation, this would update the expense index
    // For now, we'll just return a promise that resolves immediately
    return Promise.resolve();
  }

  /**
   * Index a user for search
   */
  async indexUser(user: any): Promise<void> {
    // In a real implementation, this would index the user in a search engine
    // For now, we'll just return a promise that resolves immediately
    return Promise.resolve();
  }

  /**
   * Update user index
   */
  async updateUserIndex(user: any): Promise<void> {
    // In a real implementation, this would update the user index
    // For now, we'll just return a promise that resolves immediately
    return Promise.resolve();
  }

  /**
   * Index a notification for search
   */
  async indexNotification(notification: any): Promise<void> {
    // In a real implementation, this would index the notification in a search engine
    // For now, we'll just return a promise that resolves immediately
    return Promise.resolve();
  }

  /**
   * Update notification index
   */
  async updateNotificationIndex(notification: any): Promise<void> {
    // In a real implementation, this would update the notification index
    // For now, we'll just return a promise that resolves immediately
    return Promise.resolve();
  }

  /**
   * Search expenses
   */
  async searchExpenses(query: string, limit: number = 8): Promise<ServiceResult<any[]>> {
    // In a real implementation, this would search expenses
    // For now, we'll just return an empty result
    return ok([]);
  }

  /**
   * Search users
   */
  async searchUsers(query: string, limit: number = 8): Promise<ServiceResult<any[]>> {
    // In a real implementation, this would search users
    // For now, we'll just return an empty result
    return ok([]);
  }

  /**
   * Search notifications
   */
  async searchNotifications(query: string, limit: number = 8): Promise<ServiceResult<any[]>> {
    // In a real implementation, this would search notifications
    // For now, we'll just return an empty result
    return ok([]);
  }
}

// Export singleton instance
export const searchService = SearchService.getInstance();

// Export types for backward compatibility
export {
  type GlobalSearchResult,
  type SearchBorrowerResult,
  type SearchLoanResult,
  type SearchOptions,
  type ServiceResult,
};
