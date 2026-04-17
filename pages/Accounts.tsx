import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { InternalAccount } from '@/types';
import { formatCurrency, formatNumberWithCommas, parseFormattedNumber } from '@/utils/finance';
import { accountsService } from '@/services/accounts';
import { journalEntriesService } from '@/services/journalEntries';
import {
  Plus,
  RefreshCw,
  Landmark as BankIcon,
  ArrowRightLeft,
  X,
  Wand2,
  ShieldAlert,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Coins,
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
      account_number_display: '',
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
        const result = await accountsService.getAccounts();
        
        if (result.error) {
            console.error('Error fetching accounts:', result.error);
            toast.error('Failed to load accounts: ' + result.error.message);
        }

        setAccounts(result.data?.data || []);
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
               { name: 'Share Capital', account_category: 'equity', account_code: 'CAPITAL', type: 'equity' },
               { name: 'Main Bank Account', account_category: 'asset', account_code: 'BANK', type: 'bank' },
               { name: 'Petty Cash', account_category: 'asset', account_code: 'CASH', type: 'cash' },
               { name: 'Retained Earnings', account_category: 'equity', account_code: 'EQUITY', type: 'equity' },
               { name: 'Loan Portfolio', account_category: 'asset', account_code: 'PORTFOLIO', type: 'asset' },
               { name: 'Operational Expenses', account_category: 'expense', account_code: 'OPERATIONAL', type: 'operational' }
           ];

           // Check existence using both alias and legacy columns where available.
           const existingCodes = new Set<string>();
           const codesToCheck = coreAccounts.map(a => a.account_code);

           const tryAccountCode = await supabase
               .from('internal_accounts')
               .select('account_code')
               .in('account_code', codesToCheck);
           if (!tryAccountCode.error) {
               (tryAccountCode.data || []).forEach((e: any) => {
                   if (e?.account_code) existingCodes.add(e.account_code);
               });
           }

           const tryLegacyCode = await supabase
               .from('internal_accounts')
               .select('code')
               .in('code', codesToCheck);
           if (!tryLegacyCode.error) {
               (tryLegacyCode.data || []).forEach((e: any) => {
                   if (e?.code) existingCodes.add(e.code);
               });
           }

           if (existingCodes.size === 0 && (tryAccountCode.error && tryLegacyCode.error)) {
               throw tryAccountCode.error;
           }

           const missingAccounts = coreAccounts.filter(a => !existingCodes.has(a.account_code));

          if (missingAccounts.length === 0) {
              toast.success("System accounts are already initialized.", { id: loadingToast });
              setIsProcessing(false);
              return;
          }

            const results = await Promise.all(missingAccounts.map(acc => 
                accountsService.createAccount({
                    name: acc.name,
                    account_category: acc.account_category as any,
                    account_code: acc.account_code,
                    is_system_account: true
                })
            ));

            const errors = results.filter(r => !r.success);
            if (errors.length > 0) {
                throw new Error(errors[0].error?.message || "Failed to create some system accounts");
            }

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

            const result = await accountsService.createAccount({
                name: accountForm.name,
                account_category: accountForm.category,
                account_code: accountForm.code,
                account_number_display: accountForm.account_number_display
            });

            if (!result.success || !result.data) throw new Error(result.error?.message || 'Failed to create account');
            const newAcc = result.data;

           if (Number(accountForm.initial_balance) > 0) {
                let capitalAcc: any = null;
                const capResult = await accountsService.getAccountByCode('CAPITAL');
                capitalAcc = capResult.data;

                if (capitalAcc) {
                    await journalEntriesService.createJournalEntry({
                        reference_type: 'injection',
                        reference_id: newAcc.id,
                        date: new Date().toISOString().split('T')[0],
                        description: `Initial balance for ${accountForm.name}`,
                        journal_lines: [
                            { account_id: newAcc.id, debit: Number(accountForm.initial_balance), credit: 0 },
                            { account_id: capitalAcc.id, debit: 0, credit: Number(accountForm.initial_balance) }
                        ]
                    });
                } else {
                    toast.error("Account created, but initial balance skipped because no 'CAPITAL' account exists.");
                }
            }

          toast.success('Account created successfully');
          setShowAccountModal(false);
          setAccountForm({ name: '', category: 'asset', code: 'BANK', account_number_display: '', initial_balance: 0 });
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
              await journalEntriesService.createJournalEntry({
                  reference_type: 'transfer',
                  date: new Date().toISOString().split('T')[0],
                  description: fundForm.description || 'Internal Fund Transfer',
                  journal_lines: [
                      { account_id: fundForm.to_account_id, debit: amount, credit: 0 },
                      { account_id: fundForm.from_account_id, debit: 0, credit: amount }
                  ]
              });
           } else {
                const capResult = await accountsService.getAccountByCode('CAPITAL');
                const capitalAcc = capResult.data;
                if (!capitalAcc) throw new Error("Capital account not found");

                await journalEntriesService.createJournalEntry({
                    reference_type: 'injection',
                    date: new Date().toISOString().split('T')[0],
                    description: fundForm.description || 'Capital Injection',
                    journal_lines: [
                        { account_id: fundForm.to_account_id, debit: amount, credit: 0 },
                        { account_id: capitalAcc.id, debit: 0, credit: amount }
                    ]
                });
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
          className={`flex items-center justify-between py-2.5 px-3 hover:bg-gray-50 transition-colors cursor-pointer ${
            isRoot ? 'bg-indigo-50/50 border-l-4 border-indigo-500' : 'border-l border-gray-200'
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
            
            <div>
              <div className="flex items-center gap-2">
                <h4 className={`font-semibold ${isRoot ? 'text-gray-900' : 'text-gray-700'}`}>
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
            <p className={`text-base font-semibold ${
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
        <div className="flex flex-wrap gap-2">
            {!hasCapitalAccount && (
                <button
                    onClick={handleInitializeSystem}
                    disabled={isProcessing}
                    className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                    Quick Setup
                </button>
            )}
            <button
                onClick={() => setShowFundModal(true)}
                className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
                Fund Movement
            </button>
            <button
                onClick={() => setShowAccountModal(true)}
                className="px-3 py-2 bg-indigo-900 hover:bg-indigo-800 text-white rounded-lg text-sm font-semibold transition-colors"
            >
                New Account
            </button>
        </div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Total Available Liquidity</p>
              <h3 className="text-2xl font-bold text-indigo-600">{formatCurrency(totalLiquidity)}</h3>
              <p className="mt-1 text-xs text-gray-500">Ledger-verified balance</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Total Accounts</p>
              <h3 className="text-2xl font-bold text-gray-700">{accounts.length}</h3>
              <p className="mt-1 text-xs text-gray-500">Active institutional accounts</p>
          </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
          <div className="space-y-6">
              <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-200">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                      <h3 className="font-semibold text-gray-900">
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
                                  <div className="px-4 py-2 bg-indigo-50/30 border-b border-indigo-100 flex items-center justify-between">
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
                                  <div key={acc.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                      <div className="flex items-center">
                                          <div>
                                              <div className="flex items-center gap-2">
                                                  <h4 className="font-semibold text-gray-900">{acc.name}</h4>
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
                                          <p className={`text-base font-semibold ${acc.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>{formatCurrency(acc.balance)}</p>
                                          <p className="text-[10px] text-gray-400 uppercase font-bold">Ledger Balance</p>
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                  )}
              </div>
          </div>
      </div>

      {showAccountModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-indigo-900 px-6 py-5 flex justify-between items-center">
                      <h3 className="font-bold text-white text-lg">New Institutional Account</h3>
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
                      <h3 className="font-bold text-white text-lg">Fund Movement</h3>
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
