import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { InternalAccount, JournalEntry } from '@/types';
import { formatCurrency, formatNumberWithCommas, parseFormattedNumber } from '@/utils/finance';
import { postJournalEntry } from '@/utils/accounting';
import { 
    Landmark, Wallet, ArrowUpRight, ArrowDownLeft, Plus, 
    Search, History, RefreshCw, Landmark as BankIcon, 
    Coins, ShieldCheck, ArrowRightLeft, Download, Filter,
    TrendingUp, AlertCircle, X, CheckCircle2, Calculator,
    Wand2, ShieldAlert
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Accounts: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [accounts, setAccounts] = useState<InternalAccount[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [accountForm, setAccountForm] = useState({
      name: '',
      category: 'asset' as any,
      code: 'BANK' as any,
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entries' }, () => fetchData())
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
        
        const { data: entries } = await supabase
            .from('journal_entries')
            .select('*, journal_lines(*, accounts:internal_accounts(name)), users(full_name)')
            .order('created_at', { ascending: false })
            .limit(50);

        setAccounts(accs || []);
        setJournalEntries(entries || []);
    } finally {
        setLoading(false);
    }
  };

  const totalLiquidity = useMemo(() => {
      return accounts
        .filter(a => a.account_category === 'asset' && ['CASH', 'BANK', 'MOBILE'].includes(a.account_code))
        .reduce((sum, a) => sum + Number(a.balance), 0);
  }, [accounts]);

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

  const handleInitializeSystem = async () => {
      if (!isAccountant || !profile) return;
      setIsProcessing(true);
      const loadingToast = toast.loading("Initializing chart of accounts...");

      try {
          const coreAccounts = [
              { name: 'Share Capital', category: 'equity', code: 'CAPITAL', type: 'equity' },
              { name: 'Main Bank Account', category: 'asset', code: 'BANK', type: 'bank' },
              { name: 'Petty Cash', category: 'asset', code: 'CASH', type: 'cash' },
              { name: 'Retained Earnings', category: 'equity', code: 'EQUITY', type: 'equity' },
              { name: 'Loan Portfolio', category: 'asset', code: 'PORTFOLIO', type: 'asset' }
          ];

          // Check which accounts are missing
          const { data: existing } = await supabase
            .from('internal_accounts')
            .select('account_code')
            .in('account_code', coreAccounts.map(a => a.code));
          
          const existingCodes = new Set(existing?.map(e => e.account_code) || []);
          const missingAccounts = coreAccounts.filter(a => !existingCodes.has(a.code));

          if (missingAccounts.length === 0) {
              toast.success("System accounts are already initialized.", { id: loadingToast });
              setIsProcessing(false);
              return;
          }

          // Insert missing accounts
          const { error } = await supabase
            .from('internal_accounts')
            .insert(missingAccounts.map(acc => ({
                name: acc.name,
                account_category: acc.category,
                account_code: acc.code,
                type: acc.type,
                balance: 0,
                is_system_account: true
            })));

          if (error) throw error;

          toast.success(`Successfully created ${missingAccounts.length} system accounts.`, { id: loadingToast });
          fetchData();
      } catch (e: any) {
          console.error("Setup error:", e);
          toast.error(`Setup failed: ${e.message}`, { id: loadingToast });
      } finally {
          setIsProcessing(false);
      }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!profile) return;
      setIsProcessing(true);
      try {
          // Map code to a valid type string for the DB constraint
          const validTypes = ['bank', 'cash', 'mobile', 'equity', 'liability', 'operational', 'capital', 'asset'];
          const suggestedType = accountForm.code.toLowerCase();
          const finalType = validTypes.includes(suggestedType) ? suggestedType : accountForm.category;

          const { data: newAcc, error } = await supabase
            .from('internal_accounts')
            .insert([{
                name: accountForm.name,
                account_category: accountForm.category,
                account_code: accountForm.code,
                type: finalType,
                account_number: accountForm.account_number,
                bank_name: accountForm.bank_name,
                balance: 0
            }])
            .select()
            .single();
          
          if (error) throw error;

          if (Number(accountForm.initial_balance) > 0) {
              const { data: capitalAcc } = await supabase
                .from('internal_accounts')
                .select('id')
                .eq('account_code', 'CAPITAL')
                .maybeSingle();

              if (capitalAcc) {
                  await postJournalEntry(
                      'injection',
                      newAcc.id,
                      `Initial balance for ${accountForm.name}`,
                      [
                          { account_id: newAcc.id, debit: Number(accountForm.initial_balance), credit: 0 },
                          { account_id: capitalAcc.id, debit: 0, credit: Number(accountForm.initial_balance) }
                      ],
                      profile.id
                  );
              } else {
                  toast.error("Account created, but initial balance skipped because no 'CAPITAL' account exists.");
              }
          }

          toast.success('Account created successfully');
          setShowAccountModal(false);
          setAccountForm({ name: '', category: 'asset', code: 'BANK', account_number: '', bank_name: '', initial_balance: 0 });
          setDisplayInitialBalance('0');
          fetchData();
      } catch (e: any) {
          toast.error(e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleFundAction = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!profile) return;
      setIsProcessing(true);
      try {
          const amount = Number(fundForm.amount);
          
          if (fundForm.type === 'transfer') {
              await postJournalEntry(
                  'transfer',
                  null,
                  fundForm.description || 'Internal Fund Transfer',
                  [
                      { account_id: fundForm.to_account_id, debit: amount, credit: 0 },
                      { account_id: fundForm.from_account_id, debit: 0, credit: amount }
                  ],
                  profile.id
              );
          } else {
              const { data: capitalAcc } = await supabase
                .from('internal_accounts')
                .select('id')
                .eq('account_code', 'CAPITAL')
                .maybeSingle();

              if (!capitalAcc) throw new Error("System 'Share Capital' account (code: CAPITAL) not found. Please use 'Quick Setup' or create it manually.");

              await postJournalEntry(
                  'injection',
                  null,
                  fundForm.description || 'Capital Injection',
                  [
                      { account_id: fundForm.to_account_id, debit: amount, credit: 0 },
                      { account_id: capitalAcc.id, debit: 0, credit: amount }
                  ],
                  profile.id
              );
          }

          toast.success('Transaction posted to ledger');
          setShowFundModal(false);
          setFundForm({ type: 'injection', from_account_id: '', to_account_id: '', amount: 0, description: '' });
          setDisplayFundAmount('');
          fetchData();
      } catch (e: any) {
          toast.error(e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const hasCapitalAccount = accounts.some(a => a.account_code?.toUpperCase() === 'CAPITAL');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Institutional Finance</h1>
            <p className="text-sm text-gray-500">Manage internal accounts and institutional liquidity via the ledger.</p>
        </div>
        {isAccountant && (
            <div className="flex flex-wrap gap-2">
                {!hasCapitalAccount && (
                    <button
                        onClick={handleInitializeSystem}
                        disabled={isProcessing}
                        className="inline-flex items-center px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-amber-100"
                    >
                        <Wand2 className="h-4 w-4 mr-2" /> Quick Setup
                    </button>
                )}
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

      {!hasCapitalAccount && isAccountant && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start shadow-sm">
              <ShieldAlert className="h-5 w-5 text-amber-600 mr-3 shrink-0 mt-0.5" />
              <div>
                  <h4 className="text-sm font-bold text-amber-800">System Accounts Missing</h4>
                  <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                      The mandatory <strong>Share Capital</strong> account is missing. You cannot record injections or initial balances without it. 
                      Click <strong>Quick Setup</strong> above to automatically create the standard chart of accounts.
                  </p>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Available Liquidity</p>
              <h3 className="text-3xl font-bold text-indigo-600">{formatCurrency(totalLiquidity)}</h3>
              <div className="mt-2 flex items-center text-xs text-gray-500">
                  <ShieldCheck className="h-3 w-3 mr-1 text-green-500" />
                  Ledger-verified balance
              </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Capital Injections (MTD)</p>
              <h3 className="text-3xl font-bold text-green-600">{formatCurrency(journalEntries.filter(e => e.reference_type === 'injection').reduce((sum, e) => sum + e.journal_lines.reduce((s: any, l: any) => s + Number(l.debit), 0), 0))}</h3>
              <div className="mt-2 flex items-center text-xs text-green-600">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Institutional growth
              </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Ledger Integrity</p>
              <div className="flex items-center mt-1">
                  <CheckCircle2 className="h-6 w-6 text-green-500 mr-2" />
                  <h3 className="text-xl font-bold text-gray-900">Synchronized</h3>
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
                                          acc.account_category === 'asset' ? 'bg-blue-50 text-blue-600' : 
                                          acc.account_category === 'liability' ? 'bg-red-50 text-red-600' : 
                                          'bg-purple-50 text-purple-600'
                                      }`}>
                                          {acc.account_code === 'BANK' ? <BankIcon className="h-6 w-6" /> : <Coins className="h-6 w-6" />}
                                      </div>
                                      <div>
                                          <h4 className="font-bold text-gray-900">{acc.name}</h4>
                                          <p className="text-xs text-gray-500 uppercase font-medium tracking-wider">
                                              {acc.account_category} • {acc.account_code}
                                          </p>
                                      </div>
                                  </div>
                                  <div className="text-right">
                                      <p className={`text-lg font-bold ${acc.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>{formatCurrency(acc.balance)}</p>
                                      <p className="text-[10px] text-gray-400 uppercase font-bold">Ledger Balance</p>
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
                  </div>
                  <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                              <tr>
                                  <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Date</th>
                                  <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Type</th>
                                  <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Description</th>
                                  <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-500 uppercase">Debit</th>
                                  <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-500 uppercase">Credit</th>
                              </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100">
                              {journalEntries.map(entry => (
                                  <React.Fragment key={entry.id}>
                                      <tr className="bg-gray-50/30">
                                          <td className="px-6 py-2 whitespace-nowrap text-[10px] text-gray-400 font-bold uppercase">
                                              {new Date(entry.date).toLocaleDateString()}
                                          </td>
                                          <td className="px-6 py-2 whitespace-nowrap">
                                              <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase border bg-white text-gray-600">
                                                  {entry.reference_type}
                                              </span>
                                          </td>
                                          <td colSpan={3} className="px-6 py-2 text-[10px] font-bold text-gray-900">
                                              {entry.description} <span className="text-gray-400 font-normal ml-2">by {entry.users?.full_name}</span>
                                          </td>
                                      </tr>
                                      {entry.journal_lines.map((line: any) => (
                                          <tr key={line.id} className="hover:bg-gray-50 transition-colors">
                                              <td colSpan={2}></td>
                                              <td className="px-6 py-2 text-xs text-gray-600 pl-12">
                                                  {line.accounts?.name}
                                              </td>
                                              <td className="px-6 py-2 text-right text-xs font-medium text-gray-900">
                                                  {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                                              </td>
                                              <td className="px-6 py-2 text-right text-xs font-medium text-gray-900">
                                                  {line.credit > 0 ? formatCurrency(line.credit) : '-'}
                                              </td>
                                          </tr>
                                      ))}
                                  </React.Fragment>
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
                      Liquidity Engine
                  </h3>
                  <p className="text-xs text-indigo-200 leading-relaxed mb-4">
                      Balances are calculated in real-time using the formula:
                      <br/><br/>
                      <code className="bg-black/20 p-1 rounded">Asset = Debit - Credit</code>
                      <br/>
                      <code className="bg-black/20 p-1 rounded">Liability = Credit - Debit</code>
                  </p>
                  <div className="space-y-4">
                      <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                          <p className="text-[10px] text-indigo-300 uppercase font-bold">Total Assets</p>
                          <p className="text-xl font-bold">{formatCurrency(accounts.filter(a => a.account_category === 'asset').reduce((sum, a) => sum + Number(a.balance), 0))}</p>
                      </div>
                      <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                          <p className="text-[10px] text-indigo-300 uppercase font-bold">Total Liabilities</p>
                          <p className="text-xl font-bold">{formatCurrency(accounts.filter(a => a.account_category === 'liability').reduce((sum, a) => sum + Number(a.balance), 0))}</p>
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
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Category</label>
                              <select className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white" value={accountForm.category} onChange={e => setAccountForm({...accountForm, category: e.target.value as any})}>
                                  <option value="asset">Asset</option>
                                  <option value="liability">Liability</option>
                                  <option value="equity">Equity</option>
                                  <option value="income">Income</option>
                                  <option value="expense">Expense</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Code</label>
                              <select className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white" value={accountForm.code} onChange={e => setAccountForm({...accountForm, code: e.target.value as any})}>
                                  <option value="BANK">BANK</option>
                                  <option value="CASH">CASH</option>
                                  <option value="MOBILE">MOBILE</option>
                                  <option value="EQUITY">EQUITY</option>
                                  <option value="LIABILITY">LIABILITY</option>
                                  <option value="OPERATIONAL">OPERATIONAL</option>
                                  <option value="CAPITAL">CAPITAL</option>
                                  <option value="PORTFOLIO">PORTFOLIO</option>
                              </select>
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Initial Balance (MK)</label>
                          <input type="text" className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" value={displayInitialBalance} onChange={e => handleInitialBalanceChange(e.target.value)} />
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
                          <input required type="text" className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500" placeholder="0.00" value={displayFundAmount} onChange={e => handleFundAmountChange(e.target.value)} />
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