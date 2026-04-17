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

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface CacheState {
  loans: Map<string, CacheEntry<Loan[]>>;
  borrowers: Map<string, CacheEntry<Borrower[]>>;
  accounts: Map<string, CacheEntry<InternalAccount[]>>;
  lastCleanup: number;
}

interface SharedState {
  // Current user
  currentUser: any | null;
  setCurrentUser: (user: any) => void;
  
  // Cached data with TTL
  cache: CacheState;
  setCache: <T>(entity: string, key: string, data: T) => void;
  getCache: <T>(entity: string, key: string) => T | null;
  clearCache: (entity?: string) => void;
  cleanupCache: () => void;

  // Loading states
  loadingStates: {
    loans: boolean;
    borrowers: boolean;
    accounts: boolean;
    repayments: boolean;
    journalEntries: boolean;
  };
  setLoading: (entity: string, loading: boolean) => void;

  // Errors
  errors: Record<string, string | null>;
  setError: (entity: string, error: string | null) => void;
  clearError: (entity: string) => void;
}

interface LoanState {
  // Loan data
  loans: Loan[];
  setLoans: (loans: Loan[]) => void;
  
  // Loan operations
  fetchLoans: (force?: boolean) => Promise<void>;
  createLoan: (data: Omit<Loan, 'id' | 'created_at' | 'updated_at'>) => Promise<Loan>;
  updateLoan: (id: string, data: Partial<Loan>) => Promise<Loan>;
  deleteLoan: (id: string) => Promise<boolean>;
  
  // Loan filters and search
  loanFilters: {
    status?: LoanStatus;
    officer_id?: string;
    borrower_id?: string;
    date_from?: string;
    date_to?: string;
    amount_min?: number;
    amount_max?: number;
  };
  setLoanFilters: (filters: Partial<LoanState['loanFilters']>) => void;
  
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  // Computed values
  filteredLoans: Loan[];
  loanStats: {
    total: number;
    active: number;
    completed: number;
    pending: number;
    totalDisbursed: number;
    totalOutstanding: number;
    totalRepaid: number;
  };
}

interface BorrowerState {
  // Borrower data
  borrowers: Borrower[];
  setBorrowers: (borrowers: Borrower[]) => void;
  
  // Borrower operations
  fetchBorrowers: (force?: boolean) => Promise<void>;
  createBorrower: (data: Omit<Borrower, 'id' | 'created_at' | 'updated_at'>) => Promise<Borrower>;
  updateBorrower: (id: string, data: Partial<Borrower>) => Promise<Borrower>;
  deleteBorrower: (id: string) => Promise<boolean>;
  
  // Borrower filters and search
  borrowerFilters: {
    search?: string;
    employment?: string;
    gender?: string;
    marital_status?: string;
    date_from?: string;
    date_to?: string;
  };
  setBorrowerFilters: (filters: Partial<BorrowerState['borrowerFilters']>) => void;
  
  // Computed values
  filteredBorrowers: Borrower[];
  borrowerStats: {
    total: number;
    active: number;
    completed: number;
  };
}

interface AccountState {
  // Account data
  accounts: InternalAccount[];
  setAccounts: (accounts: InternalAccount[]) => void;
  
  // Account operations
  fetchAccounts: (force?: boolean) => Promise<void>;
  
  // Account filters
  accountFilters: {
    type?: string;
    status?: string;
  };
  setAccountFilters: (filters: Partial<AccountState['accountFilters']>) => void;
  
  // Computed values
  filteredAccounts: InternalAccount[];
}

interface RepaymentState {
  // Repayment data
  repayments: Repayment[];
  setRepayments: (repayments: Repayment[]) => void;
  
  // Repayment operations
  fetchRepayments: (force?: boolean) => Promise<void>;
  createRepayment: (data: { loan_id: string; amount_paid: number; payment_date: string; target_account_id: string; transaction_fee?: number; notes?: string; recorded_by?: string; payment_method?: string; reference_number?: string }) => Promise<Repayment>;
  updateRepayment: (id: string, data: Partial<Repayment>) => Promise<Repayment>;
  deleteRepayment: (id: string) => Promise<boolean>;
  
