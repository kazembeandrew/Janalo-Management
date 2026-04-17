import { useEnhancedStore } from '../store/enhancedStore';
import { Borrower } from '../types';

/**
 * Hook for accessing and managing borrower data with caching and computed values
 */
export const useBorrowers = () => {
  const {
    borrowers,
    filteredBorrowers,
    borrowerStats,
    loadingStates,
    errors,
    fetchBorrowers,
    createBorrower,
    updateBorrower,
    deleteBorrower,
    setBorrowerFilters,
    setSearchQuery,
    borrowerFilters,
    searchQuery,
    clearError
  } = useEnhancedStore();

  const createBorrowerWithErrorHandling = async (data: Omit<Borrower, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const result = await createBorrower(data);
      clearError('borrowers');
      return result;
    } catch (error) {
      throw error;
    }
  };

  const updateBorrowerWithErrorHandling = async (id: string, data: Partial<Borrower>) => {
    try {
      const result = await updateBorrower(id, data);
      clearError('borrowers');
      return result;
    } catch (error) {
      throw error;
    }
  };

  const deleteBorrowerWithErrorHandling = async (id: string) => {
    try {
      const result = await deleteBorrower(id);
      clearError('borrowers');
      return result;
    } catch (error) {
      throw error;
    }
  };

  const fetchBorrowersWithErrorHandling = async (force?: boolean) => {
    try {
      await fetchBorrowers(force);
      clearError('borrowers');
    } catch (error) {
      throw error;
    }
  };

  // Filter borrowers by employment
  const getBorrowersByEmployment = (employment: string) => {
    return borrowers.filter(borrower => borrower.employment === employment);
  };

  // Filter borrowers by gender
  const getBorrowersByGender = (gender: string) => {
    return borrowers.filter(borrower => borrower.gender === gender);
  };

  // Filter borrowers by marital status
  const getBorrowersByMaritalStatus = (maritalStatus: string) => {
    return borrowers.filter(borrower => borrower.marital_status === maritalStatus);
  };

  // Get borrowers with active loans
  const getBorrowersWithActiveLoans = () => {
    const activeLoanBorrowerIds = new Set(
      borrowers.filter(b => b.loans?.some(loan => loan.status === 'active')).map(b => b.id)
    );
    return borrowers.filter(b => activeLoanBorrowerIds.has(b.id));
  };

  // Get borrowers with completed loans
  const getBorrowersWithCompletedLoans = () => {
    const completedLoanBorrowerIds = new Set(
      borrowers.filter(b => b.loans?.some(loan => loan.status === 'completed')).map(b => b.id)
    );
    return borrowers.filter(b => completedLoanBorrowerIds.has(b.id));
  };

  // Get borrower by ID
  const getBorrowerById = (id: string) => {
    return borrowers.find(borrower => borrower.id === id);
  };

  // Get borrower summary
  const getBorrowerSummary = (id: string) => {
    const borrower = getBorrowerById(id);
    if (!borrower) return null;

    const activeLoans = borrower.loans?.filter(loan => loan.status === 'active') || [];
    const completedLoans = borrower.loans?.filter(loan => loan.status === 'completed') || [];
    const pendingLoans = borrower.loans?.filter(loan => loan.status === 'pending') || [];

    const totalBorrowed = borrower.loans?.reduce((sum, loan) => sum + loan.principal_amount, 0) || 0;
    const totalOutstanding = borrower.loans?.reduce((sum, loan) => sum + loan.principal_outstanding, 0) || 0;
    const totalRepaid = totalBorrowed - totalOutstanding;

    return {
      ...borrower,
      activeLoansCount: activeLoans.length,
      completedLoansCount: completedLoans.length,
      pendingLoansCount: pendingLoans.length,
      totalBorrowed,
      totalOutstanding,
      totalRepaid,
      loanHistory: borrower.loans || []
    };
  };

  // Get borrowers by loan count
  const getBorrowersByLoanCount = (minLoans: number = 1) => {
    return borrowers.filter(borrower => (borrower.loans?.length || 0) >= minLoans);
  };

  // Get high-value borrowers (those with large outstanding amounts)
  const getHighValueBorrowers = (minOutstanding: number = 10000) => {
    return borrowers.filter(borrower => {
      const totalOutstanding = borrower.loans?.reduce((sum, loan) => sum + loan.principal_outstanding, 0) || 0;
      return totalOutstanding >= minOutstanding;
    });
  };

  return {
    // Data
    borrowers,
    filteredBorrowers,
    borrowerStats,

    // Filters and search
    borrowerFilters,
    searchQuery,
    setBorrowerFilters,
    setSearchQuery,

    // Loading and errors
    isLoading: loadingStates.borrowers,
    error: errors.borrowers,
    clearError: () => clearError('borrowers'),

    // Actions
    fetchBorrowers: fetchBorrowersWithErrorHandling,
    createBorrower: createBorrowerWithErrorHandling,
    updateBorrower: updateBorrowerWithErrorHandling,
    deleteBorrower: deleteBorrowerWithErrorHandling,

    // Computed values and utilities
    getBorrowersByEmployment,
    getBorrowersByGender,
    getBorrowersByMaritalStatus,
    getBorrowersWithActiveLoans,
    getBorrowersWithCompletedLoans,
    getBorrowerById,
    getBorrowerSummary,
    getBorrowersByLoanCount,
    getHighValueBorrowers,

    // Statistics
    totalBorrowers: borrowerStats.total,
    activeBorrowersCount: borrowerStats.active,
    completedBorrowersCount: borrowerStats.completed,
  };
};