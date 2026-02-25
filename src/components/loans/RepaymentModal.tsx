import React from 'react';
import { Receipt, X } from 'lucide-react';
import { InternalAccount } from '@/types';

interface RepaymentModalProps {
    displayAmount: string;
    onAmountChange: (val: string) => void;
    accounts: InternalAccount[];
    targetAccountId: string;
    setTargetAccountId: (id: string) => void;
    isProcessing: boolean;
    onClose: () => void;
    onConfirm: (e: React.FormEvent) => void;
}

export const RepaymentModal: React.FC<RepaymentModalProps> = ({
    displayAmount, onAmountChange, accounts, targetAccountId, 
    setTargetAccountId, isProcessing, onClose, onConfirm
}) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-green-600 px-6 py-5 flex justify-between items-center">
                    <h3 className="font-bold text-white flex items-center text-lg"><Receipt className="mr-3 h-6 w-6 text-green-200" /> Record Repayment</h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5 text-green-200" /></button>
                </div>
                <form onSubmit={onConfirm} className="p-8 space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Amount Received (MK)</label>
                        <input 
                            required 
                            type="text" 
                            className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500" 
                            placeholder="0.00" 
                            value={displayAmount} 
                            onChange={e => onAmountChange(e.target.value)} 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Deposit Into Account</label>
                        <select 
                            required 
                            className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500 bg-white" 
                            value={targetAccountId} 
                            onChange={e => setTargetAccountId(e.target.value)}
                        >
                            <option value="">-- Select Account --</option>
                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.account_code})</option>)}
                        </select>
                    </div>
                    <div className="pt-4">
                        <button 
                            type="submit" 
                            disabled={isProcessing || !targetAccountId} 
                            className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 disabled:bg-gray-400 transition-all shadow-lg shadow-green-100 active:scale-[0.98]"
                        >
                            {isProcessing ? 'Processing...' : 'Confirm & Record Payment'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};