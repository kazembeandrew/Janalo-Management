import React from 'react';
import { StatCard } from './StatCard';
import { Banknote, Clock, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/utils/finance';
import { Link } from 'react-router-dom';

interface OfficerViewProps {
  stats: any;
}

export const OfficerView: React.FC<OfficerViewProps> = ({ stats }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <StatCard 
          title="My Active Loans" 
          value={stats.activeLoans} 
          subtitle="Currently managing"
          icon={Banknote}
          color="bg-indigo-600"
        />
        <StatCard 
          title="My Portfolio Value"
          value={formatCurrency(stats.totalPortfolio)} 
          subtitle="Principal + Interest"
          icon={CheckCircle}
          color="bg-emerald-500"
        />
        <StatCard 
          title="Due This Week" 
          value={stats.parCount} // Reusing PAR count logic for 'at risk/due'
          subtitle="Follow-ups needed"
          icon={Clock}
          color="bg-amber-500"
        />
        <StatCard 
          title="Action Required" 
          value={stats.reassessCount || 0} 
          subtitle="Fix & Resubmit"
          icon={AlertCircle}
          color="bg-red-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Quick Actions</h3>
              <p className="text-sm text-gray-500 mb-6">Common tasks for your daily field operations.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Link to="/loans/new" className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors group">
                      <span className="text-sm font-bold text-indigo-900">New Application</span>
                      <ArrowRight className="h-4 w-4 text-indigo-600 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link to="/borrowers" className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors group">
                      <span className="text-sm font-bold text-emerald-900">Register Client</span>
                      <ArrowRight className="h-4 w-4 text-emerald-600 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link to="/collections" className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-100 hover:bg-amber-100 transition-colors group">
                      <span className="text-sm font-bold text-amber-900">Record Payment</span>
                      <ArrowRight className="h-4 w-4 text-amber-600 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link to="/calculator" className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors group">
                      <span className="text-sm font-bold text-blue-900">Loan Calculator</span>
                      <ArrowRight className="h-4 w-4 text-blue-600 group-hover:translate-x-1 transition-transform" />
                  </Link>
              </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
              <div className="p-4 bg-indigo-50 rounded-full mb-4">
                  <Clock className="h-10 w-10 text-indigo-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Collection Target</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-xs">
                  You have collected <span className="font-bold text-indigo-600">{formatCurrency(stats.interestEarned)}</span> in interest this month.
              </p>
              <div className="w-full bg-gray-100 rounded-full h-2.5 mt-6">
                  <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: '65%' }}></div>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 uppercase font-bold tracking-wider">65% of Monthly Target Reached</p>
          </div>
      </div>
    </div>
  );
};