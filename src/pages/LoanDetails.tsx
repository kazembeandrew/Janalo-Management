import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Repayment, LoanNote, LoanDocument, InternalAccount, Visitation } from '@/types';
import { formatCurrency, calculateRepaymentDistribution } from '@/utils/finance';
import { generateReceiptPDF, generateStatementPDF } from '@/utils/export';
import { 
    ArrowLeft, User, Phone, MapPin, Building2, 
    ThumbsUp, Printer, RefreshCw, 
    ChevronRight, X, Landmark, 
    RotateCcw, Ban, Receipt, FileText, Download,
    TrendingUp, Camera, Navigation, Check, RefreshCcw
} from 'lucide-react';
import toast from 'react-hot-toast';

// Sub-components
import { LoanSummaryCard } from '@/components/loans/LoanSummaryCard';
import { LoanDocumentsList } from '@/components/loans/LoanDocumentsList';
import { LoanRepaymentHistory } from '@/components/loans/LoanRepaymentHistory';
import { LoanNotesSection } from '@/components/loans/LoanNotesSection';
import { LoanVisitations } from '@/components/loans/LoanVisitations';
import { MapPicker } from '@/components/MapPicker';
import { LoanDecisionModals } from '@/components/loans/LoanDecisionModals';
import { RepaymentModal } from '@/components/loans/RepaymentModal';

