import { useState, useCallback, useMemo } from 'react';
import { useLoans } from './useLoans';
import { useBorrowers } from './useBorrowers';
import { useAccounts } from './useAccounts';
import { useRepayments } from './useRepayments';
import { useJournalEntries } from './useJournalEntries';
import { Loan, Borrower, InternalAccount, Repayment, JournalEntry } from '../types';

interface SearchResult {
  type: 'loan' | 'borrower' | 'account' | 'repayment' | 'journal_entry';
  id: string;
  title: string;
  subtitle: string;
  data: Loan | Borrower | InternalAccount | Repayment | JournalEntry;
  relevance: number;
}

interface GlobalSearchOptions {
  includeLoans?: boolean;
  includeBorrowers?: boolean;
  includeAccounts?: boolean;
  includeRepayments?: boolean;
  includeJournalEntries?: boolean;
  limit?: number;
}

/**
 * Hook for global search across all entities with intelligent filtering and ranking
 */
export const useGlobalSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [lastSearchTime, setLastSearchTime] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const { loans, filteredLoans } = useLoans();
  const { borrowers, filteredBorrowers } = useBorrowers();
  const { accounts, filteredAccounts } = useAccounts();
  const { repayments } = useRepayments();
  const { journalEntries } = useJournalEntries();

  // Debounced search function
  const performSearch = useCallback(async (
    query: string, 
    options: GlobalSearchOptions = {}
  ): Promise<SearchResult[]> => {
    if (!query.trim()) {
      setSearchResults([]);
      return [];
    }

    setIsSearching(true);
    setSearchLoading(true);
    setSearchError(null);
    const startTime = Date.now();
    setLastSearchTime(startTime);

    // Default options
    const {
      includeLoans = true,
      includeBorrowers = true,
      includeAccounts = true,
      includeRepayments = true,
      includeJournalEntries = true,
      limit = 50
    } = options;

    const results: SearchResult[] = [];

    try {
      const lowercaseQuery = query.toLowerCase().trim();
      const queryParts = lowercaseQuery.split(/\s+/);

      // Search loans
      if (includeLoans) {
        const loanResults = filteredLoans.map(loan => {
          const relevance = calculateLoanRelevance(loan, queryParts);
          return {
            type: 'loan' as const,
            id: loan.id,
            title: `Loan: ${loan.reference_no}`,
            subtitle: `${loan.borrowers?.full_name || 'Unknown Borrower'} - ${formatCurrency(loan.principal_amount)}`,
            data: loan,
            relevance
          };
        }).filter(result => result.relevance > 0);

        results.push(...loanResults);
      }

      // Search borrowers
      if (includeBorrowers) {
        const borrowerResults = filteredBorrowers.map(borrower => {
          const relevance = calculateBorrowerRelevance(borrower, queryParts);
          return {
            type: 'borrower' as const,
            id: borrower.id,
            title: `Borrower: ${borrower.full_name}`,
            subtitle: `${borrower.phone} - ${borrower.employment}`,
            data: borrower,
            relevance
          };
        }).filter(result => result.relevance > 0);

        results.push(...borrowerResults);
      }

      // Search accounts
      if (includeAccounts) {
        const accountResults = filteredAccounts.map(account => {
          const relevance = calculateAccountRelevance(account, queryParts);
          return {
            type: 'account' as const,
            id: account.id,
            title: `Account: ${account.name}`,
            subtitle: `${account.code} - ${formatCurrency(account.balance)}`,
            data: account,
            relevance
          };
        }).filter(result => result.relevance > 0);

        results.push(...accountResults);
      }

      // Search repayments
      if (includeRepayments) {
        const repaymentResults = repayments.map(repayment => {
          const relevance = calculateRepaymentRelevance(repayment, queryParts);
          return {
            type: 'repayment' as const,
            id: repayment.id,
            title: `Repayment: ${formatCurrency(repayment.amount_paid)}`,
            subtitle: `Loan ${repayment.loan_id} - ${repayment.status}`,
            data: repayment,
            relevance
          };
        }).filter(result => result.relevance > 0);

        results.push(...repaymentResults);
      }

      // Search journal entries
      if (includeJournalEntries) {
        const journalResults = journalEntries.map(entry => {
          const relevance = calculateJournalEntryRelevance(entry, queryParts);
          return {
            type: 'journal_entry' as const,
            id: entry.id,
            title: `Journal Entry: ${entry.transaction_type}`,
            subtitle: `${formatCurrency(entry.debit_amount)} - ${entry.description}`,
            data: entry,
            relevance
          };
        }).filter(result => result.relevance > 0);

        results.push(...journalResults);
      }

      // Sort by relevance and limit results
      const sortedResults = results
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);

      setSearchResults(sortedResults);
      return sortedResults;
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Search failed');
      return [];
    } finally {
      // Only update state if this is still the latest search
      if (startTime === lastSearchTime) {
        setIsSearching(false);
        setSearchLoading(false);
      }
    }
  }, [filteredLoans, filteredBorrowers, filteredAccounts, repayments, journalEntries, lastSearchTime]);

  // Calculate relevance score for loans
  const calculateLoanRelevance = (loan: Loan, queryParts: string[]): number => {
    let score = 0;
    const loanText = `${loan.reference_no} ${loan.borrowers?.full_name || ''} ${loan.status} ${loan.interest_type}`.toLowerCase();

    for (const part of queryParts) {
      if (loan.reference_no.toLowerCase().includes(part)) {
        score += 10; // Exact reference match is very relevant
      } else if (loanText.includes(part)) {
        score += 1;
      }
    }

    return score;
  };

  // Calculate relevance score for borrowers
  const calculateBorrowerRelevance = (borrower: Borrower, queryParts: string[]): number => {
    let score = 0;
    const borrowerText = `${borrower.full_name} ${borrower.phone} ${borrower.employment} ${borrower.gender} ${borrower.marital_status}`.toLowerCase();

    for (const part of queryParts) {
      if (borrower.full_name.toLowerCase().includes(part)) {
        score += 10; // Exact name match is very relevant
      } else if (borrower.phone.includes(part)) {
        score += 8; // Phone match is highly relevant
      } else if (borrowerText.includes(part)) {
        score += 1;
      }
    }

    return score;
  };

  // Calculate relevance score for accounts
  const calculateAccountRelevance = (account: InternalAccount, queryParts: string[]): number => {
    let score = 0;
    const accountText = `${account.name} ${account.code} ${account.type} ${account.category}`.toLowerCase();

    for (const part of queryParts) {
      if (account.code.toLowerCase().includes(part)) {
        score += 10; // Exact code match is very relevant
      } else if (account.name.toLowerCase().includes(part)) {
        score += 5; // Name match is relevant
      } else if (accountText.includes(part)) {
        score += 1;
      }
    }

    return score;
  };

  // Calculate relevance score for repayments
  const calculateRepaymentRelevance = (repayment: Repayment, queryParts: string[]): number => {
    let score = 0;
    const repaymentText = `${repayment.loan_id} ${repayment.status} ${repayment.payment_method}`.toLowerCase();

    for (const part of queryParts) {
      if (repayment.loan_id.includes(part)) {
        score += 10; // Loan ID match is very relevant
      } else if (repaymentText.includes(part)) {
        score += 1;
      }
    }

    return score;
  };

  // Calculate relevance score for journal entries
  const calculateJournalEntryRelevance = (entry: JournalEntry, queryParts: string[]): number => {
    let score = 0;
    const entryText = `${entry.transaction_type} ${entry.description} ${entry.reference}`.toLowerCase();

    for (const part of queryParts) {
      if (entry.reference.toLowerCase().includes(part)) {
        score += 10; // Reference match is very relevant
      } else if (entry.description.toLowerCase().includes(part)) {
        score += 5; // Description match is relevant
      } else if (entryText.includes(part)) {
        score += 1;
      }
    }

    return score;
  };

  // Format currency for display
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Search with current query
  const search = useCallback((options?: GlobalSearchOptions) => {
    return performSearch(searchQuery, options);
  }, [searchQuery, performSearch]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Update search query
  const updateSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Add to search history
  const addToHistory = useCallback((query: string) => {
    if (query.trim() && !searchHistory.includes(query)) {
      setSearchHistory(prev => [query, ...prev.slice(0, 9)]); // Keep last 10 searches
    }
  }, [searchHistory]);

  // Remove from search history
  const removeFromHistory = useCallback((query: string) => {
    setSearchHistory(prev => prev.filter(q => q !== query));
  }, []);

  // Clear search history
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
  }, []);

  return {
    searchQuery,
    isSearching,
    lastSearchTime,
    performSearch,
    search,
    clearSearch,
    updateSearchQuery,
    formatCurrency,
    searchResults,
    searchLoading,
    searchError,
    searchHistory,
    addToHistory,
    removeFromHistory,
    clearHistory
  };
};