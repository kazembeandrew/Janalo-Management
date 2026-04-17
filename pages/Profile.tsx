import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { User, Lock, Mail, Shield, Save, RefreshCw, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export const Profile: React.FC = () => {
  const { profile, user } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  
  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: fullName })
        .eq('id', profile.id);

      if (error) throw error;
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
        <p className="text-sm text-gray-500">Manage your personal information and security settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Summary Card */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-indigo-900 h-24 relative">
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
                    <div className="h-20 w-20 rounded-full bg-white p-1 shadow-lg">
                        <div className="h-full w-full rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-2xl font-bold">
                            {profile?.full_name?.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </div>
            </div>
            <div className="pt-12 pb-6 px-6 text-center">
                <h3 className="text-lg font-bold text-gray-900">{profile?.full_name}</h3>
                <p className="text-sm text-gray-500 flex items-center justify-center mt-1">
                    <Mail className="h-3 w-3 mr-1" /> {user?.email}
                </p>
                <div className="mt-4 flex justify-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 capitalize">
                        <Shield className="h-3 w-3 mr-1" /> {profile?.role?.replace('_', ' ')}
                    </span>
                </div>
            </div>
            <div className="border-t border-gray-100 px-6 py-4 bg-gray-50">
                <div className="flex items-center text-xs text-gray-500">
                    <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                    Account Active since {new Date(profile?.created_at || '').toLocaleDateString()}
                </div>
            </div>
          </div>
        </div>

        {/* Settings Forms */}
        <div className="md:col-span-2 space-y-6">
          {/* Personal Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="font-bold text-gray-900 flex items-center">
                    <User className="h-4 w-4 mr-2 text-indigo-600" />
                    Personal Information
                </h3>
            </div>
            <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Full Name</label>
                    <input 
                        type="text"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Email Address</label>
                    <input 
                        type="email"
                        disabled
                        className="mt-1 block w-full border border-gray-200 bg-gray-50 rounded-lg shadow-sm py-2 px-3 text-gray-500 sm:text-sm cursor-not-allowed"
                        value={user?.email || ''}
                    />
                    <p className="mt-1 text-xs text-gray-400 italic">Email cannot be changed. Contact admin for assistance.</p>
                </div>
                <div className="flex justify-end pt-2">
                    <button
                        type="submit"
                        disabled={isUpdating || fullName === profile?.full_name}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:bg-gray-400 transition-colors"
                    >
                        {isUpdating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Changes
                    </button>
                </div>
            </form>
          </div>

          {/* Security */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="font-bold text-gray-900 flex items-center">
                    <Lock className="h-4 w-4 mr-2 text-indigo-600" />
                    Security & Password
                </h3>
            </div>
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">New Password</label>
                        <input 
                            type="password"
                            required
                            minLength={6}
                            className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                        <input 
                            type="password"
                            required
                            minLength={6}
                            className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </div>
                </div>
                <div className="flex justify-end pt-2">
                    <button
                        type="submit"
                        disabled={isUpdating || !newPassword}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 focus:outline-none disabled:bg-gray-400 transition-colors"
                    >
                        {isUpdating ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
                        Update Password
                    </button>
                </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};