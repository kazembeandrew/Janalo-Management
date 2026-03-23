import React, { useState } from 'react';
import { Accounts } from './Accounts';
import { FinancialStatements } from './FinancialStatements';
import { Budgets } from './Budgets';

const Financial: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'accounts' | 'statements' | 'budgets'>('accounts');

  const renderContent = () => {
    switch (activeTab) {
      case 'accounts':
        return <Accounts />;
      case 'statements':
        return <FinancialStatements />;
      case 'budgets':
        return <Budgets />;
      default:
        return <Accounts />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-6">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`font-semibold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-2 underline-offset-4 ${
            activeTab === 'accounts' ? 'text-indigo-800' : ''
          }`}
        >
          Accounts
        </button>
        <button
          onClick={() => setActiveTab('statements')}
          className={`font-semibold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-2 underline-offset-4 ${
            activeTab === 'statements' ? 'text-indigo-800' : ''
          }`}
        >
          Statements
        </button>
        <button
          onClick={() => setActiveTab('budgets')}
          className={`font-semibold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-2 underline-offset-4 ${
            activeTab === 'budgets' ? 'text-indigo-800' : ''
          }`}
        >
          Budgets
        </button>
      </div>
      <div>
        {renderContent()}
      </div>
    </div>
  );
};

export default Financial;