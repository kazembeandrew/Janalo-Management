import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Expense, InternalAccount, ExpenseStatus } from '@/types';
import { formatCurrency, formatNumberWithCommas, parseFormattedNumber } from '@/utils/finance';
import { expensesService } from '@/services/expenses';
import { accountsService } from '@/services/accounts';
import { journalEntriesService } from '@/services/journalEntries';
import { Plus, Search, Filter, Receipt, Calendar, Trash2, PieChart as PieIcon, TrendingUp, BarChart3, RefreshCw, X, AlertCircle, CheckCircle2, Clock, Landmark } from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import toast from 'react-hot-toast';
import { notifyExpenseApproved } from '@/utils/notifications';
import { notifyExecutivesForPendingExpense } from '@/utils/oversightNotifications';
import { getUnifiedMonthlyProfitability, calculateExpenseStatsFromLedger, formatExpenseDataForCharts } from '@/utils/unifiedPL';

export const Expenses: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<InternalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [targetAccountId, setTargetAccountId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    category: 'Travel',
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0]
  });
  const [displayAmount, setDisplayAmount] = useState('');

  const isAccountant = effectiveRoles.includes('accountant') || effectiveRoles.includes('admin');
  const isCEO = effectiveRoles.includes('ceo') || effectiveRoles.includes('admin');
  const canRecordExpense = effectiveRoles.some(role => ['admin', 'ceo', 'accountant', 'loan_officer'].includes(role));

  useEffect(() => {
    fetchExpenses();
    fetchAccounts();
    fetchLedgerData();

    const channel = supabase
      .channel('expenses-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
          fetchExpenses();
          fetchLedgerData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLedgerData = async () => {
    try {
      setLedgerLoading(true);
      const data = await getUnifiedMonthlyProfitability(12);
      setLedgerData(data);
    } catch (error: any) {
      console.error('Error fetching ledger data:', error);
      toast.error('Failed to load ledger data');
    } finally {
      setLedgerLoading(false);
    }
  };

  const fetchAccounts = async () => {
      const result = await accountsService.getAccounts();
      if (result.data) setAccounts(result.data.data);
  };

  const fetchExpenses = async () => {
    setLoading(true);
    const result = await expensesService.getExpenses();
    if (result.data) setExpenses(result.data.data);
    setLoading(false);
  };

  const logAudit = async (action: string, details: any, entityId: string) => {
      if (!profile) return;
      await supabase.from('audit_logs').insert({
          user_id: profile.id,
          action,
          entity_type: 'expense',
          entity_id: entityId,
          details
      });
  };


  const handleAmountChange = (val: string) => {
      const numeric = parseFormattedNumber(val);
      setDisplayAmount(formatNumberWithCommas(val));
      setFormData({ ...formData, amount: numeric });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !canRecordExpense) return;
    setIsProcessing(true);

    try {
      const result = await expensesService.createExpense({
        category: formData.category,
        description: formData.description,
        amount: Number(formData.amount),
        date: formData.date,
        recorded_by: profile.id,
        status: 'pending' as ExpenseStatus
        // NOTE: account_id removed - not a column in expenses table
        // Account mapping happens during approval via category -> GL account code
      });

      if (!result.success || !result.data) throw new Error(result.error?.message || 'Error saving expense');
      const data = result.data;
      
      await notifyExecutivesForPendingExpense({
        expenseId: String(data.id),
        description: data.description,
        amountFormatted: formatCurrency(Number(data.amount || 0)),
        excludeUserId: profile.id,
        senderId: profile.id
      });
      
      toast.success('Expense proposed. Awaiting CEO approval.');
      setIsModalOpen(false);
      setFormData({
        category: 'Travel',
        description: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0]
      });
      setDisplayAmount('');
    } catch (error: any) {
      toast.error(error.message || 'Error saving expense');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async () => {
    if (!isCEO || !selectedExpense || !targetAccountId || !profile) return;
    setIsProcessing(true);
    try {
      // The updateExpenseStatus service now handles the journal entry creation internally
      const result = await expensesService.updateExpenseStatus(selectedExpense.id, 'approved', targetAccountId);
      if (!result.success) throw new Error(result.error?.message);

      await notifyExpenseApproved(selectedExpense.recorded_by, selectedExpense.description, formatCurrency(selectedExpense.amount));
      
      toast.success('Expense approved and posted to ledger');
      setShowApproveModal(false);
      setSelectedExpense(null);
      setTargetAccountId('');
    } catch (e: any) {
      toast.error("Approval failed: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (expense: Expense) => {
      if ((!isAccountant && !isCEO) || !profile) return;
      if (expense.status === 'voided') {
          toast.error('Expense is already voided');
          return;
      }
      if (!confirm('Are you sure you want to void/cancel this expense record?')) return;
      
      try {
          // The deleteExpense service method handles reversal and status update atomicity (via API design)
          const result = await expensesService.deleteExpense(expense.id);
          if (!result.success) throw new Error(result.error?.message);
          
          toast.success('Expense voided');
      } catch (error: any) {
          toast.error(error?.message || 'Failed to void record');
      }
  };

  // Use ledger-based calculations for P&L consistency
  const approvedExpenses = expenses.filter(e => e.status === 'approved');
  const categories = ['Travel', 'Transport', 'Communication', 'Office Supplies', 'Utilities', 'Marketing', 'Legal', 'Other', 'Salaries/Wages'];
  const COLORS = ['#4F46E5', '#10B981', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];

  // Calculate expense stats from ledger data (ensures P&L consistency)
  const expenseStats = ledgerData.length > 0 ? calculateExpenseStatsFromLedger(ledgerData) : {
    currentMonthExpense: 0,
    previousMonthExpense: 0,
    monthOverMonthChange: 0,
    yearToDateExpense: 0,
    averageMonthlyExpense: 0,
    topExpenseCategory: 'N/A',
    topExpenseCategoryAmount: 0
  };

  // Use ledger data for charts, fallback to raw data if ledger not loaded
  const chartData = ledgerData.length > 0 ? formatExpenseDataForCharts(ledgerData) : {
    categoryData: categories.map(cat => ({
      name: cat,
      value: approvedExpenses.filter(e => e.category === cat).reduce((sum, e) => sum + Number(e.amount), 0)
    })).filter(d => d.value > 0),
    monthlyData: Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toISOString().substring(0, 7);
      return {
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        amount: approvedExpenses.filter(e => e.date.startsWith(monthStr)).reduce((sum, e) => sum + Number(e.amount), 0)
      };
    }).reverse()
  };

  const { categoryData, monthlyData } = chartData;

  const filteredExpenses = expenses.filter(e => 
    e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Use ledger-based total for consistency, but keep raw total for comparison
  const ledgerTotalSpending = expenseStats.currentMonthExpense;
  const rawTotalSpending = approvedExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Operational Expenses</h1>
            <p className="text-sm text-gray-500">Track and analyze company spending using ledger-based calculations for P&L consistency. All expenses require CEO approval.</p>
        </div>
        {canRecordExpense && (
            <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center px-4 py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95"
            >
                <Plus className="h-4 w-4 mr-2" /> Propose Expense
            </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Spending (Ledger)</p>
              <h3 className="text-3xl font-bold text-red-600">{formatCurrency(ledgerTotalSpending)}</h3>
              <div className="mt-2 flex items-center text-xs text-gray-500">
                  <TrendingUp className="h-3 w-3 mr-1 text-indigo-500" />
                  {expenseStats.monthOverMonthChange > 0 ? '+' : ''}{expenseStats.monthOverMonthChange.toFixed(1)}% vs last month
              </div>
              {Math.abs(ledgerTotalSpending - rawTotalSpending) > 0.01 && (
                <div className="mt-1 text-xs text-amber-600">
                  <AlertCircle className="h-3 w-3 inline mr-1" />
                  Raw total: {formatCurrency(rawTotalSpending)}
                </div>
              )}
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Pending Authorization</p>
              <h3 className="text-3xl font-bold text-amber-600">{formatCurrency(expenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + Number(e.amount), 0))}</h3>
              <div className="mt-2 flex items-center text-xs text-amber-600">
                  <Clock className="h-3 w-3 mr-1" />
                  {expenses.filter(e => e.status === 'pending').length} requests awaiting CEO
              </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Top Category</p>
              <h3 className="text-3xl font-bold text-gray-900">{expenseStats.topExpenseCategory}</h3>
              <div className="mt-2 flex items-center text-xs text-blue-600">
                  <PieIcon className="h-3 w-3 mr-1" />
                  {formatCurrency(expenseStats.topExpenseCategoryAmount)}
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-indigo-600" />
                  Ledger Spending Trend (Last 6 Months)
              </h3>
              <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                          <Tooltip formatter={(val: number) => formatCurrency(val)} />
                          <Bar dataKey="amount" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                  <PieIcon className="h-5 w-5 mr-2 text-indigo-600" />
                  Ledger Expense Distribution
              </h3>
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
                          <Legend />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
          </div>
      </div>

      <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-200">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search expenses..." 
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
          </div>

          <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                      <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                      {loading ? (
                          <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500"><RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading records...</td></tr>
                      ) : filteredExpenses.length === 0 ? (
                          <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No expense records found.</td></tr>
                      ) : (
                          filteredExpenses.map(expense => (
                              <tr key={expense.id} className="hover:bg-gray-50 transition-colors group">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                      {new Date(expense.date).toLocaleDateString()}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gray-100 text-gray-700 uppercase border border-gray-200">
                                          {expense.category}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                                      {expense.description}
                                      <p className="text-[10px] text-gray-400 mt-0.5">Recorded by {expense.users?.full_name}</p>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-red-600">
                                      {formatCurrency(expense.amount)}
                                  </td>
                                   <td className="px-6 py-4 whitespace-nowrap text-center">
                                       <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                                           expense.status === 'approved' ? 'bg-green-50 text-green-700 border-green-100' : 
                                           expense.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' : 
                                           expense.status === 'voided' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                           'bg-amber-50 text-amber-700 border-amber-100'
                                       }`}>
                                           {expense.status === 'pending' ? 'Pending CEO' : expense.status === 'voided' ? 'Voided' : expense.status}
                                       </span>
                                   </td>
                                   <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                       <div className="flex justify-end gap-2">
                                           {isCEO && expense.status === 'pending' && (
                                               <button onClick={() => { setSelectedExpense(expense); setShowApproveModal(true); }} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all" title="Approve expense">
                                                  <CheckCircle2 className="h-4 w-4" />
                                               </button>
                                           )}
                                           {(isAccountant || isCEO) && expense.status !== 'voided' && (
                                               <button onClick={() => handleDelete(expense)} className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100" title="Void expense">
                                                   <Trash2 className="h-4 w-4" />
                                               </button>
                                           )}
                                       </div>
                                   </td>
                               </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-100">
            {loading ? (
              <div className="px-6 py-12 text-center text-gray-500">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                <div className="text-sm">Loading records...</div>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">No expense records found.</div>
            ) : (
              filteredExpenses.map((expense) => (
                <div key={expense.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-gray-900">
                        {new Date(expense.date).toLocaleDateString()}
                      </div>
                      <div className="mt-2">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gray-100 text-gray-700 uppercase border border-gray-200">
                          {expense.category}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-red-600">{formatCurrency(expense.amount)}</div>
                      <div className="text-[8px] text-gray-400 uppercase font-bold mt-0.5">Amount</div>
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-gray-900 font-medium">
                    {expense.description}
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Recorded by {expense.users?.full_name}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                        expense.status === 'approved'
                          ? 'bg-green-50 text-green-700 border-green-100'
                          : expense.status === 'rejected'
                            ? 'bg-red-50 text-red-700 border-red-100'
                            : expense.status === 'voided'
                              ? 'bg-gray-100 text-gray-600 border-gray-200'
                              : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}
                    >
                      {expense.status === 'pending' ? 'Pending CEO' : expense.status === 'voided' ? 'Voided' : expense.status}
                    </span>

                    <div className="flex items-center gap-2">
                      {isCEO && expense.status === 'pending' && (
                        <button
                          onClick={() => {
                            setSelectedExpense(expense);
                            setShowApproveModal(true);
                          }}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                          title="Approve expense"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      )}

                      {(isAccountant || isCEO) && expense.status !== 'voided' && (
                        <button
                          onClick={() => handleDelete(expense)}
                          className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Void expense"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
      </div>

      {/* Propose Expense Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-indigo-900 px-6 py-5 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center text-lg"><Receipt className="mr-3 h-6 w-6 text-indigo-300" /> Propose Expense</h3>
                      <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Close"><X className="h-5 w-5 text-indigo-300" /></button>
                  </div>
                  <form onSubmit={handleSubmit} className="p-8 space-y-5">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Category</label>
                          <select className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white" title="Select category" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                              {categories.filter(c => c !== 'Salaries/Wages').map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Description</label>
                          <input required type="text" className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Office rent for March" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Amount</label>
                              <input required type="text" className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="0.00" value={displayAmount} onChange={e => handleAmountChange(e.target.value)} />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Date</label>
                              <input required type="date" className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" title="Select date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                          </div>
                      </div>
                      <div className="pt-4">
                          <button type="submit" disabled={isProcessing} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-400 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]">
                              {isProcessing ? 'Submitting...' : 'Submit for Approval'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Approve Expense Modal */}
      {showApproveModal && selectedExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-indigo-900 px-6 py-5 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center text-lg"><Landmark className="mr-3 h-6 w-6 text-indigo-300" /> Authorize Payment</h3>
                      <button onClick={() => setShowApproveModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Close"><X className="h-5 w-5 text-indigo-300" /></button>
                  </div>
                  <div className="p-8 space-y-5">
                      <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                          <p className="text-xs text-indigo-700 leading-relaxed">
                              You are authorizing a payment of <strong>{formatCurrency(selectedExpense.amount)}</strong> for "{selectedExpense.description}".
                          </p>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Pay From Account</label>
                          <select 
                            required 
                            className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                            title="Select source account"
                            value={targetAccountId}
                            onChange={e => setTargetAccountId(e.target.value)}
                          >
                              <option value="">-- Select Source Account --</option>
                              {accounts.map(acc => (
                                  <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</option>
                              ))}
                          </select>
                      </div>
                      <div className="pt-4">
                          <button onClick={handleApprove} disabled={isProcessing || !targetAccountId} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-400 transition-all shadow-lg shadow-indigo-100">
                              {isProcessing ? 'Processing...' : 'Confirm & Pay'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
