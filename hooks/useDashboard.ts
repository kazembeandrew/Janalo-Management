import { useMemo } from 'react';
import { useLoans } from './useLoans';
import { useBorrowers } from './useBorrowers';
import { useAccounts } from './useAccounts';
import { useRepayments } from './useRepayments';
import { useJournalEntries } from './useJournalEntries';
import { Loan, LoanStatus, Borrower, InternalAccount, Repayment, JournalEntry } from '../types';

interface DashboardStats {
  // Loan statistics
  totalLoans: number;
  activeLoans: number;
  completedLoans: number;
  pendingLoans: number;
  totalDisbursed: number;
  totalOutstanding: number;
  totalRepaid: number;
  
  // Borrower statistics
  totalBorrowers: number;
  activeBorrowers: number;
  completedBorrowers: number;
  
  // Account statistics
  totalAccounts: number;
  activeAccounts: number;
  totalBalance: number;
  totalDebit: number;
  totalCredit: number;
  
  // Repayment statistics
  totalRepayments: number;
  totalCollected: number;
  averageRepayment: number;
  overdueLoans: number;
  
  // Journal entry statistics
  totalEntries: number;
  postedEntries: number;
  pendingEntries: number;
  failedEntries: number;
}

interface LoanAnalytics {
  byStatus: Record<LoanStatus, number>;
  byOfficer: Record<string, number>;
  byAmountRange: {
    under5000: number;
    under10000: number;
    under25000: number;
    over25000: number;
  };
  averageLoanAmount: number;
  totalInterestCollected: number;
}

interface RepaymentAnalytics {
  byStatus: Record<string, number>;
  byMethod: Record<string, number>;
  monthlyTrends: Array<{
    month: string;
    year: number;
    monthNum: number;
    totalAmount: number;
    totalCount: number;
  }>;
  dailyTrends: Array<{
    date: string;
    totalAmount: number;
    totalCount: number;
  }>;
  averageDaysToRepayment: number;
}

interface AccountAnalytics {
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  topDebitAccounts: InternalAccount[];
  topCreditAccounts: InternalAccount[];
  balanceDistribution: {
    positive: number;
    negative: number;
    zero: number;
  };
}

interface JournalAnalytics {
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  monthlyTotals: Array<{
    month: string;
    year: number;
    monthNum: number;
    totalDebits: number;
    totalCredits: number;
    entryCount: number;
  }>;
  unbalancedEntries: number;
}

/**
 * Hook for dashboard and analytics data with comprehensive statistics and insights
 */
