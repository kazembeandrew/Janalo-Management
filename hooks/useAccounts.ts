import { useEnhancedStore } from '../store/enhancedStore';
import { InternalAccount } from '../types';

/**
 * Hook for accessing and managing account data with caching and computed values
 */
export const useAccounts = () => {
  const {
    accounts,
    filteredAccounts,
    loadingStates,
    errors,
    fetchAccounts,
    setAccountFilters,
    clearError
  } = useEnhancedStore();

  const fetchAccountsWithErrorHandling = async (force?: boolean) => {
    try {
      await fetchAccounts(force);
      clearError('accounts');
    } catch (error) {
      throw error;
    }
  };

  // Filter accounts by type
  const getAccountsByType = (type: string) => {
    return accounts.filter(account => account.type === type);
  };

  // Filter accounts by status
  const getAccountsByStatus = (status: string) => {
    return accounts.filter(account => account.status === status);
  };

  // Get active accounts
  const getActiveAccounts = () => {
    return getAccountsByStatus('active');
  };

  // Get inactive accounts
  const getInactiveAccounts = () => {
    return getAccountsByStatus('inactive');
  };

  // Get accounts by category
  const getAccountsByCategory = (category: string) => {
    return accounts.filter(account => account.category === category);
  };

  // Get account by ID
  const getAccountById = (id: string) => {
    return accounts.find(account => account.id === id);
  };

  // Get account by code
  const getAccountByCode = (code: string) => {
    return accounts.find(account => account.code === code);
  };

  // Get account summary
  const getAccountSummary = (id: string) => {
    const account = getAccountById(id);
    if (!account) return null;

    return {
      ...account,
      isDebit: account.type === 'debit',
      isCredit: account.type === 'credit',
      isActive: account.status === 'active',
      isInactive: account.status === 'inactive'
    };
  };

  // Get total balance for accounts
  const getTotalBalance = () => {
    return accounts.reduce((total, account) => total + account.balance, 0);
  };

  // Get total debit balance
  const getTotalDebitBalance = () => {
    return accounts
      .filter(account => account.type === 'debit')
      .reduce((total, account) => total + account.balance, 0);
  };

  // Get total credit balance
  const getTotalCreditBalance = () => {
    return accounts
      .filter(account => account.type === 'credit')
      .reduce((total, account) => total + account.balance, 0);
  };

  // Get accounts with zero balance
  const getZeroBalanceAccounts = () => {
    return accounts.filter(account => account.balance === 0);
  };

  // Get accounts with negative balance
  const getNegativeBalanceAccounts = () => {
    return accounts.filter(account => account.balance < 0);
  };

  // Get accounts with positive balance
  const getPositiveBalanceAccounts = () => {
    return accounts.filter(account => account.balance > 0);
  };

  // Get account statistics
  const getAccountStats = () => {
    const totalAccounts = accounts.length;
    const activeAccounts = getActiveAccounts().length;
    const inactiveAccounts = getInactiveAccounts().length;
    const debitAccounts = getAccountsByType('debit').length;
    const creditAccounts = getAccountsByType('credit').length;
    const totalBalance = getTotalBalance();
    const totalDebit = getTotalDebitBalance();
    const totalCredit = getTotalCreditBalance();

    return {
      totalAccounts,
      activeAccounts,
      inactiveAccounts,
      debitAccounts,
      creditAccounts,
      totalBalance,
      totalDebit,
      totalCredit,
      balanceDifference: totalDebit - totalCredit
    };
  };

  // Get accounts by prefix (for hierarchical accounts)
  const getAccountsByPrefix = (prefix: string) => {
    return accounts.filter(account => account.code.startsWith(prefix));
  };

  // Get parent accounts (accounts that have children)
  const getParentAccounts = () => {
    const childCodes = new Set(accounts.map(account => account.parent_account_code).filter(Boolean));
    return accounts.filter(account => childCodes.has(account.code));
  };

  // Get leaf accounts (accounts that have no children)
  const getLeafAccounts = () => {
    const parentCodes = new Set(accounts.map(account => account.parent_account_code).filter(Boolean));
    return accounts.filter(account => !parentCodes.has(account.code));
  };

  return {
    // Data
    accounts,
    filteredAccounts,

    // Filters
    setAccountFilters,

    // Loading and errors
    isLoading: loadingStates.accounts,
    error: errors.accounts,
    clearError: () => clearError('accounts'),

    // Actions
    fetchAccounts: fetchAccountsWithErrorHandling,

    // Computed values and utilities
    getAccountsByType,
    getAccountsByStatus,
    getActiveAccounts,
    getInactiveAccounts,
    getAccountsByCategory,
    getAccountById,
    getAccountByCode,
    getAccountSummary,
    getTotalBalance,
    getTotalDebitBalance,
    getTotalCreditBalance,
    getZeroBalanceAccounts,
    getNegativeBalanceAccounts,
    getPositiveBalanceAccounts,
    getAccountStats,
    getAccountsByPrefix,
    getParentAccounts,
    getLeafAccounts,

    // Statistics
    totalAccounts: accounts.length,
    activeAccountsCount: getActiveAccounts().length,
    inactiveAccountsCount: getInactiveAccounts().length,
    debitAccountsCount: getAccountsByType('debit').length,
    creditAccountsCount: getAccountsByType('credit').length,
    totalBalance: getTotalBalance(),
    totalDebit: getTotalDebitBalance(),
    totalCredit: getTotalCreditBalance(),
  };
};