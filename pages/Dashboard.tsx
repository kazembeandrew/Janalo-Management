import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/finance';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  Activity,
  PieChart as PieChartIcon,
  Target,
  Shield
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

export const Dashboard: React.FC = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    totalPortfolio: 0,
    totalPrincipalOutstanding: 0,
    totalInterestOutstanding: 0,
    activeLoans: 0,
    totalClients: 0,
    parCount: 0, // Portfolio At Risk (> 30 Days)
    interestEarned: 0,
    totalDisbursed: 0,
    recoveryRate: 0,
    completedLoans: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [officerStats, setOfficerStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isExec = profile?.role === 'admin' || profile?.role === 'ceo';
  const titlePrefix = isExec ? 'Total' : 'My';

  useEffect(() => {
    fetchDashboardData();
    // Run cleanup for old applications if admin/ceo
    if (isExec) {
        runCleanup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const runCleanup = async () => {
      try {
          await supabase.rpc('cleanup_old_applications');
      } catch (e) {
          console.error("Cleanup failed", e);
      }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Main Stats from RPC
      const { data: rpcStats, error: statsError } = await supabase.rpc('get_dashboard_stats');
      if (statsError) throw statsError;

      // 2. Fetch Revenue Data from RPC
      const { data: revData, error: revError } = await supabase.rpc('get_monthly_revenue');
      if (revError) throw revError;

      // 3. Fetch Officer Stats if Exec
      let offStats: any[] = [];
      if (isExec) {
          const { data, error } = await supabase.rpc('get_officer_performance');
          if (error) console.error("Officer stats error", error);
          else offStats = data || [];
      }

      // Process Stats
      if (rpcStats) {
        const totalPrincipal = rpcStats.principal_outstanding || 0;
        const totalInterest = rpcStats.interest_outstanding || 0;
        const totalPortfolio = totalPrincipal + totalInterest;
        const completed = rpcStats.completed_count || 0;
        const active = rpcStats.active_count || 0;
        const defaulted = rpcStats.defaulted_count || 0;
        const totalLoans = active + completed + defaulted; // Approximation for recovery rate calc
        
        const recoveryRate = totalLoans > 0 
          ? (completed / totalLoans) * 100 
          : 0;

        setStats({
          totalPortfolio,
          totalPrincipalOutstanding: totalPrincipal,
          totalInterestOutstanding: totalInterest,
          activeLoans: active,
          totalClients: rpcStats.total_clients || 0,
          parCount: rpcStats.par_count || 0,
          interestEarned: rpcStats.earned_interest || 0,
          totalDisbursed: rpcStats.total_disbursed || 0,
          recoveryRate,
          completedLoans: completed
        });

        // Chart Data
        setChartData([
          { name: 'Active', value: active },
          { name: 'Completed', value: completed },
          { name: 'At Risk (>30d)', value: rpcStats.par_count || 0 }, // Using PAR as the risk metric for chart
        ]);

        // Revenue Data Map (RPC returns 'YYYY-MM', 'income')
        // We need to format it for Recharts
        const formattedRevenue = (revData || []).map((d: any) => ({
            name: new Date(d.month + '-01').toLocaleDateString('en-US', { month: 'short' }),
            income: Number(d.income)
        }));
        setRevenueData(formattedRevenue);
        setOfficerStats(offStats.map((o: any) => ({
            id: o.officer_id,
            name: o.officer_name,
            activeCount: o.active_count,
            portfolioValue: o.portfolio_value,
            atRisk: o.at_risk_count
        })));
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle, trend }: any) => (
    <div className="bg-white overflow-hidden rounded-xl shadow-sm border border-gray-100 p-5 flex items-start justify-between">
        <div>
            <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
            {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color} bg-opacity-10`}>
            <Icon className={`h-6 w-6 ${color.replace('bg-', 'text-')}`} />
        </div>
    </div>
  );

  const COLORS = ['#4F46E5', '#10B981', '#EF4444'];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isExec ? 'Executive Dashboard' : 'My Dashboard'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isExec 
              ? 'Overview of financial performance and operational metrics.' 
              : `Welcome back, ${profile?.full_name}. Here is your portfolio summary.`}
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center space-x-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
            <Activity className="w-3 h-3 mr-1" /> Live Data
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
            {profile?.role?.replace('_', ' ').toUpperCase()}
          </span>
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Portfolio Value" 
          value={formatCurrency(stats.totalPortfolio)} 
          subtitle="Outstanding Principal + Interest"
          icon={DollarSign}
          color="bg-indigo-600"
        />
        <StatCard 
          title={`${titlePrefix} Active Loans`}
          value={stats.activeLoans} 
          subtitle={`${stats.totalClients} Unique Clients`}
          icon={Activity}
          color="bg-blue-500"
        />
        <StatCard 
          title="Portfolio At Risk" 
          value={stats.parCount} 
          subtitle=">30 Days Overdue"
          icon={AlertTriangle}
          color="bg-red-500"
        />
        <StatCard 
          title="Recovery Rate" 
          value={`${stats.recoveryRate.toFixed(1)}%`} 
          subtitle={`${stats.completedLoans} Loans Completed`}
          icon={Target}
          color="bg-emerald-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Revenue Trend Chart (Large) */}
        <div className="bg-white rounded-xl shadow-sm p-6 lg:col-span-2 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Revenue Trend</h3>
                    <p className="text-sm text-gray-500">Realized Income (Interest & Penalties)</p>
                </div>
                <div className="p-2 bg-green-50 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
            </div>
            
            <div className="h-72 w-full">
                {revenueData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={revenueData}>
                            <defs>
                                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                            <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fill: '#9CA3AF', fontSize: 12}}
                                dy={10}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fill: '#9CA3AF', fontSize: 12}}
                                tickFormatter={(val) => `${val / 1000}k`}
                            />
                            <Tooltip 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="income" 
                                stroke="#10B981" 
                                strokeWidth={2}
                                fillOpacity={1} 
                                fill="url(#colorIncome)" 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                        No revenue data available yet.
                    </div>
                )}
            </div>
        </div>

        {/* Portfolio Pie Chart (Side) */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex flex-col">
          <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center">
            <PieChartIcon className="h-5 w-5 mr-2 text-indigo-500" />
            Risk Distribution
          </h3>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} iconType="circle"/>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
             <div className="flex justify-between items-center text-sm">
                 <span className="text-gray-500">Active Principal</span>
                 <span className="font-bold text-indigo-900">{formatCurrency(stats.totalPrincipalOutstanding)}</span>
             </div>
          </div>
        </div>
      </div>

      {/* Admin Section: Officer Performance */}
      {isExec && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center">
                      <Shield className="h-5 w-5 mr-2 text-indigo-600" />
                      Loan Officer Performance
                  </h3>
                  <button className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">View All Users</button>
              </div>
              <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Officer</th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Active Loans</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Portfolio Value</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">At Risk</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {officerStats.length === 0 ? (
                              <tr><td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">No officers found or no active data.</td></tr>
                          ) : (
                              officerStats.map((officer) => (
                                  <tr key={officer.id} className="hover:bg-gray-50 transition-colors">
                                      <td className="px-6 py-4 whitespace-nowrap">
                                          <div className="flex items-center">
                                              <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold mr-3 text-xs">
                                                  {(officer.name || 'U').charAt(0)}
                                              </div>
                                              <div className="text-sm font-medium text-gray-900">{officer.name || 'Unknown'}</div>
                                          </div>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                                          {officer.activeCount}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                                          {formatCurrency(officer.portfolioValue)}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                          {officer.atRisk > 0 ? (
                                              <span className="text-red-600 font-medium flex items-center justify-end">
                                                  <AlertTriangle className="h-3 w-3 mr-1" /> {officer.atRisk}
                                              </span>
                                          ) : (
                                              <span className="text-green-600">-</span>
                                          )}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-right">
                                          <div className="flex items-center justify-end">
                                              {/* Simple mock score based on portfolio vs risk */}
                                              <div className="w-16 bg-gray-200 rounded-full h-1.5 mr-2">
                                                  <div 
                                                    className={`h-1.5 rounded-full ${officer.atRisk > 2 ? 'bg-red-500' : 'bg-green-500'}`} 
                                                    style={{ width: officer.atRisk > 0 ? '60%' : '95%' }}
                                                  ></div>
                                              </div>
                                          </div>
                                      </td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}
    </div>
  );
};