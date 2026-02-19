import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { UserProfile, UserRole } from '@/types';
import { Shield, User, Power, Lock, Search, Plus, X, Mail, Key, Save, AlertTriangle, Trash2, Check, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Users: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Editing State
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editFormData, setEditFormData] = useState({
      full_name: '',
      role: 'loan_officer' as UserRole,
      is_active: true
  });
  const [resetPassword, setResetPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

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

  // --- CREATE USER LOGIC (Admin Only) ---

  const handleCreateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (newUser.password.length < 6) {
          alert("Password must be at least 6 characters long.");
          return;
      }

      setIsProcessing(true);

      try {
          // Use Express API to create user
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
          
          alert(`User account created successfully for ${newUser.email}.`);
          
          setShowCreateModal(false);
          setNewUser({ full_name: '', email: '', password: '', role: 'loan_officer' });
          
          // Refresh list
          await fetchUsers();
          
      } catch (error: any) {
          console.error(error);
          alert('Failed to create user: ' + error.message);
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
      if (!selectedUser) return;
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

          setUsers(users.map(u => u.id === selectedUser.id ? { 
              ...u, 
              full_name: editFormData.full_name,
              role: editFormData.role,
              is_active: editFormData.is_active
          } : u));

          setShowEditModal(false);
          setSelectedUser(null);
      } catch (error: any) {
          alert('Failed to update user profile: ' + error.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleManualPasswordReset = async () => {
      if (!selectedUser || !resetPassword) return;

      if (resetPassword.length < 6) {
          alert("Password must be at least 6 characters long.");
          return;
      }

      setIsProcessing(true);
      
      try {
          // Call the Express API
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
              const msg = data.error || 'Unknown error occurred';
              throw new Error(msg);
          }
          
          alert(`Success: Password for ${selectedUser.full_name} has been updated.`);
          setResetPassword('');
      } catch (error: any) {
          console.error('Reset failed:', error);
          alert('Failed to update password: ' + error.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleRevokeAccess = async () => {
      if (!selectedUser) return;
      if (!window.confirm("Are you sure? This will immediately block the user from logging in.")) return;

      setIsProcessing(true);
      try {
          const { error } = await supabase.from('users').update({ is_active: false }).eq('id', selectedUser.id);
          if (error) throw error;
          setUsers(users.map(u => u.id === selectedUser.id ? { ...u, is_active: false } : u));
          alert("User access revoked.");
          setShowEditModal(false);
      } catch (e: any) {
          console.error(e);
          alert("Failed to revoke access: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  // --- DELETION WORKFLOW ---

  const handleRequestDeletion = async () => {
      if (!selectedUser) return;
      if (!window.confirm("Are you sure you want to request deletion for this user? The CEO must approve this action.")) return;
      
      setIsProcessing(true);
      try {
          // Admin marks as pending
          const { error } = await supabase.from('users').update({ deletion_status: 'pending' }).eq('id', selectedUser.id);
          if (error) throw error;
          
          setUsers(users.map(u => u.id === selectedUser.id ? { ...u, deletion_status: 'pending' } : u));
          alert("Deletion request sent to CEO for approval.");
          setShowEditModal(false);
      } catch (e: any) {
          alert("Failed to request deletion: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleApproveDeletion = async () => {
      if (!selectedUser || profile?.role !== 'ceo') return;
      if (!window.confirm("CONFIRMATION: This will permanently delete the user account. This action cannot be undone.")) return;

      setIsProcessing(true);
      try {
          const { error } = await supabase.from('users').delete().eq('id', selectedUser.id);
          
          if (error) {
              // Handle Foreign Key Constraint Violation (User has loans/borrowers)
              if (error.code === '23503') {
                  alert("Cannot delete this user because they are linked to existing Loans, Borrowers, or Activity Logs.\n\nPlease 'Revoke Access' (Deactivate) them instead to preserve financial history.");
                  return;
              }
              throw error;
          }
          
          setUsers(users.filter(u => u.id !== selectedUser.id));
          alert("User permanently deleted.");
          setShowEditModal(false);
      } catch (e: any) {
          console.error(e);
          alert("Failed to delete user: " + e.message);
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
          
          setUsers(users.map(u => u.id === selectedUser.id ? { ...u, deletion_status: 'none' } : u));
          alert("Deletion request rejected.");
          setShowEditModal(false);
      } catch (e: any) {
          alert("Failed to reject deletion: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // CEO sees pending requests at the top
  const sortedUsers = [...filteredUsers].sort((a, b) => {
      if (a.deletion_status === 'pending' && b.deletion_status !== 'pending') return -1;
      if (a.deletion_status !== 'pending' && b.deletion_status === 'pending') return 1;
      return 0;
  });

  if (!profile || (profile.role !== 'admin' && profile.role !== 'ceo')) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500">Manage system access, onboard staff, and assign roles.</p>
        </div>
        {profile.role === 'admin' && (
            <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-900 hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="Search users by name or email..."
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
                <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">Loading users...</td>
                </tr>
              ) : sortedUsers.length === 0 ? (
                <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">No users found.</td>
                </tr>
              ) : (
                sortedUsers.map((user) => (
                  <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${user.deletion_status === 'pending' ? 'bg-red-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0">
                          {user.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 flex items-center">
                              {user.full_name}
                              {user.deletion_status === 'pending' && (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
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
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                        {user.role === 'ceo' && <Lock className="w-3 h-3 mr-1" />}
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
                            {profile.role === 'ceo' && user.deletion_status === 'pending' ? 'Review Request' : 'Manage'}
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
                                <Plus className="h-6 w-6 text-indigo-600" />
                             </div>
                             <h3 className="text-lg font-medium text-gray-900">Add New User</h3>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                                <input 
                                    type="text"
                                    required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={newUser.full_name}
                                    onChange={e => setNewUser({...newUser, full_name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                                <input 
                                    type="email"
                                    required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={newUser.email}
                                    onChange={e => setNewUser({...newUser, email: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Initial Password</label>
                                <input 
                                    type="password"
                                    required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={newUser.password}
                                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                                />
                                <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Assign Role</label>
                                <select
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={newUser.role}
                                    onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                                >
                                    <option value="loan_officer">Loan Officer</option>
                                    <option value="ceo">CEO / Executive</option>
                                    <option value="admin">System Administrator</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isProcessing}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {isProcessing ? 'Creating...' : 'Create Account'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
      )}

      {/* COMPREHENSIVE EDIT USER MODAL */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => setShowEditModal(false)}></div>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                    <div className="p-0">
                        {/* Modal Header */}
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900">Manage User</h3>
                                <p className="text-sm text-gray-500">{selectedUser.email}</p>
                            </div>
                            <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-500">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-200">
                            <button
                                onClick={() => setActiveTab('profile')}
                                className={`flex-1 py-3 px-4 text-center text-sm font-medium ${
                                    activeTab === 'profile' 
                                    ? 'border-b-2 border-indigo-500 text-indigo-600' 
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Profile & Access
                            </button>
                            <button
                                onClick={() => setActiveTab('security')}
                                className={`flex-1 py-3 px-4 text-center text-sm font-medium ${
                                    activeTab === 'security' 
                                    ? 'border-b-2 border-indigo-500 text-indigo-600' 
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Security
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6">
                            {activeTab === 'profile' && (
                                <form onSubmit={handleUpdateUser} className="space-y-4">
                                    {/* CEO APPROVAL SECTION */}
                                    {profile.role === 'ceo' && selectedUser.deletion_status === 'pending' && (
                                        <div className="bg-red-50 p-4 rounded-md border border-red-200 mb-6">
                                            <h4 className="text-red-800 font-bold flex items-center mb-2">
                                                <AlertTriangle className="h-5 w-5 mr-2" /> Deletion Requested
                                            </h4>
                                            <p className="text-sm text-red-700 mb-4">
                                                An Admin has requested to permanently delete this user. This action cannot be undone.
                                            </p>
                                            <div className="flex gap-3">
                                                <button
                                                    type="button"
                                                    onClick={handleApproveDeletion}
                                                    disabled={isProcessing}
                                                    className="flex-1 bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700"
                                                >
                                                    Approve Delete
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleRejectDeletion}
                                                    disabled={isProcessing}
                                                    className="flex-1 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Full Name</label>
                                        <input 
                                            type="text"
                                            required
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            value={editFormData.full_name}
                                            onChange={e => setEditFormData({...editFormData, full_name: e.target.value})}
                                            disabled={profile.role === 'ceo'}
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">System Role</label>
                                        <select
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            value={editFormData.role}
                                            onChange={e => setEditFormData({...editFormData, role: e.target.value as UserRole})}
                                            disabled={profile.role === 'ceo'}
                                        >
                                            <option value="loan_officer">Loan Officer</option>
                                            <option value="ceo">CEO / Executive</option>
                                            <option value="admin">System Administrator</option>
                                        </select>
                                    </div>

                                    <div className="pt-2">
                                        <label className="flex items-center space-x-3">
                                            <span className="text-sm font-medium text-gray-700">Account Status</span>
                                        </label>
                                        <div className="mt-2 flex items-center space-x-4">
                                            <button
                                                type="button"
                                                disabled={profile.role === 'ceo'}
                                                onClick={() => setEditFormData({...editFormData, is_active: true})}
                                                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium border ${
                                                    editFormData.is_active 
                                                    ? 'bg-green-50 border-green-200 text-green-700 ring-2 ring-green-500 ring-offset-1' 
                                                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                                }`}
                                            >
                                                Active
                                            </button>
                                            <button
                                                type="button"
                                                disabled={profile.role === 'ceo'}
                                                onClick={() => setEditFormData({...editFormData, is_active: false})}
                                                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium border ${
                                                    !editFormData.is_active 
                                                    ? 'bg-red-50 border-red-200 text-red-700 ring-2 ring-red-500 ring-offset-1' 
                                                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                                }`}
                                            >
                                                Inactive
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-100">
                                        <button
                                            type="button"
                                            onClick={() => setShowEditModal(false)}
                                            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                                        >
                                            Cancel
                                        </button>
                                        {profile.role === 'admin' && (
                                            <button
                                                type="submit"
                                                disabled={isProcessing}
                                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                                            >
                                                {isProcessing ? 'Saving...' : 'Save Changes'}
                                            </button>
                                        )}
                                    </div>
                                </form>
                            )}

                            {activeTab === 'security' && (
                                <div className="space-y-6">
                                    <div className="bg-yellow-50 p-4 rounded-md flex items-start">
                                        <Lock className="h-5 w-5 text-yellow-600 mr-3 mt-0.5" />
                                        <div>
                                            <h4 className="text-sm font-medium text-yellow-800">Password Management</h4>
                                            <p className="text-sm text-yellow-700 mt-1">
                                                Update the user's password directly. The user must use this new password on their next login.
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-medium text-gray-900 mb-2">Set New Password</h4>
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <input
                                                    type="password"
                                                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
                                                    placeholder="Enter new password (min 6 chars)"
                                                    value={resetPassword}
                                                    onChange={(e) => setResetPassword(e.target.value)}
                                                    disabled={profile.role === 'ceo'}
                                                />
                                            </div>
                                            {profile.role === 'admin' && (
                                                <button
                                                    type="button"
                                                    onClick={handleManualPasswordReset}
                                                    disabled={isProcessing || !resetPassword}
                                                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                                                >
                                                    <Save className="h-4 w-4 mr-2" />
                                                    Update
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-100 pt-6">
                                        <h4 className="text-sm font-medium text-red-900 mb-2">Danger Zone</h4>
                                        <p className="text-sm text-gray-500 mb-4">
                                            Revoke access immediately or request permanent deletion.
                                        </p>
                                        
                                        <div className="flex flex-col gap-3">
                                            {profile.role === 'admin' && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={handleRevokeAccess}
                                                        disabled={isProcessing}
                                                        className="inline-flex justify-center items-center px-4 py-2 border border-orange-300 shadow-sm text-sm font-medium rounded-md text-orange-700 bg-orange-50 hover:bg-orange-100 disabled:opacity-50"
                                                    >
                                                        <Power className="h-4 w-4 mr-2" />
                                                        Revoke Access (Deactivate)
                                                    </button>
                                                    
                                                    {selectedUser.deletion_status !== 'pending' ? (
                                                        <button
                                                            type="button"
                                                            onClick={handleRequestDeletion}
                                                            disabled={isProcessing}
                                                            className="inline-flex justify-center items-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Request Permanent Deletion
                                                        </button>
                                                    ) : (
                                                        <div className="text-center text-sm font-medium text-red-600 bg-red-50 p-2 rounded border border-red-100">
                                                            Deletion Pending CEO Approval
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
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