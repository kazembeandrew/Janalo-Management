import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Loan } from '@/types';
import { calculateLoanDetails, formatCurrency } from '@/utils/finance';
import { exportToCSV, generateTablePDF } from '@/utils/export';
import { 
    Calendar, Search, Download, FileText, Printer, 
    Filter, ChevronLeft, ChevronRight, RefreshCw, 
    Table as TableIcon, ListFilter, Banknote, ArrowUpDown
} from 'lucide-react';

export const RepaymentSchedule: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date_recent');
  
  const isExec = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo') || effectiveRoles.includes('accountant');

  useEffect(() => {
    fetchActiveLoans();
  }, [profile]);

  const fetchActiveLoans = async () => {
    if (!profile) return;
    setLoading(true);
    try {
        let query = supabase
            .from('loans')
            .select('*, borrowers(full_name), users!officer_id(full_name)')
            .eq('status', 'active');
        
        // Filter by officer if not an executive/accountant
        if (!isExec) {
            query = query.eq('officer_id', profile.id);
        }

        const { data, error } = await query;
        
        if (error) throw error;
        setLoans(data as any || []);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  // Generate the master flattened schedule
  const masterSchedule = useMemo(() => {
      const allInstallments: any[] = [];

      loans.forEach(loan => {
          const { schedule } = calculateLoanDetails(
              loan.principal_amount,
              loan.interest_rate,
              loan.term_months,
              loan.interest_type
          );

          const startDate = new Date(loan.disbursement_date);

          schedule.forEach(item => {
              const dueDate = new Date(startDate);
              dueDate.setMonth(startDate.getMonth() + item.month);
              const monthStr = dueDate.toISOString().substring(0, 7);

              allInstallments.push({
                  loanId: loan.id,
                  borrower: loan.borrowers?.full_name,
                  officer: loan.users?.full_name,
                  installmentNo: item.month,
                  dueDate: dueDate.toLocaleDateString(),
                  monthKey: monthStr,
                  amount: item.installment,
                  principal: item.principal,
                  interest: item.interest,
                  balance: item.balance
              });
          });
      });

      // Sort based on sortBy
      return allInstallments.sort((a, b) => {
          switch (sortBy) {
              case 'date_recent':
                  return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
              case 'date_oldest':
                  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
              case 'borrower_asc':
                  return (a.borrower || '').localeCompare(b.borrower || '');
              case 'borrower_desc':
                  return (b.borrower || '').localeCompare(a.borrower || '');
              case 'amount_high':
                  return b.amount - a.amount;
              case 'amount_low':
                  return a.amount - b.amount;
              default:
                  return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
          }
      });
  }, [loans, sortBy]);

  const filteredSchedule = masterSchedule.filter(item => {
      const matchesSearch = item.borrower?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           item.officer?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
  });

  const handleExportCSV = () => {
      const data = filteredSchedule.map(item => ({
          Due_Date: item.dueDate,
          Borrower: item.borrower,
          Officer: item.officer,
          Installment: item.installmentNo,
          Amount: item.amount.toFixed(2),
          Principal: item.principal.toFixed(2),
          Interest: item.interest.toFixed(2),
          Remaining_Balance: item.balance.toFixed(2)
      }));
      exportToCSV(data, `Repayment_Schedule_All`);
  };

  const handleExportPDF = () => {
      const headers = ['Due Date', 'Borrower', 'Inst #', 'Amount (MK)', 'Principal', 'Interest'];
      const rows = filteredSchedule.map(item => [
          item.dueDate,
          item.borrower,
          item.installmentNo,
          item.amount.toFixed(2),
          item.principal.toFixed(2),
          item.interest.toFixed(2)
      ]);
      generateTablePDF(`Repayment Schedule - All Installments`, headers, rows, `Schedule_All`);
  };

  if (loading) return <div className="p-12 text-center"><RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></div>;

  const totalDue = filteredSchedule.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Repayment Schedule</h1>
            <p className="text-sm text-gray-500">
                {isExec ? 'Master projection of all expected installments across the portfolio.' : 'All upcoming client installments across your portfolio.'}
            </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
            <button
                onClick={handleExportCSV}
                className="flex-1 sm:flex-none inline-flex justify-center items-center px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all shadow-sm"
            >
                <Download className="h-4 w-4 mr-2 text-green-600" /> Excel
            </button>
            <button
                onClick={handleExportPDF}
                className="flex-1 sm:flex-none inline-flex justify-center items-center px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all shadow-sm"
            >
                <FileText className="h-4 w-4 mr-2 text-red-600" /> PDF
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Expected Collections</p>
              <h3 className="text-2xl font-bold text-indigo-600">{formatCurrency(totalDue)}</h3>
              <p className="text-[10px] text-gray-500 mt-1">Total expected across all periods</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Installment Count</p>
              <h3 className="text-2xl font-bold text-gray-900">{filteredSchedule.length}</h3>
              <p className="text-[10px] text-gray-500 mt-1">All active installments</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Portfolio Coverage</p>
              <div className="flex items-center mt-1">
                  <Banknote className="h-5 w-5 text-green-500 mr-2" />
                  <h3 className="text-xl font-bold text-gray-900">{loans.length} Active Loans</h3>
              </div>
          </div>
      </div>

      <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-200">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input 
                        type="text" 
                        placeholder="Search borrower or officer..." 
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                  </div>
                  <div className="relative">
                      <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <select
                        className="pl-10 pr-8 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        aria-label="Sort repayment schedule"
                      >
                        <option value="date_recent">Recent dates first</option>
                        <option value="date_oldest">Oldest dates first</option>
                        <option value="borrower_asc">Borrower A-Z</option>
                        <option value="borrower_desc">Borrower Z-A</option>
                        <option value="amount_high">Amount High-Low</option>
                        <option value="amount_low">Amount Low-High</option>
                      </select>
                  </div>
              </div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Showing {filteredSchedule.length} Installments
              </div>
          </div>

          <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                      <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Due Date</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Borrower</th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Inst #</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Principal</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Interest</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Officer</th>
                      </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                      {filteredSchedule.length === 0 ? (
                          <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500 italic">No installments match your search.</td></tr>
                      ) : (
                          filteredSchedule.map((item, idx) => (
                              <tr key={`${item.loanId}-${item.installmentNo}`} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.dueDate}</td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <Link to={`/loans/${item.loanId}`} className="text-sm font-bold text-indigo-600 hover:underline">
                                          {item.borrower}
                                      </Link>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-center text-xs text-gray-500 font-bold">
                                      {item.installmentNo}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                                      {formatCurrency(item.amount)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                      {formatCurrency(item.principal)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                                      {formatCurrency(item.interest)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {item.officer}
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};