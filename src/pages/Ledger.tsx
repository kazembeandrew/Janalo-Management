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

export const Ledger: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [accounts, setAccounts] = useState<InternalAccount[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage] = useState(10);
  
  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [ledgerIntegrity, setLedgerIntegrity] = useState<{balanced: boolean, message: string} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData(1);
  }, []);
  
  useEffect(() => {
    fetchData(1);
  }, [dateFrom, dateTo, filterAccount, filterType]);

  useEffect(() => {
    const channel = supabase.channel('ledger-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_accounts' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entries' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async (page = currentPage) => {
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
        
        let query = supabase
            .from('journal_entries')
            .select('id, entry_number, date:entry_date, status, description, reference_type, reference_id, created_by, created_at, updated_at, journal_lines(*, accounts:internal_accounts(name, account_category, type)), users!journal_entries_created_by_fkey(full_name)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range((page - 1) * entriesPerPage, page * entriesPerPage - 1);
        
        if (dateFrom) {
            query = query.gte('entry_date', dateFrom);
        }
        if (dateTo) {
            query = query.lte('entry_date', dateTo);
        }
        
        if (filterType) {
            query = query.eq('reference_type', filterType);
        }
        
        if (filterAccount) {
            const { data: lineData, error: lineError } = await supabase
                .from('journal_lines')
                .select('journal_entry_id')
                .eq('account_id', filterAccount);
            
            if (lineError) {
                console.error('Error fetching journal lines:', lineError);
            }
            
            if (lineData && lineData.length > 0) {
                const entryIds = lineData.map(l => l.journal_entry_id);
                query = query.in('id', entryIds);
            } else {
                query = query.in('id', ['00000000-0000-0000-0000-000000000000']);
            }
        }
        
        const { data: entries, count, error: entriesError } = await query;

        if (entriesError) {
            console.error('Error fetching journal entries:', entriesError);
            toast.error('Failed to load ledger entries: ' + entriesError.message);
        }

        setAccounts(accs || []);
        setJournalEntries(entries || []);
        setTotalEntries(count || 0);
    } catch (e: any) {
        console.error('Unexpected error in fetchData:', e);
        toast.error('An unexpected error occurred: ' + e.message);
    } finally {
        setLoading(false);
    }
  };
  
  const totalPages = Math.ceil(totalEntries / entriesPerPage);

  const totalLiquidity = useMemo(() => {
      return accounts
        .filter(a => a.account_category === 'asset' && ['CASH', 'BANK', 'MOBILE'].includes(a.account_code))
        .reduce((sum, a) => sum + Number(a.balance), 0);
  }, [accounts]);

  const entryTypes = ['loan_disbursement', 'repayment', 'expense', 'transfer', 'injection', 'adjustment', 'reversal', 'write_off'];

  const handleVerifyTrialBalance = async () => {
    const loadingToast = toast.loading("Verifying ledger integrity...");
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase.rpc('verify_trial_balance', { p_date: today });
      
      if (error) throw error;
      
      if (data && data[0]) {
        const result = data[0];
        setLedgerIntegrity({
          balanced: result.is_balanced,
          message: result.is_balanced 
            ? `Balanced: Debits ${formatCurrency(result.total_debits)} = Credits ${formatCurrency(result.total_credits)}` 
            : `UNBALANCED: Difference ${formatCurrency(result.difference)}` 
        });
        
        if (result.is_balanced) {
          toast.success(`Trial balance verified: ${formatCurrency(result.total_debits)} = ${formatCurrency(result.total_credits)}`, { id: loadingToast });
        } else {
          toast.error(`Ledger imbalance detected: ${formatCurrency(result.difference)}`, { id: loadingToast });
        }
      }
    } catch (e: any) {
      toast.error("Verification failed: " + e.message, { id: loadingToast });
    }
  };

  const handleExportCSV = () => {
    const csvRows: string[] = [];
    csvRows.push(['Date', 'Type', 'Description', 'Account', 'Debit', 'Credit', 'User'].join(','));
    
    journalEntries.forEach(entry => {
      const date = new Date(entry.date).toLocaleDateString();
      const type = entry.reference_type;
      const desc = `"${entry.description?.replace(/"/g, '""')}"`;
      const user = entry.users?.full_name || 'System';
      
      entry.journal_lines.forEach((line: any) => {
        const account = `"${line.accounts?.name?.replace(/"/g, '""')}"`;
        const debit = line.debit > 0 ? line.debit : '';
        const credit = line.credit > 0 ? line.credit : '';
        csvRows.push([date, type, desc, account, debit, credit, user].join(','));
      });
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ledger_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Exported ${journalEntries.length} entries to CSV`);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchData(newPage);
    // Scroll to top of the ledger section
    const ledgerElement = document.getElementById('institutional-ledger');
    if (ledgerElement) {
      ledgerElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Fallback to window top if element not found
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Institutional General Ledger</h1>
            <p className="text-sm text-gray-500">View all journal entries and transactions in the institutional ledger.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleVerifyTrialBalance}
            className="inline-flex items-center px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all shadow-sm"
          >
            <Shield className="h-4 w-4 mr-2 text-green-600" /> Verify Balance
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all shadow-sm"
          >
            <Download className="h-4 w-4 mr-2 text-indigo-600" /> Export CSV
          </button>
        </div>
      </div>

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
                  {ledgerIntegrity ? (
                    ledgerIntegrity.balanced ? (
                      <><CheckCircle2 className="h-6 w-6 text-green-500 mr-2" /><h3 className="text-xl font-bold text-green-600">Verified</h3></>
                    ) : (
                      <><AlertCircle className="h-6 w-6 text-red-500 mr-2" /><h3 className="text-xl font-bold text-red-600">Issue</h3></>
                    )
                  ) : (
                    <><CheckCircle2 className="h-6 w-6 text-green-500 mr-2" /><h3 className="text-xl font-bold text-gray-900">Synchronized</h3></>
                  )}
              </div>
              {ledgerIntegrity && (
                <p className="text-xs text-gray-500 mt-1">{ledgerIntegrity.message}</p>
              )}
          </div>
      </div>

      <div id="institutional-ledger" className="bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h3 className="font-bold text-gray-900 flex items-center">
                  <History className="h-4 w-4 mr-2 text-indigo-600" />
                  Journal Entries
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex items-center px-3 py-2 rounded-xl text-xs font-bold transition-all ${showFilters ? 'bg-indigo-100 text-indigo-700' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  <Filter className="h-3.5 w-3.5 mr-1.5" /> Filters
                </button>
              </div>
            </div>
            
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">From Date</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="block w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">To Date</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="block w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Account</label>
                  <select
                    value={filterAccount}
                    onChange={(e) => setFilterAccount(e.target.value)}
                    className="block w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">All Accounts</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Entry Type</label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="block w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">All Types</option>
                    {entryTypes.map(type => (
                      <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
          <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                      <tr>
                          <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Date</th>
                          <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Type</th>
                          <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Description</th>
                          <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Account</th>
                          <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-500 uppercase">Debit</th>
                          <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-500 uppercase">Credit</th>
                      </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                      {journalEntries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                            No ledger entries found.
                          </td>
                        </tr>
                      ) : (
                        journalEntries.map(entry => (
                          <React.Fragment key={entry.id}>
                              <tr className="bg-gray-50/30">
                                  <td className="px-6 py-2 whitespace-nowrap text-[10px] text-gray-400 font-bold uppercase">
                                      {new Date(entry.date).toLocaleDateString()}
                                  </td>
                                  <td className="px-6 py-2 whitespace-nowrap">
                              <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-gray-100 text-gray-600 leading-none">
                                  {entry.reference_type?.replace(/_/g, ' ')}
                              </span>
                          </td>
                                  <td colSpan={4} className="px-6 py-2 text-[10px] font-bold text-gray-900">
                                      {entry.description} <span className="text-gray-400 font-normal ml-2">by {entry.users?.full_name}</span>
                                  </td>
                              </tr>
                              {entry.journal_lines.map((line: any) => (
                                  <tr key={line.id} className="hover:bg-gray-50 transition-colors">
                                      <td colSpan={3}></td>
                                      <td className="px-6 py-2 text-xs text-gray-600 pl-12">
                                          {line.accounts?.name}
                                      </td>
                                      <td className="px-6 py-2 text-right text-xs font-medium text-gray-900">
                                          {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                                      </td>
                                      <td className="px-6 py-2 text-right text-xs font-medium text-gray-900">
                                          {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                                      </td>
                                  </tr>
                              ))}
                          </React.Fragment>
                        ))
                      )}
                  </tbody>
              </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-100">
            {loading ? (
              <div className="px-6 py-12 text-center text-gray-500">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-indigo-600" />
                <div className="text-sm">Loading ledger entries...</div>
              </div>
            ) : journalEntries.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">No ledger entries found.</div>
            ) : (
              journalEntries.map((entry) => (
                <div key={entry.id} className="px-4 py-4 border-b border-gray-100 last:border-b-0">
                  {/* Entry header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900 leading-snug">
                        {entry.description}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(entry.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        {entry.users?.full_name && (
                          <span className="ml-1.5">· {entry.users.full_name}</span>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-gray-100 text-gray-600 leading-none">
                      {entry.reference_type?.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Journal lines */}
                  {entry.journal_lines?.length ? (
                    <div className="rounded-xl border border-gray-100 overflow-hidden">
                      {/* Column headers */}
                      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Account</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right w-20">Debit</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right w-20">Credit</span>
                      </div>
                      {entry.journal_lines.map((line: any) => (
                        <div key={line.id} className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-2.5 border-t border-gray-50 items-center">
                          <span className="text-xs font-medium text-gray-800 truncate pr-1">
                            {line.accounts?.name}
                          </span>
                          <span className={`text-xs font-bold text-right w-20 ${line.debit > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                            {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                          </span>
                          <span className={`text-xs font-bold text-right w-20 ${line.credit > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                            {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-gray-100 px-3 py-3 text-xs text-gray-400 text-center">No journal lines.</div>
                  )}
                </div>
              ))
            )}
          </div>
          
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-xs text-gray-400 font-medium order-2 sm:order-1">
                {((currentPage - 1) * entriesPerPage) + 1}–{Math.min(currentPage * entriesPerPage, totalEntries)} of {totalEntries} entries
              </p>
              <div className="flex items-center gap-2 order-1 sm:order-2">
                <button
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-bold text-gray-700 px-2 tabular-nums">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
        </div>
    </div>
  );
};
