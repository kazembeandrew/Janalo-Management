import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLoans } from '@/hooks/useLoans';
import { useRepayments } from '@/hooks/useRepayments';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { formatCurrency } from '@/utils/finance';
import toast from 'react-hot-toast';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Calendar,
  Search,
  Filter,
  Download,
  FileText,
  Target,
  AlertTriangle,
  Clock,
  Activity
} from 'lucide-react';

interface AnalyticsData {
  totalLoans: number;
  totalDisbursed: number;
  totalOutstanding: number;
  totalRecovered: number;
  activeLoans: number;
  defaultRate: number;
  avgLoanSize: number;
  monthlyDisbursements: { month: string; amount: number }[];
  monthlyRecoveries: { month: string; amount: number }[];
  portfolioDistribution: { category: string; amount: number; count: number }[];
  riskDistribution: { risk: string; count: number; amount: number }[];
}

export const Analytics: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const { loans, filteredLoans, fetchLoans } = useLoans();
  const { repayments, fetchRepayments } = useRepayments();
  const { performSearch, searchQuery, updateSearchQuery } = useGlobalSearch();

  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const isAuthorized = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo') || effectiveRoles.includes('accountant');

  useEffect(() => {
    if (isAuthorized) {
      fetchData();
    }
  }, [isAuthorized, dateRange]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchLoans(), fetchRepayments()]);
      calculateAnalytics();
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAnalytics = () => {
    // Calculate basic metrics
    const totalLoans = loans.length;
    const totalDisbursed = loans.reduce((sum, loan) => sum + loan.principal_amount, 0);
    const totalOutstanding = loans.reduce((sum, loan) => sum + loan.principal_outstanding, 0);
    const totalRecovered = loans.reduce((sum, loan) => sum + (loan.principal_amount - loan.principal_outstanding), 0);
    const activeLoans = loans.filter(loan => loan.status === 'active').length;
    
    // Calculate default rate
    const defaultedLoans = loans.filter(loan => loan.status === 'defaulted').length;
    const defaultRate = totalLoans > 0 ? (defaultedLoans / totalLoans) * 100 : 0;
    
    // Calculate average loan size
    const avgLoanSize = totalLoans > 0 ? totalDisbursed / totalLoans : 0;

    // Calculate monthly disbursements
    const monthlyDisbursements = calculateMonthlyData(loans, 'disbursement_date', 'principal_amount');
    
    // Calculate monthly recoveries
    const monthlyRecoveries = calculateMonthlyData(repayments, 'payment_date', 'amount_paid');

    // Calculate portfolio distribution
    const portfolioDistribution = calculatePortfolioDistribution(loans);

    // Calculate risk distribution
    const riskDistribution = calculateRiskDistribution(loans);

    setAnalyticsData({
      totalLoans,
      totalDisbursed,
      totalOutstanding,
      totalRecovered,
      activeLoans,
      defaultRate,
      avgLoanSize,
      monthlyDisbursements,
      monthlyRecoveries,
      portfolioDistribution,
      riskDistribution
    });
  };

  const calculateMonthlyData = (data: any[], dateField: string, amountField: string) => {
    const monthlyData: { [key: string]: number } = {};
    
    data.forEach(item => {
      const date = new Date(item[dateField]);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0;
      }
      monthlyData[monthKey] += item[amountField] || 0;
    });

    // Convert to array and sort
    return Object.entries(monthlyData)
      .map(([month, amount]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
        amount
      }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
      .slice(-12); // Last 12 months
  };

  const calculatePortfolioDistribution = (loans: any[]) => {
    const distribution: { [key: string]: { amount: number; count: number } } = {};
    
    loans.forEach(loan => {
      const category = loan.loan_type || 'Unknown';
      if (!distribution[category]) {
        distribution[category] = { amount: 0, count: 0 };
      }
      distribution[category].amount += loan.principal_amount;
      distribution[category].count += 1;
    });

    return Object.entries(distribution).map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count
    }));
  };

  const calculateRiskDistribution = (loans: any[]) => {
    const distribution: { [key: string]: { count: number; amount: number } } = {};
    
    loans.forEach(loan => {
      const risk = loan.risk_level || 'medium';
      if (!distribution[risk]) {
        distribution[risk] = { count: 0, amount: 0 };
      }
      distribution[risk].count += 1;
      distribution[risk].amount += loan.principal_outstanding;
    });

    return Object.entries(distribution).map(([risk, data]) => ({
      risk,
      count: data.count,
      amount: data.amount
    }));
  };

  const getPerformanceColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
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
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No analytics data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Analytics</h1>
          <p className="text-gray-600">Comprehensive portfolio performance and insights</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Portfolio</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(analyticsData.totalDisbursed)}</p>
              <p className="text-xs text-gray-500 mt-1">All time disbursed</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Outstanding</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(analyticsData.totalOutstanding)}</p>
              <p className="text-xs text-gray-500 mt-1">Current balance</p>
            </div>
            <Target className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Recovery Rate</p>
              <p className={`text-2xl font-bold ${getPerformanceColor(analyticsData.defaultRate)}`}>
                {formatPercentage(100 - analyticsData.defaultRate)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Portfolio performance</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Default Rate</p>
              <p className={`text-2xl font-bold ${getPerformanceColor(analyticsData.defaultRate)}`}>
                {formatPercentage(analyticsData.defaultRate)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Risk indicator</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Disbursements */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Monthly Disbursements</h3>
            <BarChart3 className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="space-y-3">
            {analyticsData.monthlyDisbursements.slice(-6).map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{item.month}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full" 
                      style={{ width: `${(item.amount / Math.max(...analyticsData.monthlyDisbursements.map(m => m.amount))) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{formatCurrency(item.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Recoveries */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Monthly Recoveries</h3>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <div className="space-y-3">
            {analyticsData.monthlyRecoveries.slice(-6).map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{item.month}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ width: `${(item.amount / Math.max(...analyticsData.monthlyRecoveries.map(m => m.amount))) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{formatCurrency(item.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Distribution Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Portfolio Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Portfolio Distribution</h3>
            <PieChart className="h-5 w-5 text-purple-600" />
          </div>
          <div className="space-y-3">
            {analyticsData.portfolioDistribution.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-900">{item.category}</span>
                  <p className="text-xs text-gray-500">{item.count} loans</p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full" 
                      style={{ width: `${(item.amount / analyticsData.totalDisbursed) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{formatCurrency(item.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Risk Distribution</h3>
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </div>
          <div className="space-y-3">
            {analyticsData.riskDistribution.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-900 capitalize">{item.risk}</span>
                  <p className="text-xs text-gray-500">{item.count} loans</p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        item.risk === 'high' ? 'bg-red-600' : 
                        item.risk === 'medium' ? 'bg-orange-600' : 
                        item.risk === 'low' ? 'bg-green-600' : 'bg-gray-600'
                      }`}
                      style={{ width: `${(item.amount / analyticsData.totalOutstanding) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{formatCurrency(item.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Performance Summary</h3>
          <Activity className="h-5 w-5 text-blue-600" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{analyticsData.activeLoans}</div>
            <div className="text-sm text-green-700">Active Loans</div>
            <div className="text-xs text-green-600 mt-1">Currently earning</div>
          </div>
          
          <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(analyticsData.avgLoanSize)}</div>
            <div className="text-sm text-blue-700">Average Loan Size</div>
            <div className="text-xs text-blue-600 mt-1">Portfolio average</div>
          </div>
          
          <div className="text-center p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{analyticsData.totalLoans}</div>
            <div className="text-sm text-purple-700">Total Loans</div>
            <div className="text-xs text-purple-600 mt-1">All time issued</div>
          </div>
        </div>
      </div>
    </div>
  );
};