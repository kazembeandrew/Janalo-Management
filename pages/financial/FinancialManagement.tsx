import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { formatCurrency } from '@/utils/finance';
import toast from 'react-hot-toast';
import {
  PiggyBank,
  DollarSign,
  TrendingUp,
  Target,
  BarChart3,
  PieChart,
  Calendar,
  Search,
  Download,
  Clock,
  Activity,
  Users,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { accountTreeService, investmentPortfolioService, budgetVarianceService } from '@/services/financialManagement';
import { loanService } from '@/services/loans';
import { expensesService } from '@/services/expenses';
import { accountsService } from '@/services/accounts';

interface FinancialSummary {
  totalPortfolio: number;
  totalOutstanding: number;
  totalRecovered: number;
  recoveryRate: number;
  activeInvestments: number;
  totalROI: number;
  monthlyCashFlow: number;
  budgetVariance: number;
}

interface InvestmentData {
  id: string;
  name: string;
  type: string;
  currentValue: number;
  initialInvestment: number;
  roi: number;
  status: string;
}

interface BudgetData {
  id: string;
  category: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercentage: number;
}

export const FinancialManagement: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const { performSearch, searchQuery, updateSearchQuery } = useGlobalSearch();

  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [investments, setInvestments] = useState<InvestmentData[]>([]);
  const [budgets, setBudgets] = useState<BudgetData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'investments' | 'budgets'>('overview');

  const isAuthorized = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo') || effectiveRoles.includes('accountant');

  useEffect(() => {
    if (isAuthorized) {
      fetchData();
    }
  }, [isAuthorized]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const results = await Promise.allSettled([
        accountsService.getAccounts({ is_active: true }), // Changed from accountTreeService
        investmentPortfolioService.getPortfolios(),
        loanService.getLoans({ status: 'active' }),
        expensesService.getExpenses(),
        budgetVarianceService.getBudgetVariances()
      ]);

      const [accountsResult, portfoliosResult, loansResult, expensesResult, variancesResult] = results;

      // Check for critical failures
      if (accountsResult.status === 'rejected') {
        console.error('[FinancialManagement] Accounts failed:', accountsResult.reason);
        throw new Error('Failed to load accounts: ' + (accountsResult.reason?.message || 'Unknown error'));
      }

      if (loansResult.status === 'rejected') {
        console.error('[FinancialManagement] Loans failed:', loansResult.reason);
        throw new Error('Failed to load loans: ' + (loansResult.reason?.message || 'Unknown error'));
      }

      // Extract data with fallbacks for non-critical failures
      const accounts = accountsResult.status === 'fulfilled' ? (accountsResult.value.data?.data || []) : [];
      const portfolios = portfoliosResult.status === 'fulfilled' && portfoliosResult.value.success ? (portfoliosResult.value.data?.data || []) : [];
      const loansData = loansResult.status === 'fulfilled' ? (loansResult.value.data?.data || []) : [];
      const expensesData = expensesResult.status === 'fulfilled' ? (expensesResult.value.data?.data ?? []) : [];
      const budgetVariances = variancesResult.status === 'fulfilled' && variancesResult.value.success ? (variancesResult.value.data?.data || []) : [];

      // Non-critical failures are handled silently with fallbacks

      // Calculate portfolio metrics from accounts
      // Total Portfolio is the sum of all "asset" account balances
      const totalPortfolio = accounts
        .filter(account => account.account_category === 'asset' && account.balance)
        .reduce((sum, account) => sum + (Number(account.balance) || 0), 0);
      
      const activeInvestments = portfolios.length;

      // Calculate loan metrics using correct Loan interface properties
      const totalOutstanding = loansData.reduce((sum, loan) => {
        return sum + (Number(loan.principal_outstanding) || 0);
      }, 0);

      const totalRecovered = loansData.reduce((sum, loan) => {
        return sum + ((Number(loan.total_payable) || 0) - (Number(loan.principal_outstanding) || 0));
      }, 0);

      const recoveryRate = (totalOutstanding + totalRecovered) > 0 
        ? (totalRecovered / (totalOutstanding + totalRecovered)) * 100 
        : 0;

      // Calculate budget variance from expenses
      const totalBudgetVariance = budgetVariances.reduce((sum, bv) => sum + (bv.variance_amount || 0), 0);

      // Simple calculation for monthly inflow/outflow
      const monthlyInflow = totalRecovered; // Simplified: recovered loans as inflow
      const monthlyOutflow = expensesData.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

      // Set calculated summary
      setFinancialSummary({
        totalPortfolio,
        totalOutstanding,
        totalRecovered,
        recoveryRate: Math.round(recoveryRate * 10) / 10,
        activeInvestments,
        totalROI: portfolios.length > 0 
          ? portfolios.reduce((sum, p) => sum + (p.actual_return || 0), 0) / portfolios.length 
          : 0,
        monthlyCashFlow: monthlyInflow - monthlyOutflow,
        budgetVariance: totalBudgetVariance
      });

      // Transform portfolios into investment data
      const investmentData: InvestmentData[] = portfolios.map(p => ({
        id: p.id,
        name: p.name,
        type: p.portfolio_type,
        currentValue: p.total_value,
        initialInvestment: p.total_value / (1 + ((p.actual_return || 0) / 100)), // Approximate calculation
        roi: p.actual_return || 0,
        status: p.is_active ? ((p.actual_return || 0) >= (p.target_return || 0) ? 'growing' : 'stable') : 'inactive'
      }));
      setInvestments(investmentData);

      // Transform budget variances into UI data
      const budgetUI: BudgetData[] = budgetVariances.map(bv => ({
        id: bv.id,
        category: `Budget ${bv.id.slice(0, 4)}`, // Fallback as actual category name needs a join
        budgeted: bv.budgeted_amount || 0,
        actual: bv.actual_amount || 0,
        variance: bv.variance_amount || 0,
        variancePercentage: bv.variance_percentage || 0
      }));
      setBudgets(budgetUI);

    } catch (error) {
      console.error('[FinancialManagement] Error fetching financial data:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      toast.error(`Failed to load financial data: ${errorMessage}`);
      setFinancialSummary(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getVarianceColor = (percentage: number) => {
    if (percentage > 0) return 'text-green-600';
    if (percentage < -10) return 'text-red-600';
    return 'text-yellow-600';
  };

  const getInvestmentTypeColor = (type: string) => {
    switch (type) {
      case 'equity': return 'bg-purple-100 text-purple-800';
      case 'bonds': return 'bg-blue-100 text-blue-800';
      case 'real_estate': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getInvestmentStatusColor = (status: string) => {
    switch (status) {
      case 'growing': return 'bg-green-100 text-green-800';
      case 'stable': return 'bg-blue-100 text-blue-800';
      case 'declining': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <PiggyBank className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">You are not authorized to access this page</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="h-12 w-12 text-indigo-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading financial data...</p>
        </div>
      </div>
    );
  }

  if (!financialSummary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No financial data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Management</h1>
          <p className="text-gray-600">Advanced financial planning and investment tracking</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={fetchData}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Clock className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Portfolio</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(financialSummary.totalPortfolio)}</p>
              <p className="text-xs text-gray-500 mt-1">All investments and assets</p>
            </div>
            <PiggyBank className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Outstanding Balance</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(financialSummary.totalOutstanding)}</p>
              <p className="text-xs text-gray-500 mt-1">Current receivables</p>
            </div>
            <DollarSign className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Recovery Rate</p>
              <p className="text-2xl font-bold text-gray-900">{financialSummary.recoveryRate}%</p>
              <p className="text-xs text-gray-500 mt-1">Portfolio performance</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Monthly Cash Flow</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(financialSummary.monthlyCashFlow)}</p>
              <p className="text-xs text-gray-500 mt-1">Net monthly inflow</p>
            </div>
            <Target className="h-8 w-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { id: 'overview', name: 'Overview', icon: BarChart3 },
              { id: 'investments', name: 'Investment Portfolio', icon: PieChart },
              { id: 'budgets', name: 'Budget Management', icon: FileText }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center px-6 py-3 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Investment Summary */}
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Investment Summary</h3>
                    <PieChart className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Active Investments</span>
                      <span className="text-sm font-medium text-gray-900">{financialSummary.activeInvestments}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total ROI</span>
                      <span className="text-sm font-medium text-green-600">+{financialSummary.totalROI}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Value</span>
                      <span className="text-sm font-medium text-gray-900">{formatCurrency(investments.reduce((sum, inv) => sum + inv.currentValue, 0))}</span>
                    </div>
                  </div>
                </div>

                {/* Budget Summary */}
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Budget Summary</h3>
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Budget</span>
                      <span className="text-sm font-medium text-gray-900">{formatCurrency(budgets.reduce((sum, b) => sum + b.budgeted, 0))}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Actual Spend</span>
                      <span className="text-sm font-medium text-gray-900">{formatCurrency(budgets.reduce((sum, b) => sum + b.actual, 0))}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Variance</span>
                      <span className={`text-sm font-medium ${getVarianceColor(financialSummary.budgetVariance)}`}>
                        {financialSummary.budgetVariance > 0 ? '+' : ''}{formatCurrency(financialSummary.budgetVariance)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Performance Metrics</h3>
                  <Activity className="h-5 w-5 text-green-600" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-white rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{financialSummary.recoveryRate.toFixed(1)}%</div>
                    <div className="text-sm text-gray-600">Recovery Rate</div>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{financialSummary.totalROI.toFixed(1)}%</div>
                    <div className="text-sm text-gray-600">Total ROI</div>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{formatCurrency(financialSummary.monthlyCashFlow)}</div>
                    <div className="text-sm text-gray-600">Monthly Cash Flow</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Investments Tab */}
          {activeTab === 'investments' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Investment Portfolio</h3>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Total Value</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(investments.reduce((sum, inv) => sum + inv.currentValue, 0))}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Average ROI</p>
                    <p className="text-lg font-bold text-green-600">+{investments.reduce((sum, inv) => sum + inv.roi, 0) / investments.length}%</p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Investment
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Current Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Initial Investment
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ROI
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {investments.map((investment) => (
                      <tr key={investment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {investment.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getInvestmentTypeColor(investment.type)}`}>
                            {investment.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(investment.currentValue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(investment.initialInvestment)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${investment.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {investment.roi >= 0 ? '+' : ''}{investment.roi.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getInvestmentStatusColor(investment.status)}`}>
                            {investment.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Budgets Tab */}
          {activeTab === 'budgets' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Budget Management</h3>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Total Budget</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(budgets.reduce((sum, b) => sum + b.budgeted, 0))}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Total Variance</p>
                    <p className={`text-lg font-bold ${getVarianceColor(financialSummary.budgetVariance)}`}>
                      {financialSummary.budgetVariance > 0 ? '+' : ''}{formatCurrency(financialSummary.budgetVariance)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Budgeted
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actual
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Variance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Variance %
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {budgets.map((budget) => (
                      <tr key={budget.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {budget.category}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(budget.budgeted)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(budget.actual)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${getVarianceColor(budget.variancePercentage)}`}>
                            {budget.variance > 0 ? '+' : ''}{formatCurrency(budget.variance)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${getVarianceColor(budget.variancePercentage)}`}>
                            {budget.variancePercentage > 0 ? '+' : ''}{budget.variancePercentage.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};