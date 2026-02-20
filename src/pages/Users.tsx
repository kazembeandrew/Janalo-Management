import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { UserProfile, UserRole } from '@/types';
import { Shield, User, Power, Lock, Search, Plus, X, Mail, Key, Save, AlertTriangle, Trash2, Check, ArrowRight, UserPlus, Briefcase, Landmark, RefreshCw, Calendar, TrendingUp, Ban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export const Users: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  
  // Editing State
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'promotion' | 'delegation' | 'security'>('profile');
  
  // Revocation State
  const [revocationReason, setRevocationReason] = useState('');
  const [successorId, setSuccessorId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Promotion State
  const [targetRole, setTargetRole] = useState<UserRole | ''>('');

  // Delegation State
  const [delegationData, setDelegationData] = useState({
      role: '' as UserRole | '',
      start: new Date().toISOString().split('T')[0],
      end: ''
  });

  // Create Form States
  const [newUser, setNewUser] = useState({
      full_name: '',
      email: '',
      password: '', 
      role: 'loan_officer' as UserRole
  });

  useEffect(() => {
    if (profile && profile.role !== 'admin' && profile.role !== 'ceo') {
      navigate('/');
    }
  }, [profile, navigate]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data as UserProfile[]);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const logAudit = async (action: string, details: any, targetUserId: string) => {
      if (!profile) return;
      await supabase.from('audit_logs').insert({
          user_id: profile.id,
          action,
          entity_type: 'user',
          entity_id: targetUserId,
          details
      });
  };

  // --- REVOKE ACCESS LOGIC ---

  const handleRevokeAccess = async () => {
      if (!selectedUser || !revocationReason.trim()) {
          toast.error("Please provide a reason for revoking access.");
          return;
      }

      if (selectedUser.role === 'loan_officer') {
          const { count } = await supabase
            .from('loans')
            .select('*', { count: 'exact', head: true })
            .eq('officer_id', selectedUser.id)
            .neq('status', 'completed');
          
          if (count && count > 0 && !successorId) {
              toast.error("Portfolio reassignment is mandatory for this officer.");
              return;
          }
      }

      setIsProcessing(true);
      try {
          if (successorId) {
              const { error } = await supabase.rpc('reassign_officer_portfolio', {
                  old_officer_id: selectedUser.id,
                  new_officer_id: successorId,
                  reason: revocationReason
              });
              if (error) throw error;

              const successorName = users.find(u => u.id === successorId)?.full_name || 'Unknown';
              await logAudit('Access Revoked (with Reassignment)', { 
                  reason: revocationReason, 
                  transferred_to: successorName 
              }, selectedUser.id);
          } else {
              const { error } = await supabase
                .from('users')
                .update({ 
                    is_active: false, 
                    revocation_reason: revocationReason 
                })
                .eq('id', selectedUser.id);
              if (error) throw error;

              await logAudit('Access Revoked', { reason: revocationReason }, selectedUser.id);
          }

          toast.success(`Access revoked for ${selectedUser.full_name}.`);
          setShowRevokeModal(false);
          setShowEditModal(false);
          fetchUsers();
      } catch (e: any) {
          toast.error("Revocation failed: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  // --- PERMANENT DELETION LOGIC ---

  const handlePermanentDelete = async () => {
      if (!selectedUser || profile?.role !== 'ceo') return;
      
      if (!window.confirm("CRITICAL ACTION: This will permanently delete the user record. This is only possible if the user has NO linked financial records. Continue?")) return;

      setIsProcessing(true);
      try {
          const { error } = await supabase.from('users').delete().eq('id', selectedUser.id);
          
          if (error) {
              if (error.code === '23503') {
                  toast.error("Cannot hard delete: User is linked to historical records. Use 'Revoke Access' instead to preserve data integrity.");
                  return;
              }
              throw error;
          }
          
          await logAudit('User Permanently Deleted', { email: selectedUser.email }, selectedUser.id);
          toast.success("User record permanently removed.");
          setShowEditModal(false);
          fetchUsers();
      } catch (e: any) {
          toast.error("Deletion failed: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  // --- PROMOTION LOGIC ---

  const handlePromote = async () => {
      if (!selectedUser || !targetRole) return;

      if (selectedUser.role === 'loan_officer' && targetRole !== 'loan_officer') {
          const { count } = await supabase
            .from('loans')
            .select('*', { count: 'exact', head: true })
            .eq('officer_id', selectedUser.id)
            .neq('status', 'completed');
          
          if (count && count > 0 && !successorId) {
              toast.error("Please select a successor for the portfolio first.");
              return;
          }
          
          if (successorId) {
              setIsProcessing(true);
              try {
                  const { error: rpcError } = await supabase.rpc('reassign_officer_portfolio', {
                      old_officer_id: selectedUser.id,
                      new_officer_id: successorId,
                      reason: `Promotion to ${targetRole}`
                  });
                  if (rpcError) throw rpcError;
              } catch (e: any) {
                  toast.error("Portfolio transfer failed: " + e.message);
                  setIsProcessing(false);
                  return;
              }
          }
      }

      setIsProcessing(true);
      try {
          const { error } = await supabase
            .from('users')
            .update({ role: targetRole })
            .eq('id', selectedUser.id);
          
          if (error) throw error;
          
          await logAudit('User Promoted', { from: selectedUser.role, to: targetRole }, selectedUser.id);
          toast.success(`${selectedUser.full_name} promoted to ${targetRole.replace('_', ' ')}.`);
          setShowEditModal(false);
          fetchUsers();
      } catch (e: any) {
          toast.error("Promotion failed: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  // --- DELEGATION LOGIC ---

  const handleSaveDelegation = async () => {
      if (!selectedUser || !delegationData.role) return;
      
      setIsProcessing(true);
      try {
          const { error } = await supabase
            .from('users')
            .update({
                delegated_role: delegationData.role,
                delegation_start: delegationData.start,
                delegation_end: delegationData.end || null
            })
            .eq('id', selectedUser.id);
          
          if (error) throw error;
          
          await logAudit('Role Delegated', { role: delegationData.role, end: delegationData.end }, selectedUser.id);
          toast.success(`Duties delegated to ${selectedUser.full_name}.`);
          setShowEditModal(false);
          fetchUsers();
      } catch (e: any) {
          toast.error("Delegation failed: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleRevokeDelegation = async () => {
      if (!selectedUser) return;
      setIsProcessing(true);
      try {
          await supabase.from('users').update({
              delegated_role: null,
              delegation_start: null,
              delegation_end: null
          }).eq('id', selectedUser.id);
          
          await logAudit('Delegation Revoked', {}, selectedUser.id);
          toast.success("Delegation revoked.");
          setShowEditModal(false);
          fetchUsers();
      } catch (e) {
          toast.error("Failed to revoke.");
      } finally {
          setIsProcessing(false);
      }
  };

  const openEditModal = (user: UserProfile) => {
      setSelectedUser(user);
      setTargetRole(user.role);
      setDelegationData({
          role: user.delegated_role || '',
          start: user.delegation_start ? user.delegation_start.split('T')[0] : new Date().toISOString().split('T')[0],
          end: user.delegation_end ? user.delegation_end.split('T')[0] : ''
      });
      setActiveTab('profile');
      setShowEditModal(true);
  };

  const openRevokeModal = () => {
      setRevocationReason('');
      setSuccessorId('');
      setShowRevokeModal(true);
  };

  const potentialSuccessors = users.filter(u => u.role === 'loan_officer' && u.is_active && u.id !== selectedUser?.id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <button onClick={() => setShowCreateModal(true)} className="bg-indigo-900 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center">
            <Plus className="h-4 w-4 mr-2" /> Add User
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Primary Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                      {user.full_name?.charAt(0)}
                    </div>
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-800 uppercase w-fit">{user.role.replace('_', ' ')}</span>
                    {user.delegated_role && (
                        <span className="text-[10px] text-blue-600 font-bold mt-1">+ {user.delegated_role.replace('_', ' ')}</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => openEditModal(user)} className="text-indigo-600 hover:text-indigo-900">Manage</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MANAGE USER MODAL */}
      {showEditModal && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
                      <h3 className="font-bold text-gray-900">Manage: {selectedUser.full_name}</h3>
                      <button onClick={() => setShowEditModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
                  </div>
                  
                  <div className="flex border-b">
                      <button onClick={() => setActiveTab('profile')} className={`flex-1 py-3 text-sm font-medium ${activeTab === 'profile' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500'}`}>Profile</button>
                      <button onClick={() => setActiveTab('promotion')} className={`flex-1 py-3 text-sm font-medium ${activeTab === 'promotion' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500'}`}>Promotion</button>
                      <button onClick={() => setActiveTab('delegation')} className={`flex-1 py-3 text-sm font-medium ${activeTab === 'delegation' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500'}`}>Delegation</button>
                      <button onClick={() => setActiveTab('security')} className={`flex-1 py-3 text-sm font-medium ${activeTab === 'security' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500'}`}>Security</button>
                  </div>

                  <div className="p-6">
                      {activeTab === 'profile' && (
                          <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                  <div className="p-4 bg-gray-50 rounded-lg">
                                      <p className="text-xs text-gray-500 uppercase font-bold">Primary Role</p>
                                      <p className="text-lg font-bold text-gray-900 capitalize">{selectedUser.role.replace('_', ' ')}</p>
                                  </div>
                                  <div className="p-4 bg-gray-50 rounded-lg">
                                      <p className="text-xs text-gray-500 uppercase font-bold">Status</p>
                                      <p className={`text-lg font-bold ${selectedUser.is_active ? 'text-green-600' : 'text-red-600'}`}>
                                          {selectedUser.is_active ? 'Active' : 'Inactive'}
                                      </p>
                                  </div>
                              </div>
                              {selectedUser.revocation_reason && !selectedUser.is_active && (
                                  <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                                      <p className="text-xs text-red-500 uppercase font-bold">Revocation Reason</p>
                                      <p className="text-sm text-red-700">{selectedUser.revocation_reason}</p>
                                  </div>
                              )}
                          </div>
                      )}

                      {activeTab === 'promotion' && (
                          <div className="space-y-4">
                              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 flex items-start">
                                  <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3 shrink-0" />
                                  <p className="text-xs text-yellow-700">
                                      <strong>Promotion is permanent.</strong> This replaces the user's current role. If promoting a Loan Officer, their portfolio must be reassigned.
                                  </p>
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-gray-700">New Permanent Role</label>
                                  <select 
                                      className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                      value={targetRole}
                                      onChange={e => setTargetRole(e.target.value as UserRole)}
                                  >
                                      <option value="loan_officer">Loan Officer</option>
                                      <option value="hr">HR Manager</option>
                                      <option value="accountant">Accountant</option>
                                      <option value="ceo">CEO / Executive</option>
                                      <option value="admin">System Administrator</option>
                                  </select>
                              </div>
                              {selectedUser.role === 'loan_officer' && targetRole !== 'loan_officer' && (
                                  <div>
                                      <label className="block text-sm font-medium text-gray-700">Select Successor for Portfolio</label>
                                      <select 
                                          className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                          value={successorId}
                                          onChange={e => setSuccessorId(e.target.value)}
                                      >
                                          <option value="">-- Select Active Officer --</option>
                                          {potentialSuccessors.map(u => (
                                              <option key={u.id} value={u.id}>{u.full_name}</option>
                                          ))}
                                      </select>
                                  </div>
                              )}
                              <div className="flex justify-end">
                                  <button 
                                    onClick={handlePromote}
                                    disabled={isProcessing || targetRole === selectedUser.role}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-bold disabled:bg-gray-300"
                                  >
                                      Confirm Promotion
                                  </button>
                              </div>
                          </div>
                      )}

                      {activeTab === 'delegation' && (
                          <div className="space-y-4">
                              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start">
                                  <Briefcase className="h-5 w-5 text-blue-600 mr-3 shrink-0" />
                                  <p className="text-xs text-blue-700">
                                      <strong>Delegation is temporary.</strong> The user will hold both their primary role and the delegated role simultaneously until the end date.
                                  </p>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                      <label className="block text-sm font-medium text-gray-700">Delegate Role</label>
                                      <select 
                                          className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                          value={delegationData.role}
                                          onChange={e => setDelegationData({...delegationData, role: e.target.value as UserRole})}
                                      >
                                          <option value="">-- Select Role --</option>
                                          <option value="hr">HR Manager</option>
                                          <option value="accountant">Accountant</option>
                                          <option value="loan_officer">Loan Officer</option>
                                      </select>
                                  </div>
                                  <div>
                                      <label className="block text-sm font-medium text-gray-700">End Date (Optional)</label>
                                      <input 
                                          type="date" 
                                          className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                                          value={delegationData.end}
                                          onChange={e => setDelegationData({...delegationData, end: e.target.value})}
                                      />
                                  </div>
                              </div>
                              <div className="flex justify-between pt-4">
                                  {selectedUser.delegated_role && (
                                      <button onClick={handleRevokeDelegation} className="text-red-600 text-sm font-bold hover:underline">Revoke Current Delegation</button>
                                  )}
                                  <button 
                                    onClick={handleSaveDelegation}
                                    disabled={isProcessing || !delegationData.role}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-bold ml-auto"
                                  >
                                      Save Delegation
                                  </button>
                              </div>
                          </div>
                      )}

                      {activeTab === 'security' && (
                          <div className="space-y-6">
                              <div className="p-4 border rounded-lg bg-white">
                                  <h4 className="font-bold text-gray-900 flex items-center mb-2">
                                      <Ban className="h-4 w-4 mr-2 text-red-600" />
                                      Revoke Access (Deactivate)
                                  </h4>
                                  <p className="text-xs text-gray-500 mb-4">
                                      Standard procedure for resignations or transfers. User cannot log in, but all historical data is preserved.
                                  </p>
                                  <button 
                                    onClick={openRevokeModal}
                                    disabled={!selectedUser.is_active}
                                    className="w-full py-2 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm font-bold hover:bg-red-100 disabled:opacity-50"
                                  >
                                      {selectedUser.is_active ? 'Revoke Access' : 'Access Already Revoked'}
                                  </button>
                              </div>

                              {profile.role === 'ceo' && (
                                  <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                                      <h4 className="font-bold text-red-800 flex items-center mb-2">
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Permanent Deletion (Hard Delete)
                                      </h4>
                                      <p className="text-xs text-red-700 mb-4">
                                          <strong>CEO ONLY:</strong> Permanently removes the user record. Only possible if the user has NO linked financial data.
                                      </p>
                                      <button 
                                        onClick={handlePermanentDelete}
                                        disabled={isProcessing}
                                        className="w-full py-2 bg-red-600 text-white rounded-md text-sm font-bold hover:bg-red-700"
                                      >
                                          Permanently Delete Record
                                      </button>
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* REVOKE ACCESS MODAL */}
      {showRevokeModal && selectedUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black bg-opacity-75">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                  <h3 className="text-lg font-bold text-red-600 flex items-center mb-4">
                      <Ban className="h-5 w-5 mr-2" /> Revoke System Access
                  </h3>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700">Reason for Revocation</label>
                          <select 
                            className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                            value={revocationReason}
                            onChange={e => setRevocationReason(e.target.value)}
                          >
                              <option value="">-- Select Reason --</option>
                              <option value="Resignation">Resignation</option>
                              <option value="Termination">Termination</option>
                              <option value="Suspension">Suspension</option>
                              <option value="Role Transfer">Role Transfer</option>
                              <option value="Other">Other</option>
                          </select>
                      </div>

                      {selectedUser.role === 'loan_officer' && (
                          <div className="p-4 bg-orange-50 border border-orange-100 rounded-lg">
                              <p className="text-xs text-orange-700 font-bold mb-2">Mandatory Portfolio Reassignment</p>
                              <label className="block text-xs text-gray-600 mb-1">Select Successor Officer</label>
                              <select 
                                className="w-full border border-gray-300 rounded-md p-2 text-sm"
                                value={successorId}
                                onChange={e => setSuccessorId(e.target.value)}
                              >
                                  <option value="">-- Select Active Officer --</option>
                                  {potentialSuccessors.map(u => (
                                      <option key={u.id} value={u.id}>{u.full_name}</option>
                                  ))}
                              </select>
                          </div>
                      )}

                      <div className="flex gap-3 pt-4">
                          <button onClick={() => setShowRevokeModal(false)} className="flex-1 px-4 py-2 border rounded-md text-sm font-medium">Cancel</button>
                          <button 
                            onClick={handleRevokeAccess}
                            disabled={isProcessing || !revocationReason}
                            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-bold disabled:opacity-50"
                          >
                              {isProcessing ? 'Processing...' : 'Confirm Revocation'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};