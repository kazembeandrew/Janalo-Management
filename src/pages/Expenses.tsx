import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Expense } from '@/types';
import { formatCurrency } from '@/utils/finance';
import { Plus, Search, Filter, Receipt, Calendar, Trash2, PieChart as PieIcon, TrendingUp, BarChart3, RefreshCw, X } from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

export const Expenses: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    category: 'Salaries/Wages',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0]
  });

  const isAccountant = effectiveRoles.includes('accountant') || effectiveRoles.includes('admin');

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
    if (!profile || !isAccountant) return;

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
      if (!isAccountant) return;
      if (!confirm('Are you sure you want to delete this expense?')) return;
      await supabase.from('expenses').delete().eq('id', id);
  };

  // ... rest of the component (charts and table)
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Operational Expenses</h1>
            <p className="text-sm text-gray-500">Track and analyze company spending and payroll.</p>
        </div>
        {isAccountant && (
            <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-900 hover:bg-indigo-800 transition-all shadow-lg shadow-indigo-200"
            >
                <Plus className="h-4 w-4 mr-2" /> Record Expense
            </button>
        )}
      </div>
      {/* ... rest of the component */}
    </div>
  );
};