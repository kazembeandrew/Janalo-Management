import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { 
  Loan, 
  Borrower, 
  Repayment, 
  InternalAccount, 
  JournalEntry,
  LoanStatus,
  InterestType 
} from '../types';
import { 
  loanService, 
  borrowerService, 
  repaymentService, 
  accountsService, 
  journalEntriesService 
} from '../services';

interface AppState {
  // State
  loans: Loan[];
  borrowers: Borrower[];
  repayments: Repayment[];
  accounts: InternalAccount[];
  journalEntries: JournalEntry[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchLoans: () => Promise<void>;
  fetchBorrowers: () => Promise<void>;
  fetchRepayments: () => Promise<void>;
  fetchAccounts: () => Promise<void>;
  fetchJournalEntries: () => Promise<void>;
  
  createLoan: (data: any) => Promise<Loan>;
  updateLoan: (id: string, data: any) => Promise<Loan>;
  deleteLoan: (id: string) => Promise<boolean>;
  
  createBorrower: (data: any) => Promise<Borrower>;
  updateBorrower: (id: string, data: any) => Promise<Borrower>;
  deleteBorrower: (id: string) => Promise<boolean>;
  
  createRepayment: (data: any) => Promise<Repayment>;
  updateRepayment: (id: string, data: any) => Promise<Repayment>;
  deleteRepayment: (id: string) => Promise<boolean>;

  // Search and filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredLoans: Loan[];
  filteredBorrowers: Borrower[];
  filteredRepayments: Repayment[];
  
  // Filters
  loanFilters: {
    status?: LoanStatus;
    officer_id?: string;
    borrower_id?: string;
    date_from?: string;
    date_to?: string;
    amount_min?: number;
    amount_max?: number;
  };
  setLoanFilters: (filters: Partial<AppState['loanFilters']>) => void;
  
  borrowerFilters: {
    search?: string;
    employment?: string;
    gender?: string;
    marital_status?: string;
    date_from?: string;
    date_to?: string;
  };
  setBorrowerFilters: (filters: Partial<AppState['borrowerFilters']>) => void;

  // Pagination
  pagination: {
    loans: { page: number; limit: number; total: number };
    borrowers: { page: number; limit: number; total: number };
    repayments: { page: number; limit: number; total: number };
  };
  setPagination: (entity: 'loans' | 'borrowers' | 'repayments', data: Partial<AppState['pagination']['loans']>) => void;

  // Utilities
  clearError: () => void;
  resetStore: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      loans: [],
      borrowers: [],
      repayments: [],
      accounts: [],
      journalEntries: [],
      isLoading: false,
      error: null,
      
      searchQuery: '',
      loanFilters: {},
      borrowerFilters: {},
      filteredLoans: [],
      filteredBorrowers: [],
      filteredRepayments: [],
      pagination: {
        loans: { page: 1, limit: 10, total: 0 },
        borrowers: { page: 1, limit: 10, total: 0 },
        repayments: { page: 1, limit: 10, total: 0 }
      },

      // Actions
      fetchLoans: async () => {
        set({ isLoading: true, error: null });
        try {
          const result = await loanService.getLoans();
          if (result.success && result.data) {
            set({ 
              loans: result.data.data || [],
              pagination: {
                ...get().pagination,
                loans: {
                  page: result.data.page || 1,
                  limit: result.data.limit || 10,
                  total: result.data.total || 0
                }
              }
            });
          } else {
            set({ error: result.error?.message || 'Failed to fetch loans' });
          }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'An error occurred while fetching loans' });
        } finally {
          set({ isLoading: false });
        }
      },

      fetchBorrowers: async () => {
        set({ isLoading: true, error: null });
        try {
          const result = await borrowerService.getBorrowers();
          if (result.success && result.data) {
            set({ 
              borrowers: result.data.data || [],
              pagination: {
                ...get().pagination,
                borrowers: {
                  page: result.data.page || 1,
                  limit: result.data.limit || 10,
                  total: result.data.total || 0
                }
              }
            });
          } else {
            set({ error: result.error?.message || 'Failed to fetch borrowers' });
          }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'An error occurred while fetching borrowers' });
        } finally {
          set({ isLoading: false });
        }
      },

      fetchRepayments: async () => {
        set({ isLoading: true, error: null });
        try {
          const result = await repaymentService.getRepayments();
          if (result.success && result.data) {
            set({ 
              repayments: result.data.data || [],
              pagination: {
                ...get().pagination,
                repayments: {
                  page: result.data.page || 1,
                  limit: result.data.limit || 10,
                  total: result.data.total || 0
                }
              }
            });
          } else {
            set({ error: result.error?.message || 'Failed to fetch repayments' });
          }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'An error occurred while fetching repayments' });
        } finally {
          set({ isLoading: false });
        }
      },

      fetchAccounts: async () => {
        set({ isLoading: true, error: null });
        try {
          const result = await accountsService.getAccounts();
          if (result.success && result.data) {
            set({ accounts: result.data.data || [] });
          } else {
            set({ error: result.error?.message || 'Failed to fetch accounts' });
          }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'An error occurred while fetching accounts' });
        } finally {
          set({ isLoading: false });
        }
      },

      fetchJournalEntries: async () => {
        set({ isLoading: true, error: null });
        try {
          const result = await journalEntriesService.getJournalEntries();
          if (result.success && result.data) {
            set({ journalEntries: result.data.data || [] });
          } else {
            set({ error: result.error?.message || 'Failed to fetch journal entries' });
          }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'An error occurred while fetching journal entries' });
        } finally {
          set({ isLoading: false });
        }
      },

      createLoan: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const result = await loanService.createLoan(data);
          if (result.success && result.data) {
            set((state) => ({
              loans: [...state.loans, result.data!],
              isLoading: false
            }));
            return result.data;
          } else {
            throw new Error(result.error?.message || 'Failed to create loan');
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'An error occurred while creating loan',
            isLoading: false 
          });
          throw error;
        }
      },

      updateLoan: async (id, data) => {
        set({ isLoading: true, error: null });
        try {
          const result = await loanService.updateLoan({ id, ...data });
          if (result.success && result.data) {
            set((state) => ({
              loans: state.loans.map(loan => loan.id === id ? result.data! : loan),
              isLoading: false
            }));
            return result.data;
          } else {
            throw new Error(result.error?.message || 'Failed to update loan');
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'An error occurred while updating loan',
            isLoading: false 
          });
          throw error;
        }
      },

      deleteLoan: async (id) => {
        set({ isLoading: true, error: null });
        try {
          const result = await loanService.deleteLoan(id);
          if (result.success && result.data) {
            set((state) => ({
              loans: state.loans.filter(loan => loan.id !== id),
              isLoading: false
            }));
            return true;
          } else {
            throw new Error(result.error?.message || 'Failed to delete loan');
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'An error occurred while deleting loan',
            isLoading: false 
          });
          throw error;
        }
      },

      createBorrower: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const result = await borrowerService.createBorrower(data);
          if (result.success && result.data) {
            set((state) => ({
              borrowers: [...state.borrowers, result.data!],
              isLoading: false
            }));
            return result.data;
          } else {
            throw new Error(result.error?.message || 'Failed to create borrower');
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'An error occurred while creating borrower',
            isLoading: false 
          });
          throw error;
        }
      },

      updateBorrower: async (id, data) => {
        set({ isLoading: true, error: null });
        try {
          const result = await borrowerService.updateBorrower({ id, ...data });
          if (result.success && result.data) {
            set((state) => ({
              borrowers: state.borrowers.map(borrower => borrower.id === id ? result.data! : borrower),
              isLoading: false
            }));
            return result.data;
          } else {
            throw new Error(result.error?.message || 'Failed to update borrower');
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'An error occurred while updating borrower',
            isLoading: false 
          });
          throw error;
        }
      },

      deleteBorrower: async (id) => {
        set({ isLoading: true, error: null });
        try {
          const result = await borrowerService.deleteBorrower(id);
          if (result.success && result.data) {
            set((state) => ({
              borrowers: state.borrowers.filter(borrower => borrower.id !== id),
              isLoading: false
            }));
            return true;
          } else {
            throw new Error(result.error?.message || 'Failed to delete borrower');
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'An error occurred while deleting borrower',
            isLoading: false 
          });
          throw error;
        }
      },

      createRepayment: async (data) => {
        set({ isLoading: true, error: null });
        try {
          // Use atomic repayment for transactional safety
          const result = await repaymentService.recordAtomicRepayment({
            loan_id: data.loan_id,
            amount: data.amount_paid,
            account_id: data.target_account_id,
            payment_date: data.payment_date,
            notes: data.notes,
            reference: data.reference_number,
            payment_method: data.payment_method
          });
          
          if (result.success && result.data) {
            // Fetch the created repayment record
            const repaymentsResult = await repaymentService.getRepayments({ loan_id: data.loan_id });
            const newRepayment = repaymentsResult.data?.data?.[0];
            
            if (newRepayment) {
              set((state) => ({
                repayments: [...state.repayments, newRepayment],
                isLoading: false
              }));
              
              // Also update the loan's outstanding balance by refetching loans
              const loansResult = await loanService.getLoans();
              if (loansResult.success && loansResult.data) {
                set({ loans: loansResult.data.data });
              }
              
              return newRepayment;
            }
          }
          
          throw new Error(result.error?.message || 'Failed to create repayment');
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'An error occurred while creating repayment',
            isLoading: false 
          });
          throw error;
        }
      },

      updateRepayment: async (id, data) => {
        set({ isLoading: true, error: null });
        try {
          const result = await repaymentService.updateRepayment(id, data);
          if (result.success && result.data) {
            set((state) => ({
              repayments: state.repayments.map(repayment => repayment.id === id ? result.data! : repayment),
              isLoading: false
            }));
            return result.data;
          } else {
            throw new Error(result.error?.message || 'Failed to update repayment');
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'An error occurred while updating repayment',
            isLoading: false 
          });
          throw error;
        }
      },

      deleteRepayment: async (id) => {
        set({ isLoading: true, error: null });
        try {
          const result = await repaymentService.deleteRepayment(id);
          if (result.success && result.data) {
            set((state) => ({
              repayments: state.repayments.filter(repayment => repayment.id !== id),
              isLoading: false
            }));
            return true;
          } else {
            throw new Error(result.error?.message || 'Failed to delete repayment');
          }
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'An error occurred while deleting repayment',
            isLoading: false 
          });
          throw error;
        }
      },

      // Search and filters
      setSearchQuery: (query) => set({ searchQuery: query }),
      
      setLoanFilters: (filters) => set((state) => ({
        loanFilters: { ...state.loanFilters, ...filters }
      })),

      setBorrowerFilters: (filters) => set((state) => ({
        borrowerFilters: { ...state.borrowerFilters, ...filters }
      })),

      setPagination: (entity, data) => set((state) => ({
        pagination: {
          ...state.pagination,
          [entity]: { ...state.pagination[entity], ...data }
        }
      })),

      clearError: () => set({ error: null }),
      
      resetStore: () => set({
        loans: [],
        borrowers: [],
        repayments: [],
        accounts: [],
        journalEntries: [],
        isLoading: false,
        error: null,
        searchQuery: '',
        loanFilters: {},
        borrowerFilters: {},
        pagination: {
          loans: { page: 1, limit: 10, total: 0 },
          borrowers: { page: 1, limit: 10, total: 0 },
          repayments: { page: 1, limit: 10, total: 0 }
        }
      })
    }),
    {
      name: 'janalo-app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist user preferences, not the data
        searchQuery: state.searchQuery,
        loanFilters: state.loanFilters,
        borrowerFilters: state.borrowerFilters,
        pagination: state.pagination
      })
    }
  )
);

