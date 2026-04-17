import { useEnhancedStore } from '../store/enhancedStore';
import { Loan, LoanStatus } from '../types';

/**
 * Hook for accessing and managing loan data with caching and computed values
 */
export const useLoans = () => {
  const {
    loans,
    filteredLoans,
    loanStats,
    loadingStates,
    errors,
    fetchLoans,
    createLoan,
    updateLoan,
    deleteLoan,
    setLoanFilters,
    setSearchQuery,
    loanFilters,
    searchQuery,
    clearError
  } = useEnhancedStore();

  const createLoanWithErrorHandling = async (data: Omit<Loan, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const result = await createLoan(data);
      clearError('loans');
      return result;
    } catch (error) {
      throw error;
    }
  };

  const updateLoanWithErrorHandling = async (id: string, data: Partial<Loan>) => {
    try {
      const result = await updateLoan(id, data);
      clearError('loans');
      return result;
    } catch (error) {
      throw error;
    }
  };

  const deleteLoanWithErrorHandling = async (id: string) => {
    try {
      const result = await deleteLoan(id);
      clearError('loans');
      return result;
    } catch (error) {
      throw error;
    }
  };

  const fetchLoansWithErrorHandling = async (force?: boolean) => {
    try {
      await fetchLoans(force);
      clearError('loans');
    } catch (error) {
      throw error;
    }
  };

  // Filter loans by status
  const getLoansByStatus = (status: LoanStatus) => {
    return loans.filter(loan => loan.status === status);
  };

  // Filter loans by officer
  const getLoansByOfficer = (officerId: string) => {
    return loans.filter(loan => loan.officer_id === officerId);
  };

  // Filter loans by borrower
  const getLoansByBorrower = (borrowerId: string) => {
    return loans.filter(loan => loan.borrower_id === borrowerId);
  };

  // Get active loans
  const getActiveLoans = () => {
    return getLoansByStatus('active');
  };

  // Get completed loans
  const getCompletedLoans = () => {
    return getLoansByStatus('completed');
  };

  // Get pending loans
  const getPendingLoans = () => {
    return getLoansByStatus('pending');
  };

  // Get overdue loans
  const getOverdueLoans = () => {
    const now = new Date();
    return loans.filter(loan => {
      const repayments = filteredLoans.find(l => l.id === loan.id)?.repayments || [];
      const monthsPaid = repayments.length;
      const dueDate = new Date(loan.disbursement_date);
      dueDate.setMonth(dueDate.getMonth() + monthsPaid + 1);
      return monthsPaid < loan.term_months && dueDate < now;
    });
  };

  // Get loan by ID
  const getLoanById = (id: string) => {
    return loans.find(loan => loan.id === id);
  };

  // Get loan summary
  const getLoanSummary = (id: string) => {
    const loan = getLoanById(id);
    if (!loan) return null;

    const repayments = filteredLoans.find(l => l.id === id)?.repayments || [];
    const totalPaid = repayments.reduce((sum, repayment) => sum + repayment.amount_paid, 0);
    const remainingBalance = loan.total_payable - totalPaid;
    const paymentProgress = loan.total_payable > 0 ? (totalPaid / loan.total_payable) * 100 : 0;

    return {
      ...loan,
      totalPaid,
      remainingBalance,
      paymentProgress,
      repaymentsCount: repayments.length,
      isOverdue: getOverdueLoans().some(l => l.id === id)
    };
  };

  return {
    // Data
    loans,
    filteredLoans,
    loanStats,

    // Filters and search
    loanFilters,
    searchQuery,
    setLoanFilters,
    setSearchQuery,

    // Loading and errors
    isLoading: loadingStates.loans,
    error: errors.loans,
    clearError: () => clearError('loans'),

    // Actions
    fetchLoans: fetchLoansWithErrorHandling,
    createLoan: createLoanWithErrorHandling,
    updateLoan: updateLoanWithErrorHandling,
    deleteLoan: deleteLoanWithErrorHandling,

    // Computed values and utilities
    getLoansByStatus,
    getLoansByOfficer,
    getLoansByBorrower,
    getActiveLoans,
    getCompletedLoans,
    getPendingLoans,
    getOverdueLoans,
    getLoanById,
    getLoanSummary,

    // Statistics
    totalLoans: loanStats.total,
    activeLoansCount: loanStats.active,
    completedLoansCount: loanStats.completed,
    pendingLoansCount: loanStats.pending,
    totalDisbursed: loanStats.totalDisbursed,
    totalOutstanding: loanStats.totalOutstanding,
    totalRepaid: loanStats.totalRepaid,
  };
};