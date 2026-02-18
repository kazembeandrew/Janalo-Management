import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Expense } from '../types';
import { formatCurrency } from '../utils/finance';
import { Plus, Receipt, Trash2, Calendar, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Expenses: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [newExpense, setNewExpense] = useState({
    category: 'Operational',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'ceo')) {
        navigate('/');
        return;
    }
    fetchExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const fetchExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, users(full_name)')
        .order('date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      const { error } = await supabase.from('expenses').insert([
        {
          category: newExpense.category,
          description: newExpense.description,
          amount: Number(newExpense.amount),
          date: newExpense.date,
          recorded_by: profile.id
        }
      ]);

      if (error) throw error;
      
      setIsModalOpen(false);
      setNewExpense({
        category: 'Operational',
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0]
      });
      fetchExpenses();
    } catch (error) {
      alert('Error recording expense');
    }
  };

  const handleDelete = async (id: string) => {
      if(!window.confirm('Are you sure you want to delete this expense record?')) return;
      
      try {
          const { error } = await supabase.from('expenses').delete().eq('id', id);
          if (error) throw error;
          fetchExpenses();
      } catch (error) {
          alert('Failed to delete expense');
      }
  };

  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expense Management</h1>
          <p className="text-sm text-gray-500">Track operational costs and overheads</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-900 hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Record Expense
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
            <div className="p-3 bg-red-50 rounded-full mr-4">
                <Receipt className="h-6 w-6 text-red-600" />
            </div>
            <div>
                <p className="text-sm font-medium text-gray-500">Total Expenses</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalExpenses)}</p>
            </div>
         </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200">
             <h3 className="text-lg font-medium text-gray-900">Expense History</h3>
         </div>
         <div className="overflow-x-auto">
             <table className="min-w-full divide-y divide-gray-200 text-sm">
                 <thead className="bg-gray-50">
                     <tr>
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recorded By</th>
                         <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                         <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                     </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-200 bg-white">
                    {loading ? (
                         <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">Loading records...</td></tr>
                    ) : expenses.length === 0 ? (
                         <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">No expenses recorded.</td></tr>
                    ) : (
                         expenses.map((expense) => (
                             <tr key={expense.id} className="hover:bg-gray-50">
                                 <td className="px-6 py-4 whitespace-nowrap text-gray-900">{new Date(expense.date).toLocaleDateString()}</td>
                                 <td className="px-6 py-4 whitespace-nowrap">
                                     <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                         {expense.category}
                                     </span>
                                 </td>
                                 <td className="px-6 py-4 text-gray-500">{expense.description}</td>
                                 <td className="px-6 py-4 whitespace-nowrap text-gray-500">{expense.users?.full_name}</td>
                                 <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900">{formatCurrency(expense.amount)}</td>
                                 <td className="px-6 py-4 whitespace-nowrap text-right">
                                     <button 
                                        onClick={() => handleDelete(expense.id)}
                                        className="text-red-600 hover:text-red-900 transition-colors"
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => setIsModalOpen(false)}></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
              <form onSubmit={handleCreate}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Record New Expense</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Date</label>
                      <input
                        required
                        type="date"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={newExpense.date}
                        onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Category</label>
                      <select
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        value={newExpense.category}
                        onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                      >
                          <option value="Operational">Operational</option>
                          <option value="Salary">Salary</option>
                          <option value="Office Rent">Office Rent</option>
                          <option value="Utilities">Utilities</option>
                          <option value="Travel">Travel</option>
                          <option value="Marketing">Marketing</option>
                          <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Description</label>
                      <input
                        required
                        type="text"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="e.g. Office Supplies for March"
                        value={newExpense.description}
                        onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Amount</label>
                      <input
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={newExpense.amount}
                        onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-900 text-base font-medium text-white hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Save Record
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
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