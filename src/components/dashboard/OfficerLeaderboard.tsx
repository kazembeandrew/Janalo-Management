import React from 'react';
import { Award, TrendingUp, Target } from 'lucide-react';
import { formatCurrency } from '@/utils/finance';

interface OfficerLeaderboardProps {
  officers: any[];
}

export const OfficerLeaderboard: React.FC<OfficerLeaderboardProps> = ({ officers }) => {
  // Sort by portfolio value descending
  const sorted = [...officers].sort((a, b) => b.portfolioValue - a.portfolioValue).slice(0, 5);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 flex items-center">
              <Award className="h-4 w-4 mr-2 text-yellow-500" />
              Top Loan Officers
          </h3>
          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">By Portfolio Value</span>
      </div>
      <div className="p-4 space-y-4">
          {sorted.length === 0 ? (
              <div className="text-center py-4 text-gray-400 text-sm">No officer data available.</div>
          ) : (
              sorted.map((officer, index) => (
                  <div key={officer.id} className="flex items-center justify-between">
                      <div className="flex items-center min-w-0">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${
                              index === 0 ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 
                              index === 1 ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                              index === 2 ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                              'bg-gray-50 text-gray-500'
                          }`}>
                              {index + 1}
                          </div>
                          <div className="truncate">
                              <p className="text-sm font-bold text-gray-900 truncate">{officer.name}</p>
                              <p className="text-[10px] text-gray-500">{officer.activeCount} Active Loans</p>
                          </div>
                      </div>
                      <div className="text-right ml-4">
                          <p className="text-sm font-bold text-indigo-600">{formatCurrency(officer.portfolioValue)}</p>
                          <div className="flex items-center justify-end text-[10px] text-green-600 font-medium">
                              <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                              {((officer.portfolioValue / (officers.reduce((sum, o) => sum + o.portfolioValue, 0) || 1)) * 100).toFixed(1)}% Share
                          </div>
                      </div>
                  </div>
              ))
          )}
      </div>
    </div>
  );
};