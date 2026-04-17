import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { repaymentService } from '@/services/repayments';
import { useAuth } from '@/context/AuthContext';

interface ReverseRepaymentModalProps {
  repaymentId: string;
  loanId: string;
  amount: number;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Reverse Repayment Modal Component
 * 
 * Allows authorized users to reverse erroneous repayments with full audit trail.
 * Uses the atomic reverse_repayment() database function for transactional safety.
 */
export const ReverseRepaymentModal: React.FC<ReverseRepaymentModalProps> = ({
  repaymentId,
  loanId,
  amount,
  onClose,
  onSuccess
}) => {
  const { profile } = useAuth();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationChecked, setConfirmationChecked] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      toast.error('Please provide a reason for reversal');
      return;
    }

    if (!confirmationChecked) {
      toast.error('Please confirm you understand the consequences');
      return;
    }

    if (!profile?.id) {
      toast.error('User not authenticated');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await repaymentService.reverseRepaymentAtomic({
        repaymentId,
        reason: reason.trim(),
        userId: profile.id
      });

      if (!result.success) {
        throw new Error(result.error?.message || 'Reversal failed');
      }

      toast.success(
        <div>
          <div className="font-semibold">Repayment reversed successfully</div>
          <div className="text-sm">
            Restored: MK {Number(result.data?.restoredPrincipal || 0).toLocaleString()} principal,
            MK {Number(result.data?.restoredInterest || 0).toLocaleString()} interest
          </div>
        </div>,
        { duration: 5000 }
      );
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Repayment reversal error:', error);
      toast.error(error.message || 'Failed to reverse repayment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Reverse Repayment</h2>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Warning Banner */}
          <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-800 mb-1">
                  This action will permanently reverse the repayment
                </p>
                <ul className="text-xs text-yellow-700 space-y-1 ml-2">
                  <li>• Loan balance will be restored by MK {amount.toLocaleString()}</li>
                  <li>• Associated journal entry will be deleted</li>
                  <li>• This action cannot be automatically undone</li>
                  <li>• Full audit trail will be maintained</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Reason Field */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Reversal <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Explain why this repayment needs to be reversed (required for audit trail)..."
              required
              disabled={isSubmitting}
              maxLength={500}
            />
            <p className="mt-1 text-xs text-gray-500">
              {reason.length}/500 characters
            </p>
          </div>

          {/* Confirmation Checkbox */}
          <div className="mb-6">
            <label className="flex items-start cursor-pointer">
              <input
                type="checkbox"
                checked={confirmationChecked}
                onChange={(e) => setConfirmationChecked(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                disabled={isSubmitting}
              />
              <span className="ml-3 text-sm text-gray-700">
                I understand that this will reverse the repayment and restore the loan balance. 
                This action is logged for audit purposes and requires supervisor approval if over MK 500,000.
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim() || !confirmationChecked}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Reversing...</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  <span>Confirm Reversal</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