  // Computed values
  repaymentStats: {
    total: number;
    totalCollected: number;
    averageRepayment: number;
    overdueLoans: number;
  };
}

interface JournalState {
  // Journal data
  journalEntries: JournalEntry[];
  setJournalEntries: (entries: JournalEntry[]) => void;
  
  // Journal operations
  fetchJournalEntries: (force?: boolean) => Promise<void>;
}

type StoreState = SharedState & LoanState & BorrowerState & AccountState & RepaymentState & JournalState;

export const useEnhancedStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // Shared State
      currentUser: null,
      setCurrentUser: (user) => set({ currentUser: user }),

      cache: {
        loans: new Map(),
        borrowers: new Map(),
        accounts: new Map(),
        lastCleanup: Date.now()
      },
      
      setCache: <T>(entity: string, key: string, data: T) => {
        set((state) => {
          const entityCache = state.cache[entity as keyof CacheState['loans' | 'borrowers' | 'accounts']];
          if (entityCache) {
            // Check cache size and evict oldest if needed
            if (entityCache.size >= MAX_CACHE_SIZE) {
              const oldestKey = entityCache.keys().next().value;
              if (oldestKey) entityCache.delete(oldestKey);
            }
            
            entityCache.set(key, {
              data,
              timestamp: Date.now()
            });
          }
          return state;
        });
      },

      getCache: <T>(entity: string, key: string): T | null => {
        const state = get();
        const entityCache = state.cache[entity as keyof CacheState['loans' | 'borrowers' | 'accounts']];
        
        if (!entityCache || !entityCache.has(key)) {
          return null;
        }

        const entry = entityCache.get(key)!;
        
        // Check if cache entry is expired
        if (Date.now() - entry.timestamp > CACHE_TTL) {
          entityCache.delete(key);
          return null;
        }

        // Cleanup if needed
        if (Date.now() - state.cache.lastCleanup > 60000) { // Cleanup every minute
          state.cleanupCache();
        }

        return entry.data as T;
      },

      clearCache: (entity?: string) => {
        set((state) => {
          if (entity) {
            if (state.cache[entity as keyof CacheState]) {
              (state.cache[entity as keyof CacheState] as Map<string, CacheEntry<any>>).clear();
            }
          } else {
            state.cache.loans.clear();
            state.cache.borrowers.clear();
            state.cache.accounts.clear();
          }
          return state;
        });
      },

      cleanupCache: () => {
        set((state) => {
          const now = Date.now();
          
          ['loans', 'borrowers', 'accounts'].forEach(entity => {
            const entityCache = state.cache[entity as keyof CacheState['loans' | 'borrowers' | 'accounts']];
            if (entityCache) {
              for (const [key, entry] of entityCache.entries()) {
                if (now - entry.timestamp > CACHE_TTL) {
                  entityCache.delete(key);
                }
              }
            }
          });

          state.cache.lastCleanup = now;
          return state;
        });
      },

      loadingStates: {
        loans: false,
        borrowers: false,
        accounts: false,
        repayments: false,
        journalEntries: false,
      },
      
      setLoading: (entity: string, loading: boolean) => {
        set((state) => ({
          loadingStates: {
            ...state.loadingStates,
            [entity]: loading
          }
        }));
      },

      errors: {},
      setError: (entity: string, error: string | null) => {
        set((state) => ({
          errors: {
            ...state.errors,
            [entity]: error
          }
        }));
      },

      clearError: (entity: string) => {
        set((state) => ({
          errors: {
            ...state.errors,
            [entity]: null
          }
        }));
      },

      // Loan State
      loans: [],
      setLoans: (loans) => set({ loans }),

      loanFilters: {},
      setLoanFilters: (filters) => set((state) => ({
        loanFilters: { ...state.loanFilters, ...filters }
      })),

      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),

      filteredLoans: [],
      loanStats: {
        total: 0,
        active: 0,
        completed: 0,
        pending: 0,
        totalDisbursed: 0,
        totalOutstanding: 0,
        totalRepaid: 0,
      },

      fetchLoans: async (force = false) => {
        const state = get();
        
        if (!force) {
          const cached = state.getCache<Loan[]>('loans', 'all');
          if (cached) {
            set({ loans: cached });
            return;
          }
        }

        state.setLoading('loans', true);
        state.clearError('loans');

        try {
          const result = await loanService.getLoans();
          if (result.success && result.data) {
            set({ 
              loans: result.data.data || [],
              filteredLoans: result.data.data || []
            });
            state.setCache('loans', 'all', result.data.data || []);
          } else {
            state.setError('loans', result.error?.message || 'Failed to fetch loans');
          }
        } catch (error) {
          state.setError('loans', error instanceof Error ? error.message : 'An error occurred while fetching loans');
        } finally {
          state.setLoading('loans', false);
        }
      },

      createLoan: async (data) => {
        const state = get();
        state.setLoading('loans', true);
        state.clearError('loans');

        try {
          const result = await loanService.createLoan(data);
          if (result.success && result.data) {
            set((prevState) => ({
              loans: [...prevState.loans, result.data!],
              filteredLoans: [...prevState.filteredLoans, result.data!]
            }));
            // Clear cache since data has changed
            state.clearCache('loans');
            return result.data;
          } else {
            throw new Error(result.error?.message || 'Failed to create loan');
          }
        } catch (error) {
          state.setError('loans', error instanceof Error ? error.message : 'An error occurred while creating loan');
          throw error;
        } finally {
          state.setLoading('loans', false);
        }
      },

      updateLoan: async (id, data) => {
        const state = get();
        state.setLoading('loans', true);
        state.clearError('loans');

        try {
          const result = await loanService.updateLoan({ id, ...data });
          if (result.success && result.data) {
            set((prevState) => ({
              loans: prevState.loans.map(loan => loan.id === id ? result.data! : loan),
              filteredLoans: prevState.filteredLoans.map(loan => loan.id === id ? result.data! : loan)
            }));
            // Clear cache since data has changed
            state.clearCache('loans');
            return result.data;
          } else {
            throw new Error(result.error?.message || 'Failed to update loan');
          }
        } catch (error) {
          state.setError('loans', error instanceof Error ? error.message : 'An error occurred while updating loan');
          throw error;
        } finally {
          state.setLoading('loans', false);
        }
      },

      deleteLoan: async (id) => {
        const state = get();
        state.setLoading('loans', true);
        state.clearError('loans');

        try {
          const result = await loanService.deleteLoan(id);
          if (result.success && result.data) {
            set((prevState) => ({
              loans: prevState.loans.filter(loan => loan.id !== id),
              filteredLoans: prevState.filteredLoans.filter(loan => loan.id !== id)
            }));
            // Clear cache since data has changed
            state.clearCache('loans');
            return true;
          } else {
            throw new Error(result.error?.message || 'Failed to delete loan');
          }
        } catch (error) {
          state.setError('loans', error instanceof Error ? error.message : 'An error occurred while deleting loan');
          throw error;
        } finally {
          state.setLoading('loans', false);
        }
      },

      // Borrower State
      borrowers: [],
      setBorrowers: (borrowers) => set({ borrowers }),

      borrowerFilters: {},
      setBorrowerFilters: (filters) => set((state) => ({
        borrowerFilters: { ...state.borrowerFilters, ...filters }
      })),

      filteredBorrowers: [],
      borrowerStats: {
        total: 0,
        active: 0,
        completed: 0,
      },

      fetchBorrowers: async (force = false) => {
        const state = get();
        
        if (!force) {
          const cached = state.getCache<Borrower[]>('borrowers', 'all');
          if (cached) {
            set({ borrowers: cached });
            return;
          }
        }

        state.setLoading('borrowers', true);
        state.clearError('borrowers');

        try {
          const result = await borrowerService.getBorrowers();
          if (result.success && result.data) {
            set({ 
              borrowers: result.data.data || [],
              filteredBorrowers: result.data.data || []
            });
            state.setCache('borrowers', 'all', result.data.data || []);
          } else {
            state.setError('borrowers', result.error?.message || 'Failed to fetch borrowers');
          }
        } catch (error) {
          state.setError('borrowers', error instanceof Error ? error.message : 'An error occurred while fetching borrowers');
        } finally {
          state.setLoading('borrowers', false);
        }
      },

      createBorrower: async (data) => {
        const state = get();
        state.setLoading('borrowers', true);
        state.clearError('borrowers');

        try {
          const result = await borrowerService.createBorrower(data);
          if (result.success && result.data) {
            set((prevState) => ({
              borrowers: [...prevState.borrowers, result.data!],
              filteredBorrowers: [...prevState.filteredBorrowers, result.data!]
            }));
            // Clear cache since data has changed
            state.clearCache('borrowers');
            return result.data;
          } else {
            throw new Error(result.error?.message || 'Failed to create borrower');
          }
        } catch (error) {
          state.setError('borrowers', error instanceof Error ? error.message : 'An error occurred while creating borrower');
          throw error;
        } finally {
          state.setLoading('borrowers', false);
        }
      },

      updateBorrower: async (id, data) => {
        const state = get();
        state.setLoading('borrowers', true);
        state.clearError('borrowers');

        try {
          const result = await borrowerService.updateBorrower({ id, ...data });
          if (result.success && result.data) {
            set((prevState) => ({
              borrowers: prevState.borrowers.map(borrower => borrower.id === id ? result.data! : borrower),
              filteredBorrowers: prevState.filteredBorrowers.map(borrower => borrower.id === id ? result.data! : borrower)
            }));
            // Clear cache since data has changed
            state.clearCache('borrowers');
            return result.data;
          } else {
            throw new Error(result.error?.message || 'Failed to update borrower');
          }
        } catch (error) {
          state.setError('borrowers', error instanceof Error ? error.message : 'An error occurred while updating borrower');
          throw error;
        } finally {
          state.setLoading('borrowers', false);
        }
      },

      deleteBorrower: async (id) => {
        const state = get();
        state.setLoading('borrowers', true);
        state.clearError('borrowers');

        try {
          const result = await borrowerService.deleteBorrower(id);
          if (result.success && result.data) {
            set((prevState) => ({
              borrowers: prevState.borrowers.filter(borrower => borrower.id !== id),
              filteredBorrowers: prevState.filteredBorrowers.filter(borrower => borrower.id !== id)
            }));
            // Clear cache since data has changed
            state.clearCache('borrowers');
            return true;
          } else {
            throw new Error(result.error?.message || 'Failed to delete borrower');
          }
        } catch (error) {
          state.setError('borrowers', error instanceof Error ? error.message : 'An error occurred while deleting borrower');
          throw error;
        } finally {
          state.setLoading('borrowers', false);
        }
      },

      // Account State
      accounts: [],
      setAccounts: (accounts) => set({ accounts }),

      accountFilters: {},
      setAccountFilters: (filters) => set((state) => ({
        accountFilters: { ...state.accountFilters, ...filters }
      })),

      filteredAccounts: [],

      fetchAccounts: async (force = false) => {
        const state = get();
        
        if (!force) {
          const cached = state.getCache<InternalAccount[]>('accounts', 'all');
          if (cached) {
            set({ accounts: cached });
            return;
          }
        }

        state.setLoading('accounts', true);
        state.clearError('accounts');

        try {
          const result = await accountsService.getAccounts();
          if (result.success && result.data) {
            set({ 
              accounts: result.data.data || [],
              filteredAccounts: result.data.data || []
            });
            state.setCache('accounts', 'all', result.data.data || []);
          } else {
            state.setError('accounts', result.error?.message || 'Failed to fetch accounts');
          }
        } catch (error) {
          state.setError('accounts', error instanceof Error ? error.message : 'An error occurred while fetching accounts');
        } finally {
          state.setLoading('accounts', false);
        }
      },

      // Repayment State
      repayments: [],
      setRepayments: (repayments) => set({ repayments }),

      repaymentStats: {
        total: 0,
        totalCollected: 0,
        averageRepayment: 0,
        overdueLoans: 0,
      },

      fetchRepayments: async (force = false) => {
        const state = get();
        
        if (!force) {
          const cached = state.getCache<Repayment[]>('repayments', 'all');
          if (cached) {
            set({ repayments: cached });
            return;
          }
        }

        state.setLoading('repayments', true);
        state.clearError('repayments');

        try {
          const result = await repaymentService.getRepayments();
          if (result.success && result.data) {
            set({ repayments: result.data.data || [] });
            state.setCache('repayments', 'all', result.data.data || []);
          } else {
            state.setError('repayments', result.error?.message || 'Failed to fetch repayments');
          }
        } catch (error) {
          state.setError('repayments', error instanceof Error ? error.message : 'An error occurred while fetching repayments');
        } finally {
          state.setLoading('repayments', false);
        }
      },

      createRepayment: async (data) => {
        const state = get();
        state.setLoading('repayments', true);
        state.clearError('repayments');

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
              set((prevState) => ({
                repayments: [...prevState.repayments, newRepayment]
              }));
              // Clear cache since data has changed
              state.clearCache('repayments');
              return newRepayment;
            }
          }
          
          throw new Error(result.error?.message || 'Failed to create repayment');
        } catch (error) {
          state.setError('repayments', error instanceof Error ? error.message : 'An error occurred while creating repayment');
          throw error;
        } finally {
          state.setLoading('repayments', false);
        }
      },

      updateRepayment: async (id, data) => {
        const state = get();
        state.setLoading('repayments', true);
        state.clearError('repayments');

        try {
          const result = await repaymentService.updateRepayment(id, data);
          if (result.success && result.data) {
            set((prevState) => ({
              repayments: prevState.repayments.map(repayment => repayment.id === id ? result.data! : repayment)
            }));
            // Clear cache since data has changed
            state.clearCache('repayments');
            return result.data;
          } else {
            throw new Error(result.error?.message || 'Failed to update repayment');
          }
        } catch (error) {
          state.setError('repayments', error instanceof Error ? error.message : 'An error occurred while updating repayment');
          throw error;
        } finally {
          state.setLoading('repayments', false);
        }
      },

      deleteRepayment: async (id) => {
        const state = get();
        state.setLoading('repayments', true);
        state.clearError('repayments');

        try {
          const result = await repaymentService.deleteRepayment(id);
          if (result.success && result.data) {
            set((prevState) => ({
              repayments: prevState.repayments.filter(repayment => repayment.id !== id)
            }));
            // Clear cache since data has changed
            state.clearCache('repayments');
            return true;
          } else {
            throw new Error(result.error?.message || 'Failed to delete repayment');
          }
        } catch (error) {
          state.setError('repayments', error instanceof Error ? error.message : 'An error occurred while deleting repayment');
          throw error;
        } finally {
          state.setLoading('repayments', false);
        }
      },

      // Journal State
      journalEntries: [],
      setJournalEntries: (entries) => set({ journalEntries: entries }),

      fetchJournalEntries: async (force = false) => {
        const state = get();
        
        if (!force) {
          const cached = state.getCache<JournalEntry[]>('journalEntries', 'all');
          if (cached) {
            set({ journalEntries: cached });
            return;
          }
        }

        state.setLoading('journalEntries', true);
        state.clearError('journalEntries');

        try {
          const result = await journalEntriesService.getJournalEntries();
          if (result.success && result.data) {
            set({ journalEntries: result.data.data || [] });
            state.setCache('journalEntries', 'all', result.data.data || []);
          } else {
            state.setError('journalEntries', result.error?.message || 'Failed to fetch journal entries');
          }
        } catch (error) {
          state.setError('journalEntries', error instanceof Error ? error.message : 'An error occurred while fetching journal entries');
        } finally {
          state.setLoading('journalEntries', false);
        }
      },
    }),
    {
      name: 'janalo-enhanced-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Persist user preferences and cache metadata
        searchQuery: state.searchQuery,
        loanFilters: state.loanFilters,
        borrowerFilters: state.borrowerFilters,
        accountFilters: state.accountFilters,
        currentUser: state.currentUser,
        cache: {
          lastCleanup: state.cache.lastCleanup
        }
      })
    }
  )
);