export const useDashboard = () => {
  const { loans, loanStats, getLoansByStatus, getLoansByOfficer, getOverdueLoans } = useLoans();
  const { borrowers, borrowerStats, getBorrowersByEmployment, getBorrowersByGender } = useBorrowers();
  const { accounts, getAccountsByType, getAccountsByStatus, getAccountStats } = useAccounts();
  const { repayments, repaymentStats, getRepaymentsByStatus, getRepaymentsByDateRange, getRepaymentsByAmountRange } = useRepayments();
  const { journalEntries, getJournalEntriesByType, getJournalEntriesByStatus, getUnbalancedEntries } = useJournalEntries();

  // Calculate dashboard statistics
  const stats: DashboardStats = useMemo(() => ({
    // Loan statistics
    totalLoans: loanStats.total,
    activeLoans: loanStats.active,
    completedLoans: loanStats.completed,
    pendingLoans: loanStats.pending,
    totalDisbursed: loanStats.totalDisbursed,
    totalOutstanding: loanStats.totalOutstanding,
    totalRepaid: loanStats.totalRepaid,
    
    // Borrower statistics
    totalBorrowers: borrowerStats.total,
    activeBorrowers: borrowerStats.active,
    completedBorrowers: borrowerStats.completed,
    
    // Account statistics
    totalAccounts: getAccountStats().totalAccounts,
    activeAccounts: getAccountStats().activeAccounts,
    totalBalance: getAccountStats().totalBalance,
    totalDebit: getAccountStats().totalDebit,
    totalCredit: getAccountStats().totalCredit,
    
    // Repayment statistics
    totalRepayments: repaymentStats.total,
    totalCollected: repaymentStats.totalCollected,
    averageRepayment: repaymentStats.averageRepayment,
    overdueLoans: repaymentStats.overdueLoans,
    
    // Journal entry statistics
    totalEntries: journalEntries.length,
    postedEntries: getJournalEntriesByStatus('posted').length,
    pendingEntries: getJournalEntriesByStatus('pending').length,
    failedEntries: getJournalEntriesByStatus('failed').length,
  }), [loanStats, borrowerStats, getAccountStats, repaymentStats, journalEntries, getJournalEntriesByStatus]);

  // Calculate loan analytics
  const loanAnalytics: LoanAnalytics = useMemo(() => {
    const byStatus: Record<LoanStatus, number> = {
      active: getLoansByStatus('active').length,
      completed: getLoansByStatus('completed').length,
      pending: getLoansByStatus('pending').length,
      defaulted: getLoansByStatus('defaulted').length,
      rejected: getLoansByStatus('rejected').length,
      reassess: getLoansByStatus('reassess').length,
      approved: getLoansByStatus('approved').length,
      overdue: getLoansByStatus('overdue').length,
      written_off: getLoansByStatus('written_off').length,
    };

    const byOfficer = loans.reduce((acc, loan) => {
      acc[loan.officer_id] = (acc[loan.officer_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byAmountRange = {
      under5000: loans.filter(loan => loan.principal_amount < 5000).length,
      under10000: loans.filter(loan => loan.principal_amount >= 5000 && loan.principal_amount < 10000).length,
      under25000: loans.filter(loan => loan.principal_amount >= 10000 && loan.principal_amount < 25000).length,
      over25000: loans.filter(loan => loan.principal_amount >= 25000).length,
    };

    const averageLoanAmount = loans.length > 0 
      ? loans.reduce((sum, loan) => sum + loan.principal_amount, 0) / loans.length 
      : 0;

    const totalInterestCollected = loans.reduce((sum, loan) => {
      const totalPaid = repayments
        .filter(r => r.loan_id === loan.id)
        .reduce((repaymentSum, repayment) => repaymentSum + repayment.amount_paid, 0);
      return sum + (totalPaid - loan.principal_amount);
    }, 0);

    return {
      byStatus,
      byOfficer,
      byAmountRange,
      averageLoanAmount,
      totalInterestCollected
    };
  }, [loans, getLoansByStatus, repayments]);

  // Calculate repayment analytics
  const repaymentAnalytics: RepaymentAnalytics = useMemo(() => {
    const byStatus = repayments.reduce((acc, repayment) => {
      acc[repayment.status] = (acc[repayment.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byMethod = repayments.reduce((acc, repayment) => {
      acc[repayment.payment_method] = (acc[repayment.payment_method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Monthly trends
    const monthlyTrends = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthRepayments = getRepaymentsByDateRange(date, endDate);
      monthlyTrends.push({
        month: date.toLocaleString('default', { month: 'long' }),
        year: date.getFullYear(),
        monthNum: date.getMonth(),
        totalAmount: monthRepayments.reduce((sum, r) => sum + r.amount_paid, 0),
        totalCount: monthRepayments.length
      });
    }

    // Daily trends (last 30 days)
    const dailyTrends = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      const dayRepayments = getRepaymentsByDateRange(date, endDate);
      dailyTrends.push({
        date: date.toISOString().split('T')[0],
        totalAmount: dayRepayments.reduce((sum, r) => sum + r.amount_paid, 0),
        totalCount: dayRepayments.length
      });
    }

    // Calculate average days to repayment
    const totalDays = repayments.reduce((sum, repayment) => {
      const loan = loans.find(l => l.id === repayment.loan_id);
      if (loan) {
        const loanDate = new Date(loan.disbursement_date);
        const repaymentDate = new Date(repayment.payment_date);
        const days = Math.ceil((repaymentDate.getTime() - loanDate.getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }
      return sum;
    }, 0);
    
    const averageDaysToRepayment = repayments.length > 0 ? totalDays / repayments.length : 0;

    return {
      byStatus,
      byMethod,
      monthlyTrends,
      dailyTrends,
      averageDaysToRepayment
    };
  }, [repayments, getRepaymentsByDateRange, loans]);

  // Calculate account analytics
  const accountAnalytics: AccountAnalytics = useMemo(() => {
    const byType = accounts.reduce((acc, account) => {
      acc[account.type] = (acc[account.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byStatus = accounts.reduce((acc, account) => {
      acc[account.status] = (acc[account.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topDebitAccounts = accounts
      .filter(account => account.type === 'debit')
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10);

    const topCreditAccounts = accounts
      .filter(account => account.type === 'credit')
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10);

    const balanceDistribution = {
      positive: accounts.filter(account => account.balance > 0).length,
      negative: accounts.filter(account => account.balance < 0).length,
      zero: accounts.filter(account => account.balance === 0).length,
    };

    return {
      byType,
      byStatus,
      topDebitAccounts,
      topCreditAccounts,
      balanceDistribution
    };
  }, [accounts]);

  // Calculate journal analytics
  const journalAnalytics: JournalAnalytics = useMemo(() => {
    const byType = journalEntries.reduce((acc, entry) => {
      acc[entry.transaction_type] = (acc[entry.transaction_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byStatus = journalEntries.reduce((acc, entry) => {
      acc[entry.status] = (acc[entry.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Monthly totals
    const monthlyTotals = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthEntries = journalEntries.filter(entry => {
        const entryDate = new Date(entry.transaction_date);
        return entryDate >= date && entryDate <= endDate;
      });
      
      monthlyTotals.push({
        month: date.toLocaleString('default', { month: 'long' }),
        year: date.getFullYear(),
        monthNum: date.getMonth(),
        totalDebits: monthEntries.reduce((sum, e) => sum + e.debit_amount, 0),
        totalCredits: monthEntries.reduce((sum, e) => sum + e.credit_amount, 0),
        entryCount: monthEntries.length
      });
    }

    const unbalancedEntries = getUnbalancedEntries().length;

    return {
      byType,
      byStatus,
      monthlyTotals,
      unbalancedEntries
    };
  }, [journalEntries, getUnbalancedEntries]);

  // Get key performance indicators
  const getKPIs = () => {
    const totalRevenue = stats.totalRepaid;
    const totalOutstanding = stats.totalOutstanding;
    const collectionRate = stats.totalDisbursed > 0 
      ? (stats.totalRepaid / stats.totalDisbursed) * 100 
      : 0;
    
    const loanApprovalRate = stats.totalLoans > 0 
      ? (stats.completedLoans / stats.totalLoans) * 100 
      : 0;

    const averageBorrowerValue = stats.totalBorrowers > 0 
      ? (stats.totalDisbursed / stats.totalBorrowers) 
      : 0;

    return {
      totalRevenue,
      totalOutstanding,
      collectionRate,
      loanApprovalRate,
      averageBorrowerValue,
      activeLoansCount: stats.activeLoans,
      overdueLoansCount: stats.overdueLoans,
      totalAccountsCount: stats.totalAccounts
    };
  };

  // Get risk indicators
  const getRiskIndicators = () => {
    const highRiskLoans = loans.filter(loan => {
      const repaymentsForLoan = repayments.filter(r => r.loan_id === loan.id);
      const monthsPaid = repaymentsForLoan.length;
      const currentDate = new Date();
      const dueDate = new Date(loan.disbursement_date);
      dueDate.setMonth(dueDate.getMonth() + monthsPaid + 1);
      return monthsPaid < loan.term_months && dueDate < currentDate;
    });

    const highRiskBorrowers = borrowers.filter(borrower => {
      const borrowerLoans = loans.filter(loan => loan.borrower_id === borrower.id);
      const hasOverdueLoans = borrowerLoans.some(loan => {
        const repaymentsForLoan = repayments.filter(r => r.loan_id === loan.id);
        const monthsPaid = repaymentsForLoan.length;
        const currentDate = new Date();
        const dueDate = new Date(loan.disbursement_date);
        dueDate.setMonth(dueDate.getMonth() + monthsPaid + 1);
        return monthsPaid < loan.term_months && dueDate < currentDate;
      });
      return hasOverdueLoans;
    });

    const concentrationRisk = Object.entries(loanAnalytics.byOfficer)
      .reduce((acc, [officer, count]) => {
        const percentage = (count / stats.totalLoans) * 100;
        if (percentage > 20) acc.push({ officer, percentage });
        return acc;
      }, [] as Array<{officer: string, percentage: number}>);

    return {
      highRiskLoansCount: highRiskLoans.length,
      highRiskBorrowersCount: highRiskBorrowers.length,
      concentrationRisk,
      averageDaysToRepayment: repaymentAnalytics.averageDaysToRepayment
    };
  };

  return {
    stats,
    loanAnalytics,
    repaymentAnalytics,
    accountAnalytics,
    journalAnalytics,
    getKPIs,
    getRiskIndicators
  };
};