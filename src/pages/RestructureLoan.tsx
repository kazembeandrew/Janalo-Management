import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { calculateLoanDetails, formatCurrency, formatNumberWithCommas, parseFormattedNumber, generateAutoReference, isValidReferenceFormat, isReferenceUnique } from '@/utils/finance';
import { 
    RefreshCw, ArrowLeft, Calculator, AlertTriangle, 
    CheckCircle2, Save, TrendingUp, Banknote, Hash 
} from 'lucide-react';
import toast from 'react-hot-toast';

export const RestructureLoan: React.FC = () => {
  const { id } = useParams<{id: string}>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [oldLoan, setOldLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // New Loan Form State
  const [formData, setFormData] = useState({
    reference_no: '',
    principal_amount: 0,
    interest_rate: 5,
    interest_type: 'flat' as 'flat' | 'reducing',
    term_months: 12,
    disbursement_date: new Date().toISOString().split('T')[0]
  });

  const [displayPrincipal, setDisplayPrincipal] = useState('');
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    fetchOldLoan();
  }, [id]);

  const fetchOldLoan = async () => {
      if (!id) return;
      try {
          const { data, error } = await supabase
            .from('loans')
            .select('*, borrowers(full_name)')
            .eq('id', id)
            .single();
          
          if (error) throw error;
          if (data.status !== 'active') {
              toast.error("Only active loans can be restructured.");
              navigate(`/loans/${id}`);
              return;
          }

          setOldLoan(data);
          
          // Calculate total outstanding to be the new principal
          const totalOutstanding = Number(data.principal_outstanding) + 
                                   Number(data.interest_outstanding) + 
                                   Number(data.penalty_outstanding || 0);
          
          // Generate auto reference number for restructured loan
          const autoRef = await generateAutoReference();
          
          setFormData(prev => ({
              ...prev,
              principal_amount: totalOutstanding,
              interest_rate: data.interest_rate,
              interest_type: data.interest_type,
              term_months: data.term_months,
              reference_no: autoRef
          }));
          setDisplayPrincipal(formatNumberWithCommas(totalOutstanding));

      } catch (e) {
          console.error(e);
          toast.error("Failed to load loan data");
          navigate('/loans');
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
    if (formData.principal_amount > 0) {
        const details = calculateLoanDetails(
            formData.principal_amount,
            formData.interest_rate,
            formData.term_months,
            formData.interest_type
        );
        setPreview(details);
    }
  }, [formData]);

  const handlePrincipalChange = (val: string) => {
      const numeric = parseFormattedNumber(val);
      setDisplayPrincipal(formatNumberWithCommas(val));
      setFormData({ ...formData, principal_amount: numeric });
  };

  const handleRestructure = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!profile || !oldLoan || !preview) return;
      
      setIsProcessing(true);
      const loadingToast = toast.loading("Processing restructure...");

      try {
          // Validate reference number format and uniqueness
          if (!isValidReferenceFormat(formData.reference_no)) {
            toast.error('Invalid reference number format');
            return;
          }

          const isUnique = await isReferenceUnique(formData.reference_no);
          if (!isUnique) {
            toast.error('Reference number already exists. Please try again.');
            return;
          }

          // 1. Create the NEW loan (Pending Approval)
          const { data: newLoan, error: newError } = await supabase
            .from('loans')
            .insert([{
                reference_no: formData.reference_no.toUpperCase(),
                borrower_id: oldLoan.borrower_id,
                officer_id: profile.id,
                principal_amount: formData.principal_amount,
                interest_rate: formData.interest_rate,
                interest_type: formData.interest_type,
                term_months: formData.term_months,
                disbursement_date: formData.disbursement_date,
                monthly_installment: preview.monthlyInstallment,
                total_payable: preview.totalPayable,
                principal_outstanding: formData.principal_amount,
                interest_outstanding: preview.totalInterest,
                status: 'pending'
            }])
            .select()
            .single();

          if (newError) throw newError;

          // 2. Close the OLD loan
          const { error: oldError } = await supabase
            .from('loans')
            .update({ 
                status: 'completed',
                principal_outstanding: 0,
                interest_outstanding: 0,
                penalty_outstanding: 0
            })
            .eq('id', oldLoan.id);
          
          if (oldError) throw oldError;

          // 3. Add Audit Notes
          await Promise.all([
              supabase.from('loan_notes').insert({
                  loan_id: oldLoan.id,
                  user_id: profile.id,
                  content: `Loan restructured into new application: ${formData.reference_no}. Outstanding balance of ${formatCurrency(formData.principal_amount)} transferred.`,
                  is_system: true
              }),
              supabase.from('loan_notes').insert({
                  loan_id: newLoan.id,
                  user_id: profile.id,
                  content: `Restructured from previous loan: ${oldLoan.reference_no || oldLoan.id.slice(0,8)}.`,
                  is_system: true
              }),
              supabase.from('audit_logs').insert({
                  user_id: profile.id,
                  action: 'Loan Restructured',
                  entity_type: 'loan',
                  entity_id: oldLoan.id,
                  details: { new_loan_id: newLoan.id, amount: formData.principal_amount }
              })
          ]);

          toast.success("Loan restructured successfully. New application is pending approval.", { id: loadingToast });
          navigate(`/loans/${newLoan.id}`);

      } catch (e: any) {
          toast.error(e.message, { id: loadingToast });
      } finally {
          setIsProcessing(false);
      }
  };

  if (loading) return <div className="p-12 text-center"><RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button onClick={() => navigate(`/loans/${id}`)} className="flex items-center text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Details
      </button>

      <div className="flex items-center justify-between">
          <div>
              <h1 className="text-2xl font-bold text-gray-900">Restructure Loan</h1>
              <p className="text-sm text-gray-500">Converting outstanding balance for {oldLoan.borrowers?.full_name} into new terms.</p>
          </div>
          <div className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold uppercase">
              Active → Pending
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
                      Current Outstanding Balance
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-[10px] text-gray-400 font-bold uppercase">Principal</p>
                          <p className="text-sm font-bold text-gray-700">{formatCurrency(oldLoan.principal_outstanding)}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-[10px] text-gray-400 font-bold uppercase">Interest</p>
                          <p className="text-sm font-bold text-gray-700">{formatCurrency(oldLoan.interest_outstanding)}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-[10px] text-gray-400 font-bold uppercase">Penalty</p>
                          <p className="text-sm font-bold text-red-600">{formatCurrency(oldLoan.penalty_outstanding || 0)}</p>
                      </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-900">Total to Restructure</span>
                      <span className="text-xl font-extrabold text-indigo-600">{formatCurrency(formData.principal_amount)}</span>
                  </div>
              </div>

              <form onSubmit={handleRestructure} className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                  <h3 className="font-bold text-gray-900 flex items-center">
                      <TrendingUp className="h-4 w-4 mr-2 text-indigo-600" />
                      New Loan Terms
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">New Reference Number</label>
                          <div className="relative">
                              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <input 
                                required
                                type="text"
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 uppercase"
                                placeholder="Auto-generated reference number"
                                value={formData.reference_no}
                                onChange={e => setFormData({...formData, reference_no: e.target.value})}
                              />
                          </div>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">New Principal (MK)</label>
                          <input 
                            required
                            type="text"
                            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                            placeholder="Enter amount"
                            value={displayPrincipal}
                            onChange={e => handlePrincipalChange(e.target.value)}
                          />
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Interest Rate (% Monthly)</label>
                          <input 
                            required
                            type="number"
                            step="0.1"
                            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                            placeholder="e.g. 5.0"
                            value={formData.interest_rate}
                            onChange={e => setFormData({...formData, interest_rate: Number(e.target.value)})}
                          />
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">New Term (Months)</label>
                          <input 
                            required
                            type="number"
                            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                            placeholder="e.g. 12"
                            value={formData.term_months}
                            onChange={e => setFormData({...formData, term_months: Number(e.target.value)})}
                          />
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Interest Type</label>
                          <select 
                            title="Select Interest Type"
                            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                            value={formData.interest_type}
                            onChange={e => setFormData({...formData, interest_type: e.target.value as any})}
                          >
                              <option value="flat">Flat Rate</option>
                              <option value="reducing">Reducing Balance</option>
                          </select>
                      </div>
                  </div>

                  <div className="pt-6 border-t border-gray-100">
                      <button 
                        type="submit"
                        disabled={isProcessing || formData.principal_amount <= 0}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-400 transition-all shadow-lg shadow-indigo-100 active:scale-[0.98]"
                      >
                          {isProcessing ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                          Execute Restructure
                      </button>
                      <p className="text-[10px] text-gray-400 text-center mt-3 uppercase font-bold tracking-widest">
                          This will close the current loan and create a new pending application.
                      </p>
                  </div>
              </form>
          </div>

          <div className="space-y-6">
              <div className="bg-indigo-900 rounded-2xl p-6 text-white shadow-xl sticky top-6">
                  <h3 className="font-bold mb-6 flex items-center">
                      <Calculator className="h-5 w-5 mr-2 text-indigo-300" />
                      New Terms Preview
                  </h3>
                  
                  {preview ? (
                      <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                              <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                                  <p className="text-[10px] text-indigo-300 uppercase font-bold">Installment</p>
                                  <p className="text-sm font-bold">{formatCurrency(preview.monthlyInstallment)}</p>
                              </div>
                              <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                                  <p className="text-[10px] text-indigo-300 uppercase font-bold">Total Interest</p>
                                  <p className="text-sm font-bold">{formatCurrency(preview.totalInterest)}</p>
                              </div>
                          </div>
                          
                          <div className="p-4 bg-white/10 rounded-xl border border-white/20">
                              <p className="text-[10px] text-indigo-300 uppercase font-bold mb-1">Total New Payable</p>
                              <p className="text-2xl font-extrabold">{formatCurrency(preview.totalPayable)}</p>
                          </div>

                          <div className="space-y-3">
                              <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-widest">Restructure Impact</p>
                              <div className="flex items-center justify-between text-xs">
                                  <span className="text-indigo-200">Previous Principal</span>
                                  <span className="font-medium">{formatCurrency(oldLoan.principal_amount)}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                  <span className="text-indigo-200">New Principal</span>
                                  <span className="font-bold text-green-400">+{formatCurrency(formData.principal_amount)}</span>
                              </div>
                          </div>
                      </div>
                  ) : (
                      <div className="py-12 text-center opacity-50">
                          <p className="text-xs italic">Enter terms to see preview</p>
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};