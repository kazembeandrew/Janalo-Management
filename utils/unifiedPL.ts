// Utility functions for unified P&L calculations using ledger-based approach
// Ensures consistency between P&L and trial balance

import { supabase } from '@/lib/supabase';

export interface MonthlyProfitability {
  month: string;
  revenue: number;
  expense: number;
  profit: number;
  revenue_categories: Array<{
    category: string;
    account_name: string;
    amount: number;
  }>;
  expense_categories: Array<{
    category: string;
    account_name: string;
    amount: number;
  }>;
  net_margin: number;
}

export interface CurrentPeriodExpenses {
  total_expense: number;
  expense_count: number;
  top_category: string;
  top_category_amount: number;
  period_start: string;
  period_end: string;
}

export interface ExpenseReconciliation {
  month: string;
  raw_expense_count: number;
  raw_expense_total: number;
  ledger_entry_count: number;
  ledger_expense_total: number;
  reconciliation_status: 'MATCHED' | 'MISMATCH';
}

/**
 * Get unified monthly profitability data from ledger (both revenue and expenses)
 * This ensures P&L always matches trial balance
 */
export async function getUnifiedMonthlyProfitability(months: number = 12): Promise<MonthlyProfitability[]> {
  const { data, error } = await (supabase as any)
    .rpc('get_unified_monthly_profitability', { p_months: months });

  if (error) {
    console.error('Error fetching unified profitability:', error);
    throw error;
  }

  return (data as MonthlyProfitability[]) || [];
}

/**
 * Get monthly expenses from ledger only
 */
export async function getMonthlyExpensesFromLedger(months: number = 12): Promise<Array<{
  month: string;
  expense: number;
  expense_categories: Array<{
    category: string;
    account_name: string;
    amount: number;
  }>;
}>> {
  const { data, error } = await (supabase as any)
    .rpc('get_monthly_expenses_from_ledger', { p_months: months });

  if (error) {
    console.error('Error fetching ledger expenses:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get current period expenses for dashboard widgets
 */
export async function getCurrentPeriodExpenses(): Promise<CurrentPeriodExpenses | null> {
  const { data, error } = await (supabase as any)
    .rpc('get_current_period_expenses');

  if (error) {
    console.error('Error fetching current period expenses:', error);
    throw error;
  }

  return data?.[0] || null;
}

/**
 * Get expense reconciliation data to compare ledger vs raw expenses table
 * This helps identify any discrepancies between the two sources
 */
export async function getExpenseReconciliation(): Promise<ExpenseReconciliation[]> {
  const { data, error } = await (supabase as any)
    .from('expense_reconciliation')
    .select('*')
    .order('month', { ascending: false });

  if (error) {
    console.error('Error fetching expense reconciliation:', error);
    throw error;
  }

  return (data as ExpenseReconciliation[]) || [];
}

/**
 * Calculate expense statistics from ledger data for dashboard display
 */
export function calculateExpenseStatsFromLedger(expenseData: MonthlyProfitability[]): {
  currentMonthExpense: number;
  previousMonthExpense: number;
  monthOverMonthChange: number;
  yearToDateExpense: number;
  averageMonthlyExpense: number;
  topExpenseCategory: string;
  topExpenseCategoryAmount: number;
} {
  const currentMonth = new Date().toISOString().substring(0, 7);
  const previousMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().substring(0, 7);
  
  const currentMonthData = expenseData.find(d => d.month === currentMonth);
  const previousMonthData = expenseData.find(d => d.month === previousMonth);
  
  const currentMonthExpense = currentMonthData?.expense || 0;
  const previousMonthExpense = previousMonthData?.expense || 0;
  
  const monthOverMonthChange = previousMonthExpense > 0 
    ? ((currentMonthExpense - previousMonthExpense) / previousMonthExpense) * 100 
    : 0;
  
  const yearToDateExpense = expenseData
    .filter(d => d.month.startsWith(new Date().getFullYear().toString()))
    .reduce((sum, d) => sum + d.expense, 0);
  
  const averageMonthlyExpense = expenseData.length > 0 
    ? expenseData.reduce((sum, d) => sum + d.expense, 0) / expenseData.length 
    : 0;
  
  // Find top expense category across all months
  const categoryTotals: { [key: string]: number } = {};
  expenseData.forEach(month => {
    month.expense_categories.forEach(cat => {
      categoryTotals[cat.category] = (categoryTotals[cat.category] || 0) + cat.amount;
    });
  });
  
  const topExpenseCategory = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A';
  const topExpenseCategoryAmount = categoryTotals[topExpenseCategory] || 0;
  
  return {
    currentMonthExpense,
    previousMonthExpense,
    monthOverMonthChange,
    yearToDateExpense,
    averageMonthlyExpense,
    topExpenseCategory,
    topExpenseCategoryAmount
  };
}

/**
 * Validate that P&L matches trial balance
 * Returns true if all monthly data balances correctly
 */
export function validatePLConsistency(profitabilityData: MonthlyProfitability[]): {
  isConsistent: boolean;
  inconsistencies: Array<{
    month: string;
    revenue: number;
    expense: number;
    profit: number;
    calculatedProfit: number;
  }>;
} {
  const inconsistencies = profitabilityData
    .map(data => ({
      month: data.month,
      revenue: data.revenue,
      expense: data.expense,
      profit: data.profit,
      calculatedProfit: data.revenue - data.expense
    }))
    .filter(data => Math.abs(data.profit - data.calculatedProfit) > 0.01);
  
  return {
    isConsistent: inconsistencies.length === 0,
    inconsistencies
  };
}

/**
 * Format expense data for charts (similar to existing Expenses.tsx but ledger-based)
 */
export function formatExpenseDataForCharts(expenseData: MonthlyProfitability[]): {
  categoryData: Array<{ name: string; value: number }>;
  monthlyData: Array<{ month: string; amount: number }>;
} {
  // Aggregate categories across all months
  const categoryTotals: { [key: string]: number } = {};
  const monthlyTotals: { [key: string]: number } = {};
  
  expenseData.forEach(month => {
    // Monthly totals
    monthlyTotals[month.month] = month.expense;
    
    // Category totals
    month.expense_categories.forEach(cat => {
      categoryTotals[cat.category] = (categoryTotals[cat.category] || 0) + cat.amount;
    });
  });
  
  // Format for charts
  const categoryData = Object.entries(categoryTotals)
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);
  
  const monthlyData = Object.entries(monthlyTotals)
    .map(([month, amount]) => ({
      month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' }),
      amount
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
  
  return { categoryData, monthlyData };
}
