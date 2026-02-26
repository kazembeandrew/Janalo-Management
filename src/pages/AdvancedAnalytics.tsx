import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Shield, 
  DollarSign, 
  Users, 
  BarChart3, 
  PieChart, 
  Activity,
  Target,
  Calendar,
  Download,
  RefreshCw
} from 'lucide-react';
import { formatCurrency } from '@/utils/finance';
import toast from 'react-hot-toast';

interface RevenueForecast {
  id: string;
  forecast_date: string;
  predicted_revenue: number;
  confidence_score: number;
  actual_revenue?: number;
  variance_percentage?: number;
}

interface RiskAssessment {
  id: string;
  assessment_date: string;
  portfolio_risk_score: number;
  concentration_risk: number;
  credit_risk: number;
  liquidity_risk: number;
  operational_risk: number;
  market_risk: number;
  risk_level: string;
  mitigation_actions?: string[];
}

interface CLVData {
  id: string;
  borrower_id: string;
  clv_score: number;
  total_revenue_generated: number;
  profitability_score: number;
  loyalty_score: number;
  borrowers?: {
    full_name: string;
  };
}

export const AdvancedAnalytics: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [activeTab, setActiveTab] = useState<'forecasting' | 'risk' | 'clv' | 'insights'>('forecasting');
  const [loading, setLoading] = useState(true);
  const [revenueForecasts, setRevenueForecasts] = useState<RevenueForecast[]>([]);
  const [riskAssessments, setRiskAssessments] = useState<RiskAssessment[]>([]);
  const [clvData, setClvData] = useState<CLVData[]>([]);
  const [analyticsSummary, setAnalyticsSummary] = useState({
    totalRevenue: 0,
    growthRate: 0,
    riskScore: 0,
    customerCount: 0,
    avgCLV: 0,
    portfolioValue: 0
  });

  const isAuthorized = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo');

  useEffect(() => {
    if (!isAuthorized) {
      toast.error('You are not authorized to access this page');
      return;
    }
    fetchAnalyticsData();
  }, [isAuthorized]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const [forecastsRes, riskRes, clvRes] = await Promise.all([
        supabase
          .from('revenue_forecasts')
          .select('*')
          .order('forecast_date', { ascending: false })
          .limit(12),
        supabase
          .from('risk_assessments')
          .select('*')
          .order('assessment_date', { ascending: false })
          .limit(6),
        supabase
          .from('customer_lifetime_value')
          .select('*, borrowers(full_name)')
          .order('clv_score', { ascending: false })
          .limit(10)
      ]);

      if (forecastsRes.data) setRevenueForecasts(forecastsRes.data);
      if (riskRes.data) setRiskAssessments(riskRes.data);
      if (clvRes.data) setClvData(clvRes.data);

      // Calculate summary metrics
      if (forecastsRes.data && forecastsRes.data.length > 0) {
        const totalRevenue = forecastsRes.data.reduce((sum, f) => sum + f.predicted_revenue, 0);
        const avgGrowth = forecastsRes.data.length > 1 
          ? ((forecastsRes.data[0].predicted_revenue - forecastsRes.data[forecastsRes.data.length - 1].predicted_revenue) / 
             forecastsRes.data[forecastsRes.data.length - 1].predicted_revenue) * 100
          : 0;
        
        setAnalyticsSummary(prev => ({
          ...prev,
          totalRevenue,
          growthRate: avgGrowth
        }));
      }

      if (riskRes.data && riskRes.data.length > 0) {
        setAnalyticsSummary(prev => ({
          ...prev,
          riskScore: riskRes.data[0].portfolio_risk_score
        }));
      }

      if (clvRes.data && clvRes.data.length > 0) {
        const avgCLV = clvRes.data.reduce((sum, c) => sum + c.clv_score, 0) / clvRes.data.length;
        const totalRevenue = clvRes.data.reduce((sum, c) => sum + c.total_revenue_generated, 0);
        
        setAnalyticsSummary(prev => ({
          ...prev,
          customerCount: clvRes.data.length,
          avgCLV,
          portfolioValue: totalRevenue
        }));
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const generateForecast = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('generate_revenue_forecast');
      if (error) throw error;
      toast.success('Revenue forecast generated successfully');
      fetchAnalyticsData();
    } catch (error) {
      console.error('Error generating forecast:', error);
      toast.error('Failed to generate forecast');
    } finally {
      setLoading(false);
    }
  };

  const assessRisk = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('assess_portfolio_risk');
      if (error) throw error;
      toast.success('Risk assessment completed');
      fetchAnalyticsData();
    } catch (error) {
      console.error('Error assessing risk:', error);
      toast.error('Failed to assess risk');
    } finally {
      setLoading(false);
    }
  };

  const calculateCLV = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('calculate_customer_lifetime_value');
      if (error) throw error;
      toast.success('Customer lifetime value calculated');
      fetchAnalyticsData();
    } catch (error) {
      console.error('Error calculating CLV:', error);
      toast.error('Failed to calculate CLV');
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
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
          <h1 className="text-2xl font-bold text-gray-900">Advanced Analytics</h1>
          <p className="text-gray-600">Comprehensive business intelligence and insights</p>
        </div>
        <button
          onClick={fetchAnalyticsData}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Revenue (Forecast)</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(analyticsSummary.totalRevenue)}</p>
              <div className="flex items-center mt-2">
                {analyticsSummary.growthRate >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                )}
                <span className={`text-sm ${analyticsSummary.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {analyticsSummary.growthRate.toFixed(1)}%
                </span>
              </div>
            </div>
            <DollarSign className="h-8 w-8 text-indigo-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Portfolio Risk Score</p>
              <p className="text-2xl font-bold text-gray-900">{analyticsSummary.riskScore.toFixed(1)}</p>
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      analyticsSummary.riskScore < 30 ? 'bg-green-500' :
                      analyticsSummary.riskScore < 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(analyticsSummary.riskScore, 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <AlertTriangle className="h-8 w-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Average Customer Lifetime Value</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(analyticsSummary.avgCLV)}</p>
              <p className="text-sm text-gray-500 mt-1">{analyticsSummary.customerCount} customers</p>
            </div>
            <Users className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { id: 'forecasting', name: 'Revenue Forecasting', icon: BarChart3 },
              { id: 'risk', name: 'Risk Assessment', icon: Shield },
              { id: 'clv', name: 'Customer Lifetime Value', icon: Users },
              { id: 'insights', name: 'Business Insights', icon: Target }
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
          {/* Revenue Forecasting Tab */}
          {activeTab === 'forecasting' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Revenue Forecasting</h3>
                <button
                  onClick={generateForecast}
                  className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  disabled={loading}
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Generate New Forecast
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {revenueForecasts.slice(0, 6).map((forecast) => (
                  <div key={forecast.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {new Date(forecast.forecast_date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          year: 'numeric' 
                        })}
                      </span>
                      <span className={`text-sm font-medium ${getConfidenceColor(forecast.confidence_score)}`}>
                        {(forecast.confidence_score * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Predicted:</span>
                        <span className="text-sm font-medium">{formatCurrency(forecast.predicted_revenue)}</span>
                      </div>
                      {forecast.actual_revenue && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Actual:</span>
                          <span className="text-sm font-medium">{formatCurrency(forecast.actual_revenue)}</span>
                        </div>
                      )}
                      {forecast.variance_percentage && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Variance:</span>
                          <span className={`text-sm font-medium ${
                            forecast.variance_percentage > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {forecast.variance_percentage > 0 ? '+' : ''}{forecast.variance_percentage.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk Assessment Tab */}
          {activeTab === 'risk' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Portfolio Risk Assessment</h3>
                <button
                  onClick={assessRisk}
                  className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  disabled={loading}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Run Risk Assessment
                </button>
              </div>

              <div className="space-y-4">
                {riskAssessments.map((assessment) => (
                  <div key={assessment.id} className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <span className="text-sm text-gray-600">Assessment Date: </span>
                        <span className="text-sm font-medium text-gray-900">
                          {new Date(assessment.assessment_date).toLocaleDateString()}
                        </span>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRiskLevelColor(assessment.risk_level)}`}>
                        {assessment.risk_level.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Portfolio Risk</p>
                        <p className="text-lg font-bold text-gray-900">{assessment.portfolio_risk_score.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Concentration</p>
                        <p className="text-lg font-bold text-gray-900">{assessment.concentration_risk.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Credit Risk</p>
                        <p className="text-lg font-bold text-gray-900">{assessment.credit_risk.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Liquidity Risk</p>
                        <p className="text-lg font-bold text-gray-900">{assessment.liquidity_risk.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Operational Risk</p>
                        <p className="text-lg font-bold text-gray-900">{assessment.operational_risk.toFixed(1)}</p>
                      </div>
                    </div>

                    {assessment.mitigation_actions && assessment.mitigation_actions.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-900 mb-2">Mitigation Actions:</p>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {assessment.mitigation_actions.map((action, index) => (
                            <li key={index} className="flex items-start">
                              <span className="text-indigo-600 mr-2">•</span>
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customer Lifetime Value Tab */}
          {activeTab === 'clv' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Customer Lifetime Value Analysis</h3>
                <button
                  onClick={calculateCLV}
                  className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  disabled={loading}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Recalculate CLV
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        CLV Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Revenue
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Profitability
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Loyalty Score
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {clvData.map((customer) => (
                      <tr key={customer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {customer.borrowers?.full_name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(customer.clv_score)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(customer.total_revenue_generated)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div 
                                className="bg-green-500 h-2 rounded-full"
                                style={{ width: `${customer.profitability_score}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">{customer.profitability_score.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div 
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${customer.loyalty_score}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">{customer.loyalty_score.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Business Insights Tab */}
          {activeTab === 'insights' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Business Insights & Recommendations</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-start">
                    <TrendingUp className="h-6 w-6 text-blue-600 mr-3 mt-1" />
                    <div>
                      <h4 className="text-sm font-semibold text-blue-900 mb-2">Growth Opportunity</h4>
                      <p className="text-sm text-blue-800">
                        Based on current trends, expanding into the commercial loan segment could increase revenue by 15-20% over the next 12 months.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                  <div className="flex items-start">
                    <AlertTriangle className="h-6 w-6 text-yellow-600 mr-3 mt-1" />
                    <div>
                      <h4 className="text-sm font-semibold text-yellow-900 mb-2">Risk Alert</h4>
                      <p className="text-sm text-yellow-800">
                        Concentration risk is elevated with top 10 borrowers representing 45% of total portfolio. Consider diversification strategies.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <div className="flex items-start">
                    <Target className="h-6 w-6 text-green-600 mr-3 mt-1" />
                    <div>
                      <h4 className="text-sm font-semibold text-green-900 mb-2">Performance Highlight</h4>
                      <p className="text-sm text-green-800">
                        Customer retention rate of 92% exceeds industry average. Focus on referral programs to leverage high satisfaction.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <div className="flex items-start">
                    <PieChart className="h-6 w-6 text-purple-600 mr-3 mt-1" />
                    <div>
                      <h4 className="text-sm font-semibold text-purple-900 mb-2">Efficiency Gain</h4>
                      <p className="text-sm text-purple-800">
                        Automated workflows could reduce processing time by 30%. Consider implementing workflow automation for loan approvals.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Key Performance Indicators</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">94%</p>
                    <p className="text-xs text-gray-600">Loan Recovery Rate</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">3.2</p>
                    <p className="text-xs text-gray-600">Avg Loans per Customer</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">18%</p>
                    <p className="text-xs text-gray-600">Portfolio Growth</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">4.8</p>
                    <p className="text-xs text-gray-600">Customer Satisfaction</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
