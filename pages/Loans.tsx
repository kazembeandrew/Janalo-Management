import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/services/permissions';
import { Loan, InternalAccount } from '@/types';
import { formatCurrency } from '@/utils/finance';
import { exportToCSV } from '@/utils/export';

// Import services
import { loanService } from '@/services/loans';
import { accountsService } from '@/services/accounts';

import {
  Plus, Filter, ChevronRight, Clock, ChevronLeft,
  Download, AlertTriangle, TrendingUp, Hash,
  CheckSquare, Square, ThumbsUp, X, RefreshCw, 
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
  const { canCreateLoan, canViewLoans, isLoanOfficer, canReviewLoan } = usePermissions();
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
  const [deleteReason, setDeleteReason] = useState('');

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
    const result = await accountsService.getAccounts({ is_active: true });
    if (result.success) {
        setAccounts(result.data.data || []);
    }
  };

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    setPage(1);
    setSelectedIds(new Set());
  };

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (filter !== 'all') filters.status = filter;
      if (isLoanOfficer()) filters.officer_id = profile?.id;

      const result = await loanService.getLoans(filters, { page, limit: ITEMS_PER_PAGE });

      if (result.success) {
        setLoans(result.data.data as LoanWithBorrower[]);
        setTotalCount(result.data.total);
      } else {
        throw new Error(result.error?.message || 'Failed to fetch loans');
      }
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
    const ids = Array.from(selectedIds) as string[];

    try {
      // Security checks using service layer
      const rateLimitCheck = await loanService.checkRateLimit('financial_operation', 5, 10);
      if (!rateLimitCheck.success || !rateLimitCheck.data?.allowed) {
        throw new Error(`Rate limit check failed: ${rateLimitCheck.data?.reason || 'Too many requests'}`);
      }

      const selectedLoans = loans.filter(l => selectedIds.has(l.id));
      const totalAmount = selectedLoans.reduce((sum, loan) => sum + Number(loan.principal_amount), 0);

      const permissionCheck = await loanService.checkFinancialPermission('disburse', totalAmount);
      if (!permissionCheck.success || !permissionCheck.data?.allowed) {
        throw new Error(`Permission denied: ${permissionCheck.data?.reason || 'Unauthorized'}`);
      }

      // NEW: Use SECURE bulk disbursement with concurrency control
      const bulkResult = await loanService.bulkDisburseLoansSecure({
        loan_ids: ids,
        account_id: targetAccountId,
        user_id: profile.id,
        disbursement_date: new Date().toISOString().split('T')[0],
        note: 'Bulk approval and disbursement'
      });

      if (!bulkResult.success) {
          throw new Error(bulkResult.error?.message || 'Bulk disbursement failed');
      }

      const result = bulkResult.data!;

      if (!result.success) {
        if (result.disbursed_count > 0) {
          toast.success(`${result.disbursed_count} loans disbursed, ${result.failed_count} failed`);
          if (result.errors && result.errors.length > 0) {
            console.error('Failed loans:', result.errors);
            // Show warning toast for failures
            toast(`${result.failed_count} failures. Check console for details.`, {
              icon: '⚠️',
              style: {
                background: '#FEF3C7',
                color: '#92400E',
                border: '1px solid #F59E0B'
              }
            });
          }
        } else {
          throw new Error(result.errors?.[0] || 'Bulk disbursement failed');
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
      Outstanding: Number(l.principal_outstanding || 0) + Number(l.interest_outstanding || 0) + Number(l.penalty_outstanding || 0),
      Term: l.term_months,
      Status: l.status,
      Date: new Date(l.created_at).toLocaleDateString()
    }));
    exportToCSV(exportData, 'Janalo_Loans_Export');
    toast.success('Export completed successfully');
  };

  const handleDelete = async () => {
    if (!deleteLoanId || !profile) return;
    if (!deleteReason.trim()) {
      toast.error('Deletion reason is required');
      return;
    }
     
    setIsProcessing(true);
    try {
        const deleteResult = await loanService.deleteLoan(deleteLoanId);
        
        if (deleteResult.success) {
            toast.success('Loan deleted successfully');
            setShowDeleteModal(false);
            setDeleteLoanId(null);
            setDeleteReason('');
            fetchLoans();
        } else {
            throw new Error(deleteResult.error?.message || 'Delete failed');
        }
    } catch (e: any) {
      console.error('Delete failed:', e);
      toast.error(`Delete failed: ${e.message}`);
    } finally {
        setIsProcessing(false);
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const SkeletonRow = () => (
    <tr>
      <td colSpan={7} className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded bg-gray-200 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-gray-200 animate-pulse" />
            <div className="h-2.5 w-1/4 rounded bg-gray-200 animate-pulse" />
          </div>
          <div className="h-3 w-1/6 rounded bg-gray-200 animate-pulse" />
          <div className="h-3 w-1/6 rounded bg-gray-200 animate-pulse" />
          <div className="h-2.5 w-1/8 rounded bg-gray-200 animate-pulse" />
          <div className="h-6 w-16 rounded bg-gray-200 animate-pulse" />
        </div>
      </td>
    </tr>
  );

  const SkeletonCard = () => (
    <div className="p-4 border-b border-gray-200">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2 flex-1">
          <div className="h-4 w-4 rounded bg-gray-200 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-gray-200 animate-pulse" />
            <div className="h-2.5 w-1/4 rounded bg-gray-200 animate-pulse" />
          </div>
        </div>
        <div className="h-5 w-16 rounded-full bg-gray-200 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-4 mt-3">
        <div>
          <div className="h-2.5 w-1/3 rounded bg-gray-200 animate-pulse mb-1" />
          <div className="h-3 w-2/3 rounded bg-gray-200 animate-pulse" />
        </div>
        <div className="text-right">
          <div className="h-2.5 w-1/3 rounded bg-gray-200 animate-pulse mb-1 ml-auto" />
          <div className="h-3 w-3/4 rounded bg-gray-200 animate-pulse ml-auto" />
        </div>
      </div>
    </div>
  );

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

  const AnimatedProgressBar: React.FC<{ percentage: number }> = ({ percentage }) => {
    const [width, setWidth] = useState(0);
    
    useEffect(() => {
      const timer = setTimeout(() => setWidth(percentage), 100);
      return () => clearTimeout(timer);
    }, [percentage]);

    return (
      <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full bg-indigo-600 transition-[width] duration-700 ease-[cubic-bezier(.22,.61,.36,1)]"
          style={{ width: `${width}%` }}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="page-header-title">Loan Portfolio</h1>
          <p className="text-sm text-gray-500 mt-1">View and manage all active and pending applications</p>
        </div>
        <div className="flex items-center gap-3">
            <button
                onClick={handleExport}
                className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm text-xs font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-95"
            >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
            </button>
            {profile?.role !== 'ceo' && (
            <Link
                to="/loans/new"
                className="inline-flex items-center px-5 py-2.5 border border-transparent rounded-xl shadow-lg shadow-indigo-200 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none transition-all active:scale-95"
            >
                <Plus className="h-4 w-4 mr-2" />
                New Application
            </Link>
            )}
        </div>
      </div>

      <div className="section-card flex flex-col min-h-[500px]">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
                <Filter className="h-5 w-5 text-gray-400" />
                <select
                    value={filter}
                    onChange={(e) => handleFilterChange(e.target.value as FilterType)}
                    className="block w-full max-w-xs pl-3 pr-10 py-2 text-xs font-bold uppercase tracking-wider border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl bg-gray-50/50"
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

        <div className="hidden md:block overflow-x-auto flex-1">
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
                Array.from({length:5}).map((_,i)=><SkeletonRow key={i}/>)
              ) : loans.length === 0 ? (
                <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">No loans found matching filter.</td>
                </tr>
              ) : (
                loans.map((loan, i) => {
                  const recovery = loan.principal_amount > 0 ? ((Number(loan.principal_amount) - Number(loan.principal_outstanding)) / Number(loan.principal_amount)) * 100 : 0;
                  const overdue = isOverdue(loan);
                  const isSelected = selectedIds.has(loan.id);

                  return (
                    <tr 
                      key={loan.id} 
                      className={`hover:bg-gray-50 transition-colors ${overdue ? 'bg-red-50/30' : ''} ${isSelected ? 'bg-indigo-50/50' : ''}`}
                    >
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
                        {formatCurrency(Number(loan.principal_outstanding || 0) + Number(loan.interest_outstanding || 0) + Number(loan.penalty_outstanding || 0))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                            <AnimatedProgressBar percentage={recovery} />
                            <span className="text-[10px] font-bold text-gray-400">{(Number(recovery) || 0).toFixed(0)}%</span>
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
                          <button onClick={() => { setDeleteLoanId(loan.id); setDeleteReason(''); setShowDeleteModal(true); }} className="text-red-600 hover:text-red-900" title="Delete">
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
                            {loan.status === 'pending' && canReviewLoan()
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

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-200 flex-1">
          {loading ? (
            Array.from({length:5}).map((_,i)=><SkeletonCard key={i}/>)
          ) : loans.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500">No loans found matching filter.</div>
          ) : (
            loans.map((loan, i) => {
              const recovery = loan.principal_amount > 0 ? ((Number(loan.principal_amount) - Number(loan.principal_outstanding)) / Number(loan.principal_amount)) * 100 : 0;
              const overdue = isOverdue(loan);
              const isSelected = selectedIds.has(loan.id);

              return (
                <div 
                  key={loan.id} 
                  className={`p-4 hover:bg-gray-50 transition-colors ${overdue ? 'bg-red-50/30' : ''} ${isSelected ? 'bg-indigo-50/50' : ''}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                      {isExec && filter === 'pending' && (
                        <button
                          onClick={() => toggleSelect(loan.id)}
                          className={`p-1 mr-2 rounded transition-all ${isSelected ? 'text-indigo-600' : 'text-gray-300 hover:text-gray-400'}`}
                        >
                          {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                        </button>
                      )}
                      <div>
                        <Link to={`/loans/${loan.id}`} className="text-sm font-bold text-gray-900 hover:text-indigo-600 hover:underline">
                          {loan.borrowers?.full_name}
                        </Link>
                        <div className="text-[10px] text-indigo-600 font-bold flex items-center mt-0.5">
                          <Hash className="h-2.5 w-2.5 mr-0.5" /> {loan.reference_no || 'NO REF'}
                        </div>
                      </div>
                      {overdue && (
                        <div className="ml-2 text-red-600" title="Overdue (30d+)">
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`px-2 inline-flex text-[10px] leading-4 font-semibold rounded-full ${getStatusColor(loan.status)}`}>
                        {loan.status === 'pending' && <Clock className="w-2.5 h-2.5 mr-1" />}
                        {loan.status === 'reassess' ? 'Reassess' : loan.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Principal</p>
                      <p className="text-sm font-medium text-gray-900">{formatCurrency(loan.principal_amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Outstanding</p>
                      <p className="text-sm font-bold text-gray-900">
                        {formatCurrency(Number(loan.principal_outstanding || 0) + Number(loan.interest_outstanding || 0) + Number(loan.penalty_outstanding || 0))}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <AnimatedProgressBar percentage={recovery} />
                      <span className="text-[10px] font-bold text-gray-400">{(Number(recovery) || 0).toFixed(0)}% Recovery</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {(effectiveRoles.includes('admin') || effectiveRoles.includes('ceo') || (effectiveRoles.includes('loan_officer') && loan.status !== 'active' && loan.status !== 'completed')) && (
                        <button onClick={() => { setDeleteLoanId(loan.id); setDeleteReason(''); setShowDeleteModal(true); }} className="text-red-600 hover:text-red-900" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      {effectiveRoles.includes('loan_officer') && (loan.status === 'rejected' || loan.status === 'reassess') && (
                        <Link to={`/loans/edit/${loan.id}`} className="text-indigo-600 hover:text-indigo-900" title="Edit">
                          <Edit className="h-4 w-4" />
                        </Link>
                      )}
                      <Link to={`/loans/${loan.id}`} className="text-indigo-600 hover:text-indigo-900 flex items-center text-xs font-bold">
                        Details <ChevronRight className="ml-0.5 h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
          )}
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
                        title="Deselect all loans"
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
                      <button onClick={() => setShowApproveModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Close modal"><X className="h-5 w-5 text-indigo-300" /></button>
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
                              {accounts.filter(acc => 
                                acc.name.toLowerCase().includes('main bank') || 
                                acc.name.toLowerCase().includes('cash')
                              ).map(acc => (
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
                      <button onClick={() => setShowDeleteModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Close modal"><X className="h-5 w-5 text-red-200" /></button>
                  </div>
                   <div className="p-8 space-y-5">
                       <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                           <p className="text-xs text-red-700 leading-relaxed">
                               <strong>Warning:</strong> This will permanently delete the loan and all associated data. Any related journal entries will be reversed first to keep the ledger correct. This action cannot be undone.
                           </p>
                       </div>
                       <div>
                           <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Reason (required)</label>
                           <textarea
                             className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 bg-white"
                             rows={3}
                             value={deleteReason}
                             onChange={e => setDeleteReason(e.target.value)}
                             placeholder="Provide a reason for deleting this loan..."
                           />
                       </div>
                       <div className="pt-4 flex gap-3">
                           <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all">Cancel</button>
                           <button onClick={handleDelete} disabled={isProcessing || !deleteReason.trim()} className="flex-2 px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all disabled:bg-gray-400 shadow-lg shadow-red-100">
                               {isProcessing ? 'Deleting...' : 'Delete Permanently'}
                           </button>
                       </div>
                   </div>
              </div>
          </div>
      )}
    </div>
);
};
