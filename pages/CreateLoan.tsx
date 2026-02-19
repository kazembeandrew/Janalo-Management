import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Borrower, InterestType } from '../types';
import { calculateLoanDetails, formatCurrency } from '../utils/finance';
import { Calculator, ArrowLeft, AlertOctagon, UploadCloud, Plus } from 'lucide-react';
import { DocumentUpload } from '../components/DocumentUpload';

export const CreateLoan: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    borrower_id: '',
    principal_amount: 1000,
    interest_rate: 10,
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

  // Guard: CEO cannot create loans
  if (profile?.role === 'ceo') {
    return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertOctagon className="h-16 w-16 text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
            <p className="text-gray-500 mt-2">Executive roles are read-only and cannot create new loans.</p>
            <button 
                onClick={() => navigate('/')}
                className="mt-4 text-indigo-600 hover:text-indigo-800 font-medium"
            >
                Return to Dashboard
            </button>
        </div>
    );
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const fetchBorrowers = async () => {
        if (!profile) return;
        
        let query = supabase.from('borrowers').select('*');
        // Officer only sees their own borrowers
        if (profile.role === 'loan_officer') {
            query = query.eq('created_by', profile.id);
        }

        const { data } = await query;
        if (data) setBorrowers(data as Borrower[]);
    };
    fetchBorrowers();
  }, [profile]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    // Recalculate whenever inputs change
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
          // Reset the last one instead of removing if it's the only one
          setCollaterals([{ id: Date.now(), blob: null }]);
      }
  };

  const updateCollateralBlob = (id: number, blob: Blob) => {
      setCollaterals(collaterals.map(c => c.id === id ? { ...c, blob } : c));
  };

  const uploadFile = async (blob: Blob, path: string) => {
      // Note: 'loan-documents' bucket must exist in Supabase Storage with public access policies
      const { data, error } = await supabase.storage
        .from('loan-documents') 
        .upload(path, blob, {
            contentType: 'image/jpeg',
            upsert: true
        });
      if (error) throw error;
      return data.path;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);

    try {
      // 1. Create Loan Record
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

      // 2. Upload Documents if they exist
      if (loan) {
          const uploads = [];
          
          // Helper to create upload promise
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

          // Upload Collaterals
          collaterals.forEach((c, index) => {
              addUpload(c.blob, 'collateral', `collateral_${index}`, `Collateral ${index + 1}`);
          });

         if (uploads.length > 0) {
             await Promise.all(uploads);
         }
      }

      navigate('/loans');
    } catch (error: any) {
      console.error(error);
      let msg = 'Failed to create loan.';
      if (error.message && error.message.includes('bucket not found')) {
          msg += ' Storage bucket "loan-documents" not found. Please create it in Supabase.';
      }
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
       <button onClick={() => navigate(-1)} className="flex items-center text-sm text-gray-500 hover:text-gray-700">
         <ArrowLeft className="h-4 w-4 mr-1" /> Back to Loans
       </button>
       
       <h1 className="text-2xl font-bold text-gray-900">New Loan Application</h1>

       <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Left Column: Loan Details */}
         <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Financial Details</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Select Borrower</label>
                        <select 
                            required
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                            value={formData.borrower_id}
                            onChange={e => setFormData({...formData, borrower_id: e.target.value})}
                        >
                            <option value="">-- Select Client --</option>
                            {borrowers.map(b => (
                                <option key={b.id} value={b.id}>{b.full_name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Principal Amount ($)</label>
                        <input 
                            type="number"
                            required
                            min="1"
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={formData.principal_amount}
                            onChange={e => setFormData({...formData, principal_amount: Number(e.target.value)})}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Interest Rate (% Annual)</label>
                            <input 
                                type="number"
                                required
                                step="0.1"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                value={formData.interest_rate}
                                onChange={e => setFormData({...formData, interest_rate: Number(e.target.value)})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Term (Months)</label>
                            <input 
                                type="number"
                                required
                                min="1"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                value={formData.term_months}
                                onChange={e => setFormData({...formData, term_months: Number(e.target.value)})}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Interest Type</label>
                        <div className="mt-2 space-x-4">
                            <label className="inline-flex items-center">
                                <input 
                                    type="radio" 
                                    className="form-radio text-indigo-600" 
                                    name="interest_type"
                                    checked={formData.interest_type === 'flat'}
                                    onChange={() => setFormData({...formData, interest_type: 'flat'})}
                                />
                                <span className="ml-2">Flat Rate</span>
                            </label>
                            <label className="inline-flex items-center">
                                <input 
                                    type="radio" 
                                    className="form-radio text-indigo-600" 
                                    name="interest_type"
                                    checked={formData.interest_type === 'reducing'}
                                    onChange={() => setFormData({...formData, interest_type: 'reducing'})}
                                />
                                <span className="ml-2">Reducing Balance</span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Disbursement Date</label>
                        <input 
                            type="date"
                            required
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={formData.disbursement_date}
                            onChange={e => setFormData({...formData, disbursement_date: e.target.value})}
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
                 <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                     <UploadCloud className="mr-2 h-5 w-5"/> Required Documentation
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                     <DocumentUpload 
                        label="Client ID / Passport" 
                        onUpload={setIdCardBlob} 
                        onRemove={() => setIdCardBlob(null)}
                     />
                     <DocumentUpload 
                        label="Application Form" 
                        onUpload={setAppFormBlob} 
                        onRemove={() => setAppFormBlob(null)}
                     />
                     <DocumentUpload 
                        label="Guarantor ID / Form" 
                        onUpload={setGuarantorBlob} 
                        onRemove={() => setGuarantorBlob(null)}
                     />
                 </div>

                 <div className="border-t border-gray-200 pt-4">
                     <div className="flex justify-between items-center mb-4">
                        <label className="block text-sm font-medium text-gray-700">Collateral Photos</label>
                        <button 
                            type="button" 
                            onClick={addCollateralField}
                            className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                        >
                            <Plus className="h-3 w-3 mr-1" /> Add Collateral
                        </button>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {collaterals.map((item, index) => (
                             <DocumentUpload 
                                key={item.id}
                                label={`Collateral ${index + 1}`}
                                onUpload={(blob) => updateCollateralBlob(item.id, blob)}
                                onRemove={() => removeCollateralField(item.id)}
                            />
                        ))}
                     </div>
                 </div>

                 <p className="text-xs text-gray-500 mt-4 bg-yellow-50 p-2 rounded border border-yellow-100">
                     * All images are automatically compressed to reduce storage size.
                 </p>
            </div>
         </div>

         {/* Right Column: Calculator */}
         <div className="space-y-6">
            <div className="bg-indigo-50 rounded-lg p-6 border border-indigo-100 sticky top-6">
                <h3 className="text-lg font-medium text-indigo-900 flex items-center mb-4">
                    <Calculator className="h-5 w-5 mr-2" />
                    Repayment Preview
                </h3>
                
                {preview && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 border-b border-indigo-200 pb-4">
                            <div>
                                <div className="text-xs text-indigo-500 uppercase">Monthly Installment</div>
                                <div className="text-xl font-bold text-indigo-900">{formatCurrency(preview.monthlyInstallment)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-indigo-500 uppercase">Total Interest</div>
                                <div className="text-xl font-bold text-indigo-900">{formatCurrency(preview.totalInterest)}</div>
                            </div>
                        </div>
                        
                        <div>
                            <div className="text-xs text-indigo-500 uppercase">Total Payable</div>
                            <div className="text-2xl font-bold text-indigo-900">{formatCurrency(preview.totalPayable)}</div>
                        </div>

                        <div className="mt-6">
                            <h4 className="text-sm font-semibold text-indigo-800 mb-2">Schedule Preview (First 5 months)</h4>
                            <div className="bg-white rounded-md overflow-hidden text-xs">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-2 py-1 text-left">Mo</th>
                                            <th className="px-2 py-1 text-right">Prin</th>
                                            <th className="px-2 py-1 text-right">Int</th>
                                            <th className="px-2 py-1 text-right">Bal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.schedule.slice(0, 5).map((row: any) => (
                                            <tr key={row.month}>
                                                <td className="px-2 py-1 border-t">{row.month}</td>
                                                <td className="px-2 py-1 text-right border-t">{formatCurrency(row.principal)}</td>
                                                <td className="px-2 py-1 text-right border-t">{formatCurrency(row.interest)}</td>
                                                <td className="px-2 py-1 text-right border-t">{formatCurrency(row.balance)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-indigo-200">
                            <button
                                type="submit"
                                disabled={loading || !formData.borrower_id}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-900 hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                            >
                                {loading ? 'Processing...' : 'Submit Application'}
                            </button>
                            <p className="text-xs text-gray-500 mt-2 text-center">
                                Note: Loan will be created with 'Pending' status.
                            </p>
                        </div>
                    </div>
                )}
            </div>
         </div>
       </form>
    </div>
  );
};