import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Search, TrendingUp, DollarSign, PieChart, Clock, FileText, Users, Target, CreditCard, ArrowUpCircle, ArrowDownCircle, Activity, Eye, Edit2, Trash2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { accountsService } from '@/services/accounts';
import { loanService } from '@/services/loans';
import { expensesService } from '@/services/expenses';
import { payrollService } from '@/services/payroll';
import { formatCurrency } from '@/utils/finance';

interface BIMetric {
  id: string;
  name: string;
  type: 'portfolio' | 'loans' | 'expenses' | 'payroll' | 'revenue' | 'recovery';
  status: 'healthy' | 'warning' | 'critical';
  value: number;
  trend: 'up' | 'down' | 'stable';
  change?: number;
  description: string;
}

const BusinessIntelligencePage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [metrics, setMetrics] = useState<BIMetric[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const biMetrics: BIMetric[] = [];

      // Load accounts for portfolio metrics
      const accountsResult = await accountsService.getAccounts();
      if (accountsResult.data) {
        const accounts = accountsResult.data.data;
        const totalAssets = accounts
          .filter(a => a.account_category === 'asset')
          .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
        const totalLiabilities = accounts
          .filter(a => a.account_category === 'liability')
          .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
        
        biMetrics.push({
          id: 'portfolio_total',
          name: 'Total Portfolio Value',
          type: 'portfolio',
          status: totalAssets > 0 ? 'healthy' : 'warning',
          value: totalAssets,
          trend: 'up',
          description: 'Sum of all asset account balances'
        });

        biMetrics.push({
          id: 'net_worth',
          name: 'Net Worth',
          type: 'revenue',
          status: (totalAssets - totalLiabilities) > 0 ? 'healthy' : 'critical',
          value: totalAssets - totalLiabilities,
          trend: 'stable',
          description: 'Total assets minus total liabilities'
        });
      }

      // Load loan metrics
      const loansResult = await loanService.getLoans();
      if (loansResult.data) {
        const loans = loansResult.data.data;
        const activeLoans = loans.filter(l => l.status === 'active').length;
        const totalDisbursed = loans.reduce((sum, l) => sum + (Number(l.principal_outstanding) || 0), 0);
        const totalRecovered = loans.reduce((sum, l) => sum + ((Number(l.total_payable) || 0) - (Number(l.principal_outstanding) || 0)), 0);
        
        biMetrics.push({
          id: 'active_loans',
          name: 'Active Loans',
          type: 'loans',
          status: activeLoans > 0 ? 'healthy' : 'warning',
          value: activeLoans,
          trend: 'stable',
          description: 'Number of currently active loans'
        });

        biMetrics.push({
          id: 'loan_recovery',
          name: 'Loan Recovery Rate',
          type: 'recovery',
          status: 'healthy',
          value: totalDisbursed > 0 ? (totalRecovered / totalDisbursed) * 100 : 0,
          trend: 'up',
          description: 'Percentage of loans recovered'
        });
      }

      // Load expense metrics
      const expensesResult = await expensesService.getExpenses();
      if (expensesResult.data) {
        const totalExpenses = expensesResult.data.data.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        biMetrics.push({
          id: 'total_expenses',
          name: 'Total Expenses',
          type: 'expenses',
          status: totalExpenses > 0 ? 'warning' : 'healthy',
          value: totalExpenses,
          trend: 'down',
          description: 'Sum of all recorded expenses'
        });
      }

      // Load payroll metrics
      const payrollResult = await payrollService.getPayrollRecords();
      if (payrollResult.data) {
        const payrollRecords = payrollResult.data.data;
        const totalPayroll = payrollRecords.reduce((sum, p) => sum + (Number(p.gross_pay) || 0), 0);
        biMetrics.push({
          id: 'total_payroll',
          name: 'Total Payroll',
          type: 'payroll',
          status: 'healthy',
          value: totalPayroll,
          trend: 'stable',
          description: 'Sum of all payroll disbursements'
        });
      }

      setMetrics(biMetrics);
    } catch (error) {
      console.error('Error loading business intelligence data:', error);
      toast.error('Failed to load business intelligence data');
    } finally {
      setLoading(false);
    }
  };

  const filteredMetrics = metrics.filter(metric => 
    metric.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    metric.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-12 text-center">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Intelligence</h1>
          <p className="text-sm text-gray-500 mt-1">Analytics, forecasts, and strategic insights</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add New
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search business intelligence..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Real-time Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMetrics.map((metric) => (
          <div key={metric.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-500 mb-1">{metric.description}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {metric.type === 'loans' || metric.type === 'payroll' ? metric.value.toLocaleString() : 
                   metric.type === 'recovery' ? `${metric.value.toFixed(1)}%` :
                   formatCurrency(metric.value)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {metric.trend === 'up' ? (
                    <ArrowUpCircle className="h-4 w-4 text-green-600" />
                  ) : metric.trend === 'down' ? (
                    <ArrowDownCircle className="h-4 w-4 text-red-600" />
                  ) : (
                    <Activity className="h-4 w-4 text-gray-400" />
                  )}
                  <span className={`text-xs font-medium ${
                    metric.status === 'healthy' ? 'text-green-600' :
                    metric.status === 'warning' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {metric.status.charAt(0).toUpperCase() + metric.status.slice(1)}
                  </span>
                </div>
              </div>
              <div className={`p-3 rounded-xl ${
                metric.type === 'portfolio' ? 'bg-green-100' :
                metric.type === 'loans' ? 'bg-blue-100' :
                metric.type === 'expenses' ? 'bg-red-100' :
                metric.type === 'payroll' ? 'bg-orange-100' :
                metric.type === 'recovery' ? 'bg-purple-100' :
                'bg-gray-100'
              }`}>
                {metric.type === 'portfolio' ? <DollarSign className="h-6 w-6 text-green-600" /> :
                 metric.type === 'loans' ? <Target className="h-6 w-6 text-blue-600" /> :
                 metric.type === 'expenses' ? <CreditCard className="h-6 w-6 text-red-600" /> :
                 metric.type === 'payroll' ? <Users className="h-6 w-6 text-orange-600" /> :
                 metric.type === 'recovery' ? <TrendingUp className="h-6 w-6 text-purple-600" /> :
                 <PieChart className="h-6 w-6 text-gray-600" />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredMetrics.length === 0 && !loading && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No business intelligence metrics found</p>
        </div>
      )}
    </div>
  );
};

export default BusinessIntelligencePage;