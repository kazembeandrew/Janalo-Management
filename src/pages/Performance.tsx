import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/utils/finance';
import { Award, TrendingUp, Users, DollarSign, Search, Download, PieChart as PieIcon } from 'lucide-react';
import { exportToCSV } from '@/utils/export';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export const Performance: React.FC = () => {
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [commissionRate, setCommissionRate] = useState(1); // 1% default

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

  useEffect(() => {
    fetchPerformance();
  }, []);

  const fetchPerformance = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_officer_performance');
    if (!error) setStats(data || []);
    setLoading(false);
  };

  const handleExport = () => {
      const exportData = stats.map(s => ({
          Officer: s.officer_name,
          Active_Loans: s.active_count,
          Portfolio_Value: s.portfolio_value,
          At_Risk: s.at_risk_count,
          Estimated_Commission: (s.portfolio_value * (commissionRate / 100))
      }));
      exportToCSV(exportData, 'Officer_Performance_Report');
  };

  const filteredStats = stats.filter(s => 
    s.officer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const chartData = stats.map(s => ({
      name: s.officer_name,
      value: Number(s.portfolio_value)
  })).filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance & Commissions</h1>
          <p className="text-sm text-gray-500">Track officer productivity and calculate monthly incentives.</p>
        </div>
        <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
            <Download className="h-4 w-4 mr-2" /> Export Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                      <Award className="h-6 w-6 text-indigo-600" />
                  </div>
                  <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">Top Performer</span>
              </div>
              <h3 className="text-sm font-medium text-gray-500">Top Officer</h3>
              <p className="text-xl font-bold text-gray-900">{stats[0]?.officer_name || 'N/A'}</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-green-50 rounded-lg">
                      <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex items-center">
                      <span className="text-xs text-gray-500 mr-2">Rate:</span>
                      <input 
                        type="number" 
                        className="w-12 text-xs border rounded px-1 py-0.5" 
                        value={commissionRate} 
                        onChange={(e) => setCommissionRate(Number(e.target.value))}
                      />
                      <span className="text-xs text-gray-500 ml-1">%</span>
                  </div>
              </div>
              <h3 className="text-sm font-medium text-gray-500">Total Est. Commissions</h3>
              <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(stats.reduce((sum, s) => sum + (s.portfolio_value * (commissionRate / 100)), 0))}
              </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-blue-50 rounded-lg">
                      <Users className="h-6 w-6 text-blue-600" />
                  </div>
              </div>
              <h3 className="text-sm font-medium text-gray-500">Active Field Staff</h3>
              <p className="text-xl font-bold text-gray-900">{stats.length}</p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white shadow rounded-lg overflow-hidden border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <div className="relative max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Search officer..." 
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
                <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Officer Name</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Active Loans</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Portfolio Value</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">At Risk</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Est. Commission</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                <tr><td colSpan={5} className="px-6 py-4 text-center">Loading performance data...</td></tr>
                ) : filteredStats.map(s => (
                <tr key={s.officer_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{s.officer_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">{s.active_count}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 font-semibold">{formatCurrency(s.portfolio_value)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${s.at_risk_count > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {s.at_risk_count}
                        </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-indigo-600 font-bold">
                        {formatCurrency(s.portfolio_value * (commissionRate / 100))}
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center mb-6">
                  <PieIcon className="h-4 w-4 mr-2 text-indigo-600" />
                  Portfolio Share
              </h3>
              <div className="h-64">
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
                          <Tooltip formatter={(val: number) => formatCurrency(val)} />
                          <Legend />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
              <div className="mt-6 space-y-2">
                  <p className="text-xs text-gray-500 italic">Visualizing the distribution of active capital across the field team.</p>
              </div>
          </div>
      </div>
    </div>
  );
};