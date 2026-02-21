import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/utils/finance';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, ComposedChart
} from 'recharts';
import { Download, Printer, Sparkles, RefreshCw, TrendingUp, TrendingDown, FileText, ChevronDown, AlertTriangle } from 'lucide-react';
import { analyzeFinancialData } from '@/services/aiService';
import { exportToCSV, generateTablePDF } from '@/utils/export';

export const Reports: React.FC = () => {
  const [statusData, setStatusData] = useState<any[]>([]);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [profitData, setProfitData] = useState<any[]>([]);
  const [parAgingData, setParAgingData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchReportData();

    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

        // 4. Expenses (Grouped by month)
        const { data: expenses } = await supabase
            .from('expenses')
            .select('amount, date');
        
        const groupedExpenses: any = {};
        expenses?.forEach(e => {
            const month = e.date.substring(0, 7);
            groupedExpenses[month] = (groupedExpenses[month] || 0) + Number(e.amount);
        });

        // 5. Merge for Profitability
        const combined = (revenue || []).map((r: any) => ({
            month: r.month,
            income: Number(r.income),
            expense: groupedExpenses[r.month] || 0,
            profit: Number(r.income) - (groupedExpenses[r.month] || 0)
        }));
        setProfitData(combined);

        // 6. PAR Aging Calculation
        const { data: activeLoans } = await supabase
            .from('loans')
            .select('id, principal_outstanding, interest_outstanding, penalty_outstanding, updated_at')
            .eq('status', 'active');
        
        if (activeLoans) {
            const buckets = [
                { range: 'Current', min: 0, max: 30, value: 0, count: 0 },
                { range: '31-60 Days', min: 31, max: 60, value: 0, count: 0 },
                { range: '61-90 Days', min: 61, max: 90, value: 0, count: 0 },
                { range: '91+ Days', min: 91, max: 9999, value: 0, count: 0 }
            ];

            const now = new Date();
            activeLoans.forEach(loan => {
                const lastUpdate = new Date(loan.updated_at);
                const diffDays = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 3600 * 24));
                const totalOutstanding = loan.principal_outstanding + loan.interest_outstanding + (loan.penalty_outstanding || 0);

                const bucket = buckets.find(b => diffDays >= b.min && diffDays <= b.max) || buckets[0];
                bucket.value += totalOutstanding;
                bucket.count += 1;
            });
            setParAgingData(buckets);
        }

    } catch (error) {
        console.error(error);
    } finally {
        setLoading(false);
    }
  };

  const handleExportCSV = () => {
      const data = profitData.map(d => ({
          Month: d.month,
          Income: d.income,
          Expense: d.expense,
          Net_Profit: d.profit
      }));
      exportToCSV(data, 'Profitability_Report');
      setShowExportMenu(false);
  };

  const handleExportPDF = () => {
      const headers = ['Month', 'Income (MK)', 'Expense (MK)', 'Net Profit (MK)'];
      const rows = profitData.map(d => [
          d.month,
          d.income.toFixed(2),
          d.expense.toFixed(2),
          d.profit.toFixed(2)
      ]);
      generateTablePDF('Monthly Profitability Report', headers, rows, 'Profitability_Report');
      setShowExportMenu(false);
  };

  const generateAIInsights = async () => {
    setIsAnalyzing(true);
    const insights = await analyzeFinancialData({
      statusData,
      timelineData,
      profitData,
      parAgingData
    });
    setAiInsights(insights);
    setIsAnalyzing(false);
  };

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
  const PAR_COLORS = ['#10B981', '#F59E0B', '#F97316', '#EF4444'];

  if (loading) return <div className="p-8 text-center">Generating reports...</div>;

  const totalIncome = profitData.reduce((sum, d) => sum + d.income, 0);
  const totalExpenses = profitData.reduce((sum, d) => sum + d.expense, 0);
  const netProfit = totalIncome - totalExpenses;

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
            
            <div className="relative" ref={exportMenuRef}>
                <button 
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    <Download className="h-4 w-4 mr-2" /> Export Data <ChevronDown className="ml-2 h-4 w-4" />
                </button>
                
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50 animate-in fade-in zoom-in-95 duration-100">
                      <div className="py-1">
                        <button onClick={handleExportCSV} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
                            <FileText className="h-4 w-4 mr-2 text-gray-400" /> Download CSV
                        </button>
                        <button onClick={handleExportPDF} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center">
                            <Printer className="h-4 w-4 mr-2 text-gray-400" /> Download PDF
                        </button>
                      </div>
                  </div>
                )}
            </div>

            <button 
                onClick={() => window.print()}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
                <Printer className="h-4 w-4 mr-2" /> Print View
            </button>
        </div>
      </div>

      {/* CFO Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500">Total Interest Income</p>
              <h3 className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</h3>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500">Total Operational Expenses</p>
              <h3 className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</h3>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500">Net Operational Profit</p>
              <h3 className={`text-2xl font-bold ${netProfit >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                  {formatCurrency(netProfit)}
              </h3>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Profitability Chart */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200 lg:col-span-2 break-inside-avoid">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Profitability Analysis (Income vs Expenses)</h3>
              <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={profitData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Legend />
                          <Bar dataKey="income" fill="#10B981" name="Interest Income" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="expense" fill="#EF4444" name="Expenses" radius={[4, 4, 0, 0]} />
                          <Line type="monotone" dataKey="profit" stroke="#4F46E5" strokeWidth={3} name="Net Profit" />
                      </ComposedChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* PAR Aging Analysis */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200 break-inside-avoid">
              <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Portfolio At Risk (PAR) Aging</h3>
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                              data={parAgingData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                          >
                              {parAgingData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={PAR_COLORS[index % PAR_COLORS.length]} />
                              ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Legend />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
              <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-xs">
                      <thead>
                          <tr className="text-gray-500 border-b">
                              <th className="text-left py-2">Aging Bucket</th>
                              <th className="text-center py-2">Count</th>
                              <th className="text-right py-2">Value</th>
                          </tr>
                      </thead>
                      <tbody>
                          {parAgingData.map((bucket, idx) => (
                              <tr key={idx} className="border-b last:border-0">
                                  <td className="py-2 font-medium flex items-center">
                                      <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: PAR_COLORS[idx] }} />
                                      {bucket.range}
                                  </td>
                                  <td className="text-center py-2">{bucket.count}</td>
                                  <td className="text-right py-2 font-bold">{formatCurrency(bucket.value)}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>

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
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200 break-inside-avoid lg:col-span-2">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Disbursement Timeline</h3>
              <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timelineData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Bar dataKey="amount" fill="#4F46E5" name="Disbursed Amount" radius={[4, 4, 0, 0]} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>
      </div>
    </div>
  );
};