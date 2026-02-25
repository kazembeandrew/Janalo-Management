import React from 'react';
import { Clock, RotateCcw, ShieldAlert } from 'lucide-react';
import { Repayment } from '@/types';
import { formatCurrency } from '@/utils/finance';
import { useAuth } from '@/context/AuthContext';

interface LoanRepaymentHistoryProps {
  repayments: Repayment[];
  onReverse?: (repayment: Repayment) => void;
}

export const LoanRepaymentHistory: React.FC<LoanRepaymentHistoryProps> = ({ repayments, onReverse }) => {
  const { effectiveRoles } = useAuth();
  const canReverse = effectiveRoles.includes('admin') || effectiveRoles.includes('accountant');

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
        <h3 className="font-bold text-gray-900 flex items-center">
          <Clock className="h-4 w-4 mr-2 text-indigo-600" />
          Repayment History
        </h3>
        <div className="flex items-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            <ShieldAlert className="h-3 w-3 mr-1" /> Immutable Ledger
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase">Date</th>
              <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase">Amount</th>
              <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase">Principal</th>
              <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase">Interest</th>
              {canReverse && <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {repayments.length === 0 ? (
              <tr><td colSpan={canReverse ? 5 : 4} className="px-6 py-8 text-center text-xs text-gray-400 italic">No repayments recorded.</td></tr>
            ) : (
              repayments.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600">{new Date(r.payment_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-bold text-green-600">{formatCurrency(r.amount_paid)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-gray-500">{formatCurrency(r.principal_paid)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-gray-500">{formatCurrency(r.interest_paid)}</td>
                  {canReverse && (
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button 
                            onClick={() => onReverse?.(r)}
                            className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Reverse Transaction"
                          >
                              <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                      </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};