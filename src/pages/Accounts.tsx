import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { InternalAccount } from '@/types';
import { formatCurrency, formatNumberWithCommas, parseFormattedNumber } from '@/utils/finance';
import { postJournalEntry } from '@/utils/accounting';
import { 
    Landmark, Wallet, ArrowUpRight, ArrowDownLeft, Plus, 
    Search, History, RefreshCw, Landmark as BankIcon, 
    Coins, ShieldCheck, ArrowRightLeft, Download, Filter,
    TrendingUp, AlertCircle, X, CheckCircle2, Calculator,
    Wand2, ShieldAlert, ChevronRight, ChevronDown, Folder, FolderOpen,
    ChevronLeft, FileSpreadsheet, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Accounts: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [accounts, setAccounts] = useState<InternalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('tree');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
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
    fetchAccounts();
  }, []);
  
  useEffect(() => {
    const channel = supabase.channel('accounts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_accounts' }, () => fetchAccounts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
        const { data: accs, error: accsError } = await supabase
            .from('internal_accounts')
            .select('*')
            .order('name', { ascending: true });
        
        if (accsError) {
            console.error('Error fetching accounts:', accsError);
            toast.error('Failed to load accounts: ' + accsError.message);
        }

        setAccounts(accs || []);
    } catch (e: any) {
        console.error('Unexpected error in fetchAccounts:', e);
        toast.error('An unexpected error occurred: ' + e.message);
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

          const { data: existing } = await supabase
            .from('internal_accounts')
            .select('code')
            .in('code', coreAccounts.map(a => a.code));
          
          const existingCodes = new Set(existing?.map(e => e.code) || []);
          const missingAccounts = coreAccounts.filter(a => !existingCodes.has(a.code));

          if (missingAccounts.length === 0) {
              toast.success("System accounts are already initialized.", { id: loadingToast });
              setIsProcessing(false);
              return;
          }

          const { error } = await supabase
            .from('internal_accounts')
            .insert(missingAccounts.map(acc => ({
                name: acc.name,
                category: acc.category,
                code: acc.code,
                type: acc.type,
                balance: 0,
                is_system_account: true
            })));

          if (error) throw error;

          toast.success(`Successfully created ${missingAccounts.length} system accounts.`, { id: loadingToast });
          fetchAccounts();
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
          const validTypes = ['bank', 'cash', 'mobile', 'equity', 'liability', 'operational', 'capital', 'asset'];
          const suggestedType = accountForm.code.toLowerCase();
          const finalType = validTypes.includes(suggestedType) ? suggestedType : accountForm.category;

          const { data: newAcc, error } = await supabase
            .from('internal_accounts')
            .insert([{
                name: accountForm.name,
                category: accountForm.category,
                code: accountForm.code,
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
                .eq('code', 'CAPITAL')
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
          fetchAccounts();
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
                .eq('code', 'CAPITAL')
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
          fetchAccounts();
      } catch (e: any) {
          toast.error(e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const hasCapitalAccount = accounts.some(a => a.account_code?.toUpperCase() === 'CAPITAL');

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const expandAll = () => {
    const allIds = new Set(accounts.map(a => a.id));
    setExpandedNodes(allIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const accountTree = useMemo(() => {
    const accountMap = new Map<string, InternalAccount>(
      accounts.map(a => [a.id, { ...a, children: [] }])
    );
    const roots: InternalAccount[] = [];
    
    accounts.forEach(account => {
      const node = accountMap.get(account.id);
      if (node && account.parent_id && accountMap.has(account.parent_id)) {
        const parent = accountMap.get(account.parent_id);
        if (parent && parent.children) {
          parent.children.push(node);
        }
      } else if (node) {
        roots.push(node);
      }
    });
    
    const sortNodes = (nodes: InternalAccount[]) => {
      return nodes.sort((a, b) => {
        const aNum = a.account_number_display || a.name;
        const bNum = b.account_number_display || b.name;
        return aNum.localeCompare(bNum);
      });
    };
    
    const sortTree = (nodes: InternalAccount[]): InternalAccount[] => {
      const sorted = sortNodes(nodes);
      sorted.forEach(node => {
        if (node.children && node.children.length > 0) {
          node.children = sortTree(node.children);
        }
      });
      return sorted;
    };
    
    return sortTree(roots);
  }, [accounts]);

  const getSubtreeBalance = (account: InternalAccount): number => {
    let total = Number(account.balance) || 0;
    if (account.children) {
      account.children.forEach(child => {
        total += getSubtreeBalance(child);
      });
    }
    return total;
  };

  const renderTreeNode = (account: InternalAccount, level: number = 0) => {
    const isExpanded = expandedNodes.has(account.id);
    const hasChildren = account.children && account.children.length > 0;
    const subtreeBalance = getSubtreeBalance(account);
    const isRoot = level === 0;
    
    return (
      <div key={account.id}>
        <div 
          className={`flex items-center justify-between py-3 px-4 hover:bg-gray-50 transition-colors cursor-pointer ${
            isRoot ? 'bg-indigo-50/50 border-l-4 border-indigo-500' : 'border-l-2 border-gray-200'
          }`}
          style={{ paddingLeft: `${16 + level * 24}px` }}
          onClick={() => hasChildren && toggleNode(account.id)}
        >
          <div className="flex items-center">
            {hasChildren && (
              <button 
                onClick={(e) => { e.stopPropagation(); toggleNode(account.id); }}
                className="mr-2 p-1 hover:bg-gray-200 rounded transition-colors"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                )}
              </button>
            )}
            {!hasChildren && <div className="w-6 mr-2" />}
            
            <div className={`p-2 rounded-lg mr-3 ${
              hasChildren 
                ? isExpanded ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'
                : account.account_category === 'asset' ? 'bg-blue-50 text-blue-600' 
                : account.account_category === 'liability' ? 'bg-red-50 text-red-600'
                : 'bg-purple-50 text-purple-600'
            }`}>
              {hasChildren ? (
                isExpanded ? <FolderOpen className="h-5 w-5" /> : <Folder className="h-5 w-5" />
              ) : (
                account.account_code === 'BANK' ? <BankIcon className="h-5 w-5" /> : <Coins className="h-5 w-5" />
              )}
            </div>
            
            <div>
              <div className="flex items-center gap-2">
                <h4 className={`font-bold ${isRoot ? 'text-gray-900' : 'text-gray-700'}`}>
                  {account.name}
                </h4>
                {account.account_number_display && (
                  <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                    {account.account_number_display}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 uppercase font-medium tracking-wider">
                {account.account_category} • {account.account_code}
                {hasChildren && (
                  <span className="ml-2 text-indigo-500">
                    ({account.children?.length} sub-accounts)
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <p className={`text-lg font-bold ${
              subtreeBalance < 0 ? 'text-red-600' : isRoot ? 'text-indigo-700' : 'text-gray-900'
            }`}>
              {formatCurrency(subtreeBalance)}
            </p>
            <p className="text-[10px] text-gray-400 uppercase font-bold">
              {hasChildren ? 'Subtree Total' : 'Account Balance'}
            </p>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {account.children?.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Available Liquidity</p>
              <h3 className="text-3xl font-bold text-indigo-600">{formatCurrency(totalLiquidity)}</h3>
              <div className="mt-2 flex items-center text-xs text-gray-500">
                  <ShieldCheck className="h-3 w-3 mr-1 text-green-500" />
                  Ledger-verified balance
              </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Accounts</p>
              <h3 className="text-3xl font-bold text-gray-600">{accounts.length}</h3>
              <div className="mt-2 flex items-center text-xs text-gray-500">
                  <Wallet className="h-3 w-3 mr-1" />
                  Active institutional accounts
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
                      <div className="flex items-center gap-2">
                          <div className="flex bg-gray-100 rounded-lg p-1">
                              <button
                                  onClick={() => setViewMode('tree')}
                                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                      viewMode === 'tree' 
                                          ? 'bg-white text-indigo-600 shadow-sm' 
                                          : 'text-gray-500 hover:text-gray-700'
                                  }`}
                                  title="Tree View"
                              >
                                  Tree
                              </button>
                              <button
                                  onClick={() => setViewMode('list')}
                                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                      viewMode === 'list' 
                                          ? 'bg-white text-indigo-600 shadow-sm' 
                                          : 'text-gray-500 hover:text-gray-700'
                                  }`}
                                  title="List View"
                              >
                                  List
                              </button>
                          </div>
                          
                          {viewMode === 'tree' && (
                              <>
                                  <button
                                      onClick={expandAll}
                                      className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                      title="Expand All"
                                  >
                                      <FolderOpen className="h-4 w-4" />
                                  </button>
                                  <button
                                      onClick={collapseAll}
                                      className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                      title="Collapse All"
                                  >
                                      <Folder className="h-4 w-4" />
                                  </button>
                              </>
                          )}
                      </div>
                  </div>
                  
                  {viewMode === 'tree' ? (
                      <div className="divide-y divide-gray-100">
                          {loading ? (
                              <div className="p-12 text-center">
                                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-4" />
                                  <p className="text-sm text-gray-500">Loading account hierarchy...</p>
                              </div>
                          ) : accountTree.length === 0 ? (
                              <div className="p-12 text-center text-gray-500">
                                  No institutional accounts configured.
                              </div>
                          ) : (
                              <div>
                                  <div className="px-6 py-3 bg-indigo-50/30 border-b border-indigo-100 flex items-center justify-between">
                                      <p className="text-xs text-indigo-700 font-medium">
                                          Showing {accounts.length} accounts in {accountTree.length} categories
                                      </p>
                                      <p className="text-xs text-gray-500">
                                          Click folders to expand/collapse
                                      </p>
                                  </div>
                                  {accountTree.map(account => renderTreeNode(account, 0))}
                              </div>
                          )}
                      </div>
                  ) : (
                      <div className="divide-y divide-gray-100">
                          {loading ? (
                              <div className="p-12 text-center">
                                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
                              </div>
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
                                              <div className="flex items-center gap-2">
                                                  <h4 className="font-bold text-gray-900">{acc.name}</h4>
                                                  {acc.account_number_display && (
                                                      <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                                                          {acc.account_number_display}
                                                      </span>
                                                  )}
                                              </div>
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
                  )}
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
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Initial Balance</label>
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
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Amount</label>
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
