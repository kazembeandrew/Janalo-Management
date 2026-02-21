import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Loan, Repayment, LoanNote, LoanDocument, Visitation, InterestType, InternalAccount } from '@/types';
import { formatCurrency, calculateLoanDetails } from '@/utils/finance';
import Markdown from 'react-markdown';
import { analyzeFinancialData, assessLoanRisk } from '@/services/aiService';
import { exportToCSV, generateReceiptPDF, generateStatementPDF } from '@/utils/export';
import { 
    ArrowLeft, AlertOctagon, AlertTriangle, ThumbsUp, ThumbsDown, MessageSquare, Send, 
    FileImage, ExternalLink, X, ZoomIn, Trash2, Edit, RefreshCw, Mail, MapPin, Camera, User, Calendar, Printer, Locate, Sparkles, ShieldCheck, Download, FileText, Receipt, Eraser, Landmark, ChevronRight, Building2, Home, Phone, History, ClipboardList
} from 'lucide-react';
import { DocumentUpload } from '@/components/DocumentUpload';
import toast from 'react-hot-toast';

type DetailTab = 'overview' | 'client' | 'documents' | 'visitations' | 'notes';

export const LoanDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { profile, effectiveRoles } = useAuth();
  const navigate = useNavigate();
  
  // Data State
  const [loan, setLoan] = useState<Loan | null>(null);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [notes, setNotes] = useState<LoanNote[]>([]);
  const [documents, setDocuments] = useState<LoanDocument[]>([]);
  const [visitations, setVisitations] = useState<Visitation[]>([]);
  const [accounts, setAccounts] = useState<InternalAccount[]>([]);
  const [documentUrls, setDocumentUrls] = useState<{[key: string]: string}>({});
  const [visitationUrls, setVisitationUrls] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [viewImage, setViewImage] = useState<string | null>(null);
  
  // Modals
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [showWaiveModal, setShowWaiveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showReassessModal, setShowReassessModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showDefaultModal, setShowDefaultModal] = useState(false);
  const [showRestructureModal, setShowRestructureModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  
  // Form States
  const [repayAmount, setRepayAmount] = useState<number>(0);
  const [targetAccountId, setTargetAccountId] = useState('');
  const [penaltyAmount, setPenaltyAmount] = useState<number>(0);
  const [waiveData, setWaiveData] = useState({ interest: 0, penalty: 0 });
  const [newNote, setNewNote] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [sendToChat, setSendToChat] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [riskAssessment, setRiskAssessment] = useState<string | null>(null);
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [officers, setOfficers] = useState<{id: string, full_name: string}[]>([]);

  // Visit Form State
  const [visitNote, setVisitNote] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [visitImageBlob, setVisitImageBlob] = useState<Blob | null>(null);
  const [visitLocation, setVisitLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    fetchData();
    fetchAccounts();
    if (effectiveRoles.includes('admin') || effectiveRoles.includes('ceo')) {
        fetchOfficers();
    }
  }, [id]);

  const fetchData = async () => {
    if (!id) return;
    try {
      const { data: loanData, error: loanError } = await supabase
        .from('loans')
        .select(`
            *, 
            borrowers(id, full_name, address, phone, employment, created_at),
            users!officer_id (email, full_name)
        `)
        .eq('id', id)
        .single();
      
      if (loanError) throw loanError;
      setLoan(loanData);

      const { data: repayData } = await supabase
        .from('repayments')
        .select('*')
        .eq('loan_id', id)
        .order('payment_date', { ascending: false });
      setRepayments(repayData || []);

      fetchNotes();
      fetchDocuments();
      fetchVisitations();

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotes = async () => {
      if (!id) return;
      const { data: noteData } = await supabase
        .from('loan_notes')
        .select('*, users(full_name)')
        .eq('loan_id', id)
        .order('created_at', { ascending: false });
      setNotes(noteData || []);
  };

  const fetchDocuments = async () => {
      if (!id) return;
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
  };

  const fetchVisitations = async () => {
      if (!id) return;
      const { data } = await supabase
        .from('visitations')
        .select('*, users(full_name)')
        .eq('loan_id', id)
        .order('visit_date', { ascending: false });
      
      setVisitations(data || []);

      if (data) {
          const urlMap: {[key: string]: string} = {};
          for (const v of data) {
              if (v.image_path) {
                  const { data: pUrl } = supabase.storage.from('loan-documents').getPublicUrl(v.image_path);
                  if (pUrl) urlMap[v.id] = pUrl.publicUrl;
              }
          }
          setVisitationUrls(urlMap);
      }
  };

  const fetchAccounts = async () => {
      const { data } = await supabase.from('internal_accounts').select('*').order('name', { ascending: true });
      if (data) setAccounts(data);
  };

  const fetchOfficers = async () => {
      const { data } = await supabase.from('users').select('id, full_name').eq('role', 'loan_officer');
      setOfficers(data || []);
  };

  const addNote = async (content: string, isSystem = false) => {
    if (!id || !profile) return;
    await supabase.from('loan_notes').insert([{
        loan_id: id,
        user_id: profile.id,
        content,
        is_system: isSystem
    }]);
    fetchNotes();
  };

  const logAudit = async (action: string, details: any) => {
      if (!profile || !id) return;
      await supabase.from('audit_logs').insert({
          user_id: profile.id,
          action,
          entity_type: 'loan',
          entity_id: id,
          details
      });
  };

  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    await addNote(newNote, false);
    setNewNote('');
    toast.success('Note added');
  };

  const handleAnalyzeLoan = async () => {
    setShowAIModal(true);
    if (aiAnalysis) return;
    setAnalyzing(true);
    try {
        const insights = await analyzeFinancialData({
            loan,
            repayments: repayments.slice(0, 10),
            notes: notes.filter(n => !n.is_system).slice(0, 5),
            visitations: visitations.slice(0, 3)
        });
        setAiAnalysis(insights.join('\n\n'));
        if (loan?.status === 'pending') {
            const risk = await assessLoanRisk(loan);
            setRiskAssessment(risk);
        }
    } catch (e: any) {
        console.error("AI Error:", e);
        setAiAnalysis(`Failed to generate analysis.`);
    } finally {
        setAnalyzing(false);
    }
  };

  const handleRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan || !profile || !targetAccountId) return;
    setProcessingAction(true);
    try {
        const amount = Number(repayAmount);
        // Logic for distribution (Penalty -> Interest -> Principal)
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
          await addNote(`Loan Approved and Disbursed. ${decisionReason}`, true);
          toast.success('Loan approved');
          setShowApproveModal(false);
          fetchData();
      } catch (e) {
          toast.error('Approval failed');
      } finally {
          setProcessingAction(false);
      }
  };

  if (loading || !loan) return <div className="p-12 text-center"><RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></div>;

  const isExecutive = effectiveRoles.includes('ceo') || effectiveRoles.includes('admin');
  const isAccountant = effectiveRoles.includes('accountant') || effectiveRoles.includes('admin');
  const isOfficer = effectiveRoles.includes('loan_officer') || effectiveRoles.includes('admin');
  const isOwner = profile?.id === loan.officer_id;

  const totalOwed = loan.principal_outstanding + loan.interest_outstanding + (loan.penalty_outstanding || 0);
  const progress = loan.total_payable > 0 ? ((loan.total_payable - totalOwed) / loan.total_payable) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
         <button onClick={() => navigate('/loans')} className="flex items-center text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Portfolio
         </button>
         <div className="flex flex-wrap gap-2">
            <button onClick={handleAnalyzeLoan} className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-sm font-bold border border-indigo-100 flex items-center hover:bg-indigo-100 transition-all">
                <Sparkles className="h-4 w-4 mr-2" /> AI Analysis
            </button>
            {loan.status === 'active' && (isAccountant || isOfficer) && (
                <button onClick={() => setShowRepayModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-green-100 hover:bg-green-700 transition-all">
                    Record Repayment
                </button>
            )}
            {loan.status === 'pending' && isExecutive && (
                <button onClick={() => setShowApproveModal(true)} className="bg-indigo-900 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-800 transition-all">
                    Approve & Disburse
                </button>
            )}
            <button onClick={() => window.print()} className="p-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all">
                <Printer className="h-5 w-5 text-gray-600" />
            </button>
         </div>
      </div>

      {/* Header Summary */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-indigo-900 p-8 text-white">
              <div className="flex flex-col md:flex-row justify-between gap-8">
                  <div>
                      <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                              loan.status === 'active' ? 'bg-blue-500/20 border-blue-400 text-blue-100' : 
                              loan.status === 'completed' ? 'bg-green-500/20 border-green-400 text-green-100' : 
                              'bg-yellow-500/20 border-yellow-400 text-yellow-100'
                          }`}>
                              {loan.status}
                          </span>
                          <span className="text-indigo-300 text-xs font-medium">Loan ID: {loan.id.slice(0, 8).toUpperCase()}</span>
                      </div>
                      <h1 className="text-3xl font-bold">{loan.borrowers?.full_name}</h1>
                      <p className="text-indigo-200 mt-1 flex items-center text-sm">
                          <User className="h-4 w-4 mr-2" /> Managed by {loan.users?.full_name}
                      </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
                      <div>
                          <p className="text-[10px] uppercase tracking-widest text-indigo-300 font-bold mb-1">Principal</p>
                          <p className="text-xl font-bold">{formatCurrency(loan.principal_amount)}</p>
                      </div>
                      <div>
                          <p className="text-[10px] uppercase tracking-widest text-indigo-300 font-bold mb-1">Outstanding</p>
                          <p className="text-xl font-bold text-red-300">{formatCurrency(totalOwed)}</p>
                      </div>
                      <div className="hidden sm:block">
                          <p className="text-[10px] uppercase tracking-widest text-indigo-300 font-bold mb-1">Repayment Progress</p>
                          <div className="flex items-center gap-3">
                              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                  <div className="h-full bg-green-400" style={{ width: `${progress}%` }}></div>
                              </div>
                              <span className="text-sm font-bold">{progress.toFixed(0)}%</span>
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          {/* Tabs Navigation */}
          <div className="flex border-b border-gray-100 bg-gray-50/50 overflow-x-auto no-scrollbar">
              {(['overview', 'client', 'documents', 'visitations', 'notes'] as DetailTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-6 py-4 text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                        activeTab === tab ? 'border-b-2 border-indigo-600 text-indigo-600 bg-white' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                      {tab}
                  </button>
              ))}
          </div>

          <div className="p-8">
              {activeTab === 'overview' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                      <div className="lg:col-span-2 space-y-8">
                          <div>
                              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                                  <History className="h-4 w-4 mr-2 text-indigo-600" />
                                  Repayment History
                              </h3>
                              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                                  <table className="min-w-full divide-y divide-gray-100">
                                      <thead className="bg-gray-50">
                                          <tr>
                                              <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase">Date</th>
                                              <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase">Amount</th>
                                              <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase">Principal</th>
                                              <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase">Interest</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-50">
                                          {repayments.length === 0 ? (
                                              <tr><td colSpan={4} className="px-6 py-8 text-center text-xs text-gray-400 italic">No repayments recorded yet.</td></tr>
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
                      <div className="space-y-6">
                          <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Loan Terms</h4>
                              <div className="space-y-4">
                                  <div className="flex justify-between text-sm">
                                      <span className="text-gray-500">Interest Rate</span>
                                      <span className="font-bold text-gray-900">{loan.interest_rate}% / month</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                      <span className="text-gray-500">Interest Type</span>
                                      <span className="font-bold text-gray-900 capitalize">{loan.interest_type}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                      <span className="text-gray-500">Term Length</span>
                                      <span className="font-bold text-gray-900">{loan.term_months} Months</span>
                                  </div>
                                  <div className="flex justify-between text-sm pt-4 border-t border-gray-200">
                                      <span className="text-gray-500">Monthly Installment</span>
                                      <span className="font-bold text-indigo-600">{formatCurrency(loan.monthly_installment)}</span>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              )}

              {activeTab === 'client' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-8">
                          <div>
                              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-3 mb-6">Personal Information</h3>
                              <div className="space-y-6">
                                  <div className="flex items-start">
                                      <div className="p-2 bg-indigo-50 rounded-lg mr-4"><User className="h-5 w-5 text-indigo-600" /></div>
                                      <div>
                                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Full Name</p>
                                          <p className="text-sm font-bold text-gray-900">{loan.borrowers?.full_name}</p>
                                      </div>
                                  </div>
                                  <div className="flex items-start">
                                      <div className="p-2 bg-indigo-50 rounded-lg mr-4"><Phone className="h-5 w-5 text-indigo-600" /></div>
                                      <div>
                                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Phone Number</p>
                                          <p className="text-sm font-bold text-gray-900">{loan.borrowers?.phone || 'N/A'}</p>
                                      </div>
                                  </div>
                                  <div className="flex items-start">
                                      <div className="p-2 bg-indigo-50 rounded-lg mr-4"><Home className="h-5 w-5 text-indigo-600" /></div>
                                      <div>
                                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Residence Address</p>
                                          <p className="text-sm font-bold text-gray-900">{loan.borrowers?.address || 'N/A'}</p>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="space-y-8">
                          <div>
                              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-3 mb-6">Employment & Business</h3>
                              <div className="flex items-start">
                                  <div className="p-2 bg-indigo-50 rounded-lg mr-4"><Building2 className="h-5 w-5 text-indigo-600" /></div>
                                  <div>
                                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Workplace / Business Address</p>
                                      <p className="text-sm font-bold text-gray-900">{loan.borrowers?.employment || 'N/A'}</p>
                                  </div>
                              </div>
                          </div>
                          <Link to={`/borrowers/${loan.borrower_id}`} className="inline-flex items-center text-indigo-600 font-bold text-sm hover:underline">
                              View Full Client Profile <ChevronRight className="h-4 w-4 ml-1" />
                          </Link>
                      </div>
                  </div>
              )}

              {activeTab === 'documents' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                      {documents.length === 0 ? (
                          <div className="col-span-full text-center py-16 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                              <FileImage className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                              <p className="text-sm text-gray-500 font-medium">No documents uploaded for this loan.</p>
                          </div>
                      ) : (
                          documents.map(doc => (
                              <div key={doc.id} onClick={() => setViewImage(documentUrls[doc.id])} className="relative aspect-square rounded-2xl border border-gray-100 overflow-hidden cursor-pointer group hover:border-indigo-500 transition-all shadow-sm">
                                  <img src={documentUrls[doc.id]} alt={doc.type} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all">
                                      <ZoomIn className="text-white opacity-0 group-hover:opacity-100 h-8 w-8" />
                                  </div>
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm text-[10px] text-white p-3 truncate font-bold uppercase tracking-wider">
                                      {doc.type.replace('_', ' ')}
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              )}

              {activeTab === 'visitations' && (
                  <div className="space-y-6">
                      <div className="flex justify-between items-center">
                          <h3 className="text-sm font-bold text-gray-900">Field Visitation Records</h3>
                          {isOfficer && (
                              <button onClick={() => setShowVisitModal(true)} className="text-xs bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all">
                                  Record New Visit
                              </button>
                          )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {visitations.length === 0 ? (
                              <div className="col-span-full text-center py-16 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                                  <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                  <p className="text-sm text-gray-500 font-medium">No field visits recorded yet.</p>
                              </div>
                          ) : (
                              visitations.map(v => (
                                  <div key={v.id} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex gap-6">
                                      {v.image_path && (
                                          <div onClick={() => setViewImage(visitationUrls[v.id])} className="h-24 w-24 rounded-xl overflow-hidden shrink-0 cursor-pointer border border-gray-100">
                                              <img src={visitationUrls[v.id]} className="h-full w-full object-cover" alt="Visit" />
                                          </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                          <div className="flex justify-between items-start mb-2">
                                              <p className="text-xs font-bold text-gray-900">{new Date(v.visit_date).toLocaleDateString()}</p>
                                              {v.location_lat && (
                                                  <span className="text-[8px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-bold uppercase border border-green-100 flex items-center">
                                                      <Locate className="h-2 w-2 mr-1" /> Geotagged
                                                  </span>
                                              )}
                                          </div>
                                          <p className="text-xs text-gray-600 leading-relaxed line-clamp-3 mb-3">{v.notes}</p>
                                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">By {v.users?.full_name}</p>
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>
              )}

              {activeTab === 'notes' && (
                  <div className="space-y-8">
                      <form onSubmit={handlePostNote} className="flex gap-3">
                          <input 
                            type="text" 
                            placeholder="Add a note or update..." 
                            className="flex-1 bg-gray-50 border-none rounded-2xl px-5 py-3 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                            value={newNote}
                            onChange={e => setNewNote(e.target.value)}
                          />
                          <button type="submit" className="bg-indigo-600 text-white p-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                              <Send className="h-5 w-5" />
                          </button>
                      </form>
                      <div className="space-y-4">
                          {notes.map(note => (
                              <div key={note.id} className={`p-5 rounded-2xl border ${note.is_system ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-100 shadow-sm'}`}>
                                  <div className="flex justify-between items-start mb-2">
                                      <div className="flex items-center gap-2">
                                          {note.is_system ? <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" /> : <User className="h-3.5 w-3.5 text-gray-400" />}
                                          <span className="text-xs font-bold text-gray-900">{note.is_system ? 'System Audit' : note.users?.full_name}</span>
                                      </div>
                                      <span className="text-[10px] text-gray-400 font-medium">{new Date(note.created_at).toLocaleString()}</span>
                                  </div>
                                  <p className={`text-sm leading-relaxed ${note.is_system ? 'text-gray-500 italic' : 'text-gray-700'}`}>{note.content}</p>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
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
                          <p className="mt-1 text-[10px] text-gray-400 italic">Installment due: {formatCurrency(loan.monthly_installment)}</p>
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
                          <textarea className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 h-20 resize-none" placeholder="Add instructions for the officer..." value={decisionReason} onChange={e => setDecisionReason(e.target.value)} />
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