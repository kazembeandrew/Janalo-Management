import React, { useState } from 'react';
import { Calculator } from './Calculator';
import { ClientMap } from './ClientMap';
import { ImportData } from './ImportData';
import { DocumentCenter } from './DocumentCenter';

const Tools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'calculator' | 'client-map' | 'data-import' | 'document-center'>('calculator');

  const renderContent = () => {
    switch (activeTab) {
      case 'calculator':
        return <Calculator />;
      case 'client-map':
        return <ClientMap />;
      case 'data-import':
        return <ImportData />;
      case 'document-center':
        return <DocumentCenter />;
      default:
        return <Calculator />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-6">
        <button
          onClick={() => setActiveTab('calculator')}
          className={`font-semibold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-2 underline-offset-4 ${
            activeTab === 'calculator' ? 'text-indigo-800' : ''
          }`}
        >
          Calculator
        </button>
        <button
          onClick={() => setActiveTab('client-map')}
          className={`font-semibold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-2 underline-offset-4 ${
            activeTab === 'client-map' ? 'text-indigo-800' : ''
          }`}
        >
          Client Map
        </button>
        <button
          onClick={() => setActiveTab('data-import')}
          className={`font-semibold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-2 underline-offset-4 ${
            activeTab === 'data-import' ? 'text-indigo-800' : ''
          }`}
        >
          Data Import
        </button>
        <button
          onClick={() => setActiveTab('document-center')}
          className={`font-semibold text-indigo-600 hover:text-indigo-800 transition-colors underline decoration-2 underline-offset-4 ${
            activeTab === 'document-center' ? 'text-indigo-800' : ''
          }`}
        >
          Document Center
        </button>
      </div>
      <div>
        {renderContent()}
      </div>
    </div>
  );
};

export default Tools;