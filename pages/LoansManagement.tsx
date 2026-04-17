import React, { useState } from 'react';
import { Loans } from './Loans';
import { Repayments } from './Repayments';
import { RepaymentSchedule } from './RepaymentSchedule';
import { Collections } from './Collections';

const LoansManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'loans' | 'repayments' | 'schedule' | 'collections'>('loans');

  const renderContent = () => {
    switch (activeTab) {
      case 'loans':
        return <Loans />;
      case 'repayments':
        return <Repayments />;
      case 'schedule':
        return <RepaymentSchedule />;
      case 'collections':
        return <Collections />;
      default:
        return <Loans />;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-header-title">Loans Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage lifecycle, repayments, and collections</p>
        </div>
        
        <div className="bg-gray-100/80 backdrop-blur-sm p-1 rounded-xl inline-flex self-start border border-gray-200 shadow-sm">
          {(['loans', 'repayments', 'schedule', 'collections'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-200 ${
                activeTab === tab 
                  ? 'bg-white text-indigo-900 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }`}
            >
              {tab === 'loans' ? 'All Loans' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="animate-scale-in">
        {renderContent()}
      </div>
    </div>
  );
};

export default LoansManagement;