import React, { useState } from 'react';
import { Messages } from './Messages';
import { Tasks } from './Tasks';

const Communication: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'inbox' | 'tasks'>('inbox');

  const renderContent = () => {
    switch (activeTab) {
      case 'inbox':
        return <Messages />;
      case 'tasks':
        return <Tasks />;
      default:
        return <Messages />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-6">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`font-semibold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-2 underline-offset-4 ${
            activeTab === 'inbox' ? 'text-indigo-800' : ''
          }`}
        >
          Inbox
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`font-semibold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-2 underline-offset-4 ${
            activeTab === 'tasks' ? 'text-indigo-800' : ''
          }`}
        >
          Tasks
        </button>
      </div>
      <div>
        {renderContent()}
      </div>
    </div>
  );
};

export default Communication;