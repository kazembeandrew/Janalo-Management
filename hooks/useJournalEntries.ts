import { useEnhancedStore } from '../store/enhancedStore';
import { JournalEntry } from '../types';

/**
 * Hook for accessing and managing journal entry data with caching and computed values
 */
export const useJournalEntries = () => {
  const {
    journalEntries,
    loadingStates,
    errors,
    fetchJournalEntries,
    clearError
  } = useEnhancedStore();

  const fetchJournalEntriesWithErrorHandling = async (force?: boolean) => {
    try {
      await fetchJournalEntries(force);
      clearError('journalEntries');
    } catch (error) {
      throw error;
    }
  };

  // Filter journal entries by account
  const getJournalEntriesByAccount = (accountId: string) => {
    return journalEntries.filter(entry =>
      entry.journal_lines?.some(line => line.account_id === accountId)
    );
  };

  // Filter journal entries by date range
  const getJournalEntriesByDateRange = (startDate: Date, endDate: Date) => {
    return journalEntries.filter(entry => {
      const entryDate = new Date(entry.transaction_date);
      return entryDate >= startDate && entryDate <= endDate;
    });
  };

  // Filter journal entries by type
  const getJournalEntriesByType = (type: string) => {
    return journalEntries.filter(entry => entry.transaction_type === type);
  };

  // Filter journal entries by status
  const getJournalEntriesByStatus = (status: string) => {
    return journalEntries.filter(entry => entry.status === status);
  };

  // Get posted journal entries
  const getPostedEntries = () => {
    return getJournalEntriesByStatus('posted');
  };

  // Get pending journal entries
  const getPendingEntries = () => {
    return getJournalEntriesByStatus('pending');
  };

  // Get failed journal entries
  const getFailedEntries = () => {
    return getJournalEntriesByStatus('failed');
  };

  // Get journal entry by ID
  const getJournalEntryById = (id: string) => {
    return journalEntries.find(entry => entry.id === id);
  };

  // Get journal entry summary
  const getJournalEntrySummary = (id: string) => {
    const entry = getJournalEntryById(id);
    if (!entry) return null;

    return {
      ...entry,
      isPosted: entry.status === 'posted',
      isPending: entry.status === 'pending',
      isFailed: entry.status === 'failed',
      isDebit: entry.debit_amount > 0,
      isCredit: entry.credit_amount > 0
    };
  };

  // Get total debits and credits for a date range
  const getTotalsByDateRange = (startDate: Date, endDate: Date) => {
    const entries = getJournalEntriesByDateRange(startDate, endDate);
    
    return {
      totalDebits: entries.reduce((sum, entry) => sum + entry.debit_amount, 0),
      totalCredits: entries.reduce((sum, entry) => sum + entry.credit_amount, 0),
      entryCount: entries.length
    };
  };

  // Get journal entries by reference
  const getJournalEntriesByReference = (reference: string) => {
    return journalEntries.filter(entry => entry.reference.includes(reference));
  };

  // Get journal entries for a specific loan
  const getJournalEntriesForLoan = (loanId: string) => {
    return journalEntries.filter(entry => entry.reference.includes(loanId));
  };

  // Get journal entries for a specific borrower
  const getJournalEntriesForBorrower = (borrowerId: string) => {
    return journalEntries.filter(entry => entry.reference.includes(borrowerId));
  };

  // Get daily totals
  const getDailyTotals = (date: Date) => {
    const dayEntries = journalEntries.filter(entry => {
      const entryDate = new Date(entry.transaction_date);
      return entryDate.toDateString() === date.toDateString();
    });

    return {
      date,
      totalDebits: dayEntries.reduce((sum, entry) => sum + entry.debit_amount, 0),
      totalCredits: dayEntries.reduce((sum, entry) => sum + entry.credit_amount, 0),
      entryCount: dayEntries.length,
      isBalanced: dayEntries.every(entry => entry.debit_amount === entry.credit_amount)
    };
  };

  // Get monthly totals
  const getMonthlyTotals = (year: number, month: number) => {
    const monthEntries = journalEntries.filter(entry => {
      const entryDate = new Date(entry.transaction_date);
      return entryDate.getFullYear() === year && entryDate.getMonth() === month;
    });

    return {
      year,
      month,
      totalDebits: monthEntries.reduce((sum, entry) => sum + entry.debit_amount, 0),
      totalCredits: monthEntries.reduce((sum, entry) => sum + entry.credit_amount, 0),
      entryCount: monthEntries.length,
      isBalanced: monthEntries.every(entry => entry.debit_amount === entry.credit_amount)
    };
  };

  // Get unbalanced entries
  const getUnbalancedEntries = () => {
    return journalEntries.filter(entry => entry.debit_amount !== entry.credit_amount);
  };

  // Get entries by amount range
  const getEntriesByAmountRange = (minAmount: number, maxAmount: number) => {
    return journalEntries.filter(entry => 
      entry.debit_amount >= minAmount && entry.debit_amount <= maxAmount
    );
  };

  // Get recent entries
  const getRecentEntries = (limit: number = 10) => {
    return journalEntries
      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
      .slice(0, limit);
  };

  return {
    // Data
    journalEntries,

    // Loading and errors
    isLoading: loadingStates.journalEntries ?? false,
    error: errors.journalEntries ?? null,
    clearError: () => clearError('journalEntries'),

    // Actions
    fetchJournalEntries: fetchJournalEntriesWithErrorHandling,

    // Computed values and utilities
    getJournalEntriesByAccount,
    getJournalEntriesByDateRange,
    getJournalEntriesByType,
    getJournalEntriesByStatus,
    getPostedEntries,
    getPendingEntries,
    getFailedEntries,
    getJournalEntryById,
    getJournalEntrySummary,
    getTotalsByDateRange,
    getJournalEntriesByReference,
    getJournalEntriesForLoan,
    getJournalEntriesForBorrower,
    getDailyTotals,
    getMonthlyTotals,
    getUnbalancedEntries,
    getEntriesByAmountRange,
    getRecentEntries,

    // Statistics
    totalEntries: journalEntries.length,
    postedEntriesCount: getPostedEntries().length,
    pendingEntriesCount: getPendingEntries().length,
    failedEntriesCount: getFailedEntries().length,
    unbalancedEntriesCount: getUnbalancedEntries().length,
  };
};