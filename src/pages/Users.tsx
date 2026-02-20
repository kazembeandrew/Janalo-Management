import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { UserProfile, UserRole } from '@/types';
import { Shield, User, Power, Lock, Search, Plus, X, Mail, Key, Save, AlertTriangle, Trash2, Check, ArrowRight, UserPlus, Briefcase, Landmark, RefreshCw } from 'lucide-react';
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
  const [showReassignModal, setShowReassignModal] = useState(false);
  
  // Editing State
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editFormData, setEditFormData] = useState({
      full_name: '',
      role: 'loan_officer' as UserRole,
      is_active: true
  });
  const [resetPassword, setResetPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'delegation'>('profile');

  // Reassignment State
  const [successorId, setSuccessorId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Create Form States
  const [newUser, setNewUser] = useState({
      full_name: '',
      email: '',
      password: '', 
      role: 'loan_officer' as UserRole
  });

  // Guard: Admin OR CEO only
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

  // --- PORTFOLIO REASSIGNMENT & DEACTIVATION ---

  const handleDeactivateWithReassign = async () => {
      if (!selectedUser || !successorId) return;
      setIsProcessing(true);

      try {
          // 1. Execute atomic transfer via RPC
          const { error } = await supabase.rpc('reassign_officer_portfolio', {
              old_officer_id: selectedUser.id,
              new_officer_id: successorId
          });

          if (error) throw error;

          // 2. Log Audit
          const successorName = users.find(u => u.id === successorId)?.full_name || 'Unknown';
          await logAudit('Officer Portfolio Transferred', { 
              from: selectedUser.full_name, 
              to: successorName,
              reason: 'Deactivation'
          }, selectedUser.id);

          // 3. Notify Successor
          await supabase.from('notifications').insert({
              user_id: successorId,
              title: 'Portfolio Transferred',
              message: `You have been assigned the portfolio of ${selectedUser.full_name}.`,
              link: '/borrowers'
          });

          toast.success(`Portfolio transferred to ${successorName} and account deactivated.`);
          setShowReassignModal(false);
          setShowEditModal(false);
          fetchUsers();
      } catch (e: any) {
          toast.error("Transfer failed: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleToggleActive = async () => {
      if (!selectedUser) return;

      // If we are deactivating a Loan Officer, check if they have a portfolio
      if (selectedUser.is_active && selectedUser.role === 'loan_officer') {
          const { count } = await supabase
            .from('loans')
            .select('*', { count: 'exact', head: true })
            .eq('officer_id', selectedUser.id)
            .neq('status', 'completed');
          
          if (count && count > 0) {
              setSuccessorId('');
              setShowReassignModal(true);
              return;
          }
      }

      // Simple toggle if no portfolio or not an officer
      setIsProcessing(true);
      try {
          const { error } = await supabase
            .from('users')
            .update({ is_active: !selectedUser.is_active })
            .eq('id', selectedUser.id);
          
          if (error) throw error;
          
          await logAudit(selectedUser.is_active ? 'User Deactivated' : 'User Activated', {}, selectedUser.id);
          toast.success(`User ${selectedUser.is_active ? 'deactivated' : 'activated'}.`);
          setShowEditModal(false);
          fetchUsers();
      } catch (e: any) {
          toast.error("Failed to update status: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  // --- CREATE USER LOGIC (Admin Only) ---

  const handleCreateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (newUser.password.length < 6) {
          toast.error("Password must be at least 6 characters long.");
          return;
      }

      setIsProcessing(true);

      try {
          const response = await fetch('/api/admin/create-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  email: newUser.email,
                  password: newUser.password,
                  full_name: newUser.full_name,
                  role: newUser.role
              })
          });

          const data = await response.json();

          if (!response.ok) {
               throw new Error(data.error || 'Error creating user');
          }
          
          toast.success(`User created. Awaiting CEO approval for ${newUser.email}.`);
          
          setShowCreateModal(false);
          setNewUser({ full_name: '', email: '', password: '', role: 'loan_officer' });
          
          await fetchUsers();
          
      } catch (error: any) {
          console.error(error);
          toast.error('Failed to create user: ' + error.message);
      } finally {
          setIsProcessing(false);
      }
  };

  // --- APPROVAL LOGIC (CEO Only) ---

  const handleApproveRegistration = async () => {
      if (!selectedUser || profile?.role !== 'ceo') return;
      setIsProcessing(true);
      try {
          const { error } = await supabase
            .from('users')
            .update({ 
                is_active: true, 
                deletion_status: 'none' 
            })
            .eq('id', selectedUser.id);
          
          if (error) throw error;
          
          await logAudit('User Registration Approved', { email: selectedUser.email }, selectedUser.id);
          toast.success("User registration approved and account activated.");
          setShowEditModal(false);
          fetchUsers();
      } catch (e: any) {
          toast.error("Failed to approve user: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleRejectRegistration = async () => {
      if (!selectedUser || profile?.role !== 'ceo') return;
      if (!window.confirm("Rejecting will permanently delete this pending account. Continue?")) return;
      
      setIsProcessing(true);
      try {
          const { error } = await supabase.from('users').delete().eq('id', selectedUser.id);
          if (error) throw error;
          
          toast.success("Registration rejected and account removed.");
          setShowEditModal(false);
          fetchUsers();
      } catch (e: any) {
          toast.error("Failed to reject registration: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  // --- DELEGATION LOGIC ---

  const handleDelegateRole = async (targetRole: UserRole) => {
      if (!selectedUser || !profile) return;
      
      // Validation
      if (targetRole === 'hr' && profile.role !== 'admin') {
          toast.error("Only Admins can delegate HR duties.");
          return;
      }
      if (targetRole === 'accountant' && profile.role !== 'ceo') {
          toast.error("Only the CEO can delegate Accountant duties.");
          return;
      }

      setIsProcessing(true);
      try {
          const { error } = await supabase
            .from('users')
            .update({ role: targetRole })
            .eq('id', selectedUser.id);

          if (error) throw error;

          await logAudit('Role Delegated', { from_role: selectedUser.role, to_role: targetRole }, selectedUser.id);
          toast.success(`Duties successfully delegated to ${selectedUser.full_name}.`);
          setShowEditModal(false);
          fetchUsers();
      } catch (e: any) {
          toast.error("Delegation failed: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  // --- EDIT USER LOGIC ---

  const openEditModal = (user: UserProfile) => {
      setSelectedUser(user);
      setEditFormData({
          full_name: user.full_name,
          role: user.role,
          is_active: user.is_active
      });
      setResetPassword('');
      setActiveTab('profile');
      setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedUser || !profile) return;

      // CEO Approval check for role changes to CEO/Admin
      if ((editFormData.role === 'ceo' || editFormData.role === 'admin') && profile.role !== 'ceo') {
          toast.error("Only the CEO can assign Admin or CEO roles.");
          return;
      }

      setIsProcessing(true);
      try {
          const { error } = await supabase
            .from('users')
            .update({ 
                full_name: editFormData.full_name,
                role: editFormData.role,
                is_active: editFormData.is_active
            })
            .eq('id', selectedUser.id);

          if (error) throw error;

          await logAudit('User Profile Updated', { changes: editFormData }, selectedUser.id);
          toast.success("User profile updated.");
          setShowEditModal(false);
          setSelectedUser(null);
          fetchUsers();
      } catch (error: any) {
          toast.error('Failed to update user profile: ' + error.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleManualPasswordReset = async () => {
      if (!selectedUser || !resetPassword) return;

      if (resetPassword.length < 6) {
          toast.error("Password must be at least 6 characters long.");
          return;
      }

      setIsProcessing(true);
      
      try {
          const response = await fetch('/api/admin/reset-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  userId: selectedUser.id, 
                  newPassword: resetPassword 
              })
          });

          const data = await response.json();

          if (!response.ok) {
              throw new Error(data.error || 'Unknown error occurred');
          }
          
          await logAudit('Password Reset by Admin', {}, selectedUser.id);
          toast.success(`Password for ${selectedUser.full_name} has been updated.`);
          setResetPassword('');
      } catch (error: any) {
          toast.error('Failed to update password: ' + error.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleRequestDeletion = async () => {
      if (!selectedUser) return;
      if (!window.confirm("Request deletion for this user? CEO must approve.")) return;
      
      setIsProcessing(true);
      try {
          const { error } = await supabase.from('users').update({ deletion_status: 'pending' }).eq('id', selectedUser.id);
          if (error) throw error;
          
          toast.success("Deletion request sent to CEO.");
          setShowEditModal(false);
          fetchUsers();
      } catch (e: any) {
          toast.error("Failed to request deletion: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleApproveDeletion = async () => {
      if (!selectedUser || profile?.role !== 'ceo') return;
      if (!window.confirm("PERMANENTLY delete this user account? This cannot be undone.")) return;

      setIsProcessing(true);
      try {
          const { error } = await supabase.from('users').delete().eq('id', selectedUser.id);
          
          if (error) {
              if (error.code === '23503') {
                  toast.error("Cannot delete user linked to financial records. Deactivate them instead.");
                  return;
              }
              throw error;
          }
          
          toast.success("User permanently deleted.");
          setShowEditModal(false);
          fetchUsers();
      } catch (e: any) {
          toast.error("Failed to delete user: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleRejectDeletion = async () => {
      if (!selectedUser || profile?.role !== 'ceo') return;
      setIsProcessing(true);
      try {
          const { error } = await supabase.from('users').update({ deletion_status: 'none' }).eq('id', selectedUser.id);
          if (error) throw error;
          
          toast.success("Deletion request rejected.");
          setShowEditModal(false);
          fetchUsers();
      } catch (e: any) {
          toast.error("Failed to reject deletion: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const sortedUsers = [...filteredUsers].sort((a, b) => {
      if (a.deletion_status === 'pending_approval' && b.deletion_status !== 'pending_approval') return -1;
      if (a.deletion_status !== 'pending_approval' && b.deletion_status === 'pending_approval') return 1;
      if (a.deletion_status === 'pending' && b.deletion_status !== 'pending') return -1;
      if (a.deletion_status !== 'pending' && b.deletion_status === 'pending') return 1;
      return 0;
  });

  // Delegation Availability Checks
  const hrExists = users.some(u => u.role === 'hr' && u.is_active);
  const accountantExists = users.some(u => u.role === 'accountant' && u.is_active);

  // Successor List (Active Loan Officers excluding the one being deactivated)
  const potentialSuccessors = users.filter(u => 
      u.role === 'loan_officer' && 
      u.is_active && 
      u.id !== selectedUser?.id
  );

  if (!profile || (profile.role !== 'admin' && profile.role !== 'ceo')) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500">Manage system access and roles. New users require CEO approval.</p>
        </div>
        {profile.role === 'admin' && (
            <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-900 hover:bg-indigo-800 focus:outline-none"
            >
                <Plus className="h-4 w-4 mr-2" />
                Add New User
            </button>
        )}
      </div>

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
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">Loading users...</td></tr>
              ) : sortedUsers.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">No users found.</td></tr>
              ) : (
                sortedUsers.map((user) => (
                  <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${user.deletion_status === 'pending_approval' ? 'bg-indigo-50' : user.deletion_status === 'pending' ? 'bg-red-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0">
                          {user.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 flex items-center">
                              {user.full_name}
                              {user.deletion_status === 'pending_approval' && (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase">
                                      Pending Approval
                                  </span>
                              )}
                              {user.deletion_status === 'pending' && (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 uppercase">
                                      Deletion Requested
                                  </span>
                              )}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                        user.role === 'ceo' ? 'bg-blue-100 text-blue-800' :
                        user.role === 'hr' ? 'bg-orange-100 text-orange-800' :
                        user.role === 'accountant' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                        {user.role === 'ceo' && <Lock className="w-3 h-3 mr-1" />}
                        {user.role === 'hr' && <Briefcase className="w-3 h-3 mr-1" />}
                        {user.role === 'accountant' && <Landmark className="w-3 h-3 mr-1" />}
                        {user.role === 'loan_officer' && <User className="w-3 h-3 mr-1" />}
                        {user.role.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      {user.id !== profile.id && (
                          <button
                            onClick={() => openEditModal(user)}
                            className="text-indigo-600 hover:text-indigo-900 font-medium"
                          >
                            {profile.role === 'ceo' && (user.deletion_status === 'pending' || user.deletion_status === 'pending_approval') ? 'Review Request' : 'Manage'}
                          </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => setShowCreateModal(false)}></div>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                    <form onSubmit={handleCreateUser} className="p-6">
                        <div className="flex items-center mb-4">
                             <div className="bg-indigo-100 rounded-full p-2 mr-3">
                                <UserPlus className="h-6 w-6 text-indigo-600" />
                             </div>
                             <h3 className="text-lg font-medium text-gray-900">Register New User</h3>
                        </div>
                        
                        <div className="bg-indigo-50 p-3 rounded-md mb-4 border border-indigo-100">
                            <p className="text-xs text-indigo-700 flex items-start">
                                <Shield className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                                Maker-Checker Policy: This account will be created in a deactivated state and requires CEO approval before activation.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                                <input 
                                    type="text"
                                    required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 sm:text-sm"
                                    value={newUser.full_name}
                                    onChange={e => setNewUser({...newUser, full_name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                                <input 
                                    type="email"
                                    required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 sm:text-sm"
                                    value={newUser.email}
                                    onChange={e => setNewUser({...newUser, email: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Initial Password</label>
                                <input 
                                    type="password"
                                    required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 sm:text-sm"
                                    value={newUser.password}
                                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Assign Role</label>
                                <select
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 sm:text-sm"
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
                        </div>

                        <div className="mt-6 flex justify-end space-x-3">
                            <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
                            <button type="submit" disabled={isProcessing} className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                                {isProcessing ? 'Processing...' : 'Submit for Approval'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
      )}

      {/* REASSIGN PORTFOLIO MODAL */}
      {showReassignModal && selectedUser && (
          <div className="fixed inset-0 z-[60] overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                  <div className="fixed inset-0 bg-gray-900 bg-opacity-75" onClick={() => setShowReassignModal(false)}></div>
                  <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                      <div className="p-6">
                          <div className="flex items-center mb-4 text-orange-600">
                              <RefreshCw className="h-6 w-6 mr-2 animate-spin-slow" />
                              <h3 className="text-lg font-bold">Mandatory Portfolio Reassignment</h3>
                          </div>
                          <p className="text-sm text-gray-600 mb-4">
                              <strong>{selectedUser.full_name}</strong> has active clients and loans. You must reassign their entire portfolio to another active officer before deactivation.
                          </p>
                          
                          <div className="space-y-4">
                              <div>
                                  <label className="block text-sm font-medium text-gray-700">Select Successor Officer</label>
                                  <select
                                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 sm:text-sm"
                                      value={successorId}
                                      onChange={e => setSuccessorId(e.target.value)}
                                  >
                                      <option value="">-- Select Active Officer --</option>
                                      {potentialSuccessors.map(u => (
                                          <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                                      ))}
                                  </select>
                                  {potentialSuccessors.length === 0 && (
                                      <p className="mt-2 text-xs text-red-600 font-medium">No other active loan officers available. Please activate or create another officer first.</p>
                                  )}
                              </div>
                          </div>

                          <div className="mt-6 flex justify-end space-x-3">
                              <button type="button" onClick={() => setShowReassignModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
                              <button 
                                onClick={handleDeactivateWithReassign} 
                                disabled={isProcessing || !successorId} 
                                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                              >
                                {isProcessing ? 'Transferring...' : 'Transfer & Deactivate'}
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* EDIT / APPROVAL MODAL */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => setShowEditModal(false)}></div>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                    <div className="p-0">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900">Manage User</h3>
                                <p className="text-sm text-gray-500">{selectedUser.email}</p>
                            </div>
                            <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-500"><X className="h-5 w-5" /></button>
                        </div>

                        <div className="p-6">
                            {/* CEO APPROVAL SECTION FOR NEW REGISTRATION */}
                            {profile.role === 'ceo' && selectedUser.deletion_status === 'pending_approval' && (
                                <div className="bg-indigo-50 p-4 rounded-md border border-indigo-200 mb-6">
                                    <h4 className="text-indigo-800 font-bold flex items-center mb-2">
                                        <UserPlus className="h-5 w-5 mr-2" /> New Registration Approval
                                    </h4>
                                    <p className="text-sm text-indigo-700 mb-4">
                                        An Admin has registered this user. Please approve to activate the account or reject to remove it.
                                    </p>
                                    <div className="flex gap-3">
                                        <button onClick={handleApproveRegistration} disabled={isProcessing} className="flex-1 bg-indigo-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-indigo-700">Approve & Activate</button>
                                        <button onClick={handleRejectRegistration} disabled={isProcessing} className="flex-1 bg-white border border-red-300 text-red-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-red-50">Reject</button>
                                    </div>
                                </div>
                            )}

                            {/* CEO APPROVAL SECTION FOR DELETION */}
                            {profile.role === 'ceo' && selectedUser.deletion_status === 'pending' && (
                                <div className="bg-red-50 p-4 rounded-md border border-red-200 mb-6">
                                    <h4 className="text-red-800 font-bold flex items-center mb-2">
                                        <AlertTriangle className="h-5 w-5 mr-2" /> Deletion Requested
                                    </h4>
                                    <p className="text-sm text-red-700 mb-4">An Admin has requested to permanently delete this user.</p>
                                    <div className="flex gap-3">
                                        <button onClick={handleApproveDeletion} disabled={isProcessing} className="flex-1 bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700">Approve Delete</button>
                                        <button onClick={handleRejectDeletion} disabled={isProcessing} className="flex-1 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50">Reject</button>
                                    </div>
                                </div>
                            )}

                            <div className="flex border-b border-gray-200 mb-6">
                                <button onClick={() => setActiveTab('profile')} className={`flex-1 py-3 px-4 text-center text-sm font-medium ${activeTab === 'profile' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Profile & Access</button>
                                <button onClick={() => setActiveTab('security')} className={`flex-1 py-3 px-4 text-center text-sm font-medium ${activeTab === 'security' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Security</button>
                                <button onClick={() => setActiveTab('delegation')} className={`flex-1 py-3 px-4 text-center text-sm font-medium ${activeTab === 'delegation' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Delegation</button>
                            </div>

                            {activeTab === 'profile' && (
                                <form onSubmit={handleUpdateUser} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Full Name</label>
                                        <input type="text" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-50" value={editFormData.full_name} onChange={e => setEditFormData({...editFormData, full_name: e.target.value})} disabled={profile.role === 'ceo'} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">System Role</label>
                                        <select className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-50" value={editFormData.role} onChange={e => setEditFormData({...editFormData, role: e.target.value as UserRole})} disabled={profile.role === 'ceo'}>
                                            <option value="loan_officer">Loan Officer</option>
                                            <option value="hr">HR Manager</option>
                                            <option value="accountant">Accountant</option>
                                            <option value="ceo">CEO / Executive</option>
                                            <option value="admin">System Administrator</option>
                                        </select>
                                    </div>
                                    <div className="pt-2">
                                        <label className="text-sm font-medium text-gray-700">Account Status</label>
                                        <div className="mt-2 flex items-center space-x-4">
                                            <button type="button" onClick={handleToggleActive} className={`flex-1 py-2 px-4 rounded-md text-sm font-medium border transition-all ${editFormData.is_active ? 'bg-green-50 border-green-200 text-green-700 ring-2 ring-green-500' : 'bg-white border-gray-200 text-gray-500'}`}>
                                                {editFormData.is_active ? 'Active' : 'Activate Account'}
                                            </button>
                                            {editFormData.is_active && (
                                                <button type="button" onClick={handleToggleActive} className="flex-1 py-2 px-4 rounded-md text-sm font-medium border bg-white border-red-200 text-red-600 hover:bg-red-50">
                                                    Deactivate
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-100">
                                        <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
                                        {profile.role === 'admin' && <button type="submit" disabled={isProcessing} className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">{isProcessing ? 'Saving...' : 'Save Changes'}</button>}
                                    </div>
                                </form>
                            )}

                            {activeTab === 'security' && (
                                <div className="space-y-6">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-900 mb-2">Set New Password</h4>
                                        <div className="flex gap-2">
                                            <input type="password" university-password-input className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-100" placeholder="Min 6 chars" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} disabled={profile.role === 'ceo'} />
                                            {profile.role === 'admin' && <button type="button" onClick={handleManualPasswordReset} disabled={isProcessing || !resetPassword} className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"><Save className="h-4 w-4 mr-2" />Update</button>}
                                        </div>
                                    </div>
                                    <div className="border-t border-gray-100 pt-6">
                                        <h4 className="text-sm font-medium text-red-900 mb-2">Danger Zone</h4>
                                        <div className="flex flex-col gap-3">
                                            {profile.role === 'admin' && (
                                                <>
                                                    <button type="button" onClick={handleToggleActive} disabled={isProcessing || !selectedUser.is_active} className="inline-flex justify-center items-center px-4 py-2 border border-orange-300 rounded-md text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 disabled:opacity-50"><Power className="h-4 w-4 mr-2" />Revoke Access</button>
                                                    {selectedUser.deletion_status !== 'pending' && selectedUser.deletion_status !== 'pending_approval' && (
                                                        <button type="button" onClick={handleRequestDeletion} disabled={isProcessing} className="inline-flex justify-center items-center px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"><Trash2 className="h-4 w-4 mr-2" />Request Deletion</button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'delegation' && (
                                <div className="space-y-6">
                                    <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                                        <h4 className="text-blue-800 font-bold flex items-center mb-2">
                                            <Briefcase className="h-5 w-5 mr-2" /> Temporary Duty Delegation
                                        </h4>
                                        <p className="text-sm text-blue-700">
                                            Assign temporary responsibilities to this user if key positions are vacant.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        {/* HR Delegation (Admin Only) */}
                                        <div className="p-4 border rounded-lg bg-white">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <h5 className="font-bold text-gray-900">HR Duties</h5>
                                                    <p className="text-xs text-gray-500">Manage staff records and payroll.</p>
                                                </div>
                                                <button 
                                                    onClick={() => handleDelegateRole('hr')}
                                                    disabled={isProcessing || hrExists || profile.role !== 'admin' || selectedUser.role === 'hr'}
                                                    className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold disabled:bg-gray-300"
                                                >
                                                    {selectedUser.role === 'hr' ? 'Already HR' : hrExists ? 'HR Exists' : 'Delegate HR'}
                                                </button>
                                            </div>
                                            {hrExists && <p className="mt-2 text-[10px] text-orange-600 italic">An active HR account already exists. Delegation disabled.</p>}
                                        </div>

                                        {/* Accountant Delegation (CEO Only) */}
                                        <div className="p-4 border rounded-lg bg-white">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <h5 className="font-bold text-gray-900">Accountant Duties</h5>
                                                    <p className="text-xs text-gray-500">Manage financial reporting and expenses.</p>
                                                </div>
                                                <button 
                                                    onClick={() => handleDelegateRole('accountant')}
                                                    disabled={isProcessing || accountantExists || profile.role !== 'ceo' || selectedUser.role === 'accountant'}
                                                    className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold disabled:bg-gray-300"
                                                >
                                                    {selectedUser.role === 'accountant' ? 'Already Accountant' : accountantExists ? 'Accountant Exists' : 'Delegate Accountant'}
                                                </button>
                                            </div>
                                            {accountantExists && <p className="mt-2 text-[10px] text-orange-600 italic">An active Accountant account already exists. Delegation disabled.</p>}
                                        </div>
                                    </div>
                                    
                                    <div className="p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                        <p className="text-[10px] text-gray-500 text-center">
                                            All delegations are logged for accountability. CEO-level responsibilities cannot be delegated without full role reassignment.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};