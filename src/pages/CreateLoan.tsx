import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Borrower, InterestType } from '@/types';
import { calculateLoanDetails, formatCurrency } from '@/utils/finance';
import { Calculator, ArrowLeft, AlertOctagon, UploadCloud, Plus, Check, ChevronRight, ChevronLeft, User, Banknote, FileText } from 'lucide-react';
import { DocumentUpload } from '@/components/DocumentUpload';

type Step = 'borrower' | 'terms' | 'documents' | 'review';

export const CreateLoan: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>('borrower');
  
  // Form State
  const [formData, setFormData] = useState({
    borrower_id: '',
    principal_amount: 1000,
    interest_rate: 5, // Default to 5% monthly
    interest_type: 'flat' as InterestType,
    term_months: 12,
    disbursement_date: new Date().toISOString().split('T')[0]
  });

  // Documents State
  const [idCardBlob, setIdCardBlob] = useState<Blob | null>(null);
  const [appFormBlob, setAppFormBlob] = useState<Blob | null>(null);
  const [guarantorBlob, setGuarantorBlob] = useState<Blob | null>(null);
  
  // Multiple Collaterals State
  const [collaterals, setCollaterals] = useState<{id: number, blob: Blob | null}[]>([
      { id: Date.now(), blob: null }
  ]);

  // Calculated Preview
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    const fetchBorrowers = async () => {
        if (!profile) return;
        let query = supabase.from('borrowers').select('*');
        if (profile.role === 'loan_officer') {
            query = query.eq('created_by', profile.id);
        }
        const { data } = await query;
        if (data) setBorrowers(data as Borrower[]);
    };
    fetchBorrowers();
  }, [profile]);

  useEffect(() => {
    const details = calculateLoanDetails(
      Number(formData.principal_amount),
      Number(formData.interest_rate),
      Number(formData.term_months),
      formData.interest_type
    );
    setPreview(details);
  }, [formData]);

  const addCollateralField = () => {
      setCollaterals([...collaterals, { id: Date.now(), blob: null }]);
  };

  const removeCollateralField = (id: number) => {
      if (collaterals.length > 1) {
          setCollaterals(collaterals.filter(c => c.id !== id));
      } else {
          setCollaterals([{ id: Date.now(), blob: null }]);
      }
  };

  const updateCollateralBlob = (id: number, blob: Blob) => {
      setCollaterals(collaterals.map(c => c.id === id ? { ...c, blob } : c));
  };

  const uploadFile = async (blob: Blob, path: string) => {
      const { data, error } = await supabase.storage
        .from('loan-documents') 
        .upload(path, blob, {
            contentType: 'image/jpeg',
            upsert: true
        });
      if (error) throw error;
      return data.path;
  };

  const handleSubmit = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      const loanData = {
        officer_id: profile.id,
        borrower_id: formData.borrower_id,
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
      };

      const { data: loan, error } = await supabase.from('loans').insert([loanData]).select().single();
      if (error) throw error;

      if (loan) {
          const uploads = [];
          const addUpload = (blob: Blob | null, type: string, namePrefix: string, friendlyName: string) => {
              if (!blob) return;
              const fileName = `${namePrefix}_${Date.now()}.jpg`;
              const path = `${loan.id}/${fileName}`;
              uploads.push(
                 uploadFile(blob, path)
                    .then(uploadedPath => supabase.from('loan_documents').insert({
                        loan_id: loan.id,
                        type: type,
                        file_name: friendlyName,
                        mime_type: 'image/jpeg',
                        file_size: blob.size,
                        storage_path: uploadedPath
                    }))
              );
          };

          addUpload(idCardBlob, 'id_card', 'id_card', 'Client ID / Passport');
          addUpload(appFormBlob, 'application_form', 'app_form', 'Application Form');
          addUpload(guarantorBlob, 'guarantor', 'guarantor', 'Guarantor Form / ID');

          collaterals.forEach((c, index) => {
              addUpload(c.blob, 'collateral', `collateral_${index}`, `Collateral ${index + 1}`);
          });

         if (uploads.length > 0) await Promise.all(uploads);
      }

      navigate('/loans');
    } catch (error: any) {
      console.error(error);
      alert('Failed to create loan application.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
      { id: 'borrower', name: 'Borrower', icon: User },
      { id: 'terms', name: 'Terms', icon: Banknote },
      { id: 'documents', name: 'Documents', icon: FileText },
      { id: 'review', name: 'Review', icon: Check },
  ];

  const renderStepIndicator = () => (
      <nav aria-label="Progress" className="mb-8">
          <ol className="flex items-center justify-center space-x-4 sm:space-x-8">
              {steps.map((step, idx) => {
                  const Icon = step.icon;
                  const isActive = currentStep === step.id;
                  const isCompleted = steps.findIndex(s => s.id === currentStep) > idx;
                  
                  return (
                      <li key={step.id} className="flex items-center">
                          <div className={`flex flex-col items-center ${isActive ? 'text-indigo-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                              <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                                  isActive ? 'border-indigo-600 bg-indigo-50' : isCompleted ? 'border-green-600 bg-green-50' : 'border-gray-300'
                              }`}>
                                  {isCompleted ? <Check className="h-6 w-6" /> : <Icon className="h-5 w-5" />}
                              </div>
                              <span className="mt-2 text-xs font-medium hidden sm:block">{step.name}</span>
                          </div>
                          {idx !== steps.length - 1 && (
                              <div className="ml-4 sm:ml-8 h-0.5 w-8 sm:w-16 bg-gray-200" />
                          )}
                      </li>
                  );
              })}
          </ol>
      </nav>
  );

  if (profile?.role === 'ceo') {
    return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertOctagon className="h-16 w-16 text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
            <p className="text-gray-500 mt-2">Executive roles are read-only and cannot create new loans.</p>
            <button onClick={() => navigate('/')} className="mt-4 text-indigo-600 hover:text-indigo-800 font-medium">Return to Dashboard</button>
        </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
       <button onClick={() => navigate(-1)} className="flex items-center text-sm text-gray-500 hover:text-gray-700">
         <ArrowLeft className="h-4 w-4 mr-1" /> Back to Loans
       </button>
       
       <div className="text-center">
           <h1 className="text-2xl font-bold text-gray-900">New Loan Application</h1>
           <p className="text-sm text-gray-500 mt-1">Complete the steps below to submit a new loan for approval.</p>
       </div>

       {renderStepIndicator()}

       <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
           <div className="p-6 sm:p-8">
               {currentStep === 'borrower' && (
                   <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                       <h3 className="text-lg font-medium text-gray-900">Select Borrower</h3>
                       <div>
                           <label className="block text-sm font-medium text-gray-700">Client Name</label>
                           <select 
                               required
                               className="mt-1 block w-full pl-3 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-lg"
                               value={formData.borrower_id}
                               onChange={e => setFormData({...formData, borrower_id: e.target.value})}
                           >
                               <option value="">-- Select Client --</option>
                               {borrowers.map(b => (
                                   <option key={b.id} value={b.id}>{b.full_name}</option>
                               ))}
                           </select>
                           <p className="mt-2 text-xs text-gray-500">If the client is not listed, please register them in the Borrowers section first.</p>
                       </div>
                   </div>
               )}

               {currentStep === 'terms' && (
                   <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                       <h3 className="text-lg font-medium text-gray-900">Loan Terms</h3>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                           <div className="sm:col-span-2">
                               <label className="block text-sm font-medium text-gray-700">Principal Amount (MK)</label>
                               <input 
                                   type="number"
                                   required
                                   className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-3 px-4 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                   value={formData.principal_amount}
                                   onChange={e => setFormData({...formData, principal_amount: Number(e.target.value)})}
                               />
                           </div>
                           <div>
                               <label className="block text-sm font-medium text-gray-700">Interest Rate (% Monthly)</label>
                               <input 
                                   type="number"
                                   required
                                   step="0.1"
                                   className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-3 px-4 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                   value={formData.interest_rate}
                                   onChange={e => setFormData({...formData, interest_rate: Number(e.target.value)})}
                               />
                           </div>
                           <div>
                               <label className="block text-sm font-medium text-gray-700">Term (Months)</label>
                               <input 
                                   type="number"
                                   required
                                   className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-3 px-4 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                   value={formData.term_months}
                                   onChange={e => setFormData({...formData, term_months: Number(e.target.value)})}
                               />
                           </div>
                           <div className="sm:col-span-2">
                               <label className="block text-sm font-medium text-gray-700">Interest Type</label>
                               <div className="mt-2 flex space-x-6">
                                   <label className="flex items-center cursor-pointer">
                                       <input type="radio" className="h-4 w-4 text-indigo-600" checked={formData.interest_type === 'flat'} onChange={() => setFormData({...formData, interest_type: 'flat'})} />
                                       <span className="ml-2 text-sm text-gray-700">Flat Rate</span>
                                   </label>
                                   <label className="flex items-center cursor-pointer">
                                       <input type="radio" className="h-4 w-4 text-indigo-600" checked={formData.interest_type === 'reducing'} onChange={() => setFormData({...formData, interest_type: 'reducing'})} />
                                       <span className="ml-2 text-sm text-gray-700">Reducing Balance</span>
                                   </label>
                               </div>
                           </div>
                       </div>
                   </div>
               )}

               {currentStep === 'documents' && (
                   <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                       <h3 className="text-lg font-medium text-gray-900">Documentation</h3>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                           <DocumentUpload label="Client ID / Passport" onUpload={setIdCardBlob} onRemove={() => setIdCardBlob(null)} />
                           <DocumentUpload label="Application Form" onUpload={setAppFormBlob} onRemove={() => setAppFormBlob(null)} />
                           <DocumentUpload label="Guarantor ID / Form" onUpload={setGuarantorBlob} onRemove={() => setGuarantorBlob(null)} />
                       </div>
                       <div className="border-t border-gray-100 pt-6">
                           <div className="flex justify-between items-center mb-4">
                               <label className="text-sm font-medium text-gray-700">Collateral Photos</label>
                               <button type="button" onClick={addCollateralField} className="text-xs text-indigo-600 font-bold flex items-center"><Plus className="h-3 w-3 mr-1"/> Add More</button>
                           </div>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                               {collaterals.map((item, index) => (
                                   <DocumentUpload key={item.id} label={`Collateral ${index + 1}`} onUpload={(blob) => updateCollateralBlob(item.id, blob)} onRemove={() => removeCollateralField(item.id)} />
                               ))}
                           </div>
                       </div>
                   </div>
               )}

               {currentStep === 'review' && (
                   <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                       <h3 className="text-lg font-medium text-gray-900">Final Review</h3>
                       <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-100">
                           <div className="grid grid-cols-2 gap-y-4 text-sm">
                               <div className="text-indigo-600">Borrower</div>
                               <div className="font-bold text-indigo-900">{borrowers.find(b => b.id === formData.borrower_id)?.full_name}</div>
                               <div className="text-indigo-600">Principal</div>
                               <div className="font-bold text-indigo-900">{formatCurrency(formData.principal_amount)}</div>
                               <div className="text-indigo-600">Monthly Installment</div>
                               <div className="font-bold text-indigo-900">{formatCurrency(preview?.monthlyInstallment)}</div>
                               <div className="text-indigo-600">Total Interest</div>
                               <div className="font-bold text-indigo-900">{formatCurrency(preview?.totalInterest)}</div>
                               <div className="text-indigo-600 border-t border-indigo-200 pt-2 mt-2">Total Payable</div>
                               <div className="font-bold text-indigo-900 border-t border-indigo-200 pt-2 mt-2 text-lg">{formatCurrency(preview?.totalPayable)}</div>
                           </div>
                       </div>
                       <div className="flex items-center p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                           <AlertOctagon className="h-5 w-5 text-yellow-600 mr-3" />
                           <p className="text-xs text-yellow-700">By submitting, you confirm that all documents have been verified and the client understands the repayment terms.</p>
                       </div>
                   </div>
               )}
           </div>

           <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-t border-gray-200">
               <button
                   type="button"
                   onClick={() => {
                       if (currentStep === 'borrower') navigate(-1);
                       else if (currentStep === 'terms') setCurrentStep('borrower');
                       else if (currentStep === 'documents') setCurrentStep('terms');
                       else setCurrentStep('documents');
                   }}
                   className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
               >
                   <ChevronLeft className="h-4 w-4 mr-1" /> {currentStep === 'borrower' ? 'Cancel' : 'Previous'}
               </button>
               
               <button
                   type="button"
                   disabled={loading || (currentStep === 'borrower' && !formData.borrower_id)}
                   onClick={() => {
                       if (currentStep === 'borrower') setCurrentStep('terms');
                       else if (currentStep === 'terms') setCurrentStep('documents');
                       else if (currentStep === 'documents') setCurrentStep('review');
                       else handleSubmit();
                   }}
                   className="inline-flex items-center px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-900 hover:bg-indigo-800 disabled:bg-gray-400 transition-all"
               >
                   {loading ? 'Processing...' : currentStep === 'review' ? 'Submit Application' : 'Next Step'}
                   {!loading && currentStep !== 'review' && <ChevronRight className="h-4 w-4 ml-1" />}
               </button>
           </div>
       </div>
    </div>
  );
};