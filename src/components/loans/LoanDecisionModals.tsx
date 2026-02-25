import React from 'react';
import { ThumbsUp, RotateCcw, Ban, X, Landmark, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/utils/finance';
import { InternalAccount } from '@/types';

interface DecisionModalProps {
    type: 'approve' | 'reassess' | 'reject';
    loan: any;
    accounts: InternalAccount[];
    targetAccountId: string;
    setTargetAccountId: (id: string) => void;
    reason: string;
    setReason: (val: string) => void;
    isProcessing: boolean;
    onClose: () => void;
    onConfirm: (status: string, note: string, accountId?: string) => void;
}

export const LoanDecisionModals: React.FC<DecisionModalProps> = ({
    type, loan, accounts, targetAccountId, setTargetAccountId, 
    reason, setReason, isProcessing, onClose, onConfirm
}) => {
    const config = {
        approve: {
            title: 'Approve & Disburse',
            icon: ThumbsUp,
            color: 'indigo',
            btnText: 'Confirm Approval',
            status: 'active'
        },
        reassess: {
            title: 'Send for Reassessment',
            icon: RotateCcw,
            color: 'purple',
            btnText: 'Confirm Reassessment',
            status: 'reassess'
        },
        reject: {
            title: 'Reject Application',
            icon: Ban,
            color: 'red',
            btnText: 'Confirm Rejection',
            status: 'rejected'
        }
    }[type];

    const Icon = config.icon;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className={`bg-${config.color}-900 px-6 py-5 flex justify-between items-center`}>
                    <h3 className="font-bold text-white flex items-center text-lg">
                        <Icon className={`mr-3 h-6 w-6 text-${config.color}-300`} /> 
                        {config.title}
                    </h3>
                    <button onClick={onClose} className={`p-1.5 hover:bg-white/10 rounded-lg transition-colors`}>
                        <X className={`h-5 w-5 text-${config.color}-300`} />
                    </button>
                </div>
                <div className="p-8 space-y-5">
                    <div className={`p-4 bg-${config.color}-50 rounded-2xl border border-${config.color}-100`}>
                        <p className={`text-xs text-${config.color}-700 leading-relaxed`}>
                            {type === 'approve' 
                                ? `Approving this loan will mark it as Active and record an institutional disbursement of ${formatCurrency(loan.principal_amount)}.`
                                : type === 'reassess'
                                ? "This will return the application to the loan officer. Please specify what needs to be corrected or verified."
                                : "Are you sure you want to reject this application? This action is permanent and will be logged in the audit trail."}
                        </p>
                    </div>

                    {type === 'approve' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Disburse From Account</label>
                            <select 
                                required 
                                className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white" 
                                value={targetAccountId} 
                                onChange={e => setTargetAccountId(e.target.value)}
                            >
                                <option value="">-- Select Source Account --</option>
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</option>)}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                            {type === 'approve' ? 'Approval Note (Optional)' : 'Reason / Instructions'}
                        </label>
                        <textarea 
                            required={type !== 'approve'}
                            className={`block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-${config.color}-500 h-24 resize-none`} 
                            placeholder="Add comments here..." 
                            value={reason} 
                            onChange={e => setReason(e.target.value)} 
                        />
                    </div>

                    <div className="pt-4">
                        <button 
                            onClick={() => onConfirm(config.status, reason, targetAccountId)} 
                            disabled={isProcessing || (type === 'approve' && !targetAccountId) || (type !== 'approve' && !reason.trim())} 
                            className={`w-full bg-${config.color}-600 text-white py-3 rounded-xl font-bold hover:bg-${config.color}-700 disabled:bg-gray-400 transition-all shadow-lg shadow-${config.color}-200`}
                        >
                            {isProcessing ? 'Processing...' : config.btnText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};