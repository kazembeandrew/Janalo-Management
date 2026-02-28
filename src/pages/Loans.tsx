import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Loan, InternalAccount } from '@/types';
import { formatCurrency } from '@/utils/finance';
import { exportToCSV } from '@/utils/export';

import {
  Plus, Filter, ChevronRight, Clock, ChevronLeft,
  Download, AlertTriangle, TrendingUp, Hash,
  CheckSquare, Square, ThumbsUp, X, RefreshCw, Landmark,
  Edit, Trash2
} from 'lucide-react';

const ITEMS_PER_PAGE = 10;

interface LoanWithBorrower extends Loan {
  borrowers: {
    full_name: string;
  };
}

type FilterType = 'all' | 'active' | 'pending' | 'reassess' | 'completed' | 'defaulted' | 'rejected';

interface ExportData {
  Reference: string;
  Borrower: string;
  Principal: number;
  Outstanding: number;
  Term: number;
  Status: string;
  Date: string;
}

export const Loans: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [loans, setLoans] = useState<LoanWithBorrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [accounts, setAccounts] = useState<InternalAccount[]>([]);
  const [targetAccountId, setTargetAccountId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [deleteLoanId, setDeleteLoanId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const isExec = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo');

  useEffect(() => {
    fetchLoans();
    if (isExec) fetchAccounts();

    const channel = supabase
      .channel('loans-list-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => {
        fetchLoans();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, filter, page]);

  const fetchAccounts = async () => {
    const { data } = await supabase.from('internal_accounts').select('*').order('name', { ascending: true });
    if (data) setAccounts(data);
  };

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    setPage(1);
    setSelectedIds(new Set());
  };

  const fetchLoans = async () => {
    try {
      let query = supabase
        .from('loans')
        .select(`
          *,
          borrowers (full_name)
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      if (profile?.role === 'loan_officer') {
        query = query.eq('officer_id', profile.id);
      }

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      
      const { data, error, count } = await query.range(from, to);

      if (error) throw error;
      
      setLoans(data as LoanWithBorrower[]);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching loans:', error);
      toast.error('Failed to fetch loans');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    const pendingLoans = loans.filter(l => l.status === 'pending');
    if (selectedIds.size === pendingLoans.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingLoans.map(l => l.id)));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0 || !targetAccountId || !profile) return;
    
    setIsProcessing(true);
    const ids = Array.from(selectedIds);
    
    try {
      const { data, error } = await supabase.rpc('bulk_disburse_loans', {
        p_loan_ids: ids,
        p_source_account_id: targetAccountId,
        p_user_id: profile.id
      });

      if (error) throw error;
      
      const result = data as any;
      
      if (!result.success) {
        if (result.disbursed_count > 0) {
          toast.success(`${result.disbursed_count} loans disbursed, ${result.failed_count} failed`);
        } else {
          throw new Error(result.error || 'Bulk disbursement failed');
        }
      } else {
        toast.success(`Successfully approved and disbursed ${result.disbursed_count} loans.`);
      }
      
      setShowApproveModal(false);
      setSelectedIds(new Set());
      setTargetAccountId('');
      fetchLoans();
    } catch (e: any) {
      toast.error(`Bulk approval failed: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = () => {
    const exportData: ExportData[] = loans.map(l => ({
      Reference: l.reference_no,
      Borrower: l.borrowers?.full_name || 'Unknown',
      Principal: l.principal_amount,
      Outstanding: l.principal_outstanding + l.interest_outstanding + (l.penalty_outstanding || 0),
      Term: l.term_months,
      Status: l.status,
      Date: new Date(l.created_at).toLocaleDateString()
    }));
    exportToCSV(exportData, 'Janalo_Loans_Export');
    toast.success('Export completed successfully');
  };

  const handleDelete = async () => {
    if (!deleteLoanId || !profile) return;
    
    setIsProcessing(true);
    try {
      await supabase.from('repayments').delete().eq('loan_id', deleteLoanId);
      await supabase.from('loan_notes').delete().eq('loan_id', deleteLoanId);
      await supabase.from('loan_documents').delete().eq('loan_id', deleteLoanId);
      await supabase.from('borrower_documents').delete().eq('loan_id', deleteLoanId);
      await supabase.from('visitations').delete().eq('loan_id', deleteLoanId);
      
      const { error } = await supabase.from('loans').delete().eq('id', deleteLoanId);
      
      if (error) throw error;
      
      toast.success('Loan deleted successfully');
      setShowDeleteModal(false);
      setDeleteLoanId(null);
      fetchLoans();
    } catch (e: any) {
      toast.error(`Delete failed: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'defaulted':
        return 'bg-red-100 text-red-800';
      case 'rejected':
        return 'bg-gray-100 text-gray-500 line-through';
      case 'reassess':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isOverdue = (loan: LoanWithBorrower) => {
    if (loan.status !== 'active') return false;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return new Date(loan.updated_at) < thirtyDaysAgo;
  };

  const pendingCount = loans.filter(l => l.status === 'pending').length;

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loan Portfolio</h1>
          <p className="text-sm text-gray-500">View and manage all loans</p>
        </div>
        <div className="flex space-x-2">
            <button
                onClick={handleExport}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
            </button>
            {profile?.role !== 'ceo' && (
            <Link
                to="/loans/new"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-900 hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
                <Plus className="h-4 w-4 mr-2" />
                New Application
            </Link>
            )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
                <Filter className="h-5 w-5 text-gray-400" />
                <select
                    value={filter}
                    onChange={(e) => handleFilterChange(e.target.value)}
                    className="block w-full max-w-xs pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    aria-label="Filter loans by status"
                >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending Approval</option>
                    <option value="reassess">Under Reassessment</option>
                    <option value="completed">Completed</option>
                    <option value="defaulted">Defaulted</option>
                    <option value="rejected">Rejected</option>
                </select>
            </div>
            {isExec && filter === 'pending' && pendingCount > 0 && (
                <button
                    onClick={toggleSelectAll}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center"
                >
                    {selectedIds.size === pendingCount ? <CheckSquare className="h-4 w-4 mr-1.5" /> : <Square className="h-4 w-4 mr-1.5" />}
                    {selectedIds.size === pendingCount ? 'Deselect All' : 'Select All Pending'}
                </button>
            )}
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {isExec && filter === 'pending' && <th className="px-6 py-3 w-10"></th>}
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Borrower / Ref</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recovery</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">View</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                        <div className="flex justify-center">
                             <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                        </div>
                    </td>
                </tr>
              ) : loans.length === 0 ? (
                <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">No loans found matching filter.</td>
                </tr>
              ) : (
                loans.map((loan) => {
                  const recovery = ((Number(loan.principal_amount) - Number(loan.principal_outstanding)) / Number(loan.principal_amount)) * 100;
                  const overdue = isOverdue(loan);
                  const isSelected = selectedIds.has(loan.id);

                  return (
                    <tr key={loan.id} className={`hover:bg-gray-50 transition-colors ${overdue ? 'bg-red-50/30' : ''} ${isSelected ? 'bg-indigo-50/50' : ''}`}>
                      {isExec && filter === 'pending' && (
                          <td className="px-6 py-4">
                              {loan.status === 'pending' && (
                                  <button 
                                    onClick={() => toggleSelect(loan.id)}
                                    className={`p-1 rounded transition-all ${isSelected ? 'text-indigo-600' : 'text-gray-300 hover:text-gray-400'}`}
                                  >
                                      {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                                  </button>
                              )}
                          </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                            <div>
                                <Link to={`/loans/${loan.id}`} className="text-sm font-bold text-gray-900 hover:text-indigo-600 hover:underline">
                                    {loan.borrowers?.full_name}
                                </Link>
                                <Link to={`/loans/${loan.id}`} className="text-[10px] text-indigo-600 font-bold flex items-center mt-0.5 hover:text-indigo-800 hover:underline">
                                    <Hash className="h-2.5 w-2.5 mr-0.5" /> {loan.reference_no || 'NO REF'}
                                </Link>
                            </div>
                            {overdue && (
                                <div className="ml-3 text-red-600" title="Overdue (30d+)">
                                    <AlertTriangle className="h-4 w-4" />
                                </div>
                            )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(loan.principal_amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {formatCurrency(loan.principal_outstanding + loan.interest_outstanding + (loan.penalty_outstanding || 0))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${recovery}%` }} />
                            </div>
                            <span className="text-[10px] font-bold text-gray-400">{recovery.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(loan.status)}`}>
                          {loan.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                          {loan.status === 'reassess' ? 'Reassess' : loan.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {(effectiveRoles.includes('admin') || effectiveRoles.includes('ceo') || (effectiveRoles.includes('loan_officer') && loan.status !== 'active' && loan.status !== 'completed')) && (
                          <button onClick={() => { setDeleteLoanId(loan.id); setShowDeleteModal(true); }} className="text-red-600 hover:text-red-900" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <div className="flex items-center justify-end gap-2">
                          {effectiveRoles.includes('loan_officer') && (loan.status === 'rejected' || loan.status === 'reassess') && (
                            <Link to={`/loans/edit/${loan.id}`} className="text-indigo-600 hover:text-indigo-900" title="Edit">
                              <Edit className="h-4 w-4" />
                            </Link>
                          )}
                          <Link to={`/loans/${loan.id}`} className="text-indigo-600 hover:text-indigo-900 flex items-center justify-end">
                            {loan.status === 'pending' && (profile?.role === 'ceo' || profile?.role === 'admin') 
                                ? 'Review' 
                                : 'Details'} 
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{totalCount === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium">{Math.min(page * ITEMS_PER_PAGE, totalCount)}</span> of <span className="font-medium">{totalCount}</span> results
                    </p>
                </div>
                <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1 || loading}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                        >
                            <span className="sr-only">Previous</span>
                            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                            Page {page} of {totalPages || 1}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages || totalPages === 0 || loading}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                        >
                            <span className="sr-only">Next</span>
                            <ChevronRight className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </nav>
                </div>
            </div>
             <div className="flex items-center justify-between w-full sm:hidden">
                <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                    Previous
                </button>
                <span className="text-sm text-gray-700">
                    Page {page}
                </span>
                <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || totalPages === 0 || loading}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                    Next
                </button>
            </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-4 animate-in slide-in-from-bottom-8 duration-300">
              <div className="bg-indigo-900 text-white rounded-2xl shadow-2xl p-4 flex items-center justify-between border border-white/10 backdrop-blur-md">
                  <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center font-bold text-indigo-300">
                          {selectedIds.size}
                      </div>
                      <div>
                          <p className="text-sm font-bold">Applications Selected</p>
                          <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider">Bulk Approval Ready</p>
                      </div>
                  </div>
                  <div className="flex gap-2">
                      <button 
                        onClick={() => setShowApproveModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-900 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-all"
                      >
                          <ThumbsUp className="h-3.5 w-3.5" /> Approve All
                      </button>
                      <button 
                        onClick={() => setSelectedIds(new Set())}
                        className="p-2 text-indigo-300 hover:text-white transition-colors"
                      >
                          <X className="h-5 w-5" />
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Bulk Approval Modal */}
      {showApproveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-indigo-900 px-6 py-5 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center text-lg"><ThumbsUp className="mr-3 h-6 w-6 text-indigo-300" /> Bulk Authorization</h3>
                      <button onClick={() => setShowApproveModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5 text-indigo-300" /></button>
                  </div>
                  <div className="p-8 space-y-6">
                      <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                          <p className="text-xs text-indigo-700 leading-relaxed">
                              You are authorizing <strong>{selectedIds.size}</strong> loan applications. 
                              Total disbursement: <strong>{formatCurrency(loans.filter(l => selectedIds.has(l.id)).reduce((sum, l) => sum + Number(l.principal_amount), 0))}</strong>.
                          </p>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Disburse From Account</label>
                          <select 
                            required 
                            className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                            value={targetAccountId}
                            onChange={e => setTargetAccountId(e.target.value)}
                            aria-label="Select account for disbursement"
                          >
                              <option value="">-- Select Source Account --</option>
                              {accounts.map(acc => (
                                  <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</option>
                              ))}
                          </select>
                      </div>
                      <div className="pt-4">
                          <button 
                            onClick={handleBulkApprove} 
                            disabled={isProcessing || !targetAccountId} 
                            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-400 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]"
                          >
                              {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin mx-auto" /> : 'Confirm Bulk Approval'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-red-600 px-6 py-5 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center text-lg"><Trash2 className="mr-3 h-6 w-6 text-red-200" /> Delete Loan</h3>
                      <button onClick={() => setShowDeleteModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5 text-red-200" /></button>
                  </div>
                  <div className="p-8 space-y-5">
                      <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                          <p className="text-xs text-red-700 leading-relaxed">
                              <strong>Warning:</strong> This will permanently delete the loan and all associated data including repayments, notes, documents, and visitation records. This action cannot be undone.
                          </p>
                      </div>
                      <div className="pt-4 flex gap-3">
                          <button 
                            onClick={handleDelete} 
                            disabled={isProcessing} 
                            className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 disabled:bg-gray-400 transition-all shadow-lg shadow-red-100"
                          >
                              {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin mx-auto" /> : 'Delete Loan'}
                          </button>
                          <button 
                            onClick={() => setShowDeleteModal(false)}
                            className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all"
                          >
                              Cancel
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};