import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLoans } from '@/hooks/useLoans';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { formatCurrency } from '@/utils/finance';
import toast from 'react-hot-toast';
import {
  ShieldAlert,
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
  Filter,
  DollarSign,
  Target,
  TrendingDown
} from 'lucide-react';

interface WriteOffRequest {
  id: string;
  loan_reference: string;
  borrower_name: string;
  principal_outstanding: number;
  interest_outstanding: number;
  penalty_outstanding: number;
  total_outstanding: number;
  risk_level: string;
  last_payment_date?: string;
}

export const WriteOff: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const { loans, filteredLoans, fetchLoans, updateLoan } = useLoans();
  const { performSearch, searchQuery, updateSearchQuery } = useGlobalSearch();

  const [selectedLoans, setSelectedLoans] = useState<string[]>([]);
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);
  const [writeOffReason, setWriteOffReason] = useState('');
  const [writeOffLoading, setWriteOffLoading] = useState(false);
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const isAuthorized = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo');

  useEffect(() => {
    if (isAuthorized) {
      fetchLoans();
    }
  }, [isAuthorized]);

  // Calculate write-off candidates (loans with high risk or long overdue)
  const getWriteOffCandidates = () => {
    const candidates: WriteOffRequest[] = [];
    
    filteredLoans.forEach(loan => {
      if (loan.status === 'active' && loan.principal_outstanding > 0) {
        const loanRepayments = loans.filter(l => l.id === loan.id);
        const lastPayment = loanRepayments.length > 0 
          ? new Date(Math.max(...loanRepayments.map(r => new Date(r.created_at).getTime())))
          : new Date(loan.disbursement_date);
        
        const daysOverdue = Math.floor((new Date().getTime() - lastPayment.getTime()) / (1000 * 60 * 60 * 24));
        const totalOutstanding = loan.principal_outstanding + loan.interest_outstanding + (loan.penalty_outstanding || 0);
        
        let riskLevel = 'low';
        if (daysOverdue > 90) riskLevel = 'high';
        else if (daysOverdue > 60) riskLevel = 'medium';
        else if (daysOverdue > 30) riskLevel = 'elevated';

        if (riskLevel === 'high' || totalOutstanding > 10000) {
          candidates.push({
            id: loan.id,
            loan_reference: loan.reference_no,
            borrower_name: loan.borrowers?.full_name || 'Unknown',
            principal_outstanding: loan.principal_outstanding,
            interest_outstanding: loan.interest_outstanding,
            penalty_outstanding: loan.penalty_outstanding || 0,
            total_outstanding: totalOutstanding,
            risk_level: riskLevel,
            last_payment_date: lastPayment.toISOString().split('T')[0]
          });
        }
      }
    });

    return candidates;
  };

  const writeOffCandidates = getWriteOffCandidates();

  // Apply filters
  const filteredCandidates = writeOffCandidates.filter(candidate => {
    const matchesRisk = riskFilter === 'all' || candidate.risk_level === riskFilter;
    const matchesDate = (!dateFrom || candidate.last_payment_date >= dateFrom) && 
                       (!dateTo || candidate.last_payment_date <= dateTo);
    return matchesRisk && matchesDate;
  });

  const handleLoanSelection = (loanId: string) => {
    setSelectedLoans(prev => 
      prev.includes(loanId) 
        ? prev.filter(id => id !== loanId)
        : [...prev, loanId]
    );
  };

  const handleSelectAll = () => {
    setSelectedLoans(filteredCandidates.map(c => c.id));
  };

  const handleClearSelection = () => {
    setSelectedLoans([]);
  };

  const handleWriteOff = async () => {
    if (selectedLoans.length === 0) {
      toast.error('Please select loans to write off');
      return;
    }
    if (!writeOffReason.trim()) {
      toast.error('Please provide a reason for write-off');
      return;
    }

    setWriteOffLoading(true);
    try {
      const writeOffPromises = selectedLoans.map(async (loanId) => {
        const loan = loans.find(l => l.id === loanId);
        if (loan) {
          return updateLoan(loanId, {
            status: 'defaulted',
            write_off_date: new Date().toISOString(),
            write_off_reason: writeOffReason,
            principal_outstanding: 0,
            interest_outstanding: 0,
            penalty_outstanding: 0
          });
        }
      });

      await Promise.all(writeOffPromises);
      toast.success(`${selectedLoans.length} loans written off successfully`);
      setSelectedLoans([]);
      setShowWriteOffModal(false);
      setWriteOffReason('');
    } catch (error) {
      toast.error('Failed to write off some loans');
    } finally {
      setWriteOffLoading(false);
    }
  };

  const getRiskLevelColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-orange-100 text-orange-800';
      case 'elevated': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getWriteOffSummary = () => {
    const selectedCandidates = writeOffCandidates.filter(c => selectedLoans.includes(c.id));
    const totalLoss = selectedCandidates.reduce((sum, candidate) => sum + candidate.total_outstanding, 0);
    return {
      count: selectedCandidates.length,
      totalLoss,
      averageLoss: selectedCandidates.length > 0 ? totalLoss / selectedCandidates.length : 0
    };
  };

  const summary = getWriteOffSummary();

  // Calculate risk distribution
  const riskDistribution = {
    high: writeOffCandidates.filter(c => c.risk_level === 'high').length,
    medium: writeOffCandidates.filter(c => c.risk_level === 'medium').length,
    elevated: writeOffCandidates.filter(c => c.risk_level === 'elevated').length,
    low: writeOffCandidates.filter(c => c.risk_level === 'low').length
  };

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <ShieldAlert className="h-12 w-12 text-gray-400 mx-auto mb-4" />
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
          <h1 className="text-2xl font-bold text-gray-900">Loan Write-Off Management</h1>
          <p className="text-gray-600">Manage and process loan write-offs for high-risk accounts</p>
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
              onClick={() => setShowWriteOffModal(true)}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <ShieldAlert className="h-4 w-4 mr-2" />
              Write Off ({selectedLoans.length})
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">High Risk Loans</p>
              <p className="text-2xl font-bold text-gray-900">{riskDistribution.high}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Exposure</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(writeOffCandidates.reduce((sum, c) => sum + c.total_outstanding, 0))}</p>
            </div>
            <DollarSign className="h-8 w-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Selected for Write-Off</p>
              <p className="text-2xl font-bold text-gray-900">{summary.count}</p>
            </div>
            <Target className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Loss</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalLoss)}</p>
            </div>
            <TrendingDown className="h-8 w-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Risk Distribution */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Distribution</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{riskDistribution.high}</div>
            <div className="text-sm text-red-700">High Risk</div>
          </div>
          <div className="text-center p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{riskDistribution.medium}</div>
            <div className="text-sm text-orange-700">Medium Risk</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{riskDistribution.elevated}</div>
            <div className="text-sm text-yellow-700">Elevated Risk</div>
          </div>
          <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{riskDistribution.low}</div>
            <div className="text-sm text-green-700">Low Risk</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Risk Level</label>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Risk Levels</option>
              <option value="high">High Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="elevated">Elevated Risk</option>
              <option value="low">Low Risk</option>
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
              Clear Selection
            </button>
          </div>
        </div>
      </div>

      {/* Write-Off Candidates */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Write-Off Candidates</h3>
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
                  Total Outstanding
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Risk Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCandidates.map((candidate) => (
                <tr key={candidate.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedLoans.includes(candidate.id)}
                      onChange={() => handleLoanSelection(candidate.id)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {candidate.loan_reference}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {candidate.borrower_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(candidate.total_outstanding)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRiskLevelColor(candidate.risk_level)}`}>
                      {candidate.risk_level}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {candidate.last_payment_date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => window.location.href = `/loans/${candidate.loan_reference}`}
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

        {filteredCandidates.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500">
            <ShieldAlert className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p>No write-off candidates found.</p>
          </div>
        )}
      </div>

      {/* Write-Off Modal */}
      {showWriteOffModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-xl bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Loan Write-Off</h3>
              <button
                onClick={() => setShowWriteOffModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <ShieldAlert className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-red-900">Selected Loans:</span>
                  <span className="text-sm font-bold text-red-900">{summary.count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-red-900">Total Loss:</span>
                  <span className="text-sm font-bold text-red-900">{formatCurrency(summary.totalLoss)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Write-Off Reason</label>
                <textarea
                  value={writeOffReason}
                  onChange={(e) => setWriteOffReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 h-24 resize-none"
                  placeholder="Provide detailed justification for this write-off..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowWriteOffModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleWriteOff}
                  disabled={writeOffLoading || !writeOffReason.trim() || selectedLoans.length === 0}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {writeOffLoading ? 'Processing...' : 'Confirm Write-Off'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};