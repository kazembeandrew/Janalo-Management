import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Budget } from '@/types';
import { formatCurrency, formatNumberWithCommas, parseFormattedNumber } from '@/utils/finance';
import { 
    Target, TrendingUp, TrendingDown, Plus, 
    RefreshCw, AlertCircle, CheckCircle2, X, 
    BarChart3, PieChart as PieIcon, Calendar, Filter
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, 
    Tooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts';
import toast from 'react-hot-toast';

export const Budgets: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [actuals, setActuals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));
  
  const [showModal, setShowModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
      category: 'Salaries/Wages',
      amount: 0,
      type: 'expense' as 'income' | 'expense'
  });
  const [displayAmount, setDisplayAmount] = useState('');

  const isAccountant = effectiveRoles.includes('accountant') || effectiveRoles.includes('admin');

  useEffect(() => {
    fetchData();
  }, [month]);

  const fetchData = async () => {
    setLoading(true);
    try {
        // Calculate date range for the selected month
        const [year, monthNum] = month.split('-').map(Number);
        const startStr = `${month}-01`;
        const nextMonthDate = new Date(year, monthNum, 1);
        const endStr = nextMonthDate.toISOString().substring(0, 10);

        // 1. Fetch Budgets
        const { data: bData } = await supabase
            .from('budgets')
            .select('*')
            .eq('month', month);
        setBudgets(bData || []);

        // 2. Fetch Actual Expenses (using lt next month to avoid invalid date errors)
        const { data: eData } = await supabase
            .from('expenses')
            .select('amount, category')
            .eq('status', 'approved')
            .gte('date', startStr)
            .lt('date', endStr);
        
        // 3. Fetch Actual Income (Interest + Penalties)
        const { data: rData } = await supabase
            .from('repayments')
            .select('interest_paid, penalty_paid')
            .gte('payment_date', startStr)
            .lt('payment_date', endStr);

        const expenseActuals = eData?.reduce((acc: any, e) => {
            acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
            return acc;
        }, {}) || {};

        const interestIncome = rData?.reduce((sum, r) => sum + Number(r.interest_paid), 0) || 0;
        const penaltyIncome = rData?.reduce((sum, r) => sum + Number(r.penalty_paid), 0) || 0;

        const combinedActuals = [
            { category: 'Interest Income', actual: interestIncome, type: 'income' },
            { category: 'Penalty Income', actual: penaltyIncome, type: 'income' },
            ...Object.entries(expenseActuals).map(([cat, amt]) => ({
                category: cat,
                actual: amt,
                type: 'expense'
            }))
        ];

        setActuals(combinedActuals);
    } finally {
        setLoading(false);
    }
  };

  const handleAmountChange = (val: string) => {
      const numeric = parseFormattedNumber(val);
      setDisplayAmount(formatNumberWithCommas(val));
      setFormData({ ...formData, amount: numeric });
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsProcessing(true);
      try {
          const { error } = await supabase
            .from('budgets')
            .upsert({
                category: formData.category,
                amount: Number(formData.amount),
                month: month,
                type: formData.type
            }, { onConflict: 'category,month' });
          
          if (error) throw error;
          toast.success('Budget updated');
          setShowModal(false);
          setDisplayAmount('');
          fetchData();
      } catch (e: any) {
          toast.error(e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const varianceData = budgets.map(b => {
      const actual = actuals.find(a => a.category === b.category)?.actual || 0;
      const variance = b.type === 'income' ? actual - b.amount : b.amount - actual;
      const percent = (actual / b.amount) * 100;
      
      return {
          category: b.category,
          budget: b.amount,
          actual: actual,
          variance: variance,
          percent: percent,
          type: b.type
      };
  });

  const totalBudgetedExpense = budgets.filter(b => b.type === 'expense').reduce((sum, b) => sum + b.amount, 0);
  const totalActualExpense = actuals.filter(a => a.type === 'expense').reduce((sum, a) => sum + a.actual, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Budgeting & Variance</h1>
            <p className="text-sm text-gray-500">Monitor institutional spending against monthly targets.</p>
        </div>
        <div className="flex gap-3">
            <input 
                type="month" 
                className="border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
            />
            {isAccountant && (
                <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center px-4 py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-200"
                >
                    <Plus className="h-4 w-4 mr-2" /> Set Budget
                </button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Expense Utilization</p>
              <h3 className="text-3xl font-bold text-indigo-600">
                  {totalBudgetedExpense > 0 ? ((totalActualExpense / totalBudgetedExpense) * 100).toFixed(1) : 0}%
              </h3>
              <div className="w-full bg-gray-100 rounded-full h-2 mt-3">
                  <div 
                    className={`h-2 rounded-full transition-all ${totalActualExpense > totalBudgetedExpense ? 'bg-red-500' : 'bg-green-500'}`} 
                    style={{ width: `${Math.min(100, (totalActualExpense / (totalBudgetedExpense || 1)) * 100)}%` }}
                  ></div>
              </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Budget Variance</p>
              <h3 className={`text-3xl font-bold ${totalBudgetedExpense - totalActualExpense >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalBudgetedExpense - totalActualExpense)}
              </h3>
              <p className="text-xs text-gray-500 mt-2">Remaining operational budget</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Fiscal Health</p>
              <div className="flex items-center mt-1">
                  {totalActualExpense <= totalBudgetedExpense ? (
                      <CheckCircle2 className="h-6 w-6 text-green-500 mr-2" />
                  ) : (
                      <AlertCircle className="h-6 w-6 text-red-500 mr-2" />
                  )}
                  <h3 className="text-xl font-bold text-gray-900">
                      {totalActualExpense <= totalBudgetedExpense ? 'Within Limits' : 'Over Budget'}
                  </h3>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                  <h3 className="font-bold text-gray-900 flex items-center">
                      <BarChart3 className="h-4 w-4 mr-2 text-indigo-600" />
                      Budget vs Actual Analysis
                  </h3>
              </div>
              <div className="p-6 h-80">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={varianceData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="category" tick={{fontSize: 10}} />
                          <YAxis tick={{fontSize: 10}} />
                          <Tooltip formatter={(val: number) => formatCurrency(val)} />
                          <Legend />
                          <Bar dataKey="budget" fill="#E5E7EB" name="Budgeted" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="actual" name="Actual" radius={[4, 4, 0, 0]}>
                              {varianceData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.type === 'income' ? '#10B981' : (entry.actual > entry.budget ? '#EF4444' : '#4F46E5')} />
                              ))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>

          <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                  <h3 className="font-bold text-gray-900 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-2 text-amber-500" />
                      Critical Variances
                  </h3>
              </div>
              <div className="p-4 space-y-4">
                  {varianceData.filter(v => v.type === 'expense' && v.actual > v.budget).length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-xs italic">No budget overruns detected.</div>
                  ) : (
                      varianceData.filter(v => v.type === 'expense' && v.actual > v.budget).map(v => (
                          <div key={v.category} className="p-4 bg-red-50 rounded-xl border border-red-100">
                              <div className="flex justify-between items-start mb-1">
                                  <span className="text-xs font-bold text-red-800">{v.category}</span>
                                  <span className="text-[10px] font-bold text-red-600">+{((v.actual/v.budget - 1) * 100).toFixed(0)}%</span>
                              </div>
                              <p className="text-[10px] text-red-700">Overspent by {formatCurrency(v.actual - v.budget)}</p>
                          </div>
                      ))
                  )}
              </div>
          </div>
      </div>

      {/* Budget Table */}
      <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                  <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Category</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase">Budgeted</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase">Actual</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase">Variance</th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">Status</th>
                  </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                  {varianceData.map(v => (
                      <tr key={v.category} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{v.category}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">{formatCurrency(v.budget)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">{formatCurrency(v.actual)}</td>
                          <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-bold ${v.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {v.variance >= 0 ? '+' : ''}{formatCurrency(v.variance)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                                  (v.type === 'expense' && v.actual <= v.budget) || (v.type === 'income' && v.actual >= v.budget)
                                  ? 'bg-green-50 text-green-700 border-green-100' 
                                  : 'bg-red-50 text-red-700 border-red-100'
                              }`}>
                                  {(v.type === 'expense' && v.actual <= v.budget) || (v.type === 'income' && v.actual >= v.budget) ? 'On Track' : 'Alert'}
                              </span>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>

      {/* Set Budget Modal */}
      {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-indigo-900 px-6 py-5 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center text-lg"><Target className="mr-3 h-6 w-6 text-indigo-300" /> Set Monthly Budget</h3>
                      <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5 text-indigo-300" /></button>
                  </div>
                  <form onSubmit={handleSaveBudget} className="p-8 space-y-5">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Budget Type</label>
                          <div className="grid grid-cols-2 gap-2">
                              <button type="button" onClick={() => setFormData({...formData, type: 'income'})} className={`py-2 rounded-xl text-xs font-bold border transition-all ${formData.type === 'income' ? 'bg-indigo-50 border-indigo-600 text-indigo-600' : 'bg-white border-gray-200 text-gray-500'}`}>Income Target</button>
                              <button type="button" onClick={() => setFormData({...formData, type: 'expense'})} className={`py-2 rounded-xl text-xs font-bold border transition-all ${formData.type === 'expense' ? 'bg-indigo-50 border-indigo-600 text-indigo-600' : 'bg-white border-gray-200 text-gray-500'}`}>Expense Limit</button>
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Category</label>
                          {formData.type === 'income' ? (
                              <select className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                                  <option value="Interest Income">Interest Income</option>
                                  <option value="Penalty Income">Penalty Income</option>
                              </select>
                          ) : (
                              <select className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                                  <option value="Salaries/Wages">Salaries/Wages</option>
                                  <option value="Travel">Travel</option>
                                  <option value="Office Supplies">Office Supplies</option>
                                  <option value="Utilities">Utilities</option>
                                  <option value="Marketing">Marketing</option>
                                  <option value="Legal">Legal</option>
                                  <option value="Other">Other</option>
                              </select>
                          )}
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Budgeted Amount (MK)</label>
                          <input required type="text" className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="0.00" value={displayAmount} onChange={e => handleAmountChange(e.target.value)} />
                      </div>
                      <div className="pt-4">
                          <button type="submit" disabled={isProcessing} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-400 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]">
                              {isProcessing ? 'Saving...' : 'Save Budget Target'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};