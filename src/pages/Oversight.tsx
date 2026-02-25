import React from 'react';
import { CEOOversight } from '@/components/dashboard/CEOOversight';
import { ShieldCheck, Info } from 'lucide-react';

export const Oversight: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <ShieldCheck className="h-6 w-6 mr-2 text-indigo-600" />
          Executive Oversight Queue
        </h1>
        <p className="text-sm text-gray-500">Review and authorize pending loans, expenses, and system tasks.</p>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-start shadow-sm">
          <Info className="h-5 w-5 text-indigo-600 mr-3 shrink-0 mt-0.5" />
          <p className="text-xs text-indigo-700 leading-relaxed">
              This queue centralizes all items requiring <strong>Executive Authorization</strong>. Actions performed here are final and will be recorded in the immutable system audit log.
          </p>
      </div>

      <CEOOversight />
    </div>
  );
};