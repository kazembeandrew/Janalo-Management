import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/utils/finance';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { Download, Printer, Sparkles, RefreshCw } from 'lucide-react';
import { analyzeFinancialData } from '@/services/aiService';

export const Reports: React.FC = () => {
  const [statusData, setStatusData] = useState<any[]>([]);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    setLoading(true);
    try {
        // 1. Status Breakdown
        const { data: status } = await supabase.rpc('get_loan_status_breakdown');
        setStatusData(status || []);

        // 2. Disbursement Timeline
        const { data: timeline } = await supabase.rpc('get_disbursement_timeline');
        setTimelineData(timeline || []);

        // 3. Revenue
        const { data: revenue } = await supabase.rpc('get_monthly_revenue');
        setRevenueData(revenue || []);

    } catch (error) {
        console.error(error);
    } finally {
        setLoading(false);
    }
  };

  const generateAIInsights = async () => {
    setIsAnalyzing(true);
    const insights = await analyzeFinancialData({
      statusData,
      timelineData,
      revenueData
    });
    setAiInsights(insights);
    setIsAnalyzing(false);
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  if (loading) return <div className="p-8 text-center">Generating reports...</div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center print:hidden">
        <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
        <div className="flex space-x-2">
            <button 
                onClick={generateAIInsights}
                disabled={isAnalyzing}
                className="inline-flex items-center px-4 py-2 border border-indigo-300 rounded-md shadow-sm text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
            >
                {isAnalyzing ? (
                    <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                    </>
                ) : (
                    <>
                        <Sparkles className="h-4 w-4 mr-2" /> AI Insights
                    </>
                )}
            </button>
            <button 
                onClick={() => window.print()}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
                <Printer className="h-4 w-4 mr-2" /> Print Report
            </button>
        </div>
      </div>

      {/* AI Insights Section */}
      {aiInsights.length > 0 && (
          <div className="bg-indigo-900 rounded-xl p-6 text-white shadow-lg border border-indigo-500/30 print:hidden">
              <div className="flex items-center mb-4">
                  <Sparkles className="h-5 w-5 text-indigo-300 mr-2" />
                  <h3 className="text-lg font-bold">AI Financial Analysis</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {aiInsights.map((insight, idx) => (
                      <div key={idx} className="bg-white/10 p-4 rounded-lg border border-white/10 flex items-start">
                          <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-2 mr-3 shrink-0" />
                          <p className="text-sm text-indigo-50">{insight}</p>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* Print Header */}
      <div className="hidden print:block text-center mb-8">
          <h1 className="text-3xl font-bold">Janalo Management Report</h1>
          <p className="text-gray-500">Generated on {new Date().toLocaleDateString()}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Portfolio Status */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200 break-inside-avoid">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Portfolio Distribution (Value)</h3>
              <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                              data={statusData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="total_value"
                          >
                              {statusData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Legend />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Disbursement Timeline */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200 break-inside-avoid">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Disbursement Timeline</h3>
              <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timelineData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Bar dataKey="amount" fill="#4F46E5" name="Disbursed Amount" />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Revenue Trend */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200 lg:col-span-2 break-inside-avoid">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Revenue Growth (Interest & Fees)</h3>
              <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={revenueData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Legend />
                          <Line type="monotone" dataKey="income" stroke="#10B981" strokeWidth={3} name="Income Collected" />
                      </LineChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-lg shadow border border-gray-200 lg:col-span-2 overflow-hidden break-inside-avoid">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-lg font-bold text-gray-900">Detailed Status Breakdown</h3>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                      <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Value</th>
                      </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                      {statusData.map((item, index) => (
                          <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">{item.status}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{item.count}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-bold">{formatCurrency(item.total_value)}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};