// Computed values and selectors
export const useFilteredLoans = () => {
  const { loans, searchQuery, loanFilters } = useAppStore();
  
  return loans.filter(loan => {
    const matchesSearch = !searchQuery || 
      loan.reference_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.borrowers?.full_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = !loanFilters.status || loan.status === loanFilters.status;
    const matchesOfficer = !loanFilters.officer_id || loan.officer_id === loanFilters.officer_id;
    const matchesBorrower = !loanFilters.borrower_id || loan.borrower_id === loanFilters.borrower_id;
    
    return matchesSearch && matchesStatus && matchesOfficer && matchesBorrower;
  });
};

export const useFilteredBorrowers = () => {
  const { borrowers, searchQuery, borrowerFilters } = useAppStore();
  
  return borrowers.filter(borrower => {
    const matchesSearch = !searchQuery || 
      borrower.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      borrower.phone.includes(searchQuery) ||
      borrower.employment.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesEmployment = !borrowerFilters.employment || borrower.employment === borrowerFilters.employment;
    const matchesGender = !borrowerFilters.gender || borrower.gender === borrowerFilters.gender;
    const matchesMaritalStatus = !borrowerFilters.marital_status || borrower.marital_status === borrowerFilters.marital_status;
    
    return matchesSearch && matchesEmployment && matchesGender && matchesMaritalStatus;
  });
};

