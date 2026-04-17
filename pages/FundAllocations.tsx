import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fundAllocationService } from '@/services/fundAllocation';
import { formatCurrency, parseFormattedNumber, formatNumberWithCommas } from '@/utils/finance';
import { 
    Plus, RefreshCw, DollarSign, Users, 
    TrendingUp, AlertCircle, CheckCircle2, X,
    PieChart, Filter, Link, FileText, BarChart3,
    Briefcase, History, Receipt
} from 'lucide-react';
import toast from 'react-hot-toast';
import { OfficerFundAllocation, UserProfile, OfficerExpenseClaim } from '@/types';

export const FundAllocations: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [allocations, setAllocations] = useState<OfficerFundAllocation[]>([]);
  const [staffMembers, setStaffMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'allocations' | 'claims' | 'insights'>('allocations');
  const [claims, setClaims] = useState<OfficerExpenseClaim[]>([]);
  const [claimStatusFilter, setClaimStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [period, setPeriod] = useState(new Date().toISOString().substring(0, 7));
  const [showModal, setShowModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [displayAmount, setDisplayAmount] = useState('');
  const [postingAllocationId, setPostingAllocationId] = useState<string | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<OfficerExpenseClaim | null>(null);
  const [formData, setFormData] = useState({
    officer_id: '',
    category: 'Transport',
    notes: '',
    amount: 0
  });

  const isAccountant = effectiveRoles.includes('accountant') || effectiveRoles.includes('admin');

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allocationsData, officersData, claimsData] = await Promise.all([
        fundAllocationService.getAllocations({ period }),
        fundAllocationService.getEligibleStaff(),
        fundAllocationService.getExpenseClaims({ 
          status: claimStatusFilter === 'all' ? undefined : claimStatusFilter 
        })
      ]);
      setAllocations(allocationsData);
      setStaffMembers(officersData);
      setClaims(claimsData);
      
      if (activeTab === 'insights') {
        fetchReport();
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchReport = async () => {
    setLoadingReport(true);
    try {
      const data = await fundAllocationService.getAllocationReport(period);
      setReportData(data);
    } catch (error: any) {
      toast.error('Failed to load report: ' + error.message);
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'insights') {
      fetchReport();
    } else {
      fetchClaimsOnly();
    }
  }, [claimStatusFilter, activeTab]);

  const fetchClaimsOnly = async () => {
    try {
      const claimsData = await fundAllocationService.getExpenseClaims({ 
        status: claimStatusFilter === 'all' ? undefined : claimStatusFilter 
      });
      setClaims(claimsData);
    } catch (error: any) {
      console.error(error);
    }
  };

  const handleAmountChange = (val: string) => {
    setDisplayAmount(formatNumberWithCommas(val));
    const numeric = parseFormattedNumber(val);
    setFormData({ ...formData, amount: numeric });
  };

  const handleSaveAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.officer_id || !displayAmount) {
      toast.error('Please fill in all required fields');
      return;
    }
    setIsProcessing(true);
    try {
      await fundAllocationService.createAllocation({
        officer_id: formData.officer_id,
        allocated_amount: formData.amount,
        allocated_period: period,
        category: formData.category,
        notes: formData.notes
      });
      toast.success('Allocation created successfully');
      setShowModal(false);
      setDisplayAmount('');
      setFormData({ officer_id: '', category: 'Transport', notes: '', amount: 0 });
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteAllocation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this allocation?')) return;
    try {
      await fundAllocationService.deleteAllocation(id);
      toast.success('Allocation deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handlePostToLedger = async (allocationId: string) => {
    setPostingAllocationId(allocationId);
    try {
      const result = await fundAllocationService.postAllocationToLedger(allocationId);
      if (result.success) {
        toast.success(`Posted to ledger: ${result.journal_entry_id}`);
        fetchData();
      } else {
        toast.error(`Posting failed: ${result.message}`);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setPostingAllocationId(null);
    }
  };

  const handleReconcilePeriod = async () => {
    if (!confirm(`Reconcile all allocations for ${period}? This will mark depleted allocations as reconciled.`)) return;
    setIsReconciling(true);
    try {
      await fundAllocationService.reconcilePeriod(period);
      toast.success(`Period ${period} reconciled successfully`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsReconciling(false);
    }
  };

  const handleApproveClaim = async (id: string) => {
    try {
      await fundAllocationService.approveClaim(id);
      toast.success('Claim approved');
      setSelectedClaim(null);
      fetchData();
    } catch (error: any) {
      toast.error('Failed to approve claim: ' + error.message);
    }
  };

  const handleRejectClaim = async (id: string, notes?: string) => {
    const rejectionNotes = notes || prompt('Enter reason for rejection:');
    if (rejectionNotes === null) return;
    try {
      await fundAllocationService.rejectClaim(id, rejectionNotes);
      toast.success('Claim rejected');
      setSelectedClaim(null);
      fetchData();
    } catch (error: any) {
      toast.error('Failed to reject claim: ' + error.message);
    }
  };

  const totalAllocated = allocations.reduce((sum, a) => sum + a.allocated_amount, 0);
  const activeCount = allocations.filter(a => a.status === 'active').length;
  const pendingClaimsCount = claims.filter(c => c.status === 'pending').length;

  const allocationsByOfficer = allocations.reduce((acc, a) => {
    const name = (a as any).users?.full_name || 'Unknown';
    if (!acc[name]) acc[name] = 0;
    acc[name] += a.allocated_amount;
    return acc;
  }, {} as Record<string, number>);

  const allocationsByCategory = allocations.reduce((acc, a) => {
    if (!acc[a.category]) acc[a.category] = 0;
    acc[a.category] += a.allocated_amount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Field Fund Allocations</h1>
          <p className="text-sm text-gray-500">Allocate field expense funds to staff members with full ledger tracking.</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <input 
            type="month" 
            className="border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
          <button
            onClick={fetchData}
            className="p-2 border border-gray-300 rounded-xl hover:bg-gray-50"
            title="Refresh allocations"
          >
            <RefreshCw className="h-5 w-5 text-gray-500" />
          </button>
          {isAccountant && (
            <>
              <button
                onClick={handleReconcilePeriod}
                disabled={isReconciling}
                className="inline-flex items-center px-4 py-2.5 bg-amber-900 hover:bg-amber-800 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-amber-200 disabled:opacity-50"
                title={`Reconcile allocations for ${period}`}
              >
                <History className="h-4 w-4 mr-2" /> {isReconciling ? 'Reconciling...' : 'Reconcile Period'}
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center px-4 py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-200"
              >
                <Plus className="h-4 w-4 mr-2" /> New Allocation
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Allocated</p>
          <h3 className="text-3xl font-bold text-indigo-600">{formatCurrency(totalAllocated)}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Pending Claims</p>
          <h3 className={`text-3xl font-bold ${pendingClaimsCount > 0 ? 'text-orange-600' : 'text-gray-900'}`}>{pendingClaimsCount}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Staff Members</p>
          <h3 className="text-3xl font-bold text-gray-900">{staffMembers.length}</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Categories</p>
          <h3 className="text-3xl font-bold text-gray-900">{Object.keys(allocationsByCategory).length}</h3>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px space-x-8">
          <button
            onClick={() => setActiveTab('allocations')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'allocations'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Fund Allocations
          </button>
          <button
            onClick={() => setActiveTab('claims')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === 'claims'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Expense Claims Review
            {pendingClaimsCount > 0 && (
              <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                {pendingClaimsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === 'insights'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Financial Insights
          </button>
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {activeTab === 'allocations' ? (
            <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-bold text-gray-900 flex items-center">
                  <Briefcase className="h-4 w-4 mr-2 text-indigo-600" />
                  Allocations for {period} (Accounting Ledger Tracked)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3 text-left">Staff Member</th>
                      <th className="px-6 py-3 text-left">Category</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                      <th className="px-6 py-3 text-center">Status</th>
                      <th className="px-6 py-3 text-center">Ledger Entry</th>
                      {isAccountant && <th className="px-6 py-3 text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Loading...</td>
                      </tr>
                    ) : allocations.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No allocations for this period</td>
                      </tr>
                    ) : (
                      allocations.map((allocation) => (
                        <tr key={allocation.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                <span className="text-xs font-bold text-indigo-600">
                                  {((allocation as any).users?.full_name || 'U').charAt(0)}
                                </span>
                              </div>
                              <span className="ml-3 font-medium text-gray-900">
                                {(allocation as any).users?.full_name || 'Unknown'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-600">{allocation.category}</td>
                          <td className="px-6 py-4 text-right font-medium text-gray-900">
                            {formatCurrency(allocation.allocated_amount)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              allocation.status === 'active' ? 'bg-green-100 text-green-700' :
                              allocation.status === 'depleted' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {allocation.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {(allocation as any).allocation_journal_entry_id ? (
                              <div className="flex items-center justify-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <button
                                  onClick={() => (allocation as any).allocation_journal_entry_id && alert(`Journal Entry: ${(allocation as any).allocation_journal_entry_id}`)}
                                  className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                                  title="View journal entry details"
                                >
                                  Posted
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-2">
                                <AlertCircle className="h-4 w-4 text-amber-600" />
                                <span className="text-xs text-amber-600">Pending</span>
                              </div>
                            )}
                          </td>
                          {isAccountant && (
                            <td className="px-6 py-4 text-center">
                              <div className="flex justify-center gap-2">
                                {!(allocation as any).allocation_journal_entry_id && (
                                  <button
                                    onClick={() => handlePostToLedger(allocation.id)}
                                    disabled={postingAllocationId === allocation.id}
                                    className="text-blue-600 hover:text-blue-800 text-xs font-medium disabled:opacity-50"
                                    title="Manually post to ledger"
                                  >
                                    {postingAllocationId === allocation.id ? 'Posting...' : 'Post'}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteAllocation(allocation.id)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === 'claims' ? (
            <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h3 className="font-bold text-gray-900 flex items-center">
                  <Receipt className="h-4 w-4 mr-2 text-indigo-600" />
                  Submitted Expense Claims
                </h3>
                <div className="flex bg-white border border-gray-200 rounded-lg p-1">
                  {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setClaimStatusFilter(s)}
                      className={`px-3 py-1 text-[10px] uppercase font-bold rounded-md transition-all ${
                        claimStatusFilter === s
                          ? 'bg-indigo-900 text-white shadow-sm'
                          : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3 text-left">Requester</th>
                      <th className="px-6 py-3 text-left">Details</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                      <th className="px-6 py-3 text-center">Status</th>
                      <th className="px-6 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading claims...</td>
                      </tr>
                    ) : claims.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                          <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-500">No pending expense claims found</p>
                        </td>
                      </tr>
                    ) : (
                      claims.map((claim) => (
                        <tr key={claim.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <span className="font-medium text-gray-900">
                              {(claim as any).users?.full_name || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">{claim.description || 'No description'}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(claim.created_at).toLocaleDateString()} • {allocations.find(a => a.id === claim.allocation_id)?.category || 'General'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-red-600">
                            {formatCurrency(claim.claim_amount)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                              claim.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                              claim.status === 'approved' ? 'bg-green-100 text-green-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {claim.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => setSelectedClaim(claim)}
                                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                                title="Review claim"
                              >
                                <FileText className="h-4 w-4" />
                              </button>
                              {claim.status === 'pending' && isAccountant && (
                                <>
                                  <button
                                    onClick={() => handleApproveClaim(claim.id)}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                    title="Approve claim"
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleRejectClaim(claim.id)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                    title="Reject claim"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {loadingReport ? (
                <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center">
                  <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin mx-auto mb-4" />
                  <p className="text-gray-500">Generating financial staff report...</p>
                </div>
              ) : reportData ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-lg">
                      <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1">Total Period Budget</p>
                      <h3 className="text-3xl font-bold">{formatCurrency(reportData.total_allocated)}</h3>
                      <p className="text-xs text-indigo-300 mt-2">Maximum fund exposure for staff</p>
                    </div>
                    <div className="bg-orange-600 text-white p-6 rounded-2xl shadow-lg">
                      <p className="text-xs font-bold text-orange-200 uppercase tracking-widest mb-1">Total Claimed</p>
                      <h3 className="text-3xl font-bold">{formatCurrency(reportData.total_claimed)}</h3>
                      <p className="text-xs text-orange-200 mt-2">Actual expenses recorded</p>
                    </div>
                    <div className="bg-emerald-600 text-white p-6 rounded-2xl shadow-lg">
                      <p className="text-xs font-bold text-emerald-200 uppercase tracking-widest mb-1">Company Savings</p>
                      <h3 className="text-3xl font-bold">{formatCurrency(reportData.total_remaining)}</h3>
                      <p className="text-xs text-emerald-200 mt-2">Unutilized field funds</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                      <h3 className="font-bold text-gray-900">Company-Wide Utilization by Staff</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                          <tr>
                            <th className="px-6 py-3 text-left">Staff Name</th>
                            <th className="px-6 py-3 text-right">Budget</th>
                            <th className="px-6 py-3 text-right">Spent</th>
                            <th className="px-6 py-3 text-right">Available</th>
                            <th className="px-6 py-3 text-center">Usage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {reportData.by_officer.map((off: any) => {
                            const percent = off.allocated > 0 ? (off.claimed / off.allocated) * 100 : 0;
                            return (
                              <tr key={off.officer_id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900">{off.officer_name}</td>
                                <td className="px-6 py-4 text-right text-gray-600">{formatCurrency(off.allocated)}</td>
                                <td className="px-6 py-4 text-right text-orange-600 font-medium">{formatCurrency(off.claimed)}</td>
                                <td className="px-6 py-4 text-right text-emerald-600 font-medium">{formatCurrency(off.remaining)}</td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center justify-center gap-2">
                                    <div className="w-16 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full ${percent > 90 ? 'bg-red-500' : percent > 70 ? 'bg-orange-500' : 'bg-green-500'}`}
                                        style={{ width: `${Math.min(100, percent)}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-500">{percent.toFixed(0)}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                      <h3 className="font-bold text-gray-900">Spending by Category</h3>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {reportData.by_category.map((cat: any) => (
                        <div key={cat.category} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                          <div className="flex justify-between items-start mb-2">
                             <span className="font-bold text-gray-900">{cat.category}</span>
                             <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                               {cat.allocated > 0 ? ((cat.claimed/cat.allocated)*100).toFixed(0) : 0}% Used
                             </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Allocated</span>
                              <span className="font-medium">{formatCurrency(cat.allocated)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Actual Claimed</span>
                              <span className="font-medium text-orange-600">{formatCurrency(cat.claimed)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center">
                   <p className="text-gray-500">No report data available for this period.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 flex items-center mb-4">
              <Users className="h-4 w-4 mr-2 text-indigo-600" />
              By Staff Member
            </h3>
            <div className="space-y-3">
              {Object.entries(allocationsByOfficer).map(([name, amount]) => (
                <div key={name} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{name}</span>
                  <span className="font-medium text-gray-900">{formatCurrency(amount)}</span>
                </div>
              ))}
              {Object.keys(allocationsByOfficer).length === 0 && (
                <p className="text-sm text-gray-500">No allocations yet</p>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 flex items-center mb-4">
              <PieChart className="h-4 w-4 mr-2 text-indigo-600" />
              By Category
            </h3>
            <div className="space-y-3">
              {Object.entries(allocationsByCategory).map(([category, amount]) => (
                <div key={category} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{category}</span>
                  <span className="font-medium text-gray-900">{formatCurrency(amount)}</span>
                </div>
              ))}
              {Object.keys(allocationsByCategory).length === 0 && (
                <p className="text-sm text-gray-500">No allocations yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Accounting Impact Summary */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-2xl border border-indigo-200 shadow-sm">
        <h3 className="font-bold text-gray-900 flex items-center mb-4">
          <BarChart3 className="h-5 w-5 mr-2 text-indigo-600" />
          Accounting Impact Summary for {period}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-white p-4 rounded-xl">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total Allocated</p>
            <p className="text-lg font-bold text-indigo-900">{formatCurrency(totalAllocated)}</p>
            <p className="text-xs text-gray-600 mt-2">Debits Officer Advances account</p>
          </div>
          <div className="bg-white p-4 rounded-xl">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Ledger Posted</p>
            <p className="text-lg font-bold text-green-700">
              {allocations.filter(a => (a as any).allocation_journal_entry_id).length} / {allocations.length}
            </p>
            <p className="text-xs text-gray-600 mt-2">Journal entries created</p>
          </div>
          <div className="bg-white p-4 rounded-xl">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Cash Impact</p>
            <p className="text-lg font-bold text-red-700">-{formatCurrency(totalAllocated)}</p>
            <p className="text-xs text-gray-600 mt-2">Credits Cash account</p>
          </div>
        </div>
        <div className="mt-4 p-3 bg-white rounded-lg border border-indigo-100 text-xs text-gray-700">
          <p className="font-medium mb-2">📊 GL Posting Details:</p>
          <ul className="space-y-1 text-gray-600">
            <li>• <strong>Debit</strong>: OFFICER_ADVANCES +{formatCurrency(totalAllocated)}</li>
            <li>• <strong>Credit</strong>: CASH -{formatCurrency(totalAllocated)}</li>
            <li>• All entries are balanced and tracked with unique journal IDs</li>
          </ul>
        </div>
      </div>

      {/* Claim Review Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-indigo-600" />
                Review Staff Expense Claim
              </h3>
              <button onClick={() => setSelectedClaim(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Requester</p>
                  <p className="font-medium text-gray-900">{(selectedClaim as any).users?.full_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Amount</p>
                  <p className="font-bold text-red-600">{formatCurrency(selectedClaim.claim_amount)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Date</p>
                  <p className="text-gray-900">{new Date(selectedClaim.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Status</p>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    selectedClaim.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                    selectedClaim.status === 'approved' ? 'bg-green-100 text-green-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {selectedClaim.status}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Description</p>
                <div className="p-3 bg-gray-50 rounded-xl text-gray-900 border border-gray-100">
                  {selectedClaim.description || 'No description provided'}
                </div>
              </div>

              {selectedClaim.notes && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Staff Notes</p>
                  <div className="p-3 bg-indigo-50/50 rounded-xl text-indigo-900 border border-indigo-100 text-xs italic">
                    "{selectedClaim.notes}"
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-6 border-t border-gray-100">
                <button
                  onClick={() => setSelectedClaim(null)}
                  className="px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 flex-1 text-sm font-medium"
                >
                  Close
                </button>
                {selectedClaim.status === 'pending' && isAccountant && (
                  <>
                    <button
                      onClick={() => handleRejectClaim(selectedClaim.id)}
                      className="px-4 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl hover:bg-red-100 flex-1 text-sm font-medium"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApproveClaim(selectedClaim.id)}
                      className="px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 flex-1 text-sm font-medium shadow-sm shadow-green-100"
                    >
                      Approve
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">New Fund Allocation</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveAllocation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff Member / Recipient</label>
                <select
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500"
                  value={formData.officer_id}
                  onChange={(e) => setFormData({ ...formData, officer_id: e.target.value })}
                  required
                >
                  <option value="">Select staff member...</option>
                  {staffMembers.map(officer => (
                    <option key={officer.id} value={officer.id}>{officer.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {fundAllocationService.getCategories().map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (MWK)</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500"
                  value={displayAmount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl font-medium disabled:opacity-50"
                >
                  {isProcessing ? 'Saving...' : 'Create Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};