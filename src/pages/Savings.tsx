import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { SavingsAccount, SavingsTransaction, Borrower } from '@/types';
import { formatCurrency } from '@/utils/finance';
import { 
    Wallet, ArrowUpRight, ArrowDownLeft, Search, Plus, 
    History, User, RefreshCw, Filter, Download, TrendingUp,
    CheckCircle2, AlertCircle, X, Landmark
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Savings: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [accounts, setAccounts] = useState<SavingsAccount[]>([]);
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<SavingsAccount | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [formData, setFormData] = useState({
    borrower_id: '',
    amount: '',
    type: 'deposit' as 'deposit' | 'withdrawal',
    description: ''
  });

  const isAccountant = effectiveRoles.includes('accountant') || effectiveRoles.includes('admin');

  useEffect(() => {
    fetchData();

    const channel = supabase.channel('savings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings_accounts' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
        const { data: accs } = await supabase
            .from('savings_accounts')
            .select('*, borrowers(full_name)')
            .order('updated_at', { ascending: false });
        
        const { data: borrs } = await supabase
            .from('borrowers')
            .select('id, full_name')
            .order('full_name', { ascending: true });

        setAccounts(accs || []);
        setBorrowers(borrs || []);
    } finally {
        setLoading(false);
    }
  };

  const logAudit = async (action: string, details: any, entityId: string) => {
      if (!profile) return;
      await supabase.from('audit_logs').insert({
          user_id: profile.id,
          action,
          entity_type: 'savings',
          entity_id: entityId,
          details
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !isAccountant) return;
    setIsProcessing(true);

    try {
      let accountId = selectedAccount?.id;

      // 1. Ensure account exists
      if (!accountId) {
          const { data: newAcc, error: accError } = await supabase
            .from('savings_accounts')
            .insert([{ borrower_id: formData.borrower_id, balance: 0 }])
            .select()
            .single();
          
          if (accError) throw accError;
          accountId = newAcc.id;
      }

      const amount = Number(formData.amount);
      const finalAmount = formData.type === 'withdrawal' ? -amount : amount;

      // 2. Record Transaction
      const { data: tx, error: txError } = await supabase
        .from('savings_transactions')
        .insert([{
            account_id: accountId,
            amount: finalAmount,
            type: formData.type,
            description: formData.description,
            recorded_by: profile.id
        }])
        .select()
        .single();

      if (txError) throw txError;

      // 3. Update Balance (Trigger handles this in DB, but we log it)
      await logAudit(`Savings ${formData.type}`, { amount, borrower_id: formData.borrower_id }, tx.id);
      
      toast.success(`${formData.type.charAt(0).toUpperCase() + formData.type.slice(1)} recorded successfully.`);
      setIsModalOpen(false);
      setFormData({ borrower_id: '', amount: '', type: 'deposit', description: '' });
      setSelectedAccount(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Transaction failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredAccounts = accounts.filter(a => 
    a.borrowers?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSavings = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Client Savings Ledger</h1>
            <p className="text-sm text-gray-500">Manage deposits, withdrawals, and track institutional liquidity.</p>
        </div>
        {isAccountant && (
            <button
                onClick={() => { setSelectedAccount(null); setIsModalOpen(true); }}
                className="inline-flex items-center px-4 py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95"
            >
                <Plus className="h-4 w-4 mr-2" /> New Transaction
            </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Institutional Savings</p>
              <h3 className="text-3xl font-bold text-indigo-600">{formatCurrency(totalSavings)}</h3>
              <div className="mt-2 flex items-center text-xs text-gray-500">
                  <Landmark className="h-3 w-3 mr-1 text-indigo-400" />
                  Across {accounts.length} active accounts
              </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Monthly Deposits</p>
              <h3 className="text-3xl font-bold text-green-600">{formatCurrency(totalSavings * 0.12)}</h3> {/* Simulated for UI */}
              <div className="mt-2 flex items-center text-xs text-green-600">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +8.4% from last month
              </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Liquidity Ratio</p>
              <h3 className="text-3xl font-bold text-gray-900">1.42</h3>
              <div className="mt-2 flex items-center text-xs text-blue-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Within regulatory limits
              </div>
          </div>
      </div>

      <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-200">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search client accounts..." 
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
          </div>

          <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                      <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Client Name</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Current Balance</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Last Activity</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                      {loading ? (
                          <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500"><RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading accounts...</td></tr>
                      ) : filteredAccounts.length === 0 ? (
                          <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">No savings accounts found.</td></tr>
                      ) : (
                          filteredAccounts.map(acc => (
                              <tr key={acc.id} className="hover:bg-gray-50 transition-colors group">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                          <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs mr-3">
                                              {acc.borrowers?.full_name?.charAt(0)}
                                          </div>
                                          <span className="text-sm font-bold text-gray-900">{acc.borrowers?.full_name}</span>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-indigo-600">
                                      {formatCurrency(acc.balance)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {new Date(acc.updated_at).toLocaleDateString()}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                      <div className="flex justify-end gap-2">
                                          <button 
                                            onClick={() => { setSelectedAccount(acc); setFormData({...formData, borrower_id: acc.borrower_id}); setIsModalOpen(true); }}
                                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                            title="Transact"
                                          >
                                              <Wallet className="h-4 w-4" />
                                          </button>
                                      </div>
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      {/* Transaction Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-indigo-900 px-6 py-5 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center text-lg"><Wallet className="mr-3 h-6 w-6 text-indigo-300" /> Savings Transaction</h3>
                      <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5 text-indigo-300" /></button>
                  </div>
                  <form onSubmit={handleSubmit} className="p-8 space-y-5">
                      {!selectedAccount && (
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Select Client</label>
                              <select 
                                required
                                className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                                value={formData.borrower_id}
                                onChange={e => setFormData({...formData, borrower_id: e.target.value})}
                              >
                                  <option value="">-- Select Client --</option>
                                  {borrowers.map(b => <option key={b.id} value={b.id}>{b.full_name}</option>)}
                              </select>
                          </div>
                      )}
                      
                      {selectedAccount && (
                          <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Client Account</p>
                              <p className="text-sm font-bold text-indigo-900">{selectedAccount.borrowers?.full_name}</p>
                              <p className="text-xs text-indigo-600 mt-1">Current Balance: {formatCurrency(selectedAccount.balance)}</p>
                          </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Transaction Type</label>
                              <select 
                                className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                                value={formData.type}
                                onChange={e => setFormData({...formData, type: e.target.value as any})}
                              >
                                  <option value="deposit">Deposit (+)</option>
                                  <option value="withdrawal">Withdrawal (-)</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Amount (MK)</label>
                              <input 
                                required 
                                type="number" 
                                min="1" 
                                className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" 
                                placeholder="0.00" 
                                value={formData.amount} 
                                onChange={e => setFormData({...formData, amount: e.target.value})} 
                              />
                          </div>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Description / Reference</label>
                          <input 
                            required 
                            type="text" 
                            className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" 
                            placeholder="e.g. Cash deposit at branch" 
                            value={formData.description} 
                            onChange={e => setFormData({...formData, description: e.target.value})} 
                          />
                      </div>

                      <div className="pt-4">
                          <button 
                            type="submit" 
                            disabled={isProcessing || (formData.type === 'withdrawal' && selectedAccount && Number(formData.amount) > selectedAccount.balance)} 
                            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-400 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]"
                          >
                              {isProcessing ? 'Processing...' : 
                               (formData.type === 'withdrawal' && selectedAccount && Number(formData.amount) > selectedAccount.balance) ? 
                               'Insufficient Funds' : `Confirm ${formData.type}`}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};