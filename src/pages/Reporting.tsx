import React, { useState } from 'react';
import { Reports } from './Reports';
import { Expenses } from './Expenses';
import { AdvancedAnalytics } from './AdvancedAnalytics';

const Reporting: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'reports' | 'expenses' | 'analytics'>('reports');

  const renderContent = () => {
    switch (activeTab) {
      case 'reports':
        return <Reports />;
      case 'expenses':
        return <Expenses />;
      case 'analytics':
        return <AdvancedAnalytics />;
      default:
        return <Reports />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-6">
        <button
          onClick={() => setActiveTab('reports')}
          className={`font-semibold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-2 underline-offset-4 ${
            activeTab === 'reports' ? 'text-indigo-800' : ''
          }`}
        >
          Reports
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`font-semibold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-2 underline-offset-4 ${
            activeTab === 'expenses' ? 'text-indigo-800' : ''
          }`}
        >
          Expenses
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`font-semibold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-2 underline-offset-4 ${
            activeTab === 'analytics' ? 'text-indigo-800' : ''
          }`}
        >
          Analytics
        </button>
      </div>
      <div>
        {renderContent()}
      </div>
    </div>
  );
};

export default Reporting;