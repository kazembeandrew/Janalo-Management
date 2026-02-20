import React from 'react';
import { StatCard } from './StatCard';
import { Users, Award, Shield, Activity, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/utils/finance';

interface HRViewProps {
  stats: any;
  officerStats: any[];
}

export const HRView: React.FC<HRViewProps> = ({ stats, officerStats }) => {
  const topOfficer = officerStats.length > 0 ? officerStats[0] : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Active Staff" 
          value={officerStats.length} 
          subtitle="Loan Officers"
          icon={Users}
          color="bg-indigo-600"
        />
        <StatCard 
          title="Total Clients"
          value={stats.totalClients} 
          subtitle="Managed Portfolio"
          icon={Activity}
          color="bg-blue-500"
        />
        <StatCard 
          title="Portfolio At Risk" 
          value={stats.parCount} 
          subtitle="Collection Issues"
          icon={AlertTriangle}
          color="bg-red-500"
        />
        <StatCard 
          title="Top Performer" 
          value={topOfficer?.name || 'N/A'} 
          subtitle="Highest Portfolio"
          icon={Award}
          color="bg-yellow-500"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                  <Shield className="h-5 w-5 mr-2 text-indigo-600" />
                  Loan Officer Performance Overview
              </h3>
          </div>
          <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                      <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Officer</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Active Loans</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Portfolio Value</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">At Risk</th>
                      </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                      {officerStats.map((officer) => (
                          <tr key={officer.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                      <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                                          {(officer.name || 'U').charAt(0)}
                                      </div>
                                      <div className="ml-3 text-sm font-medium text-gray-900">{officer.name}</div>
                                  </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">{officer.activeCount}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">{formatCurrency(officer.portfolioValue)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${officer.atRisk > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                      {officer.atRisk}
                                  </span>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};