export const useLoanStats = () => {
  const loans = useAppStore(state => state.loans);
  
  const totalLoans = loans.length;
  const activeLoans = loans.filter(loan => loan.status === 'active').length;
  const completedLoans = loans.filter(loan => loan.status === 'completed').length;
  const pendingLoans = loans.filter(loan => loan.status === 'pending').length;
  
  const totalDisbursed = loans.reduce((sum, loan) => sum + loan.principal_amount, 0);
  const totalOutstanding = loans.reduce((sum, loan) => sum + loan.principal_outstanding, 0);
  const totalRepaid = loans.reduce((sum, loan) => sum + (loan.total_payable - loan.principal_outstanding), 0);
  
  return {
    totalLoans,
    activeLoans,
    completedLoans,
    pendingLoans,
    totalDisbursed,
    totalOutstanding,
    totalRepaid
  };
};

export const useBorrowerStats = () => {
  const borrowers = useAppStore(state => state.borrowers);
  const loans = useAppStore(state => state.loans);
  
  const totalBorrowers = borrowers.length;
  const activeBorrowers = new Set(loans.filter(loan => loan.status === 'active').map(loan => loan.borrower_id)).size;
  const completedBorrowers = new Set(loans.filter(loan => loan.status === 'completed').map(loan => loan.borrower_id)).size;
  
  return {
    totalBorrowers,
    activeBorrowers,
    completedBorrowers
  };
};

export const useRepaymentStats = () => {
  const repayments = useAppStore(state => state.repayments);
  const loans = useAppStore(state => state.loans);
  
  const totalRepayments = repayments.length;
  const totalCollected = repayments.reduce((sum, repayment) => sum + repayment.amount_paid, 0);
  const averageRepayment = totalRepayments > 0 ? totalCollected / totalRepayments : 0;
  
  const overdueLoans = loans.filter(loan => {
    const repaymentsForLoan = repayments.filter(r => r.loan_id === loan.id);
    const monthsPaid = repaymentsForLoan.length;
    const currentDate = new Date();
    const dueDate = new Date(loan.disbursement_date);
    dueDate.setMonth(dueDate.getMonth() + monthsPaid + 1);
    return monthsPaid < loan.term_months && dueDate < currentDate;
  }).length;
  
  return {
    totalRepayments,
    totalCollected,
    averageRepayment,
    overdueLoans
  };
};