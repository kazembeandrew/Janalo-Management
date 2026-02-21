import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Expense } from '@/types';
import { formatCurrency } from '@/utils/finance';
import { Plus, Search, Filter, Receipt, Calendar, Trash2, PieChart as PieIcon, TrendingUp, BarChart3, RefreshCw } from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

export const Expenses: React.FC = () => {
  const { profile } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    category: 'Salaries/Wages',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0]
  });

  const categories = ['Salaries/Wages', 'Travel', 'Office Supplies', 'Utilities', 'Marketing', 'Legal', 'Other'];
  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];

  useEffect(() => {
    fetchExpenses();

    const channel = supabase
      .channel('expenses-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
          fetchExpenses();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchExpenses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('expenses')
      .select('*, users(full_name)')
      .order('date', { ascending: false });
    
    if (!error) setExpenses(data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      const { error } = await supabase.from('expenses').insert([{
        category: formData.category,
        description: formData.description,
        amount: Number(formData.amount),
        date: formData.date,
        recorded_by: profile.id
      }]);

      if (error) throw error;
      
      setIsModalOpen(false);
      setFormData({
        category: 'Salaries/Wages',
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error(error);
      alert('Error saving expense');
    }
  };

  const handleDelete = async (id: string) => {
      if (!confirm('Are you sure you want to delete this expense?')) return;
      await supabase.from('expenses').delete().eq('id', id);
  };

  const categoryData = categories.map(cat => ({
      name: cat,
      value: expenses.filter(e => e.category === cat).reduce((sum, e) => sum + Number(e.amount), 0)
  })).filter(d => d.value > 0);

  const monthlyTrendData = (() => {
      const months: any = {};
      expenses.forEach(e => {
          const month = e.date.substring(0, 7);
          months[month] = (months[month] || 0) + Number(e.amount);
      });
      return Object.keys(months).sort().map(m => ({
          month: new Date(m + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          amount: months[m]
      })).slice(-6);
  })();

  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Operational Expenses</h1>
            <p className="text-sm text-gray-500">Track and analyze company spending and payroll.</p>
        </div>
        <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-900 hover:bg-indigo-800 transition-all shadow-lg shadow-indigo-200"
        >
            <Plus className="h-4 w-4 mr-2" /> Record Expense
        </button>
      </div>

      {!loading && expenses.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center">
                          <PieIcon className="h-4 w-4 mr-2 text-indigo-600" />
                          Category Distribution
                      </h3>
                  </div>
                  <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie
                                  data={categoryData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={80}
                                  paddingAngle={5}
                                  dataKey="value"
                              >
                                  {categoryData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                              </Pie>
                              <Tooltip formatter={(val: number) => formatCurrency(val)} />
                          </PieChart>
                      </ResponsiveContainer>
                  </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center">
                          <BarChart3 className="h-4 w-4 mr-2 text-indigo-600" />
                          Monthly Trend
                      </h3>
                  </div>
                  <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthlyTrendData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                              <Tooltip formatter={(val: number) => formatCurrency(val)} />
                              <Bar dataKey="amount" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>

              <div className="bg-indigo-900 p-6 rounded-xl shadow-lg text-white flex flex-col justify-between">
                  <div>
                      <div className="p-3 bg-white/10 rounded-lg w-fit mb-4">
                          <Receipt className="h-6 w-6 text-indigo-300" />
                      </div>
                      <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest">Total Expenditure</p>
                      <h2 className="text-3xl font-bold mt-1">{formatCurrency(totalExpenses)}</h2>
                  </div>
                  <div className="mt-8 pt-6 border-t border-white/10">
                      <div className="flex justify-between items-center text-sm">
                          <span className="text-indigo-300">Top Category:</span>
                          <span className="font-bold">{categoryData.sort((a, b) => b.value - a.value)[0]?.name || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm mt-2">
                          <span className="text-indigo-300">Avg. Monthly:</span>
                          <span className="font-bold">{formatCurrency(totalExpenses / (monthlyTrendData.length || 1))}</span>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-gray-900">Expense Ledger</h3>
          </div>
          <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                      <tr>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Recorded By</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                      </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                      {loading && expenses.length === 0 ? (
                          <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500"><RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading ledger...</td></tr>
                      ) : expenses.length === 0 ? (
                          <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">No expenses recorded yet.</td></tr>
                      ) : (
                          expenses.map(exp => (
                              <tr key={exp.id} className="hover:bg-gray-50 transition-colors group">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(exp.date).toLocaleDateString()}</td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gray-100 text-gray-700 uppercase border border-gray-200">
                                          {exp.category}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">{exp.description}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{exp.users?.full_name}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right text-gray-900">{formatCurrency(exp.amount)}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                      <button 
                                        onClick={() => handleDelete(exp.id)} 
                                        className="text-gray-400 hover:text-red-600 transition-colors p-1.5 hover:bg-red-50 rounded-lg"
                                        title="Delete Record"
                                      >
                                          <Trash2 className="h-4 w-4" />
                                      </button>
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-indigo-900 px-6 py-5 flex justify-between items-center">
                    <h3 className="font-bold text-white flex items-center text-lg"><Receipt className="mr-3 h-6 w-6 text-indigo-300" /> Record New Expense</h3>
                    <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5 text-indigo-300" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-8 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Date</label>
                            <input 
                                type="date" 
                                required
                                className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                                value={formData.date}
                                onChange={e => setFormData({...formData, date: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Category</label>
                            <select
                                className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white transition-all"
                                value={formData.category}
                                onChange={e => setFormData({...formData, category: e.target.value})}
                            >
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Amount (MK)</label>
                        <input 
                            type="number" 
                            required
                            min="0"
                            step="0.01"
                            className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                            placeholder="0.00"
                            value={formData.amount}
                            onChange={e => setFormData({...formData, amount: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Description</label>
                        <textarea
                            required
                            rows={3}
                            className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                            placeholder="What was this expense for?"
                            value={formData.description}
                            onChange={e => setFormData({...formData, description: e.target.value})}
                        ></textarea>
                    </div>
                    <div className="pt-4">
                        <button
                            type="submit"
                            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]"
                        >
                            Save Expense Record
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};