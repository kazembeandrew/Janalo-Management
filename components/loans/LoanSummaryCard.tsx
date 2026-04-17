import React from 'react';
import { formatCurrency } from '@/utils/finance';
import { DollarSign, Calendar, TrendingUp, Users } from 'lucide-react';

interface LoanSummaryCardProps {
  referenceNo: string;
  principalAmount: number;
  totalPayable: number;
  termMonths: number;
  interestType: string;
  status: string;
  overpaymentAmount?: number;
}

export const LoanSummaryCard: React.FC<LoanSummaryCardProps> = ({
  referenceNo,
  principalAmount,
  totalPayable,
  termMonths,
  interestType,
  status,
  overpaymentAmount
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'defaulted': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getInterestRate = () => {
    // This would typically come from the loan object
    // For now, we'll calculate based on total payable
    if (!principalAmount || !termMonths) return "0.00";
    const totalInterest = Number(totalPayable || 0) - Number(principalAmount || 0);
    const monthlyInterest = totalInterest / termMonths;
    const monthlyRate = monthlyInterest / principalAmount;
    return (Number(monthlyRate * 12 * 100) || 0).toFixed(2);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Loan Summary</h3>
          <p className="text-sm text-gray-600">Reference: {referenceNo}</p>
        </div>
        <span className={`px-3 py-1 inline-flex text-sm font-semibold rounded-full ${getStatusColor(status)}`}>
          {status}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Principal Amount</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(principalAmount)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Payable</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalPayable)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Term</p>
              <p className="text-xl font-bold text-gray-900">{termMonths} months</p>
            </div>
            <Calendar className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Interest Rate</p>
              <p className="text-xl font-bold text-gray-900">{getInterestRate()}% APR</p>
            </div>
            <Users className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-600">Interest Type:</span>
          <span className="font-medium text-gray-900 uppercase tracking-tighter">{interestType}</span>
        </div>
        {overpaymentAmount && overpaymentAmount > 0 ? (
          <div className="mt-2 flex items-center justify-between text-xs p-3 bg-indigo-50 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <span className="text-indigo-700 font-bold uppercase tracking-wider">Client Deposit:</span>
            <span className="font-extrabold text-indigo-700 bg-white px-2 py-1 rounded-lg border border-indigo-100 shadow-sm">{formatCurrency(overpaymentAmount)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};