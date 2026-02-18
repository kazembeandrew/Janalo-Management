import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/finance';
import { Download, AlertOctagon, TrendingUp, PieChart as PieIcon, BarChart as BarIcon, Banknote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell
} from 'recharts';

export const Reports: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // Data for Charts
  const [statusData, setStatusData] = useState<any[]>([]);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [recentLoans, setRecentLoans] = useState<any[]>([]);
  
  // Dashboard Stats Reuse
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [totalDisbursed, setTotalDisbursed] = useState(0);
  const [projectedRev, setProjectedRev] = useState(0); // This currently is harder to get via simple RPC without extra logic, we'll approximate or add to RPC later. For now, use fetched RPC stat if possible or calc on recent.
  const [realizedRev, setRealizedRev] = useState(0);
  const [totalLoansCount, setTotalLoansCount] = useState(0);

  const [viewMode, setViewMode] = useState<'accrual' | 'cash'>('accrual');

  // Guard: Officers cannot view reports
  const isExec = profile?.role === 'admin' || profile?.role === 'ceo';

  useEffect(() => {
    if (!profile) return;
    if (!isExec) return;
    fetchReportData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, isExec]);

  const fetchReportData = async () => {
    try {
        setLoading(true);

        // 1. Dashboard Stats (For Total Outstanding, Realized Rev)
        const { data: stats } = await supabase.rpc('get_dashboard_stats');
        if (stats) {
            setTotalOutstanding((stats.principal_outstanding || 0) + (stats.interest_outstanding || 0));
            setTotalDisbursed(stats.total_disbursed || 0);
            setRealizedRev(stats.earned_interest || 0); // Note: earned_interest in dashboard stat is based on completed loans. 
            // For realized CASH revenue, we need get_monthly_revenue sum
        }

        // 2. Monthly Revenue Sum (Better Realized Rev)
        const { data: revData } = await supabase.rpc('get_monthly_revenue');
        if (revData) {
            const totalCash = revData.reduce((sum: number, r: any) => sum + r.income, 0);
            setRealizedRev(totalCash);
        }

        // 3. Status Breakdown
        const { data: statusBreakdown } = await supabase.rpc('get_loan_status_breakdown');
        if (statusBreakdown) {
            const formattedStatus = statusBreakdown.map((s: any) => ({
                name: s.status.charAt(0).toUpperCase() + s.status.slice(1),
                value: s.total_value,
                count: s.count
            }));
            setStatusData(formattedStatus);
            setTotalLoansCount(formattedStatus.reduce((sum: number, s: any) => sum + s.count, 0));
        }

        // 4. Timeline
        const { data: timeline } = await supabase.rpc('get_disbursement_timeline');
        if (timeline) {
            const formattedTimeline = timeline.map((t: any) => ({
                date: t.month,
                amount: t.amount
            }));
            setTimelineData(formattedTimeline);
        }

        // 5. Recent Loans (Limited Fetch)
        const { data: recent } = await supabase
            .from('loans')
            .select('id, created_at, status, principal_amount, principal_outstanding, interest_outstanding, borrowers(full_name)')
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (recent) setRecentLoans(recent);
        
        // Projected Revenue approximation (Total outstanding interest roughly)
        // Or fetch a sum. For now, let's use interest_outstanding from dashboard stats as "Unrealized/Projected" portion of active.
        // But true projected is total_payable of all time - principal. 
        // We'll stick to a simpler metric available: Outstanding Interest.
        if (stats) {
            setProjectedRev(stats.interest_outstanding || 0);
        }

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    // Exporting summaries since we don't fetch all rows anymore
    const headers = ['Metric', 'Value'];
    const csvContent = [
      headers.join(','),
      `Total Outstanding,${totalOutstanding}`,
      `Total Disbursed,${totalDisbursed}`,
      `Realized Revenue,${realizedRev}`,
      `Total Loans,${totalLoansCount}`
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'janalo_summary_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const COLORS = ['#4F46E5', '#10B981', '#EF4444', '#F59E0B', '#8B5CF6'];

  if (!isExec) {
     return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertOctagon className="h-16 w-16 text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
            <p className="text-gray-500 mt-2">Reports are restricted to Executive roles.</p>
            <button 
                onClick={() => navigate('/')}
                className="mt-4 text-indigo-600 hover:text-indigo-800 font-medium"
            >
                Return to Dashboard
            </button>
        </div>
    );
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Generating analytics...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
          <p className="text-sm text-gray-500">Real-time analytics and performance metrics</p>
        </div>
        <div className="flex space-x-3">
             {/* Toggle Switch */}
            <div className="bg-gray-100 p-1 rounded-lg flex items-center">
                <button
                    onClick={() => setViewMode('accrual')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'accrual' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Outstanding Int.
                </button>
                <button
                    onClick={() => setViewMode('cash')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'cash' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Realized (Cash)
                </button>
            </div>
            <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
            <Download className="h-4 w-4 mr-2" />
            Export Summary
            </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-500">Total Outstanding</div>
                  <div className="p-2 bg-indigo-50 rounded-lg"><TrendingUp className="h-5 w-5 text-indigo-600"/></div>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(totalOutstanding)}
              </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-500">
                      {viewMode === 'accrual' ? 'Outstanding Interest' : 'Realized Revenue'}
                  </div>
                   <div className="p-2 bg-green-50 rounded-lg"><PieIcon className="h-5 w-5 text-green-600"/></div>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(viewMode === 'accrual' ? projectedRev : realizedRev)}
              </div>
               <div className="text-xs text-gray-400 mt-1">
                   {viewMode === 'accrual' ? 'Projected from active loans' : `Cash collected (6mo)`}
               </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-500">Total Disbursed</div>
                   <div className="p-2 bg-purple-50 rounded-lg"><Banknote className="h-5 w-5 text-purple-600"/></div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalDisbursed)}</div>
              <div className="text-xs text-gray-400 mt-1">Life-to-date principal</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-500">Total Loans</div>
                   <div className="p-2 bg-blue-50 rounded-lg"><BarIcon className="h-5 w-5 text-blue-600"/></div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{totalLoansCount}</div>
              <div className="text-xs text-gray-400 mt-1">Across all branches</div>
          </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Growth Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-medium text-gray-900 mb-6">Disbursement Growth</h3>
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timelineData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis 
                            dataKey="date" 
                            tick={{fill: '#6B7280', fontSize: 12}} 
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis 
                            tick={{fill: '#6B7280', fontSize: 12}} 
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                            formatter={(value: any) => [`$${value}`, 'Disbursed']}
                        />
                        <Line 
                            type="monotone" 
                            dataKey="amount" 
                            stroke="#4F46E5" 
                            strokeWidth={3}
                            dot={{ fill: '#4F46E5', strokeWidth: 2 }}
                            activeDot={{ r: 8 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-medium text-gray-900 mb-6">Outstanding Volume by Status</h3>
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusData} layout="vertical">
                         <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E7EB" />
                         <XAxis type="number" hide />
                         <YAxis 
                            dataKey="name" 
                            type="category" 
                            tick={{fill: '#374151', fontSize: 13, fontWeight: 500}}
                            axisLine={false}
                            tickLine={false}
                            width={100}
                         />
                         <Tooltip 
                             cursor={{fill: 'transparent'}}
                             contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                             formatter={(value: any) => [`$${value}`, 'Value']}
                         />
                         <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {statusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                         </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-100">
         <div className="px-6 py-4 border-b border-gray-200">
             <h3 className="text-lg font-medium text-gray-900">Recent Transactions</h3>
         </div>
         <div className="overflow-x-auto">
             <table className="min-w-full divide-y divide-gray-200 text-sm">
                 <thead className="bg-gray-50">
                     <tr>
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Borrower</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                         <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Principal</th>
                         <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding</th>
                     </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-200 bg-white">
                     {recentLoans.map(loan => (
                         <tr key={loan.id} className="hover:bg-gray-50">
                             <td className="px-6 py-4 whitespace-nowrap text-gray-500">{new Date(loan.created_at).toLocaleDateString()}</td>
                             <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{loan.borrowers?.full_name}</td>
                             <td className="px-6 py-4 whitespace-nowrap">
                                 <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    loan.status === 'active' ? 'bg-blue-100 text-blue-800' :
                                    loan.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    'bg-red-100 text-red-800'
                                 }`}>
                                     {loan.status}
                                 </span>
                             </td>
                             <td className="px-6 py-4 whitespace-nowrap text-right text-gray-500">{formatCurrency(loan.principal_amount)}</td>
                             <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900">
                                 {formatCurrency(loan.principal_outstanding + loan.interest_outstanding)}
                             </td>
                         </tr>
                     ))}
                 </tbody>
             </table>
         </div>
      </div>
    </div>
  );
};