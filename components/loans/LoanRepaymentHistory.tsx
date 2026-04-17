import React, { useState } from 'react';
import { Repayment } from '@/types';
import { formatCurrency } from '@/utils/finance';
import { Eye, Download, Calendar, DollarSign, User, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

interface LoanRepaymentHistoryProps {
  repayments: Repayment[];
  onReverse?: (repayment: Repayment) => void;
}

export const LoanRepaymentHistory: React.FC<LoanRepaymentHistoryProps> = ({
  repayments,
  onReverse
}) => {
  const [selectedRepayment, setSelectedRepayment] = useState<Repayment | null>(null);

  const handleGenerateReceipt = (repayment: Repayment) => {
    // This would integrate with the existing receipt generation logic
    toast.success('Receipt generation initiated');
    console.log('Generating receipt for repayment:', repayment.id);
  };

  const getPaymentMethodIcon = (method?: string) => {
    if (!method) return <DollarSign className="h-4 w-4" />;
    switch (method.toLowerCase()) {
      case 'cash': return <DollarSign className="h-4 w-4" />;
      case 'bank_transfer': return <FileText className="h-4 w-4" />;
      case 'mobile_money': return <User className="h-4 w-4" />;
      default: return <DollarSign className="h-4 w-4" />;
    }
  };

  const getPaymentMethodColor = (method?: string) => {
    if (!method) return 'bg-gray-100 text-gray-800';
    switch (method.toLowerCase()) {
      case 'cash': return 'bg-green-100 text-green-800';
      case 'bank_transfer': return 'bg-blue-100 text-blue-800';
      case 'mobile_money': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Repayment History</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Payment Method
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Principal
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Interest
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Penalty
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {repayments.map((repayment) => (
              <tr key={repayment.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                    {new Date(repayment.payment_date).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {formatCurrency(repayment.amount_paid)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentMethodColor(repayment.payment_method)}`}>
                    {getPaymentMethodIcon(repayment.payment_method)}
                    <span className="ml-1">{repayment.payment_method || 'Not Specified'}</span>
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatCurrency(repayment.principal_paid)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatCurrency(repayment.interest_paid)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatCurrency(repayment.penalty_paid)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleGenerateReceipt(repayment)}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Receipt
                  </button>
                  {onReverse && (
                    <button
                      onClick={() => onReverse(repayment)}
                      className="inline-flex items-center px-3 py-1 border border-red-300 text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Reverse
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {repayments.length === 0 && (
        <div className="px-6 py-12 text-center text-gray-500">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p>No repayment history available.</p>
        </div>
      )}
    </div>
  );
};