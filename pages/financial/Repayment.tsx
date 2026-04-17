import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLoans } from '@/hooks/useLoans';
import { useRepayments } from '@/hooks/useRepayments';
import { useAccounts } from '@/hooks/useAccounts';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { formatCurrency } from '@/utils/finance';
import toast from 'react-hot-toast';
import {
  DollarSign,
  Search,
  Calendar,
  Users,
  Eye,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  BarChart3,
  FileText,
  Download,
  Filter
} from 'lucide-react';

interface RepaymentRequest {
  id: string;
  loan_reference: string;
  borrower_name: string;
  amount_due: number;
  due_date: string;
  status: string;
}

export const Repayment: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const { loans, filteredLoans, fetchLoans } = useLoans();
  const { repayments, createRepayment, isLoading, error } = useRepayments();
  const { accounts, fetchAccounts } = useAccounts();
  const { performSearch, searchQuery, updateSearchQuery } = useGlobalSearch();

  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedRepayments, setSelectedRepayments] = useState<string[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [activeSchedule, setActiveSchedule] = useState<RepaymentRequest | null>(null);
  const [repaymentAmount, setRepaymentAmount] = useState<string>('');
  const [transactionFee, setTransactionFee] = useState<string>('0');
  const [bulkLoading, setBulkLoading] = useState(false);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const isAuthorized = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo') || effectiveRoles.includes('accountant');

  useEffect(() => {
    if (isAuthorized) {
      fetchLoans();
      fetchAccounts();
    }
  }, [isAuthorized]);

  // Calculate repayment schedules for active loans
  const getRepaymentSchedules = () => {
    const schedules: RepaymentRequest[] = [];
    
    filteredLoans.forEach(loan => {
      if (loan.status === 'active') {
        const loanRepayments = repayments.filter(r => r.loan_id === loan.id);
        const monthsPaid = loanRepayments.length;
        
        // Generate next payment if not completed
        if (monthsPaid < loan.term_months) {
          const nextDueDate = new Date(loan.disbursement_date);
          nextDueDate.setMonth(nextDueDate.getMonth() + monthsPaid + 1);
          
          schedules.push({
            id: `${loan.id}-${monthsPaid + 1}`,
            loan_reference: loan.reference_no,
            borrower_name: loan.borrowers?.full_name || 'Unknown',
            amount_due: loan.monthly_payment,
            due_date: nextDueDate.toISOString().split('T')[0],
            status: 'pending'
          });
        }
      }
    });

    return schedules;
  };

  const repaymentSchedules = getRepaymentSchedules();

  // Apply filters
  const filteredSchedules = repaymentSchedules.filter(schedule => {
    const matchesStatus = statusFilter === 'all' || schedule.status === statusFilter;
    const matchesDate = (!dateFrom || schedule.due_date >= dateFrom) && (!dateTo || schedule.due_date <= dateTo);
    return matchesStatus && matchesDate;
  });

  const handleRepaymentSelection = (scheduleId: string) => {
    setSelectedRepayments(prev => 
      prev.includes(scheduleId) 
        ? prev.filter(id => id !== scheduleId)
        : [...prev, scheduleId]
    );
  };

  const handleSelectAll = () => {
    setSelectedRepayments(filteredSchedules.map(s => s.id));
  };

  const handleClearSelection = () => {
    setSelectedRepayments([]);
  };

  const handleSingleRepayment = (schedule: RepaymentRequest) => {
    setActiveSchedule(schedule);
    setRepaymentAmount(schedule.amount_due.toString());
    setTransactionFee('0');
    setShowSingleModal(true);
  };

  const processSingleRepayment = async () => {
    if (!activeSchedule || !selectedAccount || !paymentDate) {
      toast.error('Please complete all fields');
      return;
    }

    try {
      const loan = loans.find(l => l.reference_no === activeSchedule.loan_reference);
      if (!loan) throw new Error('Loan not found');

      await createRepayment({
        loan_id: loan.id,
        amount_paid: parseFloat(repaymentAmount),
        payment_date: paymentDate,
        target_account_id: selectedAccount,
        transaction_fee: parseFloat(transactionFee),
        notes: `Manual repayment for ${activeSchedule.loan_reference}`
      });
      
      toast.success(`Payment recorded for ${activeSchedule.loan_reference}`);
      setShowSingleModal(false);
      setActiveSchedule(null);
      fetchLoans();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record payment');
    }
  };

  const handleBulkRepayment = async () => {
    if (selectedRepayments.length === 0) {
      toast.error('Please select payments to process');
      return;
    }
    if (!selectedAccount || !paymentDate) {
      toast.error('Please select an account and payment date');
      return;
    }

    setBulkLoading(true);
    try {
      const selectedSchedules = repaymentSchedules.filter(s => selectedRepayments.includes(s.id));
      
      const repaymentPromises = selectedSchedules.map(async (schedule) => {
        const loan = loans.find(l => l.reference_no === schedule.loan_reference);
        if (loan) {
          return createRepayment({
            loan_id: loan.id,
            amount_paid: schedule.amount_due,
            payment_date: paymentDate,
            payment_method: 'cash',
            target_account_id: selectedAccount,
            notes: `Bulk repayment for ${schedule.loan_reference}`
          });
        }
      });

      await Promise.all(repaymentPromises);
      toast.success(`${selectedRepayments.length} payments processed successfully`);
      setSelectedRepayments([]);
      setShowBulkModal(false);
    } catch (error) {
      toast.error('Failed to process some payments');
    } finally {
      setBulkLoading(false);
    }
  };

  const getRepaymentStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRepaymentSummary = () => {
    const selectedSchedules = repaymentSchedules.filter(s => selectedRepayments.includes(s.id));
    const totalAmount = selectedSchedules.reduce((sum, schedule) => sum + schedule.amount_due, 0);
    return {
      count: selectedSchedules.length,
      totalAmount,
      averageAmount: selectedSchedules.length > 0 ? totalAmount / selectedSchedules.length : 0
    };
  };

  const summary = getRepaymentSummary();

  // Calculate overdue payments
  const overduePayments = repaymentSchedules.filter(s => {
    const dueDate = new Date(s.due_date);
    const today = new Date();
    return dueDate < today && s.status === 'pending';
  });

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">You are not authorized to access this page</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loan Repayment</h1>
          <p className="text-gray-600">Process and manage loan repayments</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => fetchLoans(true)}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Clock className="h-4 w-4 mr-2" />
            Refresh
          </button>
          {selectedRepayments.length > 0 && (
            <button
              onClick={() => setShowBulkModal(true)}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Process Payments ({selectedRepayments.length})
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Due</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(repaymentSchedules.reduce((sum, s) => sum + s.amount_due, 0))}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Overdue Payments</p>
              <p className="text-2xl font-bold text-gray-900">{overduePayments.length}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Selected for Payment</p>
              <p className="text-2xl font-bold text-gray-900">{summary.count}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalAmount)}</p>
            </div>
            <BarChart3 className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by reference or borrower..."
                value={searchQuery}
                onChange={(e) => updateSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Account</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select account...</option>
              {accounts.filter(a => ['bank', 'cash', 'mobile'].includes(a.type || '') || (a.account_category === 'asset' && !a.code.includes('PORTFOLIO'))).map(account => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Date</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSelectAll}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={handleClearSelection}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Clear Selection
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <button className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              <FileText className="h-4 w-4 mr-2" />
              Export Report
            </button>
            <button className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </button>
          </div>
        </div>
      </div>

      {/* Repayment Schedule */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Repayment Schedule</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    onChange={(e) => e.target.checked ? handleSelectAll() : handleClearSelection()}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Loan Reference
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Borrower
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount Due
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSchedules.map((schedule) => (
                <tr key={schedule.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedRepayments.includes(schedule.id)}
                      onChange={() => handleRepaymentSelection(schedule.id)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {schedule.loan_reference}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {schedule.borrower_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(schedule.amount_due)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {schedule.due_date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRepaymentStatusColor(schedule.status)}`}>
                      {schedule.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleSingleRepayment(schedule)}
                      disabled={!selectedAccount || !paymentDate}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Record Payment
                    </button>
                    <button
                      onClick={() => window.location.href = `/loans/${schedule.loan_reference}`}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View Loan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredSchedules.length === 0 && !isLoading && (
          <div className="px-6 py-12 text-center text-gray-500">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p>No repayment schedules found.</p>
          </div>
        )}
      </div>

      {/* Bulk Payment Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-xl bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Bulk Payment Processing</h3>
              <button
                onClick={() => setShowBulkModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <AlertTriangle className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-900">Selected Payments:</span>
                  <span className="text-sm font-bold text-blue-900">{summary.count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-900">Total Amount:</span>
                  <span className="text-sm font-bold text-blue-900">{formatCurrency(summary.totalAmount)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account</label>
                    <select
                      value={selectedAccount}
                      onChange={(e) => setSelectedAccount(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select account...</option>
                      {accounts.filter(a => ['bank', 'cash', 'mobile'].includes(a.type || '') || (a.account_category === 'asset' && !a.code.includes('PORTFOLIO'))).map(account => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({account.code})
                        </option>
                      ))}
                    </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkRepayment}
                  disabled={bulkLoading || !selectedAccount || !paymentDate || selectedRepayments.length === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {bulkLoading ? 'Processing...' : 'Confirm Bulk Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Single Payment Modal */}
      {showSingleModal && activeSchedule && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 transition-opacity duration-300 flex items-center justify-center p-4">
          <div className="relative mx-auto p-8 border w-full max-w-lg shadow-2xl rounded-2xl bg-white transform transition-all duration-300 scale-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Record Repayment</h3>
                <p className="text-gray-500 text-sm mt-1">Processing payment for {activeSchedule.loan_reference}</p>
              </div>
              <button onClick={() => setShowSingleModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors bg-gray-100 p-2 rounded-full">
                <AlertTriangle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Infobox */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 flex items-center justify-between shadow-inner">
                <div>
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Borrower</p>
                  <p className="text-lg font-bold text-indigo-900">{activeSchedule.borrower_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Standard Installment</p>
                  <p className="text-lg font-bold text-indigo-900">{formatCurrency(activeSchedule.amount_due)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-700">Amount Paid</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="number"
                      value={repaymentAmount}
                      onChange={(e) => setRepaymentAmount(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 shadow-sm transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-700">Target Account</label>
                  <select
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 shadow-sm transition-all bg-white"
                  >
                    <option value="">Select fund account...</option>
                    {accounts.filter(a => ['bank', 'cash', 'mobile'].includes(a.type || '') || (a.account_category === 'asset' && !a.code.includes('PORTFOLIO'))).map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-700">Transaction Fee (if any)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="number"
                      value={transactionFee}
                      onChange={(e) => setTransactionFee(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 shadow-sm transition-all"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 italic">Example: Airtel/Mpamba fee deducted from received amount</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-700">Payment Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 shadow-sm transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end space-x-4 pt-6 border-t border-gray-100">
                <button
                  onClick={() => setShowSingleModal(false)}
                  className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={processSingleRepayment}
                  disabled={isLoading || !selectedAccount || !repaymentAmount}
                  className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl active:scale-95"
                >
                  {isLoading ? 'Processing...' : 'Confirm Repayment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};