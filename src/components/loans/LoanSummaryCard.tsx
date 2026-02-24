import React from 'react';
import { Receipt } from 'lucide-react';
import { formatCurrency } from '@/utils/finance';
import { LoanStatus } from '@/types';

interface LoanSummaryCardProps {
  principalAmount: number;
  totalPayable: number;
  termMonths: number;
  interestType: string;
  status: LoanStatus;
}

export const LoanSummaryCard: React.FC<LoanSummaryCardProps> = ({ 
  principalAmount, 
  totalPayable, 
  termMonths, 
  interestType, 
  status 
}) => {
  const totalInterest = totalPayable - principalAmount;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'completed': return 'bg-green-50 text-green-700 border-green-100';
      case 'pending': return 'bg-yellow-50 text-yellow-700 border-yellow-100';
      case 'reassess': return 'bg-purple-50 text-purple-700 border-purple-100';
      default: return 'bg-red-50 text-red-700 border-red-100';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
        <h3 className="font-bold text-gray-900 flex items-center">
          <Receipt className="h-4 w-4 mr-2 text-indigo-600" />
          Loan Summary
        </h3>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(status)}`}>
          {status}
        </span>
      </div>
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
        <div className="min-w-0">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 truncate">Principal Amount</p>
          <p className="text-lg font-bold text-gray-900 truncate">{formatCurrency(principalAmount)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 truncate">Total Interest</p>
          <p className="text-lg font-bold text-indigo-600 truncate">{formatCurrency(totalInterest)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 truncate">Loan Term</p>
          <p className="text-lg font-bold text-gray-900 truncate">{termMonths} Months</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 truncate">Interest Type</p>
          <p className="text-lg font-bold text-gray-900 truncate capitalize">{interestType} Rate</p>
        </div>
      </div>
    </div>
  );
};