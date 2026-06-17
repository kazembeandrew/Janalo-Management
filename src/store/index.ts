/**
 * Zustand Store for Global State Management
 * Provides shared state for currentUser, loans, borrowers across the app
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { UserProfile, Loan, Borrower } from '@/types';

// Current User State
interface UserState {
  currentUser: UserProfile | null;
  setCurrentUser: (user: UserProfile | null) => void;
  clearCurrentUser: () => void;
}

export const useUserStore = create<UserState>()(
  subscribeWithSelector((set) => ({
    currentUser: null,
    setCurrentUser: (user) => set({ currentUser: user }),
    clearCurrentUser: () => set({ currentUser: null }),
  }))
);

// Loans List State
interface LoansState {
  loans: Loan[];
  loansLastUpdated: Date | null;
  setLoans: (loans: Loan[]) => void;
  updateLoan: (loan: Loan) => void;
  removeLoan: (loanId: string) => void;
  clearLoans: () => void;
  markLoansUpdated: () => void;
}

export const useLoansStore = create<LoansState>()(
  subscribeWithSelector((set) => ({
    loans: [],
    loansLastUpdated: null,
    setLoans: (loans) => set({ loans, loansLastUpdated: new Date() }),
    updateLoan: (updatedLoan) =>
      set((state) => ({
        loans: state.loans.map((loan) =>
          loan.id === updatedLoan.id ? updatedLoan : loan
        ),
        loansLastUpdated: new Date(),
      })),
    removeLoan: (loanId) =>
      set((state) => ({
        loans: state.loans.filter((loan) => loan.id !== loanId),
        loansLastUpdated: new Date(),
      })),
    clearLoans: () => set({ loans: [], loansLastUpdated: null }),
    markLoansUpdated: () => set({ loansLastUpdated: new Date() }),
  }))
);

// Borrowers List State
interface BorrowersState {
  borrowers: Borrower[];
  borrowersLastUpdated: Date | null;
  setBorrowers: (borrowers: Borrower[]) => void;
  updateBorrower: (borrower: Borrower) => void;
  removeBorrower: (borrowerId: string) => void;
  clearBorrowers: () => void;
  markBorrowersUpdated: () => void;
}

export const useBorrowersStore = create<BorrowersState>()(
  subscribeWithSelector((set) => ({
    borrowers: [],
    borrowersLastUpdated: null,
    setBorrowers: (borrowers) => set({ borrowers, borrowersLastUpdated: new Date() }),
    updateBorrower: (updatedBorrower) =>
      set((state) => ({
        borrowers: state.borrowers.map((borrower) =>
          borrower.id === updatedBorrower.id ? updatedBorrower : borrower
        ),
        borrowersLastUpdated: new Date(),
      })),
    removeBorrower: (borrowerId) =>
      set((state) => ({
        borrowers: state.borrowers.filter((borrower) => borrower.id !== borrowerId),
        borrowersLastUpdated: new Date(),
      })),
    clearBorrowers: () => set({ borrowers: [], borrowersLastUpdated: null }),
    markBorrowersUpdated: () => set({ borrowersLastUpdated: new Date() }),
  }))
);

// Dashboard Metrics State (optional caching layer)
interface DashboardMetrics {
  totalPortfolio: number;
  activeLoans: number;
  totalBorrowers: number;
  portfolioAtRisk: number;
  collectionRate: number;
}

interface DashboardState {
  metrics: DashboardMetrics | null;
  metricsLastUpdated: Date | null;
  setMetrics: (metrics: DashboardMetrics) => void;
  clearMetrics: () => void;
}

export const useDashboardStore = create<DashboardState>()(
  subscribeWithSelector((set) => ({
    metrics: null,
    metricsLastUpdated: null,
    setMetrics: (metrics) => set({ metrics, metricsLastUpdated: new Date() }),
    clearMetrics: () => set({ metrics: null, metricsLastUpdated: null }),
  }))
);

// Helper hook to sync stores with Realtime
export const useRealtimeSync = () => {
  // This would be implemented in a custom hook that subscribes to Supabase Realtime
  // and updates the Zustand stores when data changes
  // For now, it's a placeholder for future implementation
  return {
    syncLoans: () => {},
    syncBorrowers: () => {},
    syncUsers: () => {},
  };
};