// Computed values that update automatically
useEnhancedStore.subscribe((state) => {
  // Update filtered loans
  const filteredLoans = state.loans.filter(loan => {
    const matchesSearch = !state.searchQuery || 
      loan.reference_no.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      loan.borrowers?.full_name.toLowerCase().includes(state.searchQuery.toLowerCase());
    
    const matchesStatus = !state.loanFilters.status || loan.status === state.loanFilters.status;
    const matchesOfficer = !state.loanFilters.officer_id || loan.officer_id === state.loanFilters.officer_id;
    const matchesBorrower = !state.loanFilters.borrower_id || loan.borrower_id === state.loanFilters.borrower_id;
    
    return matchesSearch && matchesStatus && matchesOfficer && matchesBorrower;
  });

  // Update loan stats
  const loanStats = {
    total: state.loans.length,
    active: state.loans.filter(loan => loan.status === 'active').length,
    completed: state.loans.filter(loan => loan.status === 'completed').length,
    pending: state.loans.filter(loan => loan.status === 'pending').length,
    totalDisbursed: state.loans.reduce((sum, loan) => sum + loan.principal_amount, 0),
    totalOutstanding: state.loans.reduce((sum, loan) => sum + loan.principal_outstanding, 0),
    totalRepaid: state.loans.reduce((sum, loan) => sum + (loan.total_payable - loan.principal_outstanding), 0),
  };

  // Update filtered borrowers
  const filteredBorrowers = state.borrowers.filter(borrower => {
    const matchesSearch = !state.searchQuery || 
      borrower.full_name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      borrower.phone.includes(state.searchQuery) ||
      borrower.employment.toLowerCase().includes(state.searchQuery.toLowerCase());
    
    const matchesEmployment = !state.borrowerFilters.employment || borrower.employment === state.borrowerFilters.employment;
    const matchesGender = !state.borrowerFilters.gender || borrower.gender === state.borrowerFilters.gender;
    const matchesMaritalStatus = !state.borrowerFilters.marital_status || borrower.marital_status === state.borrowerFilters.marital_status;
    
    return matchesSearch && matchesEmployment && matchesGender && matchesMaritalStatus;
  });

  // Update borrower stats
  const borrowerStats = {
    total: state.borrowers.length,
    active: new Set(state.loans.filter(loan => loan.status === 'active').map(loan => loan.borrower_id)).size,
    completed: new Set(state.loans.filter(loan => loan.status === 'completed').map(loan => loan.borrower_id)).size,
  };

  // Update filtered accounts
  const filteredAccounts = state.accounts.filter(account => {
    const matchesType = !state.accountFilters.type || account.type === state.accountFilters.type;
    const matchesStatus = !state.accountFilters.status || account.status === state.accountFilters.status;
    return matchesType && matchesStatus;
  });

  // Update repayment stats
  const repaymentStats = {
    total: state.repayments.length,
    totalCollected: state.repayments.reduce((sum, repayment) => sum + repayment.amount_paid, 0),
    averageRepayment: state.repayments.length > 0 ? state.repayments.reduce((sum, repayment) => sum + repayment.amount_paid, 0) / state.repayments.length : 0,
    overdueLoans: state.loans.filter(loan => {
      const repaymentsForLoan = state.repayments.filter(r => r.loan_id === loan.id);
      const monthsPaid = repaymentsForLoan.length;
      const currentDate = new Date();
      const dueDate = new Date(loan.disbursement_date);
      dueDate.setMonth(dueDate.getMonth() + monthsPaid + 1);
      return monthsPaid < loan.term_months && dueDate < currentDate;
    }).length,
  };

  // Update store with computed values
  useEnhancedStore.setState({
    filteredLoans,
    loanStats,
    filteredBorrowers,
    borrowerStats,
    filteredAccounts,
    repaymentStats
  });
});

// Export the store for backward compatibility
export const useAppStore = useEnhancedStore;