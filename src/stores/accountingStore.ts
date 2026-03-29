import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { BroadcastChannel } from 'broadcast-channel';

import * as accountingService from '../services/accounting';
import type { ParMetrics, TrialBalanceCheck } from '../services/accounting';

interface AccountingState {
  // PAR Metrics
  parMetrics: ParMetrics | null;
  parLoading: boolean;
  parError: string | null;
  lastParCalculation: Date | null;

  // Trial Balance
  trialBalance: TrialBalanceCheck | null;
  trialBalanceLoading: boolean;
  isBooksBalanced: boolean | null;

  // Chart of Accounts
  accounts: any[];
  accountsLoading: boolean;

  // Actions
  fetchParMetrics: () => Promise<void>;
  verifyTrialBalance: (date?: string) => Promise<void>;
  fetchChartOfAccounts: () => Promise<void>;
  refreshAll: () => Promise<void>;
  reset: () => void;
}

// Cross-tab communication channel
const CHANNEL_NAME = 'janalo-accounting-sync';
let broadcastChannel: BroadcastChannel | null = null;

if (typeof window !== 'undefined') {
  broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
}

export const useAccountingStore = create<AccountingState>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    parMetrics: null,
    parLoading: false,
    parError: null,
    lastParCalculation: null,
    trialBalance: null,
    trialBalanceLoading: false,
    isBooksBalanced: null,
    accounts: [],
    accountsLoading: false,

    // Fetch PAR Metrics
    fetchParMetrics: async () => {
      set({ parLoading: true, parError: null });
      
      try {
        const metrics = await accountingService.calculateParMetrics();
        
        if (metrics) {
          set({
            parMetrics: metrics,
            parLoading: false,
            lastParCalculation: new Date()
          });
          
          // Broadcast to other tabs
          broadcastChannel?.postMessage({ type: 'PAR_UPDATED', metrics });
        } else {
          set({
            parLoading: false,
            parError: 'Failed to calculate PAR metrics'
          });
        }
      } catch (error: any) {
        set({
          parLoading: false,
          parError: error.message || 'Unknown error occurred'
        });
      }
    },

    // Verify Trial Balance
    verifyTrialBalance: async (date?: string) => {
      const checkDate = date || new Date().toISOString().split('T')[0];
      set({ trialBalanceLoading: true });
      
      try {
        const result = await accountingService.verifyTrialBalance(checkDate);
        
        set({
          trialBalance: result,
          isBooksBalanced: result.isBalanced,
          trialBalanceLoading: false
        });
        
        // Broadcast to other tabs
        broadcastChannel?.postMessage({ 
          type: 'TRIAL_BALANCE_UPDATED', 
          balanced: result.isBalanced 
        });
      } catch (error: any) {
        set({
          trialBalanceLoading: false,
          isBooksBalanced: false
        });
      }
    },

    // Fetch Chart of Accounts
    fetchChartOfAccounts: async () => {
      set({ accountsLoading: true });
      
      try {
        const accounts = await accountingService.getChartOfAccounts();
        set({ accounts, accountsLoading: false });
      } catch (error: any) {
        set({ accountsLoading: false });
        console.error('Failed to fetch chart of accounts:', error);
      }
    },

    // Refresh All Data
    refreshAll: async () => {
      await Promise.all([
        get().fetchParMetrics(),
        get().verifyTrialBalance(),
        get().fetchChartOfAccounts()
      ]);
    },

    // Reset Store
    reset: () => {
      set({
        parMetrics: null,
        parLoading: false,
        parError: null,
        lastParCalculation: null,
        trialBalance: null,
        trialBalanceLoading: false,
        isBooksBalanced: null,
        accounts: [],
        accountsLoading: false
      });
    }
  }))
);

// Listen for cross-tab updates
if (broadcastChannel) {
  broadcastChannel.onmessage = (event) => {
    const { type } = event.data;
    
    if (type === 'PAR_UPDATED') {
      useAccountingStore.setState({
        parMetrics: event.data.metrics,
        lastParCalculation: new Date()
      });
    } else if (type === 'TRIAL_BALANCE_UPDATED') {
      useAccountingStore.setState({
        isBooksBalanced: event.data.balanced
      });
    }
  };
}

// Auto-refresh hook helper
export const createAccountingAutoRefresh = (intervalMs: number = 300000) => {
  if (typeof window === 'undefined') return () => {};
  
  const intervalId = setInterval(() => {
    useAccountingStore.getState().refreshAll();
  }, intervalMs);
  
  return () => clearInterval(intervalId);
};
