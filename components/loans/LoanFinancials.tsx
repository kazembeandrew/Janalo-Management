import React from 'react';
import { TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/utils/finance';
import { LoanSummaryCard } from '@/components/loans/LoanSummaryCard';

export interface LoanFinancialsProps {
  referenceNo: string;
  principalAmount: number;
  principalOutstanding: number;
  totalPayable: number;
  termMonths: number;
  interestType: string;
  status: string;
  recoveryPercent: number;
}

export const LoanFinancials: React.FC<LoanFinancialsProps> = ({
  referenceNo,
  principalAmount,
  principalOutstanding,
  totalPayable,
  termMonths,
  interestType,
  status,
  recoveryPercent,
}) => {
  const safeRecoveryPercent = Number.isFinite(recoveryPercent) ? Math.max(0, Math.min(100, recoveryPercent)) : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-900 flex items-center">
            <TrendingUp className="h-4 w-4 mr-2 text-indigo-600" />
            Repayment Progress
          </h3>
          <span className="text-xs font-bold text-indigo-600">{safeRecoveryPercent.toFixed(1)}% Recovered</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div className="bg-indigo-600 h-full transition-all duration-1000 ease-out" style={{ width: `${safeRecoveryPercent}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          <span>Disbursed: {formatCurrency(principalAmount)}</span>
          <span>Outstanding: {formatCurrency(principalOutstanding)}</span>
        </div>
      </div>

      <LoanSummaryCard
        referenceNo={referenceNo}
        principalAmount={principalAmount}
        totalPayable={totalPayable}
        termMonths={termMonths}
        interestType={interestType}
        status={status}
      />
    </div>
  );
};