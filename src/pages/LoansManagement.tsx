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
    <div className="space-y-6">
      <div className="flex space-x-6">
        <button
          onClick={() => setActiveTab('loans')}
          className={`font-semibold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-2 underline-offset-4 ${
            activeTab === 'loans' ? 'text-indigo-800' : ''
          }`}
        >
          Loans
        </button>
        <button
          onClick={() => setActiveTab('repayments')}
          className={`font-semibold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-2 underline-offset-4 ${
            activeTab === 'repayments' ? 'text-indigo-800' : ''
          }`}
        >
          Repayment
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`font-semibold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-2 underline-offset-4 ${
            activeTab === 'schedule' ? 'text-indigo-800' : ''
          }`}
        >
          Schedule
        </button>
        <button
          onClick={() => setActiveTab('collections')}
          className={`font-semibold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-2 underline-offset-4 ${
            activeTab === 'collections' ? 'text-indigo-800' : ''
          }`}
        >
          Collections
        </button>
      </div>
      <div>
        {renderContent()}
      </div>
    </div>
  );
};

export default LoansManagement;