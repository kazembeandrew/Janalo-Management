import React, { useState } from 'react';
import { Shield, Users, Settings, Eye, Edit, Trash2, Plus, Search } from 'lucide-react';

interface Permission {
  id: string;
  name: string;
  description: string;
  module: string;
  role: string;
}

const Permissions: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedModule, setSelectedModule] = useState<string>('all');

  const permissions: Permission[] = [
    {
      id: '1',
      name: 'View Loans',
      description: 'Can view loan portfolio and details',
      module: 'Loans',
      role: 'Loan Officer'
    },
    {
      id: '2',
      name: 'Create Loans',
      description: 'Can create new loan applications',
      module: 'Loans',
      role: 'Loan Officer'
    },
    {
      id: '3',
      name: 'Approve Loans',
      description: 'Can approve and disburse loans',
      module: 'Loans',
      role: 'Manager'
    },
    {
      id: '4',
      name: 'Delete Loans',
      description: 'Can delete loan records',
      module: 'Loans',
      role: 'Admin'
    },
    {
      id: '5',
      name: 'View Borrowers',
      description: 'Can view borrower information',
      module: 'Borrowers',
      role: 'Loan Officer'
    },
    {
      id: '6',
      name: 'Manage Users',
      description: 'Can create and manage user accounts',
      module: 'Users',
      role: 'Admin'
    },
    {
      id: '7',
      name: 'View Reports',
      description: 'Can access financial reports',
      module: 'Reports',
      role: 'Manager'
    },
    {
      id: '8',
      name: 'System Settings',
      description: 'Can modify system configuration',
      module: 'System',
      role: 'Admin'
    }
  ];

  const modules = ['all', 'Loans', 'Borrowers', 'Users', 'Reports', 'System'];

  const filteredPermissions = permissions.filter(permission => {
    const matchesSearch = permission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         permission.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesModule = selectedModule === 'all' || permission.module === selectedModule;
    return matchesSearch && matchesModule;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="page-header-title">Permissions</h1>
          <p className="text-sm text-gray-500 mt-1">Manage user roles and permissions</p>
        </div>
        <button className="inline-flex items-center px-4 py-2 bg-indigo-600 border border-transparent rounded-xl shadow-sm text-xs font-bold text-white hover:bg-indigo-700 transition-all">
          <Plus className="h-4 w-4 mr-2" />
          Add Permission
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Search permissions..."
              />
            </div>
          </div>
          <div>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {modules.map(module => (
                <option key={module} value={module}>
                  {module === 'all' ? 'All Modules' : module}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Permission
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Module
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPermissions.map((permission) => (
                <tr key={permission.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Shield className="h-4 w-4 text-indigo-600 mr-2" />
                      <span className="text-sm font-medium text-gray-900">{permission.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {permission.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {permission.module}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      permission.role === 'Admin' ? 'bg-red-100 text-red-800' :
                      permission.role === 'Manager' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {permission.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button className="text-indigo-600 hover:text-indigo-900" title="View">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="text-green-600 hover:text-green-900" title="Edit">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-900" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredPermissions.length === 0 && (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No permissions found</h3>
              <p className="text-sm text-gray-500">
                Try adjusting your search or filter criteria
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Permissions;
