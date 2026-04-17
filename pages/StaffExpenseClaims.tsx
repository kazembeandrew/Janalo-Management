import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fundAllocationService } from '@/services/fundAllocation';
import { formatCurrency, parseFormattedNumber, formatNumberWithCommas } from '@/utils/finance';
import {
  Plus, RefreshCw, AlertCircle, CheckCircle2, X, Clock, FileText,
  TrendingUp, Receipt, DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';
import { OfficerFundAllocation, OfficerExpenseClaim } from '@/types';

export const StaffExpenseClaims: React.FC = () => {
  const { profile } = useAuth();
  const [allocations, setAllocations] = useState<OfficerFundAllocation[]>([]);
  const [claims, setClaims] = useState<OfficerExpenseClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(new Date().toISOString().substring(0, 7));
  const [showModal, setShowModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayAmount, setDisplayAmount] = useState('');

  const [formData, setFormData] = useState({
    allocation_id: '',
    claim_amount: 0,
    date: new Date().toISOString().split('T')[0],
    description: '',
    receipt_notes: ''
  });

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const [allocationsData, claimsData] = await Promise.all([
        fundAllocationService.getAllocations({ 
          officer_id: profile.id, 
          period 
        }),
        fundAllocationService.getOfficerClaims(profile.id, period)
      ]);
      setAllocations(allocationsData);
      setClaims(claimsData);
    } catch (error: any) {
      toast.error('Failed to load allocations and claims: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClaim = async () => {
    if (!formData.allocation_id || formData.claim_amount <= 0) {
      toast.error('Please select an allocation and enter a valid amount');
      return;
    }

    // Check if amount exceeds remaining balance
    const allocation = allocations.find(a => a.id === formData.allocation_id);
    if (!allocation) {
      toast.error('Allocation not found');
      return;
    }

    const totalClaimed = claims
      .filter(c => c.allocation_id === formData.allocation_id && c.status !== 'rejected')
      .reduce((sum, c) => sum + c.claim_amount, 0);

    if (totalClaimed + formData.claim_amount > allocation.allocated_amount) {
      toast.error(`Claim amount exceeds available balance. Available: ${formatCurrency(allocation.allocated_amount - totalClaimed)}`);
      return;
    }

    setIsProcessing(true);
    try {
      const claimData = {
        officer_id: profile!.id,
        allocation_id: formData.allocation_id,
        claim_amount: formData.claim_amount,
        claim_date: formData.date,
        description: formData.description,
        notes: formData.receipt_notes,
        status: 'pending'
      };

      await fundAllocationService.createExpenseClaim(claimData);
      toast.success('Expense claim recorded successfully');
      
      // Reset form and refresh data
      setFormData({
        allocation_id: '',
        claim_amount: 0,
        date: new Date().toISOString().split('T')[0],
        description: '',
        receipt_notes: ''
      });
      setDisplayAmount('');
      setShowModal(false);
      await fetchData();
    } catch (error: any) {
      toast.error('Failed to create claim: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedAllocation = allocations.find(a => a.id === formData.allocation_id);
  const claimsForSelected = claims.filter(c => c.allocation_id === formData.allocation_id && c.status !== 'rejected');
  const availableBalance = selectedAllocation 
    ? selectedAllocation.allocated_amount - claimsForSelected.reduce((sum, c) => sum + c.claim_amount, 0)
    : 0;

  const totalClaims = claims.reduce((sum, c) => sum + (c.status !== 'rejected' ? c.claim_amount : 0), 0);
  const pendingClaims = claims.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.claim_amount, 0);
  const approvedClaims = claims.filter(c => c.status === 'approved').reduce((sum, c) => sum + c.claim_amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Expense Claims</h1>
          <p className="text-sm text-gray-500">Record and track expenses against your staff fund allocations</p>
        </div>
        <div className="flex gap-3">
          <input
            type="month"
            className="border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
          <button
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Claim
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Claims</p>
              <h3 className="text-3xl font-bold text-indigo-600">{formatCurrency(totalClaims)}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Pending Review</p>
              <h3 className="text-3xl font-bold text-orange-600">{formatCurrency(pendingClaims)}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Approved</p>
              <h3 className="text-3xl font-bold text-green-600">{formatCurrency(approvedClaims)}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Claims Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="font-bold text-gray-900 flex items-center">
            <Receipt className="h-4 w-4 mr-2 text-indigo-600" />
            Recent Claims for {period}
          </h3>
        </div>
        {claims.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h4 className="text-gray-900 font-medium mb-1">No claims recorded</h4>
            <p className="text-gray-500 text-sm">Start recording your field expenses by clicking "New Claim"</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 text-left">Date</th>
                  <th className="px-6 py-3 text-left">Category</th>
                  <th className="px-6 py-3 text-left">Description</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-center">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {claims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(claim.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-900">
                        {allocations.find(a => a.id === claim.allocation_id)?.category || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {claim.description || '—'}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      {formatCurrency(claim.claim_amount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        claim.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        claim.status === 'approved' ? 'bg-green-100 text-green-700' :
                        claim.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {claim.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {claim.notes ? (
                        <div className="flex items-center group relative">
                          <FileText className="h-4 w-4 text-gray-400 cursor-help" />
                          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                            {claim.notes}
                          </div>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Claim Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Record New Staff Expense Claim</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            {allocations.length === 0 ? (
              <div className="bg-eellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  <AlertCircle className="h-4 w-4 inline mr-2" />
                  No fund allocations available for {period}. Please contact your accountant.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Staff Fund Allocation
                    </label>
                    <select
                      value={formData.allocation_id}
                      onChange={(e) => {
                        setFormData({ ...formData, allocation_id: e.target.value });
                        setDisplayAmount('');
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select an allocation</option>
                      {allocations.map((alloc) => {
                        const usedAmount = claims
                          .filter(c => c.allocation_id === alloc.id && c.status !== 'rejected')
                          .reduce((sum, c) => sum + c.claim_amount, 0);
                        const available = alloc.allocated_amount - usedAmount;
                        return (
                          <option key={alloc.id} value={alloc.id}>
                            {alloc.category} - {formatCurrency(available)} remaining of {formatCurrency(alloc.allocated_amount)}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expense Date
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="e.g., Field visit, Printing, Transport"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Claim Amount {availableBalance > 0 && <span className="text-gray-500">(Available: {formatCurrency(availableBalance)})</span>}
                    </label>
                    <input
                      type="text"
                      value={displayAmount}
                      onChange={(e) => {
                        setDisplayAmount(e.target.value);
                        const parsed = parseFormattedNumber(e.target.value);
                        setFormData({ ...formData, claim_amount: parsed });
                      }}
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Receipt Notes (Optional)
                    </label>
                    <textarea
                      value={formData.receipt_notes}
                      onChange={(e) => setFormData({ ...formData, receipt_notes: e.target.value })}
                      placeholder="Details about receipt, vendor, etc."
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {selectedAllocation && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                      <p className="text-xs text-blue-800">
                        <span className="font-medium">Budget Limit:</span> {formatCurrency(selectedAllocation.allocated_amount)}
                        <br />
                        <span className="font-medium">Claim Amount:</span> {formatCurrency(formData.claim_amount)}
                        <br />
                        <span className="font-medium">Remaining:</span> {formatCurrency(availableBalance - formData.claim_amount)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddClaim}
                    disabled={isProcessing || !formData.allocation_id || formData.claim_amount <= 0}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-400"
                  >
                    {isProcessing ? 'Recording...' : 'Record Claim'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
