import React, { useState } from 'react';
import { Users } from './Users';
import { AuditLogs } from './AuditLogs';
import { SystemSettings } from './SystemSettings';
import { Performance } from './Performance';

const Administration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'audit-logs' | 'system-settings' | 'performance'>('users');

  const renderContent = () => {
    switch (activeTab) {
      case 'users':
        return <Users />;
      case 'audit-logs':
        return <AuditLogs />;
      case 'system-settings':
        return <SystemSettings />;
      case 'performance':
        return <Performance />;
      default:
        return <Users />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`font-semibold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-2 underline-offset-4 ${
            activeTab === 'users' ? 'text-indigo-800' : ''
          }`}
        >
          Users
        </button>
        <button
          onClick={() => setActiveTab('audit-logs')}
          className={`font-semibold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-2 underline-offset-4 ${
            activeTab === 'audit-logs' ? 'text-indigo-800' : ''
          }`}
        >
          Audit Logs
        </button>
        <button
          onClick={() => setActiveTab('system-settings')}
          className={`font-semibold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-2 underline-offset-4 ${
            activeTab === 'system-settings' ? 'text-indigo-800' : ''
          }`}
        >
          System Settings
        </button>
        <button
          onClick={() => setActiveTab('performance')}
          className={`font-semibold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-2 underline-offset-4 ${
            activeTab === 'performance' ? 'text-indigo-800' : ''
          }`}
        >
          Performance
        </button>
      </div>
      <div>
        {renderContent()}
      </div>
    </div>
  );
};

export default Administration;