import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { UserProfile, UserRole } from '@/types';
import { 
    Shield, User, Power, Lock, Search, Plus, X, Mail, Key, Save, 
    AlertTriangle, Trash2, Check, ArrowRight, UserPlus, Briefcase, 
    Landmark, RefreshCw, Calendar, TrendingUp, Ban, Server, 
    AlertCircle, Copy, CheckCircle2, UserCog, Eraser, Archive, Eye, EyeOff
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export const Users: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [serverStatus, setServerStatus] = useState<{admin_enabled: boolean} | null>(null);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'promotion' | 'delegation' | 'security'>('profile');
  
  const [revocationReason, setRevocationReason] = useState('');
  const [successorId, setSuccessorId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [targetRole, setTargetRole] = useState<UserRole | ''>('');

  const [delegationData, setDelegationData] = useState({
      role: '' as UserRole | '',
      start: new Date().toISOString().split('T')[0],
      end: ''
  });

  const [newUser, setNewUser] = useState({
      full_name: '',
      username: '', 
      password: '', 
      role: 'loan_officer' as UserRole
  });

  const [newPassword, setNewPassword] = useState('');

  const isCEO = effectiveRoles.includes('ceo') || effectiveRoles.includes('admin');
  const isHR = effectiveRoles.includes('hr');

  useEffect(() => {
    if (profile && !isCEO && !isHR) {
      navigate('/');
    }
  }, [profile, navigate, isCEO, isHR]);

  useEffect(() => {
    fetchUsers();
    checkServerStatus();

    const channel = supabase
      .channel('users-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
          fetchUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
          toast.error("Server is not configured for user creation.");
          return;
      }
      setIsProcessing(true);
      
      const email = `${newUser.username.toLowerCase().trim()}@janalo.com`;
      
      try {
          const response = await fetch('/api/admin/create-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  ...newUser,
                  email: email
              })
          });

          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Failed to create user');

          await logAudit('User Created', { username: newUser.username, role: newUser.role }, result.user.id);
          toast.success(`User ${newUser.full_name} created successfully.`);
          setShowCreateModal(false);
          setNewUser({ full_name: '', username: '', password: '', role: 'loan_officer' });
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
      } catch (e: any) {
          toast.error("Revocation failed: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleArchiveUser = async () => {
      if (!selectedUser) return;
      
      const isCEO = profile?.role === 'ceo' || profile?.role === 'admin';
      
      if (isCEO) {
          if (!window.confirm("Archive User: This will deactivate the user immediately. Continue?")) return;
          setIsProcessing(true);
          try {
              const { error } = await supabase
                .from('users')
                .update({ 
                    is_active: false, 
                    deletion_status: 'approved',
                    revocation_reason: 'Archived by CEO'
                })
                .eq('id', selectedUser.id);
              if (error) throw error;
              toast.success("User archived successfully.");
              setShowEditModal(false);
          } catch (e: any) {
              toast.error("Archiving failed: " + e.message);
          } finally {
              setIsProcessing(false);
          }
      } else if (isHR) {
          if (!window.confirm("Request Archive: This will send a request to the CEO for approval. Continue?")) return;
          setIsProcessing(true);
          try {
              const { error } = await supabase
                .from('users')
                .update({ 
                    deletion_status: 'pending_approval'
                })
                .eq('id', selectedUser.id);
              if (error) throw error;
              toast.success("Archive request sent to CEO.");
              setShowEditModal(false);
          } catch (e: any) {
              toast.error("Request failed: " + e.message);
          } finally {
              setIsProcessing(false);
          }
      }
  };

  const handlePermanentDelete = async () => {
      if (!selectedUser || !isCEO) return;
      
      if (!window.confirm("CRITICAL ACTION: This will permanently delete the user record. This only works for users with NO historical data. Continue?")) return;

      setIsProcessing(true);
      try {
          const { error } = await supabase.from('users').delete().eq('id', selectedUser.id);
          
          if (error) {
              if (error.code === '23503') {
                  toast.error("Cannot hard delete: User is linked to historical records. Use 'Archive' instead to hide them.");
                  return;
              }
              throw error;
          }
          
          await logAudit('User Permanently Deleted', { email: selectedUser.email }, selectedUser.id);
          toast.success("User record permanently removed.");
          setShowEditModal(false);
      } catch (e: any) {
          toast.error("Deletion failed: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handlePromote = async () => {
      if (!selectedUser || !targetRole) return;
      if (serverStatus && !serverStatus.admin_enabled) {
          toast.error("Server is not configured for role synchronization.");
          return;
      }

      setIsProcessing(true);
      try {
          const response = await fetch('/api/admin/update-user-role', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: selectedUser.id, newRole: targetRole })
          });

          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Failed to promote user');
          
          await logAudit('User Promoted', { from: selectedUser.role, to: targetRole }, selectedUser.id);
          toast.success(`${selectedUser.full_name} promoted to ${targetRole.replace('_', ' ')}.`);
          setShowEditModal(false);
      } catch (e: any) {
          toast.error("Promotion failed: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleSaveDelegation = async () => {
      if (!selectedUser) return;
      
      const isClearing = !delegationData.role;
      
      if (!isClearing) {
          const existingDelegate = users.find(u => 
              u.id !== selectedUser.id && 
              u.delegated_role === delegationData.role &&
              u.is_active
          );

          if (existingDelegate) {
              toast.error(`The role ${delegationData.role.replace('_', ' ')} is already delegated to ${existingDelegate.full_name}. Only one user can hold a delegated role at a time.`);
              return;
          }
      }
      
      setIsProcessing(true);
      try {
          const updatePayload = {
              delegated_role: isClearing ? null : delegationData.role,
              delegation_start: isClearing ? null : delegationData.start,
              delegation_end: (isClearing || !delegationData.end) ? null : delegationData.end
          };

          const { error } = await supabase
            .from('users')
            .update(updatePayload)
            .eq('id', selectedUser.id);
          
          if (error) throw error;
          
          const action = isClearing ? 'Delegation Cleared' : 'Role Delegated';
          await logAudit(action, { role: delegationData.role, end: delegationData.end }, selectedUser.id);
          toast.success(isClearing ? `Delegation cleared for ${selectedUser.full_name}.` : `Duties delegated to ${selectedUser.full_name}.`);
          
          setShowEditModal(false);
      } catch (e: any) {
          toast.error("Delegation failed: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleClearDelegation = async () => {
      if (!selectedUser) return;
      
      setIsProcessing(true);
      try {
          const { error } = await supabase
            .from('users')
            .update({
                delegated_role: null,
                delegation_start: null,
                delegation_end: null
            })
            .eq('id', selectedUser.id);
          
          if (error) throw error;
          
          await logAudit('Delegation Cleared', { previous_role: selectedUser.delegated_role }, selectedUser.id);
          toast.success(`Delegation cleared for ${selectedUser.full_name}.`);
          
          setShowEditModal(false);
      } catch (e: any) {
          toast.error("Failed to clear delegation: " + e.message);
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

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const isArchived = u.deletion_status === 'approved';
    
    if (showArchived) return matchesSearch;
    return matchesSearch && !isArchived;
  });

  const potentialSuccessors = users.filter(u => u.role === 'loan_officer' && u.is_active && u.id !== selectedUser?.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="text-sm text-gray-500">Manage staff access, roles, and delegations.</p>
        </div>
        <div className="flex items-center space-x-3">
            <button 
                onClick={() => setShowArchived(!showArchived)}
                className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    showArchived 
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
            >
                {showArchived ? <EyeOff className="h-3.5 w-3.5 mr-1.5" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}
                {showArchived ? 'Hide Archived' : 'Show Archived'}
            </button>
            {serverStatus && (
                <div className={`flex items-center px-3 py-1.5 rounded-full text-xs font-bold border shadow-sm ${
                    serverStatus.admin_enabled 
                    ? 'bg-green-50 text-green-700 border-green-100' 
                    : 'bg-amber-50 text-amber-700 border-amber-100'
                }`}>
                    <Server className="h-3.5 w-3.5 mr-1.5" />
                    {serverStatus.admin_enabled ? 'Admin Server Ready' : 'Admin Server Restricted'}
                </div>
            )}
            <button 
                onClick={() => setShowCreateModal(true)} 
                className="bg-indigo-900 hover:bg-indigo-800 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all shadow-lg shadow-indigo-200 active:scale-95"
            >
                <Plus className="h-4 w-4 mr-2" /> Add User
            </button>
        </div>
      </div>

      {serverStatus && !serverStatus.admin_enabled && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start shadow-sm">
              <AlertCircle className="h-5 w-5 text-amber-600 mr-3 shrink-0 mt-0.5" />
              <div>
                  <h4 className="text-sm font-bold text-amber-800">Administrative Actions Restricted</h4>
                  <p className="text-xs text-amber-700 mt-1 leading-relaxed">
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
          className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm transition-all"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
                <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">User Details</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Primary Role</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
                {loading && users.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500"><RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading users...</td></tr>
                ) : filteredUsers.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">No users found matching your search.</td></tr>
                ) : (
                    filteredUsers.map(user => (
                    <tr key={user.id} className={`hover:bg-gray-50 transition-colors group ${user.deletion_status === 'approved' ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm ${user.deletion_status === 'approved' ? 'bg-gray-200 text-gray-500' : 'bg-indigo-100 text-indigo-700'}`}>
                            {user.full_name?.charAt(0)}
                            </div>
                            <div className="ml-4">
                            <div className="text-sm font-bold text-gray-900 flex items-center">
                                {user.full_name}
                                {user.deletion_status === 'approved' && (
                                    <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[8px] font-bold uppercase rounded border border-gray-200">Archived</span>
                                )}
                                {user.deletion_status === 'pending_approval' && (
                                    <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-bold uppercase rounded border border-amber-200">Pending CEO Approval</span>
                                )}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center">
                                {user.email}
                                <button onClick={() => copyToClipboard(user.email)} className="ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-indigo-600">
                                    <Copy className="h-3 w-3" />
                                </button>
                            </div>
                            </div>
                        </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gray-100 text-gray-700 uppercase w-fit border border-gray-200">{user.role.replace('_', ' ')}</span>
                            {user.delegated_role && (
                                <div className="flex items-center mt-1.5 text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md w-fit border border-indigo-100">
                                    <Briefcase className="h-2.5 w-2.5 mr-1" />
                                    + {user.delegated_role.replace('_', ' ')}
                                </div>
                            )}
                        </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                            user.is_active 
                            ? 'bg-green-50 text-green-700 border-green-100' 
                            : 'bg-red-50 text-red-700 border-red-100'
                        }`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                            onClick={() => openEditModal(user)} 
                            className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-all shadow-sm"
                        >
                            <UserCog className="h-4 w-4 mr-1.5" />
                            Manage
                        </button>
                        </td>
                    </tr>
                    ))
                )}
            </tbody>
            </table>
        </div>
      </div>

      {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-indigo-900 px-6 py-5 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center text-lg"><UserPlus className="mr-3 h-6 w-6 text-indigo-300" /> Add New Staff</h3>
                      <button onClick={() => setShowCreateModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5 text-indigo-300" /></button>
                  </div>
                  <form onSubmit={handleCreateUser} className="p-8 space-y-5">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Full Name</label>
                          <input 
                            required
                            type="text"
                            className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            placeholder="e.g. John Doe"
                            value={newUser.full_name}
                            onChange={e => setNewUser({...newUser, full_name: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Username</label>
                          <input 
                            required
                            type="text"
                            className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            placeholder="e.g. john"
                            value={newUser.username}
                            onChange={e => setNewUser({...newUser, username: e.target.value})}
                          />
                          <p className="mt-1 text-[10px] text-gray-400 italic">This will be used for login (e.g. {newUser.username || 'john'}@janalo.com)</p>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Initial Password</label>
                          <input 
                            required
                            type="password"
                            minLength={6}
                            className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            placeholder="••••••••"
                            value={newUser.password}
                            onChange={e => setNewUser({...newUser, password: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Primary Role</label>
                          <select 
                            className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white"
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
                            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-400 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]"
                          >
                              {isProcessing ? 'Creating Account...' : 'Create User Account'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {showEditModal && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-gray-50 px-6 py-5 border-b flex justify-between items-center">
                      <div className="flex items-center">
                          <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold mr-4">
                              {selectedUser.full_name?.charAt(0)}
                          </div>
                          <div>
                              <h3 className="font-bold text-gray-900">{selectedUser.full_name}</h3>
                              <p className="text-xs text-gray-500">{selectedUser.email}</p>
                          </div>
                      </div>
                      <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-gray-200 rounded-xl transition-colors"><X className="h-5 w-5 text-gray-400" /></button>
                  </div>
                  
                  <div className="flex border-b bg-gray-50/50">
                      <button onClick={() => setActiveTab('profile')} className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'profile' ? 'border-b-2 border-indigo-600 text-indigo-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}>Profile</button>
                      <button onClick={() => setActiveTab('promotion')} className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'promotion' ? 'border-b-2 border-indigo-600 text-indigo-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}>Promotion</button>
                      <button onClick={() => setActiveTab('delegation')} className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'delegation' ? 'border-b-2 border-indigo-600 text-indigo-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}>Delegation</button>
                      <button onClick={() => setActiveTab('security')} className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'security' ? 'border-b-2 border-indigo-600 text-indigo-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}>Security</button>
                  </div>

                  <div className="p-8">
                      {activeTab === 'profile' && (
                          <div className="space-y-6">
                              <div className="grid grid-cols-2 gap-6">
                                  <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                                      <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Primary Role</p>
                                      <p className="text-lg font-bold text-gray-900 capitalize">{selectedUser.role.replace('_', ' ')}</p>
                                  </div>
                                  <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                                      <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Account Status</p>
                                      <div className="flex items-center">
                                          <div className={`h-2 w-2 rounded-full mr-2 ${selectedUser.is_active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                          <p className={`text-lg font-bold ${selectedUser.is_active ? 'text-green-600' : 'text-red-600'}`}>
                                              {selectedUser.is_active ? 'Active' : 'Inactive'}
                                          </p>
                                      </div>
                                  </div>
                              </div>
                              {selectedUser.revocation_reason && !selectedUser.is_active && (
                                  <div className="p-5 bg-red-50 border border-red-100 rounded-2xl flex items-start">
                                      <AlertTriangle className="h-5 w-5 text-red-500 mr-3 shrink-0 mt-0.5" />
                                      <div>
                                          <p className="text-[10px] text-red-500 uppercase font-bold tracking-widest mb-1">Revocation Reason</p>
                                          <p className="text-sm text-red-700 font-medium">{selectedUser.revocation_reason}</p>
                                      </div>
                                  </div>
                              )}
                              <div className="flex items-center text-xs text-gray-400 italic">
                                  <Calendar className="h-3.5 w-3.5 mr-1.5" />
                                  Member since {new Date(selectedUser.created_at).toLocaleDateString()}
                              </div>
                          </div>
                      )}

                      {activeTab === 'promotion' && (
                          <div className="space-y-6">
                              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start">
                                  <AlertTriangle className="h-5 w-5 text-amber-600 mr-3 shrink-0 mt-0.5" />
                                  <p className="text-xs text-amber-700 leading-relaxed">
                                      <strong>Promotion is permanent.</strong> This replaces the user's current primary role. Ensure you have verified the staff member's new responsibilities before confirming.
                                  </p>
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">New Permanent Role</label>
                                  <select 
                                      className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
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
                              <div className="flex justify-end pt-4">
                                  <button 
                                    onClick={handlePromote}
                                    disabled={isProcessing || targetRole === selectedUser.role}
                                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm disabled:bg-gray-300 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                                  >
                                      Confirm Promotion
                                  </button>
                              </div>
                          </div>
                      )}

                      {activeTab === 'delegation' && (
                          <div className="space-y-6">
                              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex items-start">
                                  <Briefcase className="h-5 w-5 text-indigo-600 mr-3 shrink-0 mt-0.5" />
                                  <p className="text-xs text-indigo-700 leading-relaxed">
                                      <strong>Delegation is temporary.</strong> The user will hold both their primary role and the delegated role simultaneously. This is ideal for covering leave or temporary projects.
                                  </p>
                              </div>
                              
                              {selectedUser.delegated_role && (
                                  <div className="p-4 bg-white border border-indigo-100 rounded-2xl flex items-center justify-between shadow-sm">
                                      <div>
                                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Current Delegation</p>
                                          <p className="text-sm font-bold text-indigo-900">{selectedUser.delegated_role.replace('_', ' ')}</p>
                                      </div>
                                      <button 
                                        onClick={handleClearDelegation}
                                        disabled={isProcessing}
                                        className="flex items-center px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                                      >
                                          <Eraser className="h-3.5 w-3.5 mr-1.5" />
                                          Clear Delegation
                                      </button>
                                  </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Delegate New Role</label>
                                      <select 
                                          className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
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
                                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">End Date (Optional)</label>
                                      <input 
                                          type="date" 
                                          className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                                          value={delegationData.end}
                                          onChange={e => setDelegationData({...delegationData, end: e.target.value})}
                                      />
                                  </div>
                              </div>
                              <div className="flex justify-end pt-4">
                                  <button 
                                    onClick={handleSaveDelegation}
                                    disabled={isProcessing || !delegationData.role}
                                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 transition-all active:scale-95"
                                  >
                                      Save New Delegation
                                  </button>
                              </div>
                          </div>
                      )}

                      {activeTab === 'security' && (
                          <div className="space-y-8">
                              <div className="p-6 border border-gray-200 rounded-2xl bg-white shadow-sm">
                                  <h4 className="font-bold text-gray-900 flex items-center mb-4">
                                      <Key className="h-5 w-5 mr-2 text-indigo-600" />
                                      Reset User Password
                                  </h4>
                                  <form onSubmit={handleResetPassword} className="flex gap-3">
                                      <input 
                                        required
                                        type="password"
                                        placeholder="Enter new password..."
                                        className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                      />
                                      <button 
                                        type="submit"
                                        disabled={isProcessing || !newPassword || (serverStatus && !serverStatus.admin_enabled)}
                                        className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm disabled:bg-gray-400 transition-all active:scale-95"
                                      >
                                          Reset
                                      </button>
                                  </form>
                              </div>

                              <div className="p-6 border border-red-100 rounded-2xl bg-red-50/30">
                                  <h4 className="font-bold text-gray-900 flex items-center mb-2">
                                      <Ban className="h-5 w-5 mr-2 text-red-600" />
                                      Revoke Access
                                  </h4>
                                  <p className="text-xs text-gray-500 mb-5 leading-relaxed">
                                      Deactivating a user prevents them from logging in immediately. All historical data, including loans and repayments recorded by this user, will be preserved for audit purposes.
                                  </p>
                                  <button 
                                    onClick={() => setShowRevokeModal(true)}
                                    disabled={!selectedUser.is_active}
                                    className="w-full py-3 bg-white text-red-600 border border-red-200 rounded-xl text-sm font-bold hover:bg-red-50 disabled:opacity-50 transition-all active:scale-[0.99]"
                                  >
                                      {selectedUser.is_active ? 'Revoke System Access' : 'Access Already Revoked'}
                                  </button>
                              </div>

                              {(isCEO || isHR) && (
                                  <div className="p-6 border border-red-200 rounded-2xl bg-red-50 space-y-4">
                                      <div>
                                          <h4 className="font-bold text-red-800 flex items-center mb-2">
                                              <Archive className="h-5 w-5 mr-2" />
                                              {isCEO ? 'Archive User (Soft Delete)' : 'Request User Archive'}
                                          </h4>
                                          <p className="text-xs text-red-700 mb-3 leading-relaxed">
                                              {isCEO 
                                                ? "Use this if the user has historical records. It will hide them from the active list while keeping data integrity."
                                                : "This will send a request to the CEO to archive this user account."}
                                          </p>
                                          <button 
                                            onClick={handleArchiveUser}
                                            disabled={isProcessing || selectedUser.deletion_status === 'approved' || selectedUser.deletion_status === 'pending_approval'}
                                            className="w-full py-3 bg-white text-red-700 border border-red-300 rounded-xl text-sm font-bold hover:bg-red-50 transition-all active:scale-[0.99]"
                                          >
                                              {selectedUser.deletion_status === 'approved' ? 'User Already Archived' : 
                                               selectedUser.deletion_status === 'pending_approval' ? 'Archive Request Pending' :
                                               isCEO ? 'Archive User Record' : 'Send Archive Request'}
                                          </button>
                                      </div>

                                      {isCEO && (
                                          <div className="pt-4 border-t border-red-200">
                                              <h4 className="font-bold text-red-800 flex items-center mb-2">
                                                  <Trash2 className="h-5 w-5 mr-2" />
                                                  Permanent Deletion
                                              </h4>
                                              <p className="text-xs text-red-700 mb-3 leading-relaxed">
                                                  <strong>CEO ONLY:</strong> This action permanently removes the user record. This only works for accounts with <strong>NO</strong> historical data.
                                              </p>
                                              <button 
                                                onClick={handlePermanentDelete}
                                                disabled={isProcessing}
                                                className="w-full py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 active:scale-[0.99]"
                                              >
                                                  Permanently Delete Record
                                              </button>
                                          </div>
                                      )}
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {showRevokeModal && selectedUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                  <div className="p-8">
                      <div className="h-14 w-14 bg-red-100 rounded-2xl flex items-center justify-center mb-6">
                          <Ban className="h-8 w-8 text-red-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Revoke System Access</h3>
                      <p className="text-sm text-gray-500 mb-8 leading-relaxed">
                          You are about to deactivate <strong>{selectedUser.full_name}</strong>. Please provide a reason and handle any active portfolio responsibilities.
                      </p>
                      
                      <div className="space-y-6">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Reason for Revocation</label>
                              <select 
                                className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
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
                              <div className="p-5 bg-orange-50 border border-orange-100 rounded-2xl">
                                  <div className="flex items-center mb-3">
                                      <RefreshCw className="h-4 w-4 text-orange-600 mr-2" />
                                      <p className="text-xs text-orange-700 font-bold uppercase tracking-wider">Portfolio Reassignment</p>
                                  </div>
                                  <p className="text-[11px] text-orange-600 mb-4 leading-relaxed">
                                      This officer has active loans. Select a successor to take over their clients and conversations.
                                  </p>
                                  <select 
                                    className="block w-full border border-orange-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 bg-white"
                                    value={successorId}
                                    onChange={e => setSuccessorId(e.target.value)}
                                  >
                                      <option value="">-- Select Successor Officer --</option>
                                      {potentialSuccessors.map(u => (
                                          <option key={u.id} value={u.id}>{u.full_name}</option>
                                      ))}
                                  </select>
                              </div>
                          )}

                          <div className="flex gap-3 pt-4">
                              <button onClick={() => setShowRevokeModal(false)} className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all">Cancel</button>
                              <button 
                                onClick={handleRevokeAccess}
                                disabled={isProcessing || !revocationReason || (selectedUser.role === 'loan_officer' && !successorId)}
                                className="flex-1 bg-red-600 text-white px-4 py-3 rounded-xl text-sm font-bold disabled:opacity-50 shadow-lg shadow-red-100 transition-all active:scale-95"
                              >
                                  {isProcessing ? 'Processing...' : 'Confirm Revocation'}
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};