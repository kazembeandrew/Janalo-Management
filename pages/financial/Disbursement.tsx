import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLoans } from '@/hooks/useLoans';
import { useAccounts } from '@/hooks/useAccounts';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { formatCurrency } from '@/utils/finance';
import toast from 'react-hot-toast';
import {
  Banknote,
  Search,
  Filter,
  Calendar,
  DollarSign,
  Users,
  Eye,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp
} from 'lucide-react';

interface DisbursementRequest {
  id: string;
  reference_no: string;
  borrower_name: string;
  principal_amount: number;
  status: string;
  created_at: string;
  borrower_id: string;
}

export const Disbursement: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const { loans, filteredLoans, fetchLoans, updateLoan, isLoading, error } = useLoans();
  const { accounts, fetchAccounts } = useAccounts();
  const { performSearch, searchQuery, updateSearchQuery } = useGlobalSearch();

  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [disbursementDate, setDisbursementDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedLoans, setSelectedLoans] = useState<string[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const isAuthorized = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo') || effectiveRoles.includes('accountant');

  const mainBankAccount = accounts.find(account =>
    account.code === 'BANK' || account.name?.toLowerCase().includes('main bank')
  );

  useEffect(() => {
    if (isAuthorized) {
      fetchLoans();
      fetchAccounts();
    }
  }, [isAuthorized]);

  useEffect(() => {
    if (mainBankAccount) {
      setSelectedAccount(mainBankAccount.id);
    }
  }, [mainBankAccount]);

  // Filter loans for disbursement (pending loans)
  const pendingLoans = filteredLoans.filter(loan => loan.status === 'pending');

  const handleLoanSelection = (loanId: string) => {
    setSelectedLoans(prev => 
      prev.includes(loanId) 
        ? prev.filter(id => id !== loanId)
        : [...prev, loanId]
    );
  };

  const handleSelectAll = () => {
    setSelectedLoans(pendingLoans.map(loan => loan.id));
  };

  const handleClearSelection = () => {
    setSelectedLoans([]);
  };

  const handleSingleDisbursement = async (loan: any) => {
    if (!selectedAccount || !disbursementDate) {
      toast.error('Please confirm the Main Bank Account and disbursement date');
      return;
    }

    try {
      await updateLoan(loan.id, {
        status: 'active',
        disbursement_date: disbursementDate,
        disbursed_by: profile?.id
      });
      toast.success(`Loan ${loan.reference_no} disbursed successfully`);
    } catch (error) {
      toast.error('Failed to disburse loan');
    }
  };

  const handleBulkDisbursement = async () => {
    if (selectedLoans.length === 0) {
      toast.error('Please select loans to disburse');
      return;
    }
    if (!selectedAccount || !disbursementDate) {
      toast.error('Please confirm the Main Bank Account and disbursement date');
      return;
    }

    setBulkLoading(true);
    try {
      const disbursementPromises = selectedLoans.map(loanId => 
        updateLoan(loanId, {
          status: 'active',
          disbursement_date: disbursementDate,
          disbursed_by: profile?.id
        })
      );

      await Promise.all(disbursementPromises);
      toast.success(`${selectedLoans.length} loans disbursed successfully`);
      setSelectedLoans([]);
      setShowBulkModal(false);
    } catch (error) {
      toast.error('Failed to disburse some loans');
    } finally {
      setBulkLoading(false);
    }
  };

  const getLoanStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDisbursementSummary = () => {
    const selectedLoanObjects = loans.filter(loan => selectedLoans.includes(loan.id));
    const totalAmount = selectedLoanObjects.reduce((sum, loan) => sum + loan.principal_amount, 0);
    return {
      count: selectedLoanObjects.length,
      totalAmount,
      averageAmount: selectedLoanObjects.length > 0 ? totalAmount / selectedLoanObjects.length : 0
    };
  };

  const summary = getDisbursementSummary();

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Banknote className="h-12 w-12 text-gray-400 mx-auto mb-4" />
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
          <h1 className="text-2xl font-bold text-gray-900">Loan Disbursement</h1>
          <p className="text-gray-600">Process and manage loan disbursements</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => fetchLoans(true)}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Clock className="h-4 w-4 mr-2" />
            Refresh
          </button>
          {selectedLoans.length > 0 && (
            <button
              onClick={() => setShowBulkModal(true)}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Bulk Disburse ({selectedLoans.length})
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Loans</p>
              <p className="text-2xl font-bold text-gray-900">{pendingLoans.length}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Selected for Disbursement</p>
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
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Average Loan</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.averageAmount)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Loans</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Disbursement Account</label>
            <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700">
              {mainBankAccount ? `${mainBankAccount.name} (${mainBankAccount.code})` : 'Main Bank Account (not configured)'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Disbursement Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={disbursementDate}
                onChange={(e) => setDisbursementDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-end space-x-2">
            <button
              onClick={handleSelectAll}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={handleClearSelection}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Loan List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Pending Loans for Disbursement</h3>
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
                  Reference
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Borrower
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pendingLoans.map((loan) => (
                <tr key={loan.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedLoans.includes(loan.id)}
                      onChange={() => handleLoanSelection(loan.id)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {loan.reference_no}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {loan.borrowers?.full_name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(loan.principal_amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getLoanStatusColor(loan.status)}`}>
                      {loan.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(loan.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleSingleDisbursement(loan)}
                      disabled={!selectedAccount || !disbursementDate}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Disburse
                    </button>
                    <button
                      onClick={() => window.location.href = `/loans/${loan.id}`}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pendingLoans.length === 0 && !isLoading && (
          <div className="px-6 py-12 text-center text-gray-500">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p>No pending loans found for disbursement.</p>
          </div>
        )}
      </div>

      {/* Bulk Disbursement Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-xl bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Bulk Disbursement</h3>
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
                  <span className="text-sm font-medium text-blue-900">Selected Loans:</span>
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
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                  <input
                    type="date"
                    value={disbursementDate}
                    onChange={(e) => setDisbursementDate(e.target.value)}
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
                  onClick={handleBulkDisbursement}
                  disabled={bulkLoading || !selectedAccount || !disbursementDate || selectedLoans.length === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {bulkLoading ? 'Processing...' : 'Confirm Bulk Disbursement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};