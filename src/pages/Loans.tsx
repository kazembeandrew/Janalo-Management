import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Loan } from '@/types';
import { formatCurrency } from '@/utils/finance';
import { exportToCSV } from '@/utils/export';
import { Plus, Filter, ChevronRight, Clock, ChevronLeft, Download, Calendar, User, Banknote, RefreshCw } from 'lucide-react';

const ITEMS_PER_PAGE = 10;

export const Loans: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const isExec = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo');
  const isOfficer = effectiveRoles.includes('loan_officer');

  useEffect(() => {
    fetchLoans();

    const channel = supabase
      .channel('loans-list-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => {
          fetchLoans();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, filter, page, effectiveRoles]);

  const handleFilterChange = (newFilter: string) => {
      setFilter(newFilter);
      setPage(1);
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

      if (isOfficer && !isExec) {
        query = query.eq('officer_id', profile?.id);
      }

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      
      const { data, error, count } = await query.range(from, to);

      if (error) throw error;
      
      setLoans(data as Loan[]);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching loans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
      const exportData = loans.map(l => ({
          Borrower: l.borrowers?.full_name,
          Principal: l.principal_amount,
          Outstanding: l.principal_outstanding + l.interest_outstanding + (loan.penalty_outstanding || 0),
          Term: l.term_months,
          Status: l.status,
          Date: new Date(l.created_at).toLocaleDateString()
      }));
      exportToCSV(exportData, 'Janalo_Loans_Export');
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'defaulted': return 'bg-red-100 text-red-800';
      case 'rejected': return 'bg-gray-100 text-gray-500 line-through';
      case 'reassess': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loan Portfolio</h1>
          <p className="text-sm text-gray-500">View and manage all loans</p>
        </div>
        <div className="flex w-full sm:w-auto space-x-2">
            <button
                onClick={handleExport}
                className="flex-1 sm:flex-none inline-flex justify-center items-center px-4 py-2.5 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
                <Download className="h-4 w-4 mr-2" />
                Export
            </button>
            {effectiveRoles.includes('loan_officer') && (
            <Link
                to="/loans/new"
                className="flex-1 sm:flex-none inline-flex justify-center items-center px-4 py-2.5 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-indigo-900 hover:bg-indigo-800"
            >
                <Plus className="h-4 w-4 mr-2" />
                New Loan
            </Link>
            )}
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-2xl overflow-hidden flex flex-col border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center space-x-4 bg-gray-50/50">
            <Filter className="h-5 w-5 text-gray-400" />
            <select
                value={filter}
                onChange={(e) => handleFilterChange(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-xl bg-white"
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

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Borrower</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Outstanding</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Term</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="relative px-6 py-3"><span className="sr-only">View</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center"><RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600" /></td></tr>
              ) : loans.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">No loans found.</td></tr>
              ) : (
                loans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">{loan.borrowers?.full_name}</div>
                      <div className="text-[10px] text-gray-400 uppercase font-bold">{new Date(loan.created_at).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(loan.principal_amount)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600">
                      {formatCurrency(loan.principal_outstanding + loan.interest_outstanding + (loan.penalty_outstanding || 0))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{loan.term_months} Mo ({loan.interest_type})</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-[10px] font-bold rounded-full uppercase border ${getStatusColor(loan.status)}`}>
                        {loan.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link to={`/loans/${loan.id}`} className="text-indigo-600 hover:text-indigo-900 flex items-center justify-end font-bold">
                        Details <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
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
                <div className="p-12 text-center"><RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></div>
            ) : loans.length === 0 ? (
                <div className="p-12 text-center text-sm text-gray-500">No loans found.</div>
            ) : (
                loans.map((loan) => (
                    <Link key={loan.id} to={`/loans/${loan.id}`} className="block p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">{loan.borrowers?.full_name}</h3>
                                <div className="flex items-center text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                                    <Calendar className="h-2.5 w-2.5 mr-1" /> {new Date(loan.created_at).toLocaleDateString()}
                                </div>
                            </div>
                            <span className={`px-2 py-0.5 text-[8px] font-bold rounded-full uppercase border ${getStatusColor(loan.status)}`}>
                                {loan.status}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <div>
                                <p className="text-[8px] text-gray-400 uppercase font-bold tracking-wider">Principal</p>
                                <p className="text-xs font-bold text-gray-700">{formatCurrency(loan.principal_amount)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[8px] text-gray-400 uppercase font-bold tracking-wider">Outstanding</p>
                                <p className="text-xs font-bold text-indigo-600">
                                    {formatCurrency(loan.principal_outstanding + loan.interest_outstanding + (loan.penalty_outstanding || 0))}
                                </p>
                            </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-[10px] text-gray-500 font-medium">
                            <div className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" /> {loan.term_months} Months
                            </div>
                            <div className="flex items-center text-indigo-600 font-bold">
                                View Details <ChevronRight className="h-3 w-3 ml-0.5" />
                            </div>
                        </div>
                    </Link>
                )
            ))}
        </div>

        <div className="bg-white px-4 py-4 border-t border-gray-100 flex items-center justify-between sm:px-6">
            <div className="flex-1 flex justify-between items-center">
                <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-bold rounded-xl text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-all"
                >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </button>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                    Page {page} of {totalPages || 1}
                </span>
                <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || totalPages === 0 || loading}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-bold rounded-xl text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-all"
                >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};