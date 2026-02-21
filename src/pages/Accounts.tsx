import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { InternalAccount, FundTransaction } from '@/types';
import { formatCurrency, formatNumberWithCommas, parseFormattedNumber } from '@/utils/finance';
import { 
    Landmark, Wallet, ArrowUpRight, ArrowDownLeft, Plus, 
    Search, History, RefreshCw, Landmark as BankIcon, 
    Coins, ShieldCheck, ArrowRightLeft, Download, Filter,
    TrendingUp, AlertCircle, X, CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Accounts: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [accounts, setAccounts] = useState<InternalAccount[]>([]);
  const [transactions, setTransactions] = useState<FundTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [accountForm, setAccountForm] = useState({
      name: '',
      type: 'bank' as any,
      account_number: '',
      bank_name: '',
      initial_balance: 0
  });
  const [displayInitialBalance, setDisplayInitialBalance] = useState('0');

  const [fundForm, setFundForm] = useState({
      type: 'injection' as any,
      from_account_id: '',
      to_account_id: '',
      amount: 0,
      description: ''
  });
  const [displayFundAmount, setDisplayFundAmount] = useState('');

  const isAccountant = effectiveRoles.includes('accountant') || effectiveRoles.includes('admin');

  useEffect(() => {
    fetchData();

    const channel = supabase.channel('finance-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_accounts' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_transactions' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
        const { data: accs } = await supabase
            .from('internal_accounts')
            .select('*')
            .order('name', { ascending: true });
        
        const { data: txs } = await supabase
            .from('fund_transactions')
            .select('*, users(full_name)')
            .order('created_at', { ascending: false })
            .limit(50);

        setAccounts(accs || []);
        setTransactions(txs || []);
    } finally {
        setLoading(false);
    }
  };

  const handleVerify = async (txId: string) => {
      if (!isAccountant) return;
      try {
          const { error } = await supabase
            .from('fund_transactions')
            .update({ is_verified: true })
            .eq('id', txId);
          if (error) throw error;
          toast.success('Transaction verified');
          fetchData();
      } catch (e) {
          toast.error('Verification failed');
      }
  };

  const handleInitialBalanceChange = (val: string) => {
      const numeric = parseFormattedNumber(val);
      setDisplayInitialBalance(formatNumberWithCommas(val));
      setAccountForm({ ...accountForm, initial_balance: numeric });
  };

  const handleFundAmountChange = (val: string) => {
      const numeric = parseFormattedNumber(val);
      setDisplayFundAmount(formatNumberWithCommas(val));
      setFundForm({ ...fundForm, amount: numeric });
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsProcessing(true);
      try {
          const { data, error } = await supabase
            .from('internal_accounts')
            .insert([{
                name: accountForm.name,
                type: accountForm.type,
                account_number: accountForm.account_number,
                bank_name: accountForm.bank_name,
                balance: Number(accountForm.initial_balance)
            }])
            .select()
            .single();
          
          if (error) throw error;

          if (Number(accountForm.initial_balance) > 0) {
              await supabase.from('fund_transactions').insert([{
                  to_account_id: data.id,
                  amount: Number(accountForm.initial_balance),
                  type: 'injection',
                  description: 'Initial account balance',
                  recorded_by: profile?.id,
                  is_verified: true
              }]);
          }

          toast.success('Account created successfully');
          setShowAccountModal(false);
          setAccountForm({ name: '', type: 'bank', account_number: '', bank_name: '', initial_balance: 0 });
          setDisplayInitialBalance('0');
      } catch (e: any) {
          toast.error(e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleFundAction = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsProcessing(true);
      try {
          const amount = Number(fundForm.amount);
          
          if (fundForm.type === 'transfer') {
              if (!fundForm.from_account_id || !fundForm.to_account_id) throw new Error("Select both accounts");
              
              const { error } = await supabase.from('fund_transactions').insert([{
                  from_account_id: fundForm.from_account_id,
                  to_account_id: fundForm.to_account_id,
                  amount: amount,
                  type: 'transfer',
                  description: fundForm.description,
                  recorded_by: profile?.id
              }]);
              if (error) throw error;
          } else {
              const { error } = await supabase.from('fund_transactions').insert([{
                  to_account_id: fundForm.to_account_id,
                  amount: amount,
                  type: 'injection',
                  description: fundForm.description,
                  recorded_by: profile?.id
              }]);
              if (error) throw error;
          }

          toast.success('Transaction recorded');
          setShowFundModal(false);
          setFundForm({ type: 'injection', from_account_id: '', to_account_id: '', amount: 0, description: '' });
          setDisplayFundAmount('');
      } catch (e: any) {
          toast.error(e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const totalLiquidity = accounts.filter(a => a.type !== 'equity' && a.type !== 'liability').reduce((sum, a) => sum + Number(a.balance), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Institutional Finance</h1>
            <p className="text-sm text-gray-500">Manage internal accounts, capital funds, and institutional liquidity.</p>
        </div>
        {isAccountant && (
            <div className="flex gap-2">
                <button
                    onClick={() => setShowFundModal(true)}
                    className="inline-flex items-center px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all shadow-sm"
                >
                    <ArrowRightLeft className="h-4 w-4 mr-2 text-indigo-600" /> Fund Movement
                </button>
                <button
                    onClick={() => setShowAccountModal(true)}
                    className="inline-flex items-center px-4 py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-200"
                >
                    <Plus className="h-4 w-4 mr-2" /> New Account
                </button>
            </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Available Liquidity</p>
              <h3 className="text-3xl font-bold text-indigo-600">{formatCurrency(totalLiquidity)}</h3>
              <div className="mt-2 flex items-center text-xs text-gray-500">
                  <ShieldCheck className="h-3 w-3 mr-1 text-green-500" />
                  Verified across {accounts.length} accounts
              </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Capital Injections (MTD)</p>
              <h3 className="text-3xl font-bold text-green-600">{formatCurrency(transactions.filter(t => t.type === 'injection').reduce((sum, t) => sum + Number(t.amount), 0))}</h3>
              <div className="mt-2 flex items-center text-xs text-green-600">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Institutional growth
              </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Net Cash Flow</p>
              <h3 className="text-3xl font-bold text-gray-900">Positive</h3>
              <div className="mt-2 flex items-center text-xs text-blue-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Healthy operational margin
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
              <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                      <h3 className="font-bold text-gray-900 flex items-center">
                          <BankIcon className="h-4 w-4 mr-2 text-indigo-600" />
                          Chart of Accounts
                      </h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                      {loading ? (
                          <div className="p-12 text-center"><RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></div>
                      ) : accounts.length === 0 ? (
                          <div className="p-12 text-center text-gray-500">No institutional accounts configured.</div>
                      ) : (
                          accounts.map(acc => (
                              <div key={acc.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                  <div className="flex items-center">
                                      <div className={`h-12 w-12 rounded-xl flex items-center justify-center mr-4 ${
                                          acc.type === 'bank' ? 'bg-blue-50 text-blue-600' : 
                                          acc.type === 'cash' ? 'bg-green-50 text-green-600' : 
                                          'bg-purple-50 text-purple-600'
                                      }`}>
                                          {acc.type === 'bank' ? <BankIcon className="h-6 w-6" /> : <Coins className="h-6 w-6" />}
                                      </div>
                                      <div>
                                          <h4 className="font-bold text-gray-900">{acc.name}</h4>
                                          <p className="text-xs text-gray-500 uppercase font-medium tracking-wider">
                                              {acc.bank_name ? `${acc.bank_name} • ` : ''}{acc.type}
                                          </p>
                                      </div>
                                  </div>
                                  <div className="text-right">
                                      <p className="text-lg font-bold text-gray-900">{formatCurrency(acc.balance)}</p>
                                      <p className="text-[10px] text-gray-400 uppercase font-bold">Current Balance</p>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>

              <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                      <h3 className="font-bold text-gray-900 flex items-center">
                          <History className="h-4 w-4 mr-2 text-indigo-600" />
                          Institutional General Ledger
                      </h3>
                      <button className="text-xs font-bold text-indigo-600 hover:underline flex items-center">
                          <Download className="h-3 w-3 mr-1" /> Export Ledger
                      </button>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                              <tr>
                                  <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Date</th>
                                  <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Type</th>
                                  <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Description</th>
                                  <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-500 uppercase">Amount</th>
                                  <th className="px-6 py-3 text-center text-[10px] font-bold text-gray-500 uppercase">Reconciled</th>
                              </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100">
                              {transactions.map(tx => (
                                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                                          {new Date(tx.created_at).toLocaleDateString()}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase border ${
                                              tx.type === 'injection' ? 'bg-green-50 text-green-700 border-green-100' :
                                              tx.type === 'transfer' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                              'bg-gray-50 text-gray-700 border-gray-100'
                                          }`}>
                                              {tx.type}
                                          </span>
                                      </td>
                                      <td className="px-6 py-4 text-xs text-gray-900 font-medium">
                                          {tx.description}
                                          <p className="text-[10px] text-gray-400 mt-0.5">Recorded by {tx.users?.full_name}</p>
                                      </td>
                                      <td className={`px-6 py-4 whitespace-nowrap text-right text-xs font-bold ${
                                          tx.type === 'injection' || tx.type === 'repayment' ? 'text-green-600' : 'text-red-600'
                                      }`}>
                                          {tx.type === 'injection' || tx.type === 'repayment' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-center">
                                          {tx.is_verified ? (
                                              <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                                          ) : (
                                              isAccountant && (
                                                  <button onClick={() => handleVerify(tx.id)} className="text-[10px] font-bold text-indigo-600 hover:underline">Verify</button>
                                              )
                                          )}
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>

          <div className="space-y-6">
              <div className="bg-indigo-900 rounded-2xl p-6 text-white shadow-lg">
                  <h3 className="font-bold mb-4 flex items-center">
                      <TrendingUp className="h-5 w-5 mr-2 text-indigo-300" />
                      Liquidity Forecast
                  </h3>
                  <div className="space-y-4">
                      <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                          <p className="text-[10px] text-indigo-300 uppercase font-bold">Projected Inflows (30d)</p>
                          <p className="text-xl font-bold">{formatCurrency(totalLiquidity * 0.25)}</p>
                      </div>
                      <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                          <p className="text-[10px] text-indigo-300 uppercase font-bold">Projected Outflows (30d)</p>
                          <p className="text-xl font-bold">{formatCurrency(totalLiquidity * 0.15)}</p>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* Create Account Modal */}
      {showAccountModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-indigo-900 px-6 py-5 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center text-lg"><BankIcon className="mr-3 h-6 w-6 text-indigo-300" /> New Institutional Account</h3>
                      <button onClick={() => setShowAccountModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5 text-indigo-300" /></button>
                  </div>
                  <form onSubmit={handleCreateAccount} className="p-8 space-y-5">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Account Name</label>
                          <input required type="text" className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Main Operating Account" value={accountForm.name} onChange={e => setAccountForm({...accountForm, name: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Type</label>
                              <select className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white" value={accountForm.type} onChange={e => setAccountForm({...accountForm, type: e.target.value as any})}>
                                  <option value="bank">Bank Account</option>
                                  <option value="cash">Petty Cash</option>
                                  <option value="equity">Equity/Capital</option>
                                  <option value="liability">Liability</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Initial Balance (MK)</label>
                              <input type="text" className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" value={displayInitialBalance} onChange={e => handleInitialBalanceChange(e.target.value)} />
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Bank Name (Optional)</label>
                          <input type="text" className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="e.g. National Bank" value={accountForm.bank_name} onChange={e => setAccountForm({...accountForm, bank_name: e.target.value})} />
                      </div>
                      <div className="pt-4">
                          <button type="submit" disabled={isProcessing} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-400 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]">
                              {isProcessing ? 'Creating...' : 'Create Account'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Fund Movement Modal */}
      {showFundModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-indigo-900 px-6 py-5 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center text-lg"><ArrowRightLeft className="mr-3 h-6 w-6 text-indigo-300" /> Fund Movement</h3>
                      <button onClick={() => setShowFundModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5 text-indigo-300" /></button>
                  </div>
                  <form onSubmit={handleFundAction} className="p-8 space-y-5">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Transaction Type</label>
                          <div className="grid grid-cols-2 gap-2">
                              <button type="button" onClick={() => setFundForm({...fundForm, type: 'injection'})} className={`py-2 rounded-xl text-xs font-bold border transition-all ${fundForm.type === 'injection' ? 'bg-indigo-50 border-indigo-600 text-indigo-600' : 'bg-white border-gray-200 text-gray-500'}`}>Capital Injection</button>
                              <button type="button" onClick={() => setFundForm({...fundForm, type: 'transfer'})} className={`py-2 rounded-xl text-xs font-bold border transition-all ${fundForm.type === 'transfer' ? 'bg-indigo-50 border-indigo-600 text-indigo-600' : 'bg-white border-gray-200 text-gray-500'}`}>Internal Transfer</button>
                          </div>
                      </div>
                      {fundForm.type === 'transfer' && (
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">From Account</label>
                              <select required className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white" value={fundForm.from_account_id} onChange={e => setFundForm({...fundForm, from_account_id: e.target.value})}>
                                  <option value="">-- Select Source --</option>
                                  {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</option>)}
                              </select>
                          </div>
                      )}
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{fundForm.type === 'transfer' ? 'To Account' : 'Target Account'}</label>
                          <select required className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white" value={fundForm.to_account_id} onChange={e => setFundForm({...fundForm, to_account_id: e.target.value})}>
                              <option value="">-- Select Destination --</option>
                              {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Amount (MK)</label>
                          <input required type="text" className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="0.00" value={displayFundAmount} onChange={e => handleFundAmountChange(e.target.value)} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Description</label>
                          <input required type="text" className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Monthly capital injection" value={fundForm.description} onChange={e => setFundForm({...fundForm, description: e.target.value})} />
                      </div>
                      <div className="pt-4">
                          <button type="submit" disabled={isProcessing} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-400 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]">
                              {isProcessing ? 'Processing...' : 'Record Transaction'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};