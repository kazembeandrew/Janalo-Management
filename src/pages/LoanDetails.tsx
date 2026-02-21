import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Loan, Repayment, LoanNote, LoanDocument, InternalAccount } from '@/types';
import { formatCurrency } from '@/utils/finance';
import { generateReceiptPDF } from '@/utils/export';
import { 
    ArrowLeft, User, Phone, MapPin, Building2, FileText, 
    MessageSquare, Send, Receipt, ThumbsUp, Printer, RefreshCw, 
    ChevronRight, ZoomIn, X, Clock, CheckCircle2, AlertCircle, Landmark, 
    RotateCcw, Ban
} from 'lucide-react';
import toast from 'react-hot-toast';

export const LoanDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { profile, effectiveRoles } = useAuth();
  const navigate = useNavigate();
  
  // Data State
  const [loan, setLoan] = useState<any>(null);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [notes, setNotes] = useState<LoanNote[]>([]);
  const [documents, setDocuments] = useState<LoanDocument[]>([]);
  const [accounts, setAccounts] = useState<InternalAccount[]>([]);
  const [documentUrls, setDocumentUrls] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showReassessModal, setShowReassessModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  
  // Form States
  const [repayAmount, setRepayAmount] = useState<number>(0);
  const [targetAccountId, setTargetAccountId] = useState('');
  const [newNote, setNewNote] = useState('');
  const [decisionReason, setDecisionReason] = useState('');

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

      // Fetch Repayments
      const { data: repayData } = await supabase
        .from('repayments')
        .select('*')
        .eq('loan_id', id)
        .order('payment_date', { ascending: false });
      setRepayments(repayData || []);

      // Fetch Notes
      const { data: noteData } = await supabase
        .from('loan_notes')
        .select('*, users(full_name)')
        .eq('loan_id', id)
        .order('created_at', { ascending: false });
      setNotes(noteData || []);

      // Fetch Documents
      const { data: docData } = await supabase
        .from('loan_documents')
        .select('*')
        .eq('loan_id', id);
      setDocuments(docData || []);
      
      if (docData) {
          const urlMap: {[key: string]: string} = {};
          for (const doc of docData) {
              const { data } = supabase.storage.from('loan-documents').getPublicUrl(doc.storage_path);
              if (data) urlMap[doc.id] = data.publicUrl;
          }
          setDocumentUrls(urlMap);
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
      if (data) setAccounts(data);
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

  const handleRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan || !profile || !targetAccountId) return;
    setProcessingAction(true);
    try {
        const amount = Number(repayAmount);
        let remaining = amount;
        const penPaid = Math.min(remaining, loan.penalty_outstanding || 0);
        remaining -= penPaid;
        const intPaid = Math.min(remaining, loan.interest_outstanding);
        remaining -= intPaid;
        const prinPaid = remaining;

        const { data: rData, error: rError } = await supabase.from('repayments').insert([{
            loan_id: loan.id,
            amount_paid: amount,
            principal_paid: prinPaid,
            interest_paid: intPaid,
            penalty_paid: penPaid,
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

        const isCompleted = (loan.principal_outstanding - prinPaid) <= 0.01;
        await supabase.from('loans').update({
            penalty_outstanding: Math.max(0, (loan.penalty_outstanding || 0) - penPaid),
            interest_outstanding: Math.max(0, loan.interest_outstanding - intPaid),
            principal_outstanding: Math.max(0, loan.principal_outstanding - prinPaid),
            status: isCompleted ? 'completed' : 'active'
        }).eq('id', loan.id);

        toast.success('Repayment recorded');
        setShowRepayModal(false);
        fetchData();
        if (rData) generateReceiptPDF(loan, rData, profile.full_name);
    } catch (e: any) {
        toast.error(e.message);
    } finally {
        setProcessingAction(false);
    }
  };

  const handleApproveLoan = async () => {
      if (!loan || !targetAccountId) return;
      setProcessingAction(true);
      try {
          await supabase.from('loans').update({ status: 'active' }).eq('id', loan.id);
          await supabase.from('fund_transactions').insert([{
              from_account_id: targetAccountId,
              amount: loan.principal_amount,
              type: 'disbursement',
              description: `Loan disbursement to ${loan.borrowers?.full_name}`,
              reference_id: loan.id,
              recorded_by: profile?.id
          }]);
          
          await supabase.from('loan_notes').insert([{
              loan_id: id,
              user_id: profile?.id,
              content: `Loan Approved and Disbursed. ${decisionReason}`,
              is_system: true
          }]);

          toast.success('Loan approved');
          setShowApproveModal(false);
          fetchData();
      } catch (e) {
          toast.error('Approval failed');
      } finally {
          setProcessingAction(false);
      }
  };

  const handleReassessLoan = async () => {
      if (!loan || !decisionReason.trim()) return;
      setProcessingAction(true);
      try {
          await supabase.from('loans').update({ status: 'reassess' }).eq('id', loan.id);
          await supabase.from('loan_notes').insert([{
              loan_id: id,
              user_id: profile?.id,
              content: `Application sent back for reassessment. Reason: ${decisionReason}`,
              is_system: true
          }]);

          toast.success('Sent for reassessment');
          setShowReassessModal(false);
          fetchData();
      } catch (e) {
          toast.error('Action failed');
      } finally {
          setProcessingAction(false);
      }
  };

  const handleRejectLoan = async () => {
      if (!loan || !decisionReason.trim()) return;
      setProcessingAction(true);
      try {
          await supabase.from('loans').update({ status: 'rejected' }).eq('id', loan.id);
          await supabase.from('loan_notes').insert([{
              loan_id: id,
              user_id: profile?.id,
              content: `Application Rejected. Reason: ${decisionReason}`,
              is_system: true
          }]);

          toast.success('Application rejected');
          setShowRejectModal(false);
          fetchData();
      } catch (e) {
          toast.error('Action failed');
      } finally {
          setProcessingAction(false);
      }
  };

  if (loading || !loan) return <div className="p-12 text-center"><RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></div>;

  const isExecutive = effectiveRoles.includes('ceo') || effectiveRoles.includes('admin');
  const isAccountant = effectiveRoles.includes('accountant') || effectiveRoles.includes('admin');
  const isOfficer = effectiveRoles.includes('loan_officer') || effectiveRoles.includes('admin');

  const totalInterest = loan.total_payable - loan.principal_amount;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
         <button onClick={() => navigate('/loans')} className="flex items-center text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Portfolio
         </button>
         <div className="flex flex-wrap gap-2">
            {loan.status === 'active' && (isAccountant || isOfficer) && (
                <button onClick={() => setShowRepayModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-green-700 transition-all">
                    Record Repayment
                </button>
            )}
            {loan.status === 'pending' && isExecutive && (
                <>
                    <button onClick={() => setShowReassessModal(true)} className="bg-purple-50 text-purple-700 border border-purple-200 px-4 py-2 rounded-xl text-sm font-bold hover:bg-purple-100 transition-all flex items-center">
                        <RotateCcw className="h-4 w-4 mr-1.5" /> Reassess
                    </button>
                    <button onClick={() => setShowRejectModal(true)} className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-100 transition-all flex items-center">
                        <Ban className="h-4 w-4 mr-1.5" /> Reject
                    </button>
                    <button onClick={() => setShowApproveModal(true)} className="bg-indigo-900 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-800 transition-all flex items-center">
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
          {/* Left Column: Financials & History */}
          <div className="lg:col-span-2 space-y-6">
              {/* Financial Summary Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                      <h3 className="font-bold text-gray-900 flex items-center">
                          <Receipt className="h-4 w-4 mr-2 text-indigo-600" />
                          Loan Summary
                      </h3>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                          loan.status === 'active' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                          loan.status === 'completed' ? 'bg-green-50 text-green-700 border-green-100' : 
                          loan.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                          loan.status === 'reassess' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                          'bg-red-50 text-red-700 border-red-100'
                      }`}>
                          {loan.status}
                      </span>
                  </div>
                  <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-y-6 gap-x-8">
                      <div className="min-w-0">
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 truncate">Principal Amount</p>
                          <p className="text-lg font-bold text-gray-900 truncate">{formatCurrency(loan.principal_amount)}</p>
                      </div>
                      <div className="min-w-0">
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 truncate">Total Interest</p>
                          <p className="text-lg font-bold text-indigo-600 truncate">{formatCurrency(totalInterest)}</p>
                      </div>
                      <div className="min-w-0">
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 truncate">Loan Term</p>
                          <p className="text-lg font-bold text-gray-900 truncate">{loan.term_months} Months</p>
                      </div>
                  </div>
              </div>

              {/* Documents Section */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                      <h3 className="font-bold text-gray-900 flex items-center">
                          <FileText className="h-4 w-4 mr-2 text-indigo-600" />
                          Loan Documents
                      </h3>
                  </div>
                  <div className="p-6">
                      {documents.length === 0 ? (
                          <p className="text-sm text-gray-400 italic text-center py-4">No documents uploaded.</p>
                      ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                              {documents.map(doc => (
                                  <div key={doc.id} onClick={() => setViewImage(documentUrls[doc.id])} className="relative aspect-square rounded-xl border border-gray-100 overflow-hidden cursor-pointer group hover:border-indigo-500 transition-all">
                                      <img src={documentUrls[doc.id]} alt={doc.type} className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                          <ZoomIn className="text-white h-6 w-6" />
                                      </div>
                                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1.5 text-[8px] text-white text-center font-bold uppercase truncate">
                                          {doc.type.replace('_', ' ')}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>

              {/* Repayment History Table */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                      <h3 className="font-bold text-gray-900 flex items-center">
                          <Clock className="h-4 w-4 mr-2 text-indigo-600" />
                          Repayment History
                      </h3>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                              <tr>
                                  <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase">Date</th>
                                  <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase">Amount</th>
                                  <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase">Principal</th>
                                  <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase">Interest</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {repayments.length === 0 ? (
                                  <tr><td colSpan={4} className="px-6 py-8 text-center text-xs text-gray-400 italic">No repayments recorded.</td></tr>
                              ) : (
                                  repayments.map(r => (
                                      <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                          <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600">{new Date(r.payment_date).toLocaleDateString()}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-bold text-green-600">{formatCurrency(r.amount_paid)}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-gray-500">{formatCurrency(r.principal_paid)}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-gray-500">{formatCurrency(r.interest_paid)}</td>
                                      </tr>
                                  ))
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>

          {/* Right Column: Client Info & Notes */}
          <div className="space-y-6">
              {/* Client Info Card */}
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

              {/* Notes Section */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                      <h3 className="font-bold text-gray-900 flex items-center">
                          <MessageSquare className="h-4 w-4 mr-2 text-indigo-600" />
                          Loan Notes
                      </h3>
                  </div>
                  <div className="p-6 space-y-6">
                      <form onSubmit={handlePostNote} className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Add a note..." 
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={newNote}
                            onChange={e => setNewNote(e.target.value)}
                          />
                          <button type="submit" className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 transition-all">
                              <Send className="h-4 w-4" />
                          </button>
                      </form>
                      <div className="space-y-4 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                          {notes.map(note => (
                              <div key={note.id} className={`p-3 rounded-xl border ${note.is_system ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-100 shadow-sm'}`}>
                                  <div className="flex justify-between items-start mb-1">
                                      <span className="text-[10px] font-bold text-gray-900">{note.is_system ? 'System' : note.users?.full_name}</span>
                                      <span className="text-[8px] text-gray-400">{new Date(note.created_at).toLocaleDateString()}</span>
                                  </div>
                                  <p className={`text-xs leading-relaxed ${note.is_system ? 'text-gray-500 italic' : 'text-gray-700'}`}>{note.content}</p>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* Modals */}
      {showRepayModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-green-600 px-6 py-5 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center text-lg"><Receipt className="mr-3 h-6 w-6 text-green-200" /> Record Repayment</h3>
                      <button onClick={() => setShowRepayModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5 text-green-200" /></button>
                  </div>
                  <form onSubmit={handleRepayment} className="p-8 space-y-5">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Amount Received (MK)</label>
                          <input required type="number" min="1" className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500" placeholder="0.00" value={repayAmount} onChange={e => setRepayAmount(Number(e.target.value))} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Deposit Into Account</label>
                          <select required className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-green-500 bg-white" value={targetAccountId} onChange={e => setTargetAccountId(e.target.value)}>
                              <option value="">-- Select Account --</option>
                              {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>)}
                          </select>
                      </div>
                      <div className="pt-4">
                          <button type="submit" disabled={processingAction || !targetAccountId} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 disabled:bg-gray-400 transition-all shadow-lg shadow-green-100 active:scale-[0.98]">
                              {processingAction ? 'Processing...' : 'Confirm & Record Payment'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {showApproveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-indigo-900 px-6 py-5 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center text-lg"><ThumbsUp className="mr-3 h-6 w-6 text-indigo-300" /> Approve & Disburse</h3>
                      <button onClick={() => setShowApproveModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5 text-indigo-300" /></button>
                  </div>
                  <div className="p-8 space-y-5">
                      <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                          <p className="text-xs text-indigo-700 leading-relaxed">Approving this loan will mark it as <strong>Active</strong> and record an institutional disbursement of <strong>{formatCurrency(loan.principal_amount)}</strong>.</p>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Disburse From Account</label>
                          <select required className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white" value={targetAccountId} onChange={e => setTargetAccountId(e.target.value)}>
                              <option value="">-- Select Source Account --</option>
                              {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Approval Note (Optional)</label>
                          <textarea className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 h-20 resize-none" placeholder="Add any final comments..." value={decisionReason} onChange={e => setDecisionReason(e.target.value)} />
                      </div>
                      <div className="pt-4">
                          <button onClick={handleApproveLoan} disabled={processingAction || !targetAccountId} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-400 transition-all shadow-lg shadow-indigo-100">
                              {processingAction ? 'Processing...' : 'Confirm Approval'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {showReassessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-purple-600 px-6 py-5 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center text-lg"><RotateCcw className="mr-3 h-6 w-6 text-purple-200" /> Send for Reassessment</h3>
                      <button onClick={() => setShowReassessModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5 text-purple-200" /></button>
                  </div>
                  <div className="p-8 space-y-5">
                      <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                          <p className="text-xs text-purple-700 leading-relaxed">This will return the application to the loan officer. Please specify what needs to be corrected or verified.</p>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Instructions for Officer</label>
                          <textarea required className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 h-32 resize-none" placeholder="e.g. Please verify the guarantor's employment status..." value={decisionReason} onChange={e => setDecisionReason(e.target.value)} />
                      </div>
                      <div className="pt-4">
                          <button onClick={handleReassessLoan} disabled={processingAction || !decisionReason.trim()} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 disabled:bg-gray-400 transition-all shadow-lg shadow-purple-100">
                              {processingAction ? 'Processing...' : 'Confirm Reassessment'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-red-600 px-6 py-5 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center text-lg"><Ban className="mr-3 h-6 w-6 text-red-200" /> Reject Application</h3>
                      <button onClick={() => setShowRejectModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5 text-red-200" /></button>
                  </div>
                  <div className="p-8 space-y-5">
                      <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                          <p className="text-xs text-red-700 leading-relaxed">Are you sure you want to reject this application? This action is permanent and will be logged in the audit trail.</p>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Reason for Rejection</label>
                          <textarea required className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 h-32 resize-none" placeholder="e.g. Insufficient collateral value..." value={decisionReason} onChange={e => setDecisionReason(e.target.value)} />
                      </div>
                      <div className="pt-4">
                          <button onClick={handleRejectLoan} disabled={processingAction || !decisionReason.trim()} className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 disabled:bg-gray-400 transition-all shadow-lg shadow-red-100">
                              {processingAction ? 'Processing...' : 'Confirm Rejection'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
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