import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fundAllocationService } from '@/services/fundAllocation';
import { formatCurrency, parseFormattedNumber } from '@/utils/finance';
import { 
    DollarSign, TrendingUp, TrendingDown, 
    AlertCircle, CheckCircle2, Clock, Plus, X, Receipt
} from 'lucide-react';
import toast from 'react-hot-toast';
import { OfficerFundAllocation, AllocationBalance } from '@/types';

export const MyFieldFunds: React.FC = () => {
  const { profile } = useAuth();
  const [allocations, setAllocations] = useState<OfficerFundAllocation[]>([]);
  const [balances, setBalances] = useState<AllocationBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(new Date().toISOString().substring(0, 7));
  
  // Quick Claim state
  const [showModal, setShowModal] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<AllocationBalance | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayAmount, setDisplayAmount] = useState('');
  const [formData, setFormData] = useState({
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
      const [allocationsData, balancesData] = await Promise.all([
        fundAllocationService.getAllocations({ 
          officer_id: profile.id, 
          period 
        }),
        fundAllocationService.getAllocationBalance(profile.id, period)
      ]);
      setAllocations(allocationsData);
      setBalances(balancesData);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenClaim = (balance: AllocationBalance) => {
    setSelectedBalance(balance);
    setFormData({
      ...formData,
      claim_amount: 0,
      description: ''
    });
    setDisplayAmount('');
    setShowModal(true);
  };

  const handleAddClaim = async () => {
    if (!selectedBalance || formData.claim_amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (formData.claim_amount > selectedBalance.remaining_balance) {
      toast.error(`Amount exceeds available balance: ${formatCurrency(selectedBalance.remaining_balance)}`);
      return;
    }

    setIsProcessing(true);
    try {
      await fundAllocationService.createExpenseClaim({
        officer_id: profile!.id,
        allocation_id: selectedBalance.allocation_id,
        claim_amount: formData.claim_amount,
        claim_date: formData.date,
        description: formData.description,
        notes: formData.receipt_notes,
        status: 'pending'
      });
      
      toast.success('Expense claim recorded successfully');
      setShowModal(false);
      await fetchData(); // Refresh balances
    } catch (error: any) {
      toast.error('Failed to create claim: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const totalAllocated = allocations.reduce((sum, a) => sum + a.allocated_amount, 0);
  const totalClaimed = balances.reduce((sum, b) => sum + b.claimed_amount, 0);
  const totalRemaining = balances.reduce((sum, b) => sum + b.remaining_balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Field Funds</h1>
          <p className="text-sm text-gray-500">View your allocated staff expense funds and recording claims.</p>
        </div>
        <div className="flex gap-3">
          <input 
            type="month" 
            className="border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Allocated</p>
              <h3 className="text-3xl font-bold text-indigo-600">{formatCurrency(totalAllocated)}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Claimed</p>
              <h3 className="text-3xl font-bold text-orange-600">{formatCurrency(totalClaimed)}</h3>
            </div>
            <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Remaining Balance</p>
              <h3 className={`text-3xl font-bold ${totalRemaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totalRemaining)}
              </h3>
            </div>
            <div className={`h-12 w-12 rounded-full flex items-center justify-center ${totalRemaining > 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              {totalRemaining > 0 ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : (
                <AlertCircle className="h-6 w-6 text-red-600" />
              )}
            </div>
          </div>
        </div>
      </div>

      {totalAllocated === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-200 text-center">
          <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <DollarSign className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">No Funds Allocated</h3>
          <p className="text-gray-500">
            You don't have any staff fund allocations for {period}. Contact your accountant to request an allocation.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-bold text-gray-900 flex items-center">
              <DollarSign className="h-4 w-4 mr-2 text-indigo-600" />
              Allocation Breakdown for {period}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 text-left">Category</th>
                  <th className="px-6 py-3 text-right">Allocated</th>
                  <th className="px-6 py-3 text-right">Claimed</th>
                  <th className="px-6 py-3 text-right">Remaining</th>
                  <th className="px-6 py-3 text-center">Usage</th>
                  <th className="px-6 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Loading...</td>
                  </tr>
                ) : balances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No allocations for this period</td>
                  </tr>
                ) : (
                  balances.map((balance) => {
                    const usagePercent = balance.allocated_amount > 0 
                      ? (balance.claimed_amount / balance.allocated_amount) * 100 
                      : 0;
                    return (
                      <tr key={balance.allocation_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <span className="font-medium text-gray-900">{balance.category}</span>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600">
                          {formatCurrency(balance.allocated_amount)}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600">
                          {formatCurrency(balance.claimed_amount)}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-gray-900">
                          {formatCurrency(balance.remaining_balance)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center">
                            <div className="w-24 bg-gray-100 rounded-full h-2 mr-2">
                              <div 
                                className={`h-2 rounded-full ${usagePercent >= 100 ? 'bg-red-500' : usagePercent >= 80 ? 'bg-orange-500' : 'bg-green-500'}`}
                                style={{ width: `${Math.min(100, usagePercent)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{usagePercent.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleOpenClaim(balance)}
                            disabled={balance.remaining_balance <= 0}
                            className="inline-flex items-center px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 disabled:bg-gray-50 disabled:text-gray-400 transition-colors"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Claim
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
        <h4 className="font-bold text-blue-900 flex items-center mb-2">
          <Clock className="h-4 w-4 mr-2" />
          How to Use Your Field Funds
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>1. Use the "Claim" button next to any category to record an expense</li>
          <li>2. Your remaining balance will be updated once the claim is recorded</li>
          <li>3. Accountants will review and approve your claims for ledger posting</li>
          <li>4. View all your historical claims on the Staff Expense Claims page</li>
        </ul>
      </div>

      {/* Quick Claim Modal */}
      {showModal && selectedBalance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Record Expense: {selectedBalance.category}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
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
                  placeholder="e.g., Field visit, Printing, Fuel"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Claim Amount <span className="text-gray-500">(Available: {formatCurrency(selectedBalance.remaining_balance)})</span>
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

              <div className="bg-indigo-50 rounded-lg p-3">
                <div className="flex items-start">
                  <AlertCircle className="h-4 w-4 text-indigo-600 mt-0.5 mr-2" />
                  <p className="text-xs text-indigo-800">
                    This claim will be sent for review. Once approved, it will be automatically posted to the general ledger.
                  </p>
                </div>
              </div>
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
                disabled={isProcessing || formData.claim_amount <= 0}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
              >
                {isProcessing ? 'Recording...' : 'Record Claim'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};