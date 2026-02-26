import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  TrendingUp, 
  DollarSign, 
  PiggyBank, 
  Target, 
  BarChart3, 
  PieChart, 
  Calendar, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Calculator
} from 'lucide-react';
import { formatCurrency } from '@/utils/finance';
import toast from 'react-hot-toast';

interface CashFlowProjection {
  id: string;
  projection_date: string;
  projected_inflow: number;
  projected_outflow: number;
  net_cash_flow: number;
  confidence_level: number;
  notes?: string;
  created_by: string;
  created_at: string;
  creator?: {
    full_name: string;
  };
}

interface InvestmentPortfolio {
  id: string;
  investment_name: string;
  investment_type: string;
  current_value: number;
  initial_investment: number;
  purchase_date: string;
  maturity_date?: string;
  interest_rate?: number;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator?: {
    full_name: string;
  };
}

interface BudgetVariance {
  id: string;
  budget_id: string;
  actual_amount: number;
  variance_amount: number;
  variance_percentage: number;
  analysis_period: string;
  notes?: string;
  created_by: string;
  created_at: string;
  creator?: {
    full_name: string;
  };
  budget?: {
    category: string;
    amount: number;
    month: string;
    type: string;
  };
}

export const FinancialManagement: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [activeTab, setActiveTab] = useState<'cashflow' | 'investments' | 'variance'>('cashflow');
  const [loading, setLoading] = useState(true);
  
  const [cashFlowProjections, setCashFlowProjections] = useState<CashFlowProjection[]>([]);
  const [investmentPortfolio, setInvestmentPortfolio] = useState<InvestmentPortfolio[]>([]);
  const [budgetVariances, setBudgetVariances] = useState<BudgetVariance[]>([]);
  
  const [showProjectionModal, setShowProjectionModal] = useState(false);
  const [showInvestmentModal, setShowInvestmentModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  const [newProjection, setNewProjection] = useState({
    projection_date: '',
    projected_inflow: 0,
    projected_outflow: 0,
    confidence_level: 0.8,
    notes: ''
  });
  
  const [newInvestment, setNewInvestment] = useState({
    investment_name: '',
    investment_type: 'stocks',
    initial_investment: 0,
    purchase_date: '',
    maturity_date: '',
    interest_rate: 0,
    status: 'active'
  });

  const isAuthorized = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo' ) || effectiveRoles.includes('accountant');

  useEffect(() => {
    if (!isAuthorized) {
      toast.error('You are not authorized to access this page');
      return;
    }
    fetchFinancialData();
  }, [isAuthorized]);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const [cashFlowRes, investmentRes, varianceRes] = await Promise.all([
        supabase
          .from('cash_flow_projections')
          .select('*, creator:profiles!cash_flow_projections_created_by_fkey(full_name)')
          .order('projection_date', { ascending: true }),
        supabase
          .from('investment_portfolio')
          .select('*, creator:profiles!investment_portfolio_created_by_fkey(full_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('budget_variance')
          .select('*, creator:profiles!budget_variance_created_by_fkey(full_name), budget:budgets!budget_variance_budget_id_fkey(category, amount, month, type)')
          .order('created_at', { ascending: false })
      ]);

      if (cashFlowRes.data) setCashFlowProjections(cashFlowRes.data);
      if (investmentRes.data) setInvestmentPortfolio(investmentRes.data);
      if (varianceRes.data) setBudgetVariances(varianceRes.data);
    } catch (error) {
      console.error('Error fetching financial data:', error);
      toast.error('Failed to load financial data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'matured': return 'text-blue-600 bg-blue-100';
      case 'sold': return 'text-gray-600 bg-gray-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getInvestmentTypeColor = (type: string) => {
    switch (type) {
      case 'stocks': return 'text-purple-600 bg-purple-100';
      case 'bonds': return 'text-blue-600 bg-blue-100';
      case 'mutual_funds': return 'text-green-600 bg-green-100';
      case 'fixed_deposit': return 'text-yellow-600 bg-yellow-100';
      case 'real_estate': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const createCashFlowProjection = async () => {
    try {
      const { error } = await supabase
        .from('cash_flow_projections')
        .insert({
          ...newProjection,
          net_cash_flow: newProjection.projected_inflow - newProjection.projected_outflow,
          created_by: profile?.id
        });

      if (error) throw error;
      
      toast.success('Cash flow projection created successfully');
      setNewProjection({
        projection_date: '',
        projected_inflow: 0,
        projected_outflow: 0,
        confidence_level: 0.8,
        notes: ''
      });
      setShowProjectionModal(false);
      fetchFinancialData();
    } catch (error) {
      console.error('Error creating cash flow projection:', error);
      toast.error('Failed to create cash flow projection');
    }
  };

  const createInvestment = async () => {
    try {
      const { error } = await supabase
        .from('investment_portfolio')
        .insert({
          ...newInvestment,
          current_value: newInvestment.initial_investment,
          created_by: profile?.id
        });

      if (error) throw error;
      
      toast.success('Investment added successfully');
      setNewInvestment({
        investment_name: '',
        investment_type: 'stocks',
        initial_investment: 0,
        purchase_date: '',
        maturity_date: '',
        interest_rate: 0,
        status: 'active'
      });
      setShowInvestmentModal(false);
      fetchFinancialData();
    } catch (error) {
      console.error('Error creating investment:', error);
      toast.error('Failed to add investment');
    }
  };

  const deleteInvestment = async (investmentId: string) => {
    if (!confirm('Are you sure you want to delete this investment?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('investment_portfolio')
        .delete()
        .eq('id', investmentId);

      if (error) throw error;
      
      toast.success('Investment deleted successfully');
      fetchFinancialData();
    } catch (error) {
      console.error('Error deleting investment:', error);
      toast.error('Failed to delete investment');
    }
  };

  const calculateROI = (currentValue: number, initialInvestment: number) => {
    if (initialInvestment === 0) return 0;
    return ((currentValue - initialInvestment) / initialInvestment) * 100;
  };

  const calculateTotalPortfolioValue = () => {
    return investmentPortfolio.reduce((sum, investment) => sum + investment.current_value, 0);
  };

  const calculateTotalROI = () => {
    const totalInitial = investmentPortfolio.reduce((sum, inv) => sum + inv.initial_investment, 0);
    const totalCurrent = investmentPortfolio.reduce((sum, inv) => sum + inv.current_value, 0);
    return calculateROI(totalCurrent, totalInitial);
  };

  const getVarianceColor = (percentage: number) => {
    if (percentage > 10) return 'text-red-600';
    if (percentage > 5) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">You are not authorized to access this page</p>
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
        <button
          onClick={fetchFinancialData}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Portfolio Value</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(calculateTotalPortfolioValue())}
              </p>
              <div className="flex items-center mt-2">
                {calculateTotalROI() >= 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-green-500 mr-1" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-500 mr-1" />
                )}
                <span className={`text-sm ${calculateTotalROI() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {calculateTotalROI().toFixed(2)}%
                </span>
              </div>
            </div>
            <PiggyBank className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Investments</p>
              <p className="text-2xl font-bold text-gray-900">
                {investmentPortfolio.filter(inv => inv.status === 'active').length}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {investmentPortfolio.filter(inv => inv.status === 'matured').length} matured
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Projected Cash Flow</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(
                  cashFlowProjections.reduce((sum, proj) => sum + proj.net_cash_flow, 0)
                )}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Next 30 days
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Budget Variance</p>
              <p className="text-2xl font-bold text-gray-900">
                {budgetVariances.length > 0 
                  ? (budgetVariances.reduce((sum, v) => sum + Math.abs(v.variance_percentage), 0) / budgetVariances.length).toFixed(1)
                  : '0'
                }%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Average variance
              </p>
            </div>
            <Target className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { id: 'cashflow', name: 'Cash Flow Projections', icon: DollarSign },
              { id: 'investments', name: 'Investment Portfolio', icon: PiggyBank },
              { id: 'variance', name: 'Budget Variance', icon: Target }
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
          {/* Cash Flow Projections Tab */}
          {activeTab === 'cashflow' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Cash Flow Projections</h3>
                <button
                  onClick={() => setShowProjectionModal(true)}
                  className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Projection
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cashFlowProjections.map((projection) => (
                  <div key={projection.id} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-gray-900">
                        {new Date(projection.projection_date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </span>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        <span className="text-xs text-gray-500">
                          {(projection.confidence_level * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Inflow:</span>
                        <span className="text-sm font-medium text-green-600">
                          {formatCurrency(projection.projected_inflow)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Outflow:</span>
                        <span className="text-sm font-medium text-red-600">
                          {formatCurrency(projection.projected_outflow)}
                        </span>
                      </div>
                      <div className="border-t pt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-900">Net Cash Flow:</span>
                          <span className={`text-sm font-bold ${
                            projection.net_cash_flow >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatCurrency(projection.net_cash_flow)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {projection.notes && (
                      <div className="mt-4 pt-3 border-t">
                        <p className="text-xs text-gray-500">{projection.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Investment Portfolio Tab */}
          {activeTab === 'investments' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Investment Portfolio</h3>
                <button
                  onClick={() => setShowInvestmentModal(true)}
                  className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Investment
                </button>
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
                        Initial Investment
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Current Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ROI
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {investmentPortfolio.map((investment) => (
                      <tr key={investment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{investment.investment_name}</p>
                            <p className="text-xs text-gray-500">
                              Purchased: {new Date(investment.purchase_date).toLocaleDateString()}
                            </p>
                            {investment.maturity_date && (
                              <p className="text-xs text-gray-500">
                                Matures: {new Date(investment.maturity_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getInvestmentTypeColor(investment.investment_type)}`}>
                            {investment.investment_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(investment.initial_investment)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(investment.current_value)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {calculateROI(investment.current_value, investment.initial_investment) >= 0 ? (
                              <ArrowUpRight className="h-4 w-4 text-green-500 mr-1" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-red-500 mr-1" />
                            )}
                            <span className={`text-sm font-medium ${
                              calculateROI(investment.current_value, investment.initial_investment) >= 0 
                                ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {calculateROI(investment.current_value, investment.initial_investment).toFixed(2)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(investment.status)}`}>
                            {investment.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => deleteInvestment(investment.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete investment"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Budget Variance Tab */}
          {activeTab === 'variance' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Budget Variance Analysis</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {budgetVariances.map((variance) => (
                  <div key={variance.id} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">
                          {variance.budget?.category || 'Unknown Category'}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {variance.budget?.month ? new Date(variance.budget.month).toLocaleDateString('en-US', { 
                            month: 'long', 
                            year: 'numeric' 
                          }) : 'Unknown Period'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`text-2xl font-bold ${getVarianceColor(Math.abs(variance.variance_percentage))}`}>
                          {variance.variance_percentage > 0 ? '+' : ''}{variance.variance_percentage.toFixed(1)}%
                        </span>
                        <p className="text-xs text-gray-500">variance</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Budgeted:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(variance.budget?.amount || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Actual:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(variance.actual_amount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-sm font-medium text-gray-900">Variance:</span>
                        <span className={`text-sm font-bold ${
                          variance.variance_amount >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {variance.variance_amount > 0 ? '+' : ''}{formatCurrency(variance.variance_amount)}
                        </span>
                      </div>
                    </div>

                    {variance.notes && (
                      <div className="mt-4 pt-3 border-t">
                        <p className="text-xs text-gray-600">{variance.notes}</p>
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                      <span>Analysis: {variance.analysis_period}</span>
                      <span>By {variance.creator?.full_name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cash Flow Projection Modal */}
      {showProjectionModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-xl bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">New Cash Flow Projection</h3>
              <button
                onClick={() => setShowProjectionModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Trash2 className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Projection Date
                </label>
                <input
                  type="date"
                  value={newProjection.projection_date}
                  onChange={(e) => setNewProjection({ ...newProjection, projection_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Projected Inflow
                  </label>
                  <input
                    type="number"
                    value={newProjection.projected_inflow}
                    onChange={(e) => setNewProjection({ ...newProjection, projected_inflow: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Projected Outflow
                  </label>
                  <input
                    type="number"
                    value={newProjection.projected_outflow}
                    onChange={(e) => setNewProjection({ ...newProjection, projected_outflow: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confidence Level ({(newProjection.confidence_level * 100).toFixed(0)}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={newProjection.confidence_level}
                  onChange={(e) => setNewProjection({ ...newProjection, confidence_level: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={newProjection.notes}
                  onChange={(e) => setNewProjection({ ...newProjection, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  rows={3}
                  placeholder="Add any notes about this projection..."
                />
              </div>

              <div className="flex items-center justify-end space-x-4 pt-4 border-t">
                <button
                  onClick={() => setShowProjectionModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createCashFlowProjection}
                  disabled={!newProjection.projection_date}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  Create Projection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Investment Modal */}
      {showInvestmentModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-xl bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Add Investment</h3>
              <button
                onClick={() => setShowInvestmentModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Trash2 className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Investment Name
                </label>
                <input
                  type="text"
                  value={newInvestment.investment_name}
                  onChange={(e) => setNewInvestment({ ...newInvestment, investment_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter investment name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Investment Type
                </label>
                <select
                  value={newInvestment.investment_type}
                  onChange={(e) => setNewInvestment({ ...newInvestment, investment_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="stocks">Stocks</option>
                  <option value="bonds">Bonds</option>
                  <option value="mutual_funds">Mutual Funds</option>
                  <option value="fixed_deposit">Fixed Deposit</option>
                  <option value="real_estate">Real Estate</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Initial Investment
                </label>
                <input
                  type="number"
                  value={newInvestment.initial_investment}
                  onChange={(e) => setNewInvestment({ ...newInvestment, initial_investment: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0.00"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    value={newInvestment.purchase_date}
                    onChange={(e) => setNewInvestment({ ...newInvestment, purchase_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maturity Date (optional)
                  </label>
                  <input
                    type="date"
                    value={newInvestment.maturity_date}
                    onChange={(e) => setNewInvestment({ ...newInvestment, maturity_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Interest Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={newInvestment.interest_rate}
                  onChange={(e) => setNewInvestment({ ...newInvestment, interest_rate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0.0"
                />
              </div>

              <div className="flex items-center justify-end space-x-4 pt-4 border-t">
                <button
                  onClick={() => setShowInvestmentModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createInvestment}
                  disabled={!newInvestment.investment_name || !newInvestment.purchase_date}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  Add Investment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
