import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Loan, Repayment } from '@/types';
import { formatCurrency } from '@/utils/finance';
import { 
    Calendar, Phone, CheckCircle, AlertCircle, Clock, 
    ChevronRight, TrendingUp, Receipt, Filter, Download, Search 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { exportToCSV } from '@/utils/export';

export const Collections: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [upcomingLoans, setUpcomingLoans] = useState<Loan[]>([]);
  const [dailyRepayments, setDailyRepayments] = useState<any[]>([]);
  const [stats, setStats] = useState({
      overdueCount: 0,
      mtdCollected: 0,
      expectedThisMonth: 0,
      efficiency: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const isAccountant = effectiveRoles.includes('accountant') || effectiveRoles.includes('admin');

  useEffect(() => {
    fetchCollectionData();
  }, [profile, effectiveRoles]);

  const fetchCollectionData = async () => {
    if (!profile) return;
    setLoading(true);
    
    try {
      // 1. Fetch active loans
      let loanQuery = supabase
        .from('loans')
        .select('*, borrowers(*)')
        .eq('status', 'active');

      if (effectiveRoles.includes('loan_officer') && !effectiveRoles.includes('admin')) {
        loanQuery = loanQuery.eq('officer_id', profile.id);
      }

      const { data: loans } = await loanQuery;
      
      // 2. Fetch MTD Repayments
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const startStr = startOfMonth.toISOString().split('T')[0];

      let repayQuery = supabase
        .from('repayments')
        .select('*, loans(borrowers(full_name))')
        .gte('payment_date', startStr);
      
      if (effectiveRoles.includes('loan_officer') && !effectiveRoles.includes('admin')) {
          repayQuery = repayQuery.eq('recorded_by', profile.id);
      }

      const { data: repayments } = await repayQuery;

      // 3. Calculate Stats
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const overdue = loans?.filter(l => new Date(l.updated_at) < thirtyDaysAgo) || [];
      const mtdTotal = repayments?.reduce((sum, r) => sum + Number(r.amount_paid), 0) || 0;
      
      // Expected is sum of monthly installments for all active loans
      const expected = loans?.reduce((sum, l) => sum + Number(l.monthly_installment), 0) || 0;
      
      setStats({
          overdueCount: overdue.length,
          mtdCollected: mtdTotal,
          expectedThisMonth: expected,
          efficiency: expected > 0 ? (mtdTotal / expected) * 100 : 0
      });

      setUpcomingLoans(loans || []);
      setDailyRepayments(repayments || []);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportDaily = () => {
      const data = dailyRepayments.map(r => ({
          Date: r.payment_date,
          Client: r.loans?.borrowers?.full_name,
          Amount: r.amount_paid,
          Principal: r.principal_paid,
          Interest: r.interest_paid,
          Penalty: r.penalty_paid
      }));
      exportToCSV(data, 'Daily_Collection_Report');
  };

  const filteredLoans = upcomingLoans.filter(l => 
    l.borrowers?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Collections & Recovery</h1>
          <p className="text-sm text-gray-500">Monitor repayment performance and track daily inflows.</p>
        </div>
        <button
            onClick={handleExportDaily}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
            <Download className="h-4 w-4 mr-2" /> Export Daily Log
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">MTD Collected</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(stats.mtdCollected)}</p>
              <div className="mt-2 flex items-center text-[10px] text-gray-500">
                  <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                  Target: {formatCurrency(stats.expectedThisMonth)}
              </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Collection Efficiency</p>
              <p className="text-xl font-bold text-indigo-600">{stats.efficiency.toFixed(1)}%</p>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                  <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, stats.efficiency)}%` }}></div>
              </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Overdue Accounts</p>
              <p className="text-xl font-bold text-red-600">{stats.overdueCount}</p>
              <p className="text-[10px] text-gray-500 mt-2">Portfolio At Risk (30d+)</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Active Portfolio</p>
              <p className="text-xl font-bold text-gray-900">{upcomingLoans.length}</p>
              <p className="text-[10px] text-gray-500 mt-2">Total Active Contracts</p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Tracking */}
          <div className="lg:col-span-2 bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h3 className="font-bold text-gray-900 flex items-center">
                    <Clock className="h-4 w-4 mr-2 text-indigo-600" />
                    Repayment Tracking
                </h3>
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Search client..." 
                        className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                    <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Borrower</th>
                    <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Installment</th>
                    <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Outstanding</th>
                    <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-500 uppercase">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                    {loading ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-xs text-gray-500">Loading portfolio...</td></tr>
                    ) : filteredLoans.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-xs text-gray-500">No active loans found.</td></tr>
                    ) : (
                    filteredLoans.map(loan => (
                        <tr key={loan.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900">{loan.borrowers?.full_name}</div>
                            <div className="text-[10px] text-gray-500 flex items-center mt-0.5">
                                <Phone className="h-2.5 w-2.5 mr-1" /> {loan.borrowers?.phone}
                            </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
                            {formatCurrency(loan.monthly_installment)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 font-medium">
                                {formatCurrency(loan.principal_outstanding + loan.interest_outstanding + (loan.penalty_outstanding || 0))}
                            </div>
                            {loan.penalty_outstanding > 0 && (
                                <div className="text-[10px] text-red-600 font-bold">Incl. {formatCurrency(loan.penalty_outstanding)} Penalty</div>
                            )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link 
                                to={`/loans/${loan.id}`}
                                className="inline-flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
                            >
                                View <ChevronRight className="h-3 w-3 ml-1" />
                            </Link>
                        </td>
                        </tr>
                    ))
                    )}
                </tbody>
                </table>
            </div>
          </div>

          {/* Daily Log */}
          <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200 flex flex-col">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="font-bold text-gray-900 flex items-center">
                      <Receipt className="h-4 w-4 mr-2 text-green-600" />
                      MTD Collection Log
                  </h3>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[500px] custom-scrollbar">
                  {dailyRepayments.length === 0 ? (
                      <div className="p-8 text-center text-xs text-gray-400 italic">No collections recorded this month.</div>
                  ) : (
                      <div className="divide-y divide-gray-50">
                          {dailyRepayments.map(repay => (
                              <div key={repay.id} className="p-4 hover:bg-gray-50 transition-colors">
                                  <div className="flex justify-between items-start mb-1">
                                      <span className="text-xs font-bold text-gray-900">{repay.loans?.borrowers?.full_name}</span>
                                      <span className="text-xs font-bold text-green-600">{formatCurrency(repay.amount_paid)}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                      <span className="text-[10px] text-gray-400">{new Date(repay.payment_date).toLocaleDateString()}</span>
                                      <div className="flex gap-2">
                                          {repay.penalty_paid > 0 && <span className="text-[8px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold">Penalty</span>}
                                          <span className="text-[8px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold">Verified</span>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
              <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
                  <p className="text-[10px] text-gray-500 font-medium">Showing latest {dailyRepayments.length} entries</p>
              </div>
          </div>
      </div>
    </div>
  );
};