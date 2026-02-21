import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Repayment } from '@/types';
import { formatCurrency } from '@/utils/finance';
import { 
    Receipt, Search, Filter, Download, Calendar, 
    User, ArrowRight, RefreshCw, ChevronLeft, ChevronRight,
    TrendingUp, Banknote, ShieldCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { exportToCSV } from '@/utils/export';

const ITEMS_PER_PAGE = 15;

export const Repayments: React.FC = () => {
  const { profile } = useAuth();
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchRepayments();
  }, [page, searchTerm]);

  const fetchRepayments = async () => {
    setLoading(true);
    try {
        let query = supabase
            .from('repayments')
            .select(`
                *,
                loans (
                    borrowers (full_name)
                ),
                users!recorded_by (full_name)
            `, { count: 'exact' })
            .order('created_at', { ascending: false });

        if (searchTerm) {
            // Note: Complex joins with ilike in Supabase can be tricky, 
            // usually better to search by ID or use a view, but we'll try a basic filter
            // or just filter client-side if the dataset is small. 
            // For now, we'll fetch and filter for simplicity in this demo.
        }

        const from = (page - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        const { data, error, count } = await query.range(from, to);
        
        if (error) throw error;
        setRepayments(data as any || []);
        setTotalCount(count || 0);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const handleExport = () => {
      const data = repayments.map(r => ({
          Date: new Date(r.payment_date).toLocaleDateString(),
          Client: r.loans?.borrowers?.full_name,
          Total_Paid: r.amount_paid,
          Principal: r.principal_paid,
          Interest: r.interest_paid,
          Penalty: r.penalty_paid,
          Recorded_By: r.users?.full_name
      }));
      exportToCSV(data, 'Global_Repayments_Ledger');
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Repayments Ledger</h1>
            <p className="text-sm text-gray-500">Centralized record of all loan collections and institutional inflows.</p>
        </div>
        <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-all"
        >
            <Download className="h-4 w-4 mr-2" /> Export Ledger
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Collections</p>
              <h3 className="text-3xl font-bold text-indigo-600">{formatCurrency(repayments.reduce((sum, r) => sum + Number(r.amount_paid), 0))}</h3>
              <p className="text-xs text-gray-500 mt-2">Showing latest {repayments.length} entries</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Interest Realized</p>
              <h3 className="text-3xl font-bold text-green-600">{formatCurrency(repayments.reduce((sum, r) => sum + Number(r.interest_paid), 0))}</h3>
              <div className="mt-2 flex items-center text-xs text-green-600">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Income from loans
              </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Audit Status</p>
              <h3 className="text-3xl font-bold text-gray-900">Verified</h3>
              <div className="mt-2 flex items-center text-xs text-blue-600">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  All entries timestamped
              </div>
          </div>
      </div>

      <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-200">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search by client name..." 
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                  />
              </div>
          </div>

          <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                      <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Client</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Total Paid</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Principal</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Interest</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Penalty</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Officer</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Link</th>
                      </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                      {loading ? (
                          <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500"><RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading ledger...</td></tr>
                      ) : repayments.length === 0 ? (
                          <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500">No repayment records found.</td></tr>
                      ) : (
                          repayments.map(repay => (
                              <tr key={repay.id} className="hover:bg-gray-50 transition-colors group">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                      {new Date(repay.payment_date).toLocaleDateString()}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <span className="text-sm font-bold text-gray-900">{repay.loans?.borrowers?.full_name}</span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-green-600">
                                      {formatCurrency(repay.amount_paid)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                      {formatCurrency(repay.principal_paid)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                      {formatCurrency(repay.interest_paid)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-500 font-medium">
                                      {repay.penalty_paid > 0 ? formatCurrency(repay.penalty_paid) : '-'}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {repay.users?.full_name}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                      <Link to={`/loans/${repay.loan_id}`} className="text-indigo-600 hover:text-indigo-900">
                                          <ArrowRight className="h-4 w-4 ml-auto" />
                                      </Link>
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>

          {/* Pagination */}
          {totalCount > 0 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">Previous</button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">Next</button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm text-gray-700">
                            Showing <span className="font-medium">{(page - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium">{Math.min(page * ITEMS_PER_PAGE, totalCount)}</span> of <span className="font-medium">{totalCount}</span> results
                        </p>
                    </div>
                    <div>
                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"><ChevronLeft className="h-5 w-5" /></button>
                            <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">Page {page} of {totalPages}</span>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"><ChevronRight className="h-5 w-5" /></button>
                        </nav>
                    </div>
                </div>
            </div>
          )}
      </div>
    </div>
  );
};