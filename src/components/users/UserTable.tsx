import React from 'react';
import { UserCog, Copy, RefreshCw } from 'lucide-react';
import { UserProfile } from '@/types';

interface UserTableProps {
  users: UserProfile[];
  loading: boolean;
  onManage: (user: UserProfile) => void;
  onCopy: (text: string) => void;
}

export const UserTable: React.FC<UserTableProps> = ({ users, loading, onManage, onCopy }) => {
  return (
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
            ) : users.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">No users found matching your search.</td></tr>
            ) : (
              users.map(user => (
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
                          <button onClick={() => onCopy(user.email)} className="ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-indigo-600">
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
                      onClick={() => onManage(user)} 
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
  );
};