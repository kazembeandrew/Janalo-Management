import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Expense } from '../types';
import { formatCurrency } from '../utils/finance';
import { Plus, Search, Filter, Receipt, Calendar, Trash2 } from 'lucide-react';

export const Expenses: React.FC = () => {
  const { profile } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    category: 'Travel',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0]
  });

  const categories = ['Travel', 'Office Supplies', 'Utilities', 'Marketing', 'Legal', 'Other'];

  useEffect(() => {
    fetchExpenses();
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
        category: 'Travel',
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0]
      });
      fetchExpenses();
    } catch (error) {
      console.error(error);
      alert('Error saving expense');
    }
  };

  const handleDelete = async (id: string) => {
      if (!confirm('Are you sure you want to delete this expense?')) return;
      await supabase.from('expenses').delete().eq('id', id);
      fetchExpenses();
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
            <p className="text-sm text-gray-500">Track operational costs</p>
        </div>
        <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-900 hover:bg-indigo-800"
        >
            <Plus className="h-4 w-4 mr-2" /> Record Expense
        </button>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-lg shadow p-6 flex items-center justify-between">
          <div>
              <p className="text-sm font-medium text-gray-500">Total Expenses (All Time)</p>
              <h2 className="text-3xl font-bold text-gray-900">{formatCurrency(totalExpenses)}</h2>
          </div>
          <div className="p-3 bg-red-50 rounded-full">
              <Receipt className="h-8 w-8 text-red-600" />
          </div>
      </div>

      {/* List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                  <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recorded By</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                      <tr><td colSpan={6} className="px-6 py-4 text-center">Loading...</td></tr>
                  ) : expenses.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">No expenses recorded.</td></tr>
                  ) : (
                      expenses.map(exp => (
                          <tr key={exp.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(exp.date).toLocaleDateString()}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                      {exp.category}
                                  </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">{exp.description}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{exp.users?.full_name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right text-gray-900">{formatCurrency(exp.amount)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <button onClick={() => handleDelete(exp.id)} className="text-red-600 hover:text-red-900">
                                      <Trash2 className="h-4 w-4" />
                                  </button>
                              </td>
                          </tr>
                      ))
                  )}
              </tbody>
          </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => setIsModalOpen(false)}></div>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                    <form onSubmit={handleSubmit} className="p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Record New Expense</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Date</label>
                                <input 
                                    type="date" 
                                    required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={formData.date}
                                    onChange={e => setFormData({...formData, date: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Category</label>
                                <select
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={formData.category}
                                    onChange={e => setFormData({...formData, category: e.target.value})}
                                >
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Amount</label>
                                <input 
                                    type="number" 
                                    required
                                    min="0"
                                    step="0.01"
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={formData.amount}
                                    onChange={e => setFormData({...formData, amount: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Description</label>
                                <textarea
                                    required
                                    rows={3}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={formData.description}
                                    onChange={e => setFormData({...formData, description: e.target.value})}
                                ></textarea>
                            </div>
                        </div>
                        <div className="mt-5 sm:mt-6 flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                            >
                                Save Expense
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
