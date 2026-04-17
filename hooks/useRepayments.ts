import { useEnhancedStore } from '../store/enhancedStore';
import { Repayment } from '../types';

/**
 * Hook for accessing and managing repayment data with caching and computed values
 */
export const useRepayments = () => {
  const {
    repayments,
    repaymentStats,
    loadingStates,
    errors,
    fetchRepayments,
    createRepayment,
    updateRepayment,
    deleteRepayment,
    clearError
  } = useEnhancedStore();

  const createRepaymentWithErrorHandling = async (data: { loan_id: string; amount_paid: number; payment_date: string; target_account_id: string; transaction_fee?: number; notes?: string; recorded_by?: string; payment_method?: string }) => {
    try {
      const result = await createRepayment(data);
      clearError('repayments');
      return result;
    } catch (error) {
      throw error;
    }
  };

  const updateRepaymentWithErrorHandling = async (id: string, data: Partial<Repayment>) => {
    try {
      const result = await updateRepayment(id, data);
      clearError('repayments');
      return result;
    } catch (error) {
      throw error;
    }
  };

  const deleteRepaymentWithErrorHandling = async (id: string) => {
    try {
      const result = await deleteRepayment(id);
      clearError('repayments');
      return result;
    } catch (error) {
      throw error;
    }
  };

  const fetchRepaymentsWithErrorHandling = async (force?: boolean) => {
    try {
      await fetchRepayments(force);
      clearError('repayments');
    } catch (error) {
      throw error;
    }
  };

  // Filter repayments by loan
  const getRepaymentsByLoan = (loanId: string) => {
    return repayments.filter(repayment => repayment.loan_id === loanId);
  };

  // Filter repayments by date range
  const getRepaymentsByDateRange = (startDate: Date, endDate: Date) => {
    return repayments.filter(repayment => {
      const repaymentDate = new Date(repayment.payment_date);
      return repaymentDate >= startDate && repaymentDate <= endDate;
    });
  };

  // Filter repayments by amount range
  const getRepaymentsByAmountRange = (minAmount: number, maxAmount: number) => {
    return repayments.filter(repayment => 
      repayment.amount_paid >= minAmount && repayment.amount_paid <= maxAmount
    );
  };

  // Get repayments by status
  const getRepaymentsByStatus = (status: string) => {
    return repayments.filter(repayment => repayment.status === status);
  };

  // Get successful repayments
  const getSuccessfulRepayments = () => {
    return getRepaymentsByStatus('completed');
  };

  // Get failed repayments
  const getFailedRepayments = () => {
    return getRepaymentsByStatus('failed');
  };

  // Get pending repayments
  const getPendingRepayments = () => {
    return getRepaymentsByStatus('pending');
  };

  // Get repayment by ID
  const getRepaymentById = (id: string) => {
    return repayments.find(repayment => repayment.id === id);
  };

  // Get repayment summary
  const getRepaymentSummary = (id: string) => {
    const repayment = getRepaymentById(id);
    if (!repayment) return null;

    return {
      ...repayment,
      isSuccessful: repayment.status === 'completed',
      isFailed: repayment.status === 'failed',
      isPending: repayment.status === 'pending'
    };
  };

  // Get total repayments for a loan
  const getTotalRepaymentsForLoan = (loanId: string) => {
    const loanRepayments = getRepaymentsByLoan(loanId);
    return loanRepayments.reduce((total, repayment) => total + repayment.amount_paid, 0);
  };

  // Get repayment count for a loan
  const getRepaymentCountForLoan = (loanId: string) => {
    return getRepaymentsByLoan(loanId).length;
  };

  // Get average repayment amount
  const getAverageRepaymentAmount = () => {
    if (repayments.length === 0) return 0;
    const totalAmount = repayments.reduce((sum, repayment) => sum + repayment.amount_paid, 0);
    return totalAmount / repayments.length;
  };

  // Get repayment statistics by date
  const getRepaymentStatsByDate = (date: Date) => {
    const dayRepayments = repayments.filter(repayment => {
      const repaymentDate = new Date(repayment.payment_date);
      return repaymentDate.toDateString() === date.toDateString();
    });

    return {
      date,
      totalAmount: dayRepayments.reduce((sum, repayment) => sum + repayment.amount_paid, 0),
      totalCount: dayRepayments.length,
      successfulCount: dayRepayments.filter(r => r.status === 'completed').length,
      failedCount: dayRepayments.filter(r => r.status === 'failed').length,
      pendingCount: dayRepayments.filter(r => r.status === 'pending').length
    };
  };

  // Get monthly repayment statistics
  const getMonthlyRepaymentStats = (year: number, month: number) => {
    const monthRepayments = repayments.filter(repayment => {
      const repaymentDate = new Date(repayment.payment_date);
      return repaymentDate.getFullYear() === year && repaymentDate.getMonth() === month;
    });

    return {
      year,
      month,
      totalAmount: monthRepayments.reduce((sum, repayment) => sum + repayment.amount_paid, 0),
      totalCount: monthRepayments.length,
      successfulCount: monthRepayments.filter(r => r.status === 'completed').length,
      failedCount: monthRepayments.filter(r => r.status === 'failed').length,
      pendingCount: monthRepayments.filter(r => r.status === 'pending').length
    };
  };

  // Get overdue repayments
  const getOverdueRepayments = () => {
    const now = new Date();
    return repayments.filter(repayment => {
      const dueDate = new Date(repayment.payment_date);
      return dueDate < now && repayment.status !== 'completed';
    });
  };

  // Get repayments due today
  const getRepaymentsDueToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return repayments.filter(repayment => {
      const repaymentDate = new Date(repayment.payment_date);
      return repaymentDate >= today && repaymentDate < tomorrow && repayment.status !== 'completed';
    });
  };

  return {
    // Data
    repayments,
    repaymentStats,

    // Loading and errors
    isLoading: loadingStates.repayments,
    error: errors.repayments,
    clearError: () => clearError('repayments'),

    // Actions
    fetchRepayments: fetchRepaymentsWithErrorHandling,
    createRepayment: createRepaymentWithErrorHandling,
    updateRepayment: updateRepaymentWithErrorHandling,
    deleteRepayment: deleteRepaymentWithErrorHandling,

    // Computed values and utilities
    getRepaymentsByLoan,
    getRepaymentsByDateRange,
    getRepaymentsByAmountRange,
    getRepaymentsByStatus,
    getSuccessfulRepayments,
    getFailedRepayments,
    getPendingRepayments,
    getRepaymentById,
    getRepaymentSummary,
    getTotalRepaymentsForLoan,
    getRepaymentCountForLoan,
    getAverageRepaymentAmount,
    getRepaymentStatsByDate,
    getMonthlyRepaymentStats,
    getOverdueRepayments,
    getRepaymentsDueToday,

    // Statistics
    totalRepayments: repaymentStats.total,
    totalCollected: repaymentStats.totalCollected,
    averageRepayment: repaymentStats.averageRepayment,
    overdueLoans: repaymentStats.overdueLoans,
  };
};