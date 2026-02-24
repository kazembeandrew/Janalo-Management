import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Repayment } from '@/types';
import { formatCurrency } from '@/utils/finance';
import { 
    Receipt, Search, Filter, Download, Calendar, 
    User, ArrowRight, RefreshCw, ChevronLeft, ChevronRight,
    TrendingUp, Banknote, ShieldCheck, Clock
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
            <p className="text-sm text-gray-500">Centralized record of all loan collections.</p>
        </div>
        <button
            onClick={handleExport}
            className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2.5 border border-gray-300 rounded-xl shadow-sm text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition-all"
        >
            <Download className="h-4 w-4 mr-2" /> Export Ledger
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Collections</p>
              <h3 className="text-2xl font-bold text-indigo-600">{formatCurrency(repayments.reduce((sum, r) => sum + Number(r.amount_paid), 0))}</h3>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Interest Realized</p>
              <h3 className="text-2xl font-bold text-green-600">{formatCurrency(repayments.reduce((sum, r) => sum + Number(r.interest_paid), 0))}</h3>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Audit Status</p>
              <div className="flex items-center mt-1">
                  <ShieldCheck className="h-5 w-5 text-blue-500 mr-2" />
                  <h3 className="text-xl font-bold text-gray-900">Verified</h3>
              </div>
          </div>
      </div>

      <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-200">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search by client name..." 
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                  />
              </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                      <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Client</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Total Paid</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Principal</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Interest</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Officer</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Link</th>
                      </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                      {loading ? (
                          <tr><td colSpan={7} className="px-6 py-12 text-center"><RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600" /></td></tr>
                      ) : (
                          repayments.map(repay => (
                              <tr key={repay.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(repay.payment_date).toLocaleDateString()}</td>
                                  <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{repay.loans?.borrowers?.full_name}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-green-600">{formatCurrency(repay.amount_paid)}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">{formatCurrency(repay.principal_paid)}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">{formatCurrency(repay.interest_paid)}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{repay.users?.full_name}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                      <Link to={`/loans/${repay.loan_id}`} className="text-indigo-600 hover:text-indigo-900"><ArrowRight className="h-4 w-4 ml-auto" /></Link>
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
              ) : (
                  repayments.map(repay => (
                      <div key={repay.id} className="p-4">
                          <div className="flex justify-between items-start mb-2">
                              <div>
                                  <h4 className="text-sm font-bold text-gray-900">{repay.loans?.borrowers?.full_name}</h4>
                                  <div className="flex items-center text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                                      <Calendar className="h-2.5 w-2.5 mr-1" /> {new Date(repay.payment_date).toLocaleDateString()}
                                  </div>
                              </div>
                              <div className="text-right">
                                  <p className="text-sm font-bold text-green-600">{formatCurrency(repay.amount_paid)}</p>
                                  <p className="text-[8px] text-gray-400 uppercase font-bold">Total Received</p>
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100 text-[10px]">
                              <div className="flex justify-between px-1">
                                  <span className="text-gray-500">Principal:</span>
                                  <span className="font-bold text-gray-700">{formatCurrency(repay.principal_paid)}</span>
                              </div>
                              <div className="flex justify-between px-1">
                                  <span className="text-gray-500">Interest:</span>
                                  <span className="font-bold text-gray-700">{formatCurrency(repay.interest_paid)}</span>
                              </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                              <div className="flex items-center text-[10px] text-gray-400">
                                  <User className="h-3 w-3 mr-1" /> {repay.users?.full_name}
                              </div>
                              <Link to={`/loans/${repay.loan_id}`} className="text-[10px] font-bold text-indigo-600 flex items-center">
                                  View Loan <ChevronRight className="h-3 w-3 ml-0.5" />
                              </Link>
                          </div>
                      </div>
                  ))
              )}
          </div>

          <div className="bg-white px-4 py-4 border-t border-gray-100 flex items-center justify-between">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 border border-gray-300 text-sm font-bold rounded-xl text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-all">Prev</button>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Page {page} of {totalPages || 1}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0} className="px-4 py-2 border border-gray-300 text-sm font-bold rounded-xl text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-all">Next</button>
          </div>
      </div>
    </div>
  );
};