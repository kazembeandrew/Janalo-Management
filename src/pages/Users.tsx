import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { UserProfile, UserRole } from '@/types';
import { Shield, User, Power, Lock, Search, Plus, X, Mail, Key, Save, AlertTriangle, Trash2, Check, ArrowRight, UserPlus, Briefcase, Landmark, RefreshCw, Calendar, TrendingUp, Ban, Server, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export const Users: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [serverStatus, setServerStatus] = useState<{admin_enabled: boolean} | null>(null);
  
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

  // Password Reset State
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (profile && profile.role !== 'admin' && profile.role !== 'ceo') {
      navigate('/');
    }
  }, [profile, navigate]);

  useEffect(() => {
    fetchUsers();
    checkServerStatus();
  }, []);

  const checkServerStatus = async () => {
      try {
          const res = await fetch('/api/health');
          const data = await res.json();
          setServerStatus(data);
      } catch (e) {
          console.error("Failed to check server status", e);
      }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
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

  const handleCreateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (serverStatus && !serverStatus.admin_enabled) {
          toast.error("Server is not configured for user creation. Please add SUPABASE_SERVICE_ROLE_KEY.");
          return;
      }
      setIsProcessing(true);
      
      try {
          const response = await fetch('/api/admin/create-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newUser)
          });

          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Failed to create user');

          await logAudit('User Created', { email: newUser.email, role: newUser.role }, result.user.id);
          toast.success(`User ${newUser.full_name} created successfully.`);
          setShowCreateModal(false);
          setNewUser({ full_name: '', email: '', password: '', role: 'loan_officer' });
          fetchUsers();
      } catch (error: any) {
          toast.error(error.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedUser || !newPassword) return;
      if (serverStatus && !serverStatus.admin_enabled) {
          toast.error("Server is not configured for password resets.");
          return;
      }
      setIsProcessing(true);

      try {
          const response = await fetch('/api/admin/reset-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: selectedUser.id, newPassword })
          });

          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Failed to reset password');

          await logAudit('Password Reset', { admin: profile?.full_name }, selectedUser.id);
          toast.success("Password updated successfully.");
          setNewPassword('');
      } catch (error: any) {
          toast.error(error.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleRevokeAccess = async () => {
      if (!selectedUser || !revocationReason.trim()) {
          toast.error("Please provide a reason for revoking access.");
          return;
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

  const handlePermanentDelete = async () => {
      if (!selectedUser || profile?.role !== 'ceo') return;
      
      if (!window.confirm("CRITICAL ACTION: This will permanently delete the user record. Continue?")) return;

      setIsProcessing(true);
      try {
          const { error } = await supabase.from('users').delete().eq('id', selectedUser.id);
          
          if (error) {
              if (error.code === '23503') {
                  toast.error("Cannot hard delete: User is linked to historical records. Use 'Revoke Access' instead.");
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

  const handlePromote = async () => {
      if (!selectedUser || !targetRole) return;

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

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const potentialSuccessors = users.filter(u => u.role === 'loan_officer' && u.is_active && u.id !== selectedUser?.id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="text-sm text-gray-500">Manage staff access, roles, and delegations.</p>
        </div>
        <div className="flex items-center space-x-3">
            {serverStatus && (
                <div className={`flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
                    serverStatus.admin_enabled 
                    ? 'bg-green-50 text-green-700 border-green-100' 
                    : 'bg-amber-50 text-amber-700 border-amber-100'
                }`}>
                    <Server className="h-3 w-3 mr-1" />
                    {serverStatus.admin_enabled ? 'Admin Server Ready' : 'Admin Server Restricted'}
                </div>
            )}
            <button onClick={() => setShowCreateModal(true)} className="bg-indigo-900 hover:bg-indigo-800 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center transition-colors">
                <Plus className="h-4 w-4 mr-2" /> Add User
            </button>
        </div>
      </div>

      {serverStatus && !serverStatus.admin_enabled && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start">
              <AlertCircle className="h-5 w-5 text-amber-600 mr-3 shrink-0 mt-0.5" />
              <div>
                  <h4 className="text-sm font-bold text-amber-800">Administrative Actions Restricted</h4>
                  <p className="text-xs text-amber-700 mt-1">
                      The backend server is missing the <strong>SUPABASE_SERVICE_ROLE_KEY</strong>. 
                      You can view users, but creating new accounts or resetting passwords will not work until this secret is added to the environment variables.
                  </p>
              </div>
          </div>
      )}

      <div className="relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
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
            {loading ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">Loading users...</td></tr>
            ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">No users found.</td></tr>
            ) : (
                filteredUsers.map(user => (
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
                ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                  <div className="bg-indigo-900 px-6 py-4 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center"><UserPlus className="mr-2 h-5 w-5" /> Add New Staff Member</h3>
                      <button onClick={() => setShowCreateModal(false)}><X className="h-5 w-5 text-indigo-300" /></button>
                  </div>
                  <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                      {serverStatus && !serverStatus.admin_enabled && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                              User creation is currently disabled due to missing server configuration.
                          </div>
                      )}
                      <div>
                          <label className="block text-sm font-medium text-gray-700">Full Name</label>
                          <input 
                            required
                            type="text"
                            className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-sm"
                            value={newUser.full_name}
                            onChange={e => setNewUser({...newUser, full_name: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700">Email Address</label>
                          <input 
                            required
                            type="email"
                            className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-sm"
                            value={newUser.email}
                            onChange={e => setNewUser({...newUser, email: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700">Initial Password</label>
                          <input 
                            required
                            type="password"
                            minLength={6}
                            className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-sm"
                            value={newUser.password}
                            onChange={e => setNewUser({...newUser, password: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700">Primary Role</label>
                          <select 
                            className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-sm"
                            value={newUser.role}
                            onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                          >
                              <option value="loan_officer">Loan Officer</option>
                              <option value="hr">HR Manager</option>
                              <option value="accountant">Accountant</option>
                              <option value="ceo">CEO / Executive</option>
                              <option value="admin">System Administrator</option>
                          </select>
                      </div>
                      <div className="pt-4">
                          <button 
                            type="submit"
                            disabled={isProcessing || (serverStatus && !serverStatus.admin_enabled)}
                            className="w-full bg-indigo-600 text-white py-2 rounded-md font-bold hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                          >
                              {isProcessing ? 'Creating Account...' : 'Create User Account'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

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
                                      <strong>Promotion is permanent.</strong> This replaces the user's current role.
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
                                      <strong>Delegation is temporary.</strong> The user will hold both their primary role and the delegated role simultaneously.
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
                              <div className="flex justify-end pt-4">
                                  <button 
                                    onClick={handleSaveDelegation}
                                    disabled={isProcessing || !delegationData.role}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-bold"
                                  >
                                      Save Delegation
                                  </button>
                              </div>
                          </div>
                      )}

                      {activeTab === 'security' && (
                          <div className="space-y-6">
                              <div className="p-4 border rounded-lg bg-white">
                                  <h4 className="font-bold text-gray-900 flex items-center mb-4">
                                      <Key className="h-4 w-4 mr-2 text-indigo-600" />
                                      Reset User Password
                                  </h4>
                                  {serverStatus && !serverStatus.admin_enabled && (
                                      <p className="text-xs text-amber-600 mb-3">Password reset is disabled due to missing server configuration.</p>
                                  )}
                                  <form onSubmit={handleResetPassword} className="flex gap-2">
                                      <input 
                                        required
                                        type="password"
                                        placeholder="New password..."
                                        className="flex-1 border border-gray-300 rounded-md p-2 text-sm"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                      />
                                      <button 
                                        type="submit"
                                        disabled={isProcessing || !newPassword || (serverStatus && !serverStatus.admin_enabled)}
                                        className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-bold disabled:bg-gray-400"
                                      >
                                          Reset
                                      </button>
                                  </form>
                              </div>

                              <div className="p-4 border rounded-lg bg-white">
                                  <h4 className="font-bold text-gray-900 flex items-center mb-2">
                                      <Ban className="h-4 w-4 mr-2 text-red-600" />
                                      Revoke Access (Deactivate)
                                  </h4>
                                  <p className="text-xs text-gray-500 mb-4">
                                      User cannot log in, but all historical data is preserved.
                                  </p>
                                  <button 
                                    onClick={() => setShowRevokeModal(true)}
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
                                          Permanent Deletion
                                      </h4>
                                      <p className="text-xs text-red-700 mb-4">
                                          <strong>CEO ONLY:</strong> Permanently removes the user record.
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