export const LoanDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { profile, effectiveRoles } = useAuth();
  const navigate = useNavigate();
  
  // Data State
  const [loan, setLoan] = useState<any>(null);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [notes, setNotes] = useState<LoanNote[]>([]);
  const [documents, setDocuments] = useState<LoanDocument[]>([]);
  const [visitations, setVisitations] = useState<Visitation[]>([]);
  const [accounts, setAccounts] = useState<InternalAccount[]>([]);
  const [documentUrls, setDocumentUrls] = useState<{[key: string]: string}>({});
  const [visitImageUrls, setVisitImageUrls] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'repay' | 'approve' | 'reassess' | 'reject' | 'visit' | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  
  // Form States
  const [repayAmount, setRepayAmount] = useState<number>(0);
  const [displayRepayAmount, setDisplayRepayAmount] = useState('');
  const [targetAccountId, setTargetAccountId] = useState('');
  const [newNote, setNewNote] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  
  // Visit Form State
  const [visitForm, setVisitForm] = useState({
      notes: '',
      lat: null as number | null,
      lng: null as number | null,
      imageBlob: null as Blob | null
  });

  useEffect(() => {
    fetchData();
    fetchAccounts();
  }, [id]);

  const fetchData = async () => {
    if (!id) return;
    try {
      const { data: loanData, error: loanError } = await supabase
        .from('loans')
        .select(`
            *, 
            borrowers(id, full_name, address, phone, employment, created_at),
            users!officer_id (full_name)
        `)
        .eq('id', id)
        .single();
      
      if (loanError) throw loanError;
      setLoan(loanData);

      const [repayRes, noteRes, docRes, visitRes] = await Promise.all([
        supabase.from('repayments').select('*').eq('loan_id', id).order('payment_date', { ascending: false }),
        supabase.from('loan_notes').select('*, users(full_name)').eq('loan_id', id).order('created_at', { ascending: false }),
        supabase.from('loan_documents').select('*').eq('loan_id', id),
        supabase.from('visitations').select('*, users(full_name)').eq('loan_id', id).order('visit_date', { ascending: false })
      ]);

      setRepayments(repayRes.data || []);
      setNotes(noteRes.data || []);
      setDocuments(docRes.data || []);
      setVisitations(visitRes.data || []);
      
      if (docRes.data) {
          const urlMap: {[key: string]: string} = {};
          for (const doc of docRes.data) {
              const { data } = supabase.storage.from('loan-documents').getPublicUrl(doc.storage_path);
              if (data) urlMap[doc.id] = data.publicUrl;
          }
          setDocumentUrls(urlMap);
      }

      if (visitRes.data) {
          const vUrlMap: {[key: string]: string} = {};
          for (const v of visitRes.data) {
              if (v.image_path) {
                  const { data } = supabase.storage.from('loan-documents').getPublicUrl(v.image_path);
                  if (data) vUrlMap[v.id] = data.publicUrl;
              }
          }
          setVisitImageUrls(vUrlMap);
      }
    } catch (error) {
      console.error(error);
      toast.error("Error loading loan details");
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
      const { data } = await supabase.from('internal_accounts').select('*').order('name', { ascending: true });
      setAccounts(data || []);
  };

  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !profile) return;
    
    const { error } = await supabase.from('loan_notes').insert([{
        loan_id: id,
        user_id: profile.id,
        content: newNote,
        is_system: false
    }]);

    if (!error) {
        setNewNote('');
        fetchData();
        toast.success('Note added');
    }
  };

  const handleLogVisit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!profile || !id) return;
      setProcessingAction(true);

      try {
          let imagePath = null;
          if (visitForm.imageBlob) {
              const fileName = `visit_${Date.now()}.jpg`;
              const path = `${id}/${fileName}`;
              const { data, error: uploadError } = await supabase.storage
                .from('loan-documents')
                .upload(path, visitForm.imageBlob);
              if (uploadError) throw uploadError;
              imagePath = data.path;
          }

          const { error } = await supabase.from('visitations').insert({
              loan_id: id,
              officer_id: profile.id,
              notes: visitForm.notes,
              location_lat: visitForm.lat,
              location_long: visitForm.lng,
              image_path: imagePath,
              visit_date: new Date().toISOString().split('T')[0]
          });

          if (error) throw error;

          toast.success("Field visit logged");
          setActiveModal(null);
          setVisitForm({ notes: '', lat: null, lng: null, imageBlob: null });
          fetchData();
      } catch (e: any) {
          toast.error(e.message);
      } finally {
          setProcessingAction(false);
      }
  };

  const handleRepayAmountChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    setDisplayRepayAmount(cleaned);
    setRepayAmount(parseFloat(cleaned) || 0);
  };

  const handleRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan || !profile || !targetAccountId) return;
    setProcessingAction(true);
    try {
        const amount = Number(repayAmount);
        const { principalPaid, interestPaid, penaltyPaid } = calculateRepaymentDistribution(
            amount,
            loan.penalty_outstanding || 0,
            loan.interest_outstanding,
            loan.principal_outstanding
        );

        const { data: rData, error: rError } = await supabase.from('repayments').insert([{
            loan_id: loan.id,
            amount_paid: amount,
            principal_paid: principalPaid,
            interest_paid: interestPaid,
            penalty_paid: penaltyPaid,
            payment_date: new Date().toISOString().split('T')[0],
            recorded_by: profile.id
        }]).select().single();

        if (rError) throw rError;

        await supabase.from('fund_transactions').insert([{
            to_account_id: targetAccountId,
            amount: amount,
            type: 'repayment',
            description: `Loan repayment from ${loan.borrowers?.full_name}`,
            reference_id: loan.id,
            recorded_by: profile.id
        }]);

        await supabase.from('loan_notes').insert([{
            loan_id: id,
            user_id: profile.id,
            content: `Repayment of ${formatCurrency(amount)} recorded. Principal: ${formatCurrency(principalPaid)}, Interest: ${formatCurrency(interestPaid)}, Penalty: ${formatCurrency(penaltyPaid)}.`,
            is_system: true
        }]);

        const isCompleted = (loan.principal_outstanding - principalPaid) <= 0.01;
        await supabase.from('loans').update({
            penalty_outstanding: Math.max(0, (loan.penalty_outstanding || 0) - penaltyPaid),
            interest_outstanding: Math.max(0, loan.interest_outstanding - interestPaid),
            principal_outstanding: Math.max(0, loan.principal_outstanding - principalPaid),
            status: isCompleted ? 'completed' : 'active'
        }).eq('id', loan.id);

        toast.success('Repayment recorded');
        setActiveModal(null);
        setDisplayRepayAmount('');
        setRepayAmount(0);
        fetchData();
        if (rData) generateReceiptPDF(loan, rData, profile.full_name);
    } catch (e: any) {
        toast.error(e.message);
    } finally {
        setProcessingAction(false);
    }
  };

  const handleStatusUpdate = async (status: string, note: string, accountId?: string) => {
      if (!loan) return;
      setProcessingAction(true);
      try {
          await supabase.from('loans').update({ status }).eq('id', loan.id);
          
          if (status === 'active' && accountId) {
              await supabase.from('fund_transactions').insert([{
                  from_account_id: accountId,
                  amount: loan.principal_amount,
                  type: 'disbursement',
                  description: `Loan disbursement to ${loan.borrowers?.full_name}`,
                  reference_id: loan.id,
                  recorded_by: profile?.id
              }]);
          }
          
          await supabase.from('loan_notes').insert([{
              loan_id: id,
              user_id: profile?.id,
              content: `${status.charAt(0).toUpperCase() + status.slice(1)}: ${note}`,
              is_system: true
          }]);

          toast.success(`Loan ${status}`);
          setActiveModal(null);
          setDecisionReason('');
          fetchData();
      } catch (e) {
          toast.error('Action failed');
      } finally {
          setProcessingAction(false);
      }
  };

  const handleDownloadStatement = () => {
      if (!loan) return;
      generateStatementPDF(loan, repayments);
      toast.success("Statement generated");
  };

  if (loading || !loan) return <div className="p-12 text-center"><RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></div>;

  const isExecutive = effectiveRoles.includes('ceo') || effectiveRoles.includes('admin');
  const isAccountant = effectiveRoles.includes('accountant') || effectiveRoles.includes('admin');
  const isOfficer = effectiveRoles.includes('loan_officer') || effectiveRoles.includes('admin');

  const principalPaid = Number(loan.principal_amount) - Number(loan.principal_outstanding);
  const recoveryPercent = (principalPaid / Number(loan.principal_amount)) * 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
         <button onClick={() => navigate('/loans')} className="flex items-center text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Portfolio
         </button>
         <div className="flex flex-wrap gap-2">
            <button 
                onClick={handleDownloadStatement}
                className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all flex items-center"
            >
                <Download className="h-4 w-4 mr-1.5 text-indigo-600" /> Statement
            </button>
            {loan.status === 'active' && isOfficer && (
                <>
                    <button onClick={() => setActiveModal('visit')} className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-all flex items-center">
                        <MapPin className="h-4 w-4 mr-1.5" /> Log Visit
                    </button>
                    <Link to={`/loans/restructure/${loan.id}`} className="bg-amber-50 text-amber-700 border border-amber-200 px-4 py-2 rounded-xl text-sm font-bold hover:bg-amber-100 transition-all flex items-center">
                        <RefreshCcw className="h-4 w-4 mr-1.5" /> Restructure
                    </Link>
                </>
            )}
            {loan.status === 'active' && (isAccountant || isOfficer) && (
                <button onClick={() => setActiveModal('repay')} className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-green-700 transition-all">
                    Record Repayment
                </button>
            )}
            {loan.status === 'pending' && isExecutive && (
                <>
                    <button onClick={() => setActiveModal('reassess')} className="bg-purple-50 text-purple-700 border border-purple-200 px-4 py-2 rounded-xl text-sm font-bold hover:bg-purple-100 transition-all flex items-center">
                        <RotateCcw className="h-4 w-4 mr-1.5" /> Reassess
                    </button>
                    <button onClick={() => setActiveModal('reject')} className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-100 transition-all flex items-center">
                        <Ban className="h-4 w-4 mr-1.5" /> Reject
                    </button>
                    <button onClick={() => setActiveModal('approve')} className="bg-indigo-900 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-800 transition-all flex items-center">
                        <ThumbsUp className="h-4 w-4 mr-1.5" /> Approve & Disburse
                    </button>
                </>
            )}
            <button onClick={() => window.print()} className="p-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all">
                <Printer className="h-5 w-5 text-gray-600" />
            </button>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-900 flex items-center">
                          <TrendingUp className="h-4 w-4 mr-2 text-indigo-600" />
                          Repayment Progress
                      </h3>
                      <span className="text-xs font-bold text-indigo-600">{recoveryPercent.toFixed(1)}% Recovered</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-full transition-all duration-1000 ease-out" 
                        style={{ width: `${recoveryPercent}%` }}
                      />
                  </div>
                  <div className="flex justify-between mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      <span>Disbursed: {formatCurrency(loan.principal_amount)}</span>
                      <span>Outstanding: {formatCurrency(loan.principal_outstanding)}</span>
                  </div>
              </div>

              <LoanSummaryCard 
                referenceNo={loan.reference_no}
                principalAmount={loan.principal_amount}
                totalPayable={loan.total_payable}
                termMonths={loan.term_months}
                interestType={loan.interest_type}
                status={loan.status}
              />

              <LoanVisitations 
                visitations={visitations}
                imageUrls={visitImageUrls}
                onViewImage={setViewImage}
              />

              <LoanDocumentsList 
                documents={documents}
                documentUrls={documentUrls}
                onViewImage={setViewImage}
              />

              <LoanRepaymentHistory repayments={repayments} />
          </div>

          <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                      <h3 className="font-bold text-gray-900 flex items-center">
                          <User className="h-4 w-4 mr-2 text-indigo-600" />
                          Client Profile
                      </h3>
                  </div>
                  <div className="p-6 space-y-5">
                      <div>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Full Name</p>
                          <p className="text-sm font-bold text-gray-900">{loan.borrowers?.full_name}</p>
                      </div>
                      <div className="flex items-start">
                          <Phone className="h-4 w-4 mr-3 text-gray-400 mt-0.5" />
                          <div>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Phone</p>
                              <p className="text-sm font-medium text-gray-700">{loan.borrowers?.phone || 'N/A'}</p>
                          </div>
                      </div>
                      <div className="flex items-start">
                          <MapPin className="h-4 w-4 mr-3 text-gray-400 mt-0.5" />
                          <div>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Residence</p>
                              <p className="text-sm font-medium text-gray-700 leading-relaxed">{loan.borrowers?.address || 'N/A'}</p>
                          </div>
                      </div>
                      <div className="flex items-start">
                          <Building2 className="h-4 w-4 mr-3 text-gray-400 mt-0.5" />
                          <div>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Employment</p>
                              <p className="text-sm font-medium text-gray-700 leading-relaxed">{loan.borrowers?.employment || 'N/A'}</p>
                          </div>
                      </div>
                      <div className="pt-4 border-t border-gray-100">
                          <Link to={`/borrowers/${loan.borrower_id}`} className="text-xs font-bold text-indigo-600 hover:underline flex items-center">
                              View Full Profile <ChevronRight className="h-3 w-3 ml-1" />
                          </Link>
                      </div>
                  </div>
              </div>

              <LoanNotesSection 
                notes={notes}
                newNote={newNote}
                onNoteChange={setNewNote}
                onPostNote={handlePostNote}
              />
          </div>
      </div>

      {/* Modals */}
      {activeModal === 'visit' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-indigo-900 px-6 py-5 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center text-lg"><MapPin className="mr-3 h-6 w-6 text-indigo-300" /> Log Field Visit</h3>
                      <button onClick={() => setActiveModal(null)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5 text-indigo-300" /></button>
                  </div>
                  <form onSubmit={handleLogVisit} className="p-8 space-y-5">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Visit Notes</label>
                          <textarea required className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 h-24 resize-none" placeholder="Describe the purpose and outcome of the visit..." value={visitForm.notes} onChange={e => setVisitForm({...visitForm, notes: e.target.value})} />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Location Tag</label>
                              <button 
                                type="button" 
                                onClick={() => setShowMapPicker(true)}
                                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all ${visitForm.lat ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                              >
                                  {visitForm.lat ? <><Check className="h-3.5 w-3.5" /> Tagged</> : <><Navigation className="h-3.5 w-3.5" /> Pin GPS</>}
                              </button>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Site Photo</label>
                              <div className="relative">
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    capture="environment"
                                    className="hidden" 
                                    id="visit-photo"
                                    onChange={e => setVisitForm({...visitForm, imageBlob: e.target.files?.[0] || null})}
                                  />
                                  <label 
                                    htmlFor="visit-photo"
                                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${visitForm.imageBlob ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                                  >
                                      {visitForm.imageBlob ? <><Check className="h-3.5 w-3.5" /> Captured</> : <><Camera className="h-3.5 w-3.5" /> Take Photo</>}
                                  </label>
                              </div>
                          </div>
                      </div>

                      <div className="pt-4">
                          <button type="submit" disabled={processingAction} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-400 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]">
                              {processingAction ? 'Saving...' : 'Save Visit Log'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {showMapPicker && (
          <MapPicker 
            onSelect={(lat, lng) => { setVisitForm({...visitForm, lat, lng}); setShowMapPicker(false); }}
            onClose={() => setShowMapPicker(false)}
          />
      )}

      {activeModal === 'repay' && (
          <RepaymentModal 
            displayAmount={displayRepayAmount}
            onAmountChange={handleRepayAmountChange}
            accounts={accounts}
            targetAccountId={targetAccountId}
            setTargetAccountId={setTargetAccountId}
            isProcessing={processingAction}
            onClose={() => setActiveModal(null)}
            onConfirm={handleRepayment}
          />
      )}

      {(activeModal === 'approve' || activeModal === 'reassess' || activeModal === 'reject') && (
          <LoanDecisionModals 
            type={activeModal as any}
            loan={loan}
            accounts={accounts}
            targetAccountId={targetAccountId}
            setTargetAccountId={setTargetAccountId}
            reason={decisionReason}
            setReason={setDecisionReason}
            isProcessing={processingAction}
            onClose={() => setActiveModal(null)}
            onConfirm={handleStatusUpdate}
          />
      )}

      {/* Image Viewer */}
      {viewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4" onClick={() => setViewImage(null)}>
            <button className="absolute top-6 right-6 text-white p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all"><X className="h-6 w-6" /></button>
            <img src={viewImage} alt="Full View" className="max-w-full max-h-screen object-contain rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
};