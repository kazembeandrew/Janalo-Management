import React from 'react';
import { Receipt, X, Info, Banknote, Building2, Smartphone, Wallet } from 'lucide-react';
import { formatCurrency } from '@/utils/finance';

// ─── Payment Method Types ─────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'bank' | 'airtel_money' | 'mpamba';

interface PaymentMethodOption {
  id: PaymentMethod;
  label: string;
  icon: React.ReactNode;
  color: string;
  activeColor: string;
  borderColor: string;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: 'cash',
    label: 'Cash',
    icon: <Banknote className="h-5 w-5" />,
    color: 'text-green-700',
    activeColor: 'bg-green-600 text-white shadow-green-200',
    borderColor: 'border-green-300 hover:border-green-500 hover:bg-green-50',
  },
  {
    id: 'bank',
    label: 'Bank',
    icon: <Building2 className="h-5 w-5" />,
    color: 'text-blue-700',
    activeColor: 'bg-blue-600 text-white shadow-blue-200',
    borderColor: 'border-blue-300 hover:border-blue-500 hover:bg-blue-50',
  },
  {
    id: 'airtel_money',
    label: 'Airtel Money',
    icon: <Smartphone className="h-5 w-5" />,
    color: 'text-red-700',
    activeColor: 'bg-red-600 text-white shadow-red-200',
    borderColor: 'border-red-300 hover:border-red-500 hover:bg-red-50',
  },
  {
    id: 'mpamba',
    label: 'Mpamba',
    icon: <Wallet className="h-5 w-5" />,
    color: 'text-yellow-700',
    activeColor: 'bg-yellow-500 text-white shadow-yellow-200',
    borderColor: 'border-yellow-300 hover:border-yellow-500 hover:bg-yellow-50',
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface RepaymentModalProps {
  isOpen: boolean;
  displayAmount: string;
  onAmountChange: (val: string) => void;
  paymentMethod: PaymentMethod | null;
  setPaymentMethod: (method: PaymentMethod) => void;
  transactionRef: string;
  setTransactionRef: (ref: string) => void;
  isProcessing: boolean;
  onClose: () => void;
  onConfirm: (e: React.FormEvent) => void;
  loan?: any;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const RepaymentModal: React.FC<RepaymentModalProps> = ({
  isOpen,
  displayAmount,
  onAmountChange,
  paymentMethod,
  setPaymentMethod,
  transactionRef,
  setTransactionRef,
  isProcessing,
  onClose,
  onConfirm,
  loan,
}) => {
  if (!isOpen) return null;

  // ── Payment allocation breakdown ──────────────────────────────────────────
  const amount = parseFloat(displayAmount) || 0;
  let principal = 0, interest = 0, penalty = 0, overpayment = 0;

  if (loan && amount > 0) {
    principal = Math.min(amount, Number(loan.principal_outstanding || 0));
    interest = Math.min(Math.max(amount - principal, 0), Number(loan.interest_outstanding || 0));
    penalty = Math.min(Math.max(amount - principal - interest, 0), Number(loan.penalty_outstanding || 0));
    overpayment = Math.max(amount - principal - interest - penalty, 0);
  }

  // ── Conditional field rules ───────────────────────────────────────────────
  const showBankRef = paymentMethod === 'bank';
  const showMobileRef = paymentMethod === 'airtel_money' || paymentMethod === 'mpamba';
  const mobileRefRequired = showMobileRef;

  const mobileRefLabel =
    paymentMethod === 'airtel_money' ? 'Airtel Money Transaction ID' : 'Mpamba Transaction ID / Reference';

  // ── Validation ────────────────────────────────────────────────────────────
  const isSubmitDisabled =
    isProcessing ||
    !paymentMethod ||
    !displayAmount ||
    parseFloat(displayAmount) <= 0 ||
    (mobileRefRequired && !transactionRef.trim());

  // ── Submit guard ──────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentMethod) return;
    if (mobileRefRequired && !transactionRef.trim()) return;
    onConfirm(e);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="bg-green-600 px-6 py-5 flex justify-between items-center">
          <h3 className="font-bold text-white flex items-center text-lg">
            <Receipt className="mr-3 h-6 w-6 text-green-200" />
            Record Repayment
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-green-200" />
          </button>
        </div>

        {/* ── Form ───────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Amount */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Amount Received (MWK)
            </label>
            <input
              required
              type="text"
              inputMode="decimal"
              className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              placeholder="0.00"
              value={displayAmount}
              onChange={e => onAmountChange(e.target.value)}
            />
          </div>

          {/* Payment allocation breakdown */}
          {amount > 0 && loan && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                  Payment Allocation
                </span>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Principal</span>
                  <span className="font-semibold text-gray-800">{formatCurrency(principal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Interest</span>
                  <span className="font-semibold text-gray-800">{formatCurrency(interest)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Penalty</span>
                  <span className="font-semibold text-gray-800">{formatCurrency(penalty)}</span>
                </div>
                {overpayment > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>Overpayment</span>
                    <span className="font-semibold">{formatCurrency(overpayment)}</span>
                  </div>
                )}
                <div className="border-t pt-2 mt-1 flex justify-between font-bold text-gray-900">
                  <span>Total</span>
                  <span>{formatCurrency(amount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Payment Method Buttons ──────────────────────────────────── */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map(method => {
                const isActive = paymentMethod === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(method.id);
                      // Clear ref when switching methods
                      setTransactionRef('');
                    }}
                    className={`
                      flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-semibold text-sm
                      transition-all duration-150 shadow-sm active:scale-[0.97] select-none
                      ${isActive
                        ? `${method.activeColor} border-transparent shadow-md`
                        : `bg-white ${method.borderColor} ${method.color}`
                      }
                    `}
                    aria-pressed={isActive}
                  >
                    {method.icon}
                    {method.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Conditional: Bank Reference ─────────────────────────────── */}
          {showBankRef && (
            <div className="animate-in slide-in-from-top-2 duration-150">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Transaction Reference
                <span className="ml-1 text-gray-400 font-normal normal-case">(Optional)</span>
              </label>
              <input
                type="text"
                className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="e.g. CHQ-0012345 or transfer ref"
                value={transactionRef}
                onChange={e => setTransactionRef(e.target.value)}
              />
            </div>
          )}

          {/* ── Conditional: Mobile Money Reference ─────────────────────── */}
          {showMobileRef && (
            <div className="animate-in slide-in-from-top-2 duration-150">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                {mobileRefLabel}
                <span className="ml-1 text-red-500">*</span>
              </label>
              <input
                required={mobileRefRequired}
                type="text"
                className={`
                  block w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:border-transparent outline-none
                  ${!transactionRef.trim()
                    ? 'border-red-300 focus:ring-red-400'
                    : 'border-gray-300 focus:ring-green-500'
                  }
                `}
                placeholder={
                  paymentMethod === 'airtel_money'
                    ? 'e.g. AIR2025XXXXXX'
                    : 'e.g. MPAMBA-XXXXXX'
                }
                value={transactionRef}
                onChange={e => setTransactionRef(e.target.value)}
              />
              {!transactionRef.trim() && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Transaction ID is required for mobile money payments
                </p>
              )}
            </div>
          )}

          {/* ── Submit Button ───────────────────────────────────────────── */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="
                w-full bg-green-600 text-white py-3 rounded-xl font-bold
                hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                transition-all shadow-lg shadow-green-100 active:scale-[0.98]
              "
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                'Confirm & Record Payment'
              )}
            </button>

            <p className="text-xs text-gray-400 mt-2 text-center flex items-center justify-center gap-1">
              <Info className="inline h-3 w-3" />
              Payment is posted automatically to the correct account
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
