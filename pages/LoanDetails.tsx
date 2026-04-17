import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Repayment, LoanNote, LoanDocument, InternalAccount, Visitation } from '@/types';
import { formatCurrency } from '@/utils/finance';
import { generateReceiptPDF, generateStatementPDF } from '@/utils/export';
import toast from 'react-hot-toast';

// Import services
import { loanService } from '@/services/loans';
import { repaymentService } from '@/services/repayments';
import { accountsService } from '@/services/accounts';

import { LoanSummaryCard } from '@/components/loans/LoanSummaryCard';
import { LoanDocumentsList } from '@/components/loans/LoanDocumentsList';
import { LoanRepaymentHistory } from '@/components/loans/LoanRepaymentHistory';
import { LoanNotesSection } from '@/components/loans/LoanNotesSection';
import { LoanVisitations } from '@/components/loans/LoanVisitations';
import { MapPicker } from '@/components/MapPicker';
import { LoanDecisionModals } from '@/components/loans/LoanDecisionModals';
import { RepaymentModal, type PaymentMethod } from '@/components/loans/RepaymentModal';
import { ReverseRepaymentModal } from '@/components/loans/ReverseRepaymentModal';
import { DocumentUpload } from '@/components/DocumentUpload';

import {
  ArrowLeft, User, Phone, MapPin, Building2,
  ThumbsUp, Printer, RefreshCw,
  ChevronRight, X, LandPlot,
  RotateCcw, Ban, FileText, Download,
  TrendingUp, Camera, Navigation, Check, ShieldAlert
} from 'lucide-react';

const LOAN_DOCUMENTS_BUCKET = 'loan-documents';
const VISIT_IMAGE_PREFIX = 'visit_';
const APPLICATION_FORM_PREFIX = 'application_form_';

// ─── Account keyword mapping (hidden from Loan Officer) ───────────────────────
const PAYMENT_METHOD_ACCOUNT_KEYWORDS: Record<PaymentMethod, string[]> = {
  cash: ['cash'],
  bank: ['main bank', 'bank'],
  airtel_money: ['airtel'],
  mpamba: ['mpamba'],
};

export const LoanDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { profile, effectiveRoles } = useAuth();
  const navigate = useNavigate();

  // Data State
  const [loan, setLoan] = useState<any>(null);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [notes, setNotes] = useState<LoanNote[]>([]);
  const [documents, setDocuments] = useState<LoanDocument[]>([]);
  const [borrowerDocuments, setBorrowerDocuments] = useState<any[]>([]);
  const [visitations, setVisitations] = useState<Visitation[]>([]);
  const [accounts, setAccounts] = useState<InternalAccount[]>([]);
  const [documentUrls, setDocumentUrls] = useState<{ [key: string]: string }>({});
  const [documentMimeTypes, setDocumentMimeTypes] = useState<{ [key: string]: string }>({});
  const [visitImageUrls, setVisitImageUrls] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);

  // UI State
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'repay' | 'approve' | 'reassess' | 'reject' | 'visit' | 'reverse' | 'writeoff' | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

  // Form States
  const [repayAmount, setRepayAmount] = useState<number>(0);
  const [displayRepayAmount, setDisplayRepayAmount] = useState('');

  // Payment method selected by the officer via buttons — no account details shown (for repayments)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);

  // Transaction reference — required for mobile money, optional for bank (for repayments)
  const [transactionRef, setTransactionRef] = useState('');

  // Target account ID for loan disbursement (different from repayment)
  const [targetAccountId, setTargetAccountId] = useState('');

  const [newNote, setNewNote] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [selectedRepayment, setSelectedRepayment] = useState<Repayment | null>(null);

  // NEW: Idempotency key for preventing duplicate repayments
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  // Document upload states
  const [appFormBlob, setAppFormBlob] = useState<Blob | null>(null);

  // Visit Form State
  const [visitForm, setVisitForm] = useState({
    notes: '',
    lat: null as number | null,
    lng: null as number | null,
    imageBlob: null as Blob | null
  });

  useEffect(() => {
    if (!id) return;
    fetchData();
    fetchAccounts();
    // Generate new idempotency key on component mount (using crypto.randomUUID if available, fallback to Math.random)
    const generateUUID = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      // Fallback for older browsers
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };
    setIdempotencyKey(generateUUID());
  }, [id]);

  const fetchData = async () => {
    if (!id) return;
    try {
      setLoading(true);

      const [loanResult, repaymentsResult, notesResult, documentsResult, visitationsResult] = await Promise.all([
        loanService.getLoanById(id),
        repaymentService.getLoanRepayments(id),
        loanService.getLoanNotes(id),
        loanService.getLoanDocuments(id),
        loanService.getLoanVisitations(id)
      ]);

      if (loanResult.success && loanResult.data) {
        setLoan(loanResult.data);
      }

      if (repaymentsResult.success) {
        setRepayments(repaymentsResult.data || []);
      }

      if (notesResult.success) {
        setNotes(notesResult.data || []);
      }

      if (documentsResult.success) {
        setDocuments(documentsResult.data || []);
      }

      if (visitationsResult.success) {
        setVisitations(visitationsResult.data || []);
      }

      // Process document URLs
      const urlMap: { [key: string]: string } = {};
      const mimeMap: { [key: string]: string } = {};

      if (documentsResult.success && documentsResult.data) {
        const { supabase } = await import('@/lib/supabase');
        for (const doc of documentsResult.data) {
          const { data } = supabase.storage.from(LOAN_DOCUMENTS_BUCKET).getPublicUrl(doc.storage_path);
          if (data) urlMap[doc.id] = data.publicUrl;
          mimeMap[doc.id] = doc.mime_type;
        }
      }

      setDocumentUrls(urlMap);
      setDocumentMimeTypes(mimeMap);

      if (visitationsResult.success && visitationsResult.data) {
        const vUrlMap: { [key: string]: string } = {};
        const { supabase } = await import('@/lib/supabase');
        for (const v of visitationsResult.data) {
          if (v.image_path) {
            const { data } = supabase.storage.from(LOAN_DOCUMENTS_BUCKET).getPublicUrl(v.image_path);
            if (data) vUrlMap[v.id] = data.publicUrl;
          }
        }
        setVisitImageUrls(vUrlMap);
      }
    } catch (error) {
      console.error('Error loading loan details:', error);
      toast.error('Error loading loan details');
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const accountsResult = await accountsService.getAccounts({ is_active: true });
      if (accountsResult.success) {
        setAccounts(accountsResult.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !id) return;

    try {
      const noteResult = await loanService.addLoanNote(id, newNote);
      if (noteResult.success) {
        setNewNote('');
        fetchData();
        toast.success('Note added');
      } else {
        throw new Error(noteResult.error?.message || 'Failed to add note');
      }
    } catch (error) {
      console.error('Error posting note:', error);
      toast.error('Failed to add note');
    }
  };

  const handleLogVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !id) return;
    setProcessingAction(true);

    try {
      let imagePath = null;
      if (visitForm.imageBlob) {
        const fileName = `${VISIT_IMAGE_PREFIX}${Date.now()}.jpg`;
        const path = `${id}/${fileName}`;
        const { supabase } = await import('@/lib/supabase');
        const { data } = await supabase.storage.from(LOAN_DOCUMENTS_BUCKET).upload(path, visitForm.imageBlob);
        if (data) imagePath = data.path;
      }

      const visitResult = await loanService.logVisit({
        loan_id: id,
        officer_id: profile.id,
        notes: visitForm.notes,
        location_lat: visitForm.lat,
        location_long: visitForm.lng,
        image_path: imagePath,
        visit_date: new Date().toISOString().split('T')[0]
      });

      if (visitResult.success) {
        toast.success('Field visit logged');
        setActiveModal(null);
        setVisitForm({ notes: '', lat: null, lng: null, imageBlob: null });
        fetchData();
      } else {
        throw new Error(visitResult.error?.message || 'Failed to log visit');
      }
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

  // NEW: Helper function to open repayment modal with fresh idempotency key
  const handleOpenRepaymentModal = () => {
    // Generate fresh UUID for each new repayment
    const generateUUID = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    setIdempotencyKey(generateUUID());
    setActiveModal('repay');
  };

  // ── Internal account resolver ──────────────────────────────────────────────
  // Translates the officer's button selection into the correct internal account ID.
  // This mapping is completely hidden from the Loan Officer UI.
  const resolveAccountId = (method: PaymentMethod | null): string => {
    if (!method) return '';

    const keywords = PAYMENT_METHOD_ACCOUNT_KEYWORDS[method];
    const match = accounts.find(acc =>
      keywords.some(k => acc.name.toLowerCase().includes(k)),
    );

    return match?.id ?? '';
  };

  const handleRepayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loan || !profile || !paymentMethod) {
      toast.error('Please select a payment method before confirming.');
      return;
    }

    // Enforce transaction reference for mobile money
    const requiresRef = paymentMethod === 'airtel_money' || paymentMethod === 'mpamba';
    if (requiresRef && !transactionRef.trim()) {
      toast.error('A Transaction ID is required for mobile money payments.');
      return;
    }

    // Silently resolve to the correct internal account
    const resolvedAccountId = resolveAccountId(paymentMethod);
    if (!resolvedAccountId) {
      toast.error(
        `No account configured for "${paymentMethod.replace('_', ' ')}". Contact your administrator.`,
      );
      return;
    }

    setProcessingAction(true);

    try {
      const amount = Number(repayAmount);

      // NEW: Use ATOMIC repayment function with idempotency
      const repaymentResult = await repaymentService.recordIdempotentRepayment({
        loan_id: loan.id,
        amount: amount,
        account_id: resolvedAccountId,
        payment_date: new Date().toISOString().split('T')[0],
        notes: undefined,
        reference: transactionRef.trim() || undefined,
        payment_method: paymentMethod,
        idempotency_key: idempotencyKey
      });

      if (repaymentResult.success && repaymentResult.data) {
        const data = repaymentResult.data;

        // Handle duplicate detection
        if (data.is_duplicate) {
          toast('This repayment was already recorded. Showing existing record.', {
            icon: '⚠️',
            style: {
              background: '#FEF3C7',
              color: '#92400E',
              border: '1px solid #F59E0B'
            }
          });
          setActiveModal(null);
          fetchData();
          return;
        }

        // Generate receipt with repayment details
        generateReceiptPDF(loan, {
          id: data.repayment_id,
          amount_paid: amount,
          payment_date: new Date().toISOString(),
          principal_paid: data.principal_paid,
          interest_paid: data.interest_paid,
          penalty_paid: data.penalty_paid
        }, profile.full_name || 'System');

        toast.success('Repayment recorded successfully. Receipt generated.');

        setActiveModal(null);
        setDisplayRepayAmount('');
        setRepayAmount(0);
        setPaymentMethod(null);
        setTransactionRef('');
        // Generate new key for next repayment
        const generateUUID = () => {
          if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
          }
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        };
        setIdempotencyKey(generateUUID());
        fetchData();

      } else {
        throw new Error(repaymentResult.error?.message || 'Repayment processing failed');
      }
    } catch (error: any) {
      console.error('Repayment error:', error);
      toast.error(error.message || 'Failed to record repayment');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleReverseRepayment = async () => {
    if (!selectedRepayment || !profile || !id) return;
    setProcessingAction(true);
    try {
      // Use the new atomic reversal method (maintains audit trail)
      const reversalResult = await repaymentService.reverseRepaymentAtomic({
        repaymentId: selectedRepayment.id,
        reason: decisionReason,
        userId: profile.id
      });

      if (reversalResult.success) {
        toast.success(
          <div>
            <div className="font-semibold">Repayment reversed successfully</div>
            <div className="text-sm mt-1">
              Restored: MK {Number(reversalResult.data?.restoredPrincipal || 0).toLocaleString()} principal,
              MK {Number(reversalResult.data?.restoredInterest || 0).toLocaleString()} interest
            </div>
          </div>,
          { duration: 5000 }
        );
        setActiveModal(null);
        setDecisionReason('');
        setSelectedRepayment(null);
        fetchData();
      } else {
        throw new Error(reversalResult.error?.message || 'Reversal failed');
      }
    } catch (e: any) {
      console.error('Repayment reversal error:', e);
      toast.error(e.message || "Reversal failed");
    } finally {
      setProcessingAction(false);
    }
  };

  const handleWriteOff = async () => {
    if (!profile || !loan) return;
    setProcessingAction(true);
    try {
      const writeOffResult = await loanService.writeOffLoan({
        loan_id: loan.id,
        user_id: profile.id,
        reason: decisionReason,
      });

      if (writeOffResult.success) {
        toast.success(`Loan written off. Total loss recognized.`);
        setActiveModal(null);
        setDecisionReason('');
        fetchData();
      } else {
        throw new Error(writeOffResult.error?.message || 'Write-off failed');
      }
    } catch (e: any) {
      toast.error("Write-off failed: " + e.message);
    } finally {
      setProcessingAction(false);
    }
  };

  const handleStatusUpdate = async (status: string, note: string, accountId?: string) => {
    if (!loan) return;
    setProcessingAction(true);
    try {
      let statusResult;

      if (status === 'active' && accountId) {
        statusResult = await loanService.disburseLoan({
          loan_id: loan.id,
          account_id: accountId,
          disbursement_date: new Date().toISOString().split('T')[0],
          user_id: profile?.id,
          note: note,
        });
      } else {
        statusResult = await loanService.updateLoanStatus(loan.id, status as any, note);
      }

      if (statusResult.success) {
        toast.success(status === 'active' ? `Loan approved and disbursed` : `Loan ${status}`);
        setActiveModal(null);
        setDecisionReason('');
        fetchData();
      } else {
        throw new Error(statusResult.error?.message || 'Action failed');
      }
    } catch (e: any) {
      toast.error('Action failed: ' + e.message);
    } finally {
      setProcessingAction(false);
    }
  };

  const handleDownloadStatement = () => {
    if (!loan) return;
    generateStatementPDF(loan, repayments);
    toast.success("Statement generated");
  };

  const handleDeleteLoan = async () => {
    if (!loan || !profile) return;

    if (!effectiveRoles.includes('admin')) {
      toast.error('Only admins can delete loans.');
      return;
    }

    const reason = (prompt('Reason for deleting this loan (required):') || '').trim();
    if (!reason) {
      toast.error('Deletion reason is required');
      return;
    }

    setProcessingAction(true);
    try {
      const deleteResult = await loanService.deleteLoan(loan.id);

      if (deleteResult.success) {
        toast.success('Loan deleted successfully');
        navigate('/loans');
      } else {
        throw new Error(deleteResult.error?.message || 'Delete failed');
      }
    } catch (e: any) {
      toast.error(`Delete failed: ${e.message}`);
    } finally {
      setProcessingAction(false);
    }
  };

  const handleAppFormUpload = async () => {
    if (!appFormBlob || !loan || !profile) return;
    setProcessingAction(true);

    try {
      const fileName = `${APPLICATION_FORM_PREFIX}${Date.now()}.pdf`;
      const path = `${loan.id}/${fileName}`;
      const { supabase } = await import('@/lib/supabase');
      const { data } = await supabase.storage.from(LOAN_DOCUMENTS_BUCKET).upload(path, appFormBlob);

      if (data) {
        const { error: dbError } = await supabase.from('loan_documents').insert({
          loan_id: loan.id,
          type: 'application_form',
          file_name: 'Application Form',
          mime_type: appFormBlob.type || 'application/pdf',
          file_size: appFormBlob.size,
          storage_path: data.path,
          uploaded_by: profile.id
        });

        if (!dbError) {
          toast.success('Loan agreement uploaded successfully');
          setAppFormBlob(null);
          fetchData();
        } else {
          throw dbError;
        }
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload agreement');
    } finally {
      setProcessingAction(false);
    }
  };

  if (loading || !loan) return <div className="p-12 text-center"><RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></div>;

  const isExecutive = effectiveRoles.includes('ceo') || effectiveRoles.includes('admin');
  const isAccountant = effectiveRoles.includes('accountant') || effectiveRoles.includes('admin');
  const isOfficer = effectiveRoles.includes('loan_officer') || effectiveRoles.includes('admin');

  const principalPaid = Number(loan.principal_amount || 0) - Number(loan.principal_outstanding || 0);
  const recoveryPercent = loan.principal_amount > 0 ? (principalPaid / Number(loan.principal_amount)) * 100 : 0;

  const allDocuments = [...documents, ...borrowerDocuments.map(doc => ({
    id: doc.id,
    loan_id: id,
    type: doc.type,
    file_name: doc.file_name,
    mime_type: doc.mime_type,
    file_size: doc.file_size,
    storage_path: doc.storage_path,
    created_at: doc.created_at
  }))];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/loans')} className="flex items-center text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Portfolio
          </button>
          {loan.status === 'active' && isOfficer && (
            <>
              <button onClick={() => setActiveModal('visit')} className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-all flex items-center">
                <MapPin className="h-4 w-4 mr-1.5" /> Log Visit
              </button>
              <Link to={`/loans/restructure/${loan.id}`} className="bg-amber-50 text-amber-700 border border-amber-200 px-4 py-2 rounded-xl text-sm font-bold hover:bg-amber-100 transition-all flex items-center">
                <RefreshCw className="h-4 w-4 mr-1.5" /> Restructure
              </Link>
            </>
          )}
          {loan.status === 'active' && isExecutive && (
            <button onClick={() => setActiveModal('writeoff')} className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-100 transition-all flex items-center">
              <ShieldAlert className="h-4 w-4 mr-1.5" /> Write Off
            </button>
          )}
          {loan.status === 'active' && (isAccountant || isOfficer) && (
            <button onClick={handleOpenRepaymentModal} className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-green-700 transition-all">
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
              <button onClick={() => setActiveModal('approve')} className="bg-indigo-900 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-800 transition-all flex items-center" title="Approve and Disburse Loan">
                <ThumbsUp className="h-4 w-4 mr-1.5" /> Approve & Disburse
              </button>
            </>
          )}
          {isExecutive && (
            <button onClick={handleDeleteLoan} className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-100 transition-all flex items-center">
              <ShieldAlert className="h-4 w-4 mr-1.5" /> Delete
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDownloadStatement} className="flex items-center text-sm text-indigo-600 hover:text-indigo-800 px-3 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all" title="Download Statement">
            <Download className="h-4 w-4 mr-1" /> Statement
          </button>
          <button onClick={() => window.print()} className="p-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all" title="Print">
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
              <span className="text-xs font-bold text-indigo-600">{(Number(recoveryPercent) || 0).toFixed(1)}% Recovered</span>
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
            overpaymentAmount={loan.overpayment_amount}
          />

          <LoanVisitations
            visitations={visitations}
            imageUrls={visitImageUrls}
            onViewImage={setViewImage}
          />

          {/* Loan Agreement Upload for Approved Loans */}
          {loan.status === 'active' && !documents.some(doc => doc.type === 'application_form') && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-900 flex items-center">
                  <FileText className="h-4 w-4 mr-2 text-indigo-600" />
                  Loan Agreement
                </h3>
                <span className="text-[10px] font-bold text-amber-600 uppercase bg-amber-50 px-2 py-1 rounded border border-amber-100">Upload Required</span>
              </div>
              <div className="space-y-4">
                <DocumentUpload label="Upload Loan Agreement" onUpload={setAppFormBlob} onRemove={() => setAppFormBlob(null)} />
                {appFormBlob && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleAppFormUpload}
                      disabled={processingAction}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-400 transition-all"
                    >
                      {processingAction ? 'Uploading...' : 'Upload Agreement'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <LoanDocumentsList
            documents={allDocuments}
            documentUrls={documentUrls}
            documentMimeTypes={documentMimeTypes}
            onViewImage={setViewImage}
            onViewPdf={(url, name) => { }}
            onViewExcel={(url, name) => { }}
          />

          <LoanRepaymentHistory
            repayments={repayments}
            onReverse={(r) => { setSelectedRepayment(r); setActiveModal('reverse'); }}
          />
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

      {/* Decision Modals */}
      <LoanDecisionModals
        isOpen={['approve', 'reassess', 'reject'].includes(activeModal as string)}
        type={activeModal as any}
        loan={loan}
        isProcessing={processingAction}
        accounts={accounts}
        targetAccountId={targetAccountId}
        setTargetAccountId={setTargetAccountId}
        reason={decisionReason}
        setReason={setDecisionReason}
        onClose={() => setActiveModal(null)}
        onConfirm={handleStatusUpdate}
      />

      {/* Repayment Modal */}
      <RepaymentModal
        isOpen={activeModal === 'repay'}
        displayAmount={displayRepayAmount}
        onAmountChange={handleRepayAmountChange}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        transactionRef={transactionRef}
        setTransactionRef={setTransactionRef}
        isProcessing={processingAction}
        onClose={() => setActiveModal(null)}
        onConfirm={handleRepayment}
        loan={loan}
      />

      {activeModal === 'visit' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-indigo-900 px-6 py-5 flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center text-lg"><MapPin className="mr-3 h-6 w-6 text-indigo-300" /> Log Field Visit</h3>
              <button onClick={() => setActiveModal(null)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Close"><X className="h-5 w-5 text-indigo-300" /></button>
            </div>
            <form onSubmit={handleLogVisit} className="p-8 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Visit Notes</label>
                <textarea required className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 h-24 resize-none" placeholder="Describe the purpose and outcome of the visit..." value={visitForm.notes} onChange={e => setVisitForm({ ...visitForm, notes: e.target.value })} />
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
                      onChange={e => setVisitForm({ ...visitForm, imageBlob: e.target.files?.[0] || null })}
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

      {/* Legacy Reverse Modal - Kept for backward compatibility, but prefer using ReverseRepaymentModal component */}
      {activeModal === 'reverse' && selectedRepayment && (
        <ReverseRepaymentModal
          repaymentId={selectedRepayment.id}
          loanId={loan?.id || ''}
          amount={selectedRepayment.amount_paid}
          onClose={() => {
            setActiveModal(null);
            setSelectedRepayment(null);
            setDecisionReason('');
          }}
          onSuccess={() => {
            fetchData();
          }}
        />
      )}

      {activeModal === 'writeoff' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-red-900 px-6 py-5 flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center text-lg"><ShieldAlert className="mr-3 h-6 w-6 text-red-300" /> Loan Write-Off</h3>
              <button onClick={() => setActiveModal(null)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Close"><X className="h-5 w-5 text-red-300" /></button>
            </div>
            <div className="p-8 space-y-5">
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                <p className="text-xs text-red-700 leading-relaxed font-bold">
                  CRITICAL ACTION: This will recognize a total loss of {formatCurrency((loan.principal_outstanding || 0) + (loan.interest_outstanding || 0) + (loan.penalty_outstanding || 0))} and close the loan as Defaulted.
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Justification</label>
                <textarea required className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 h-24 resize-none" placeholder="Provide detailed justification for this write-off..." value={decisionReason} onChange={e => setDecisionReason(e.target.value)} />
              </div>
              <div className="pt-4">
                <button onClick={handleWriteOff} disabled={processingAction || !decisionReason.trim()} className="w-full bg-red-900 text-white py-3 rounded-xl font-bold hover:bg-black transition-all shadow-lg shadow-red-200">
                  {processingAction ? 'Processing...' : 'Execute Write-Off'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMapPicker && (
        <MapPicker
          onSelect={(lat, lng) => { setVisitForm({ ...visitForm, lat, lng }); setShowMapPicker(false); }}
          onClose={() => setShowMapPicker(false)}
        />
      )}

      {viewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setViewImage(null)}>
          <button className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><X className="h-6 w-6 text-white" /></button>
          <img src={viewImage} className="max-w-full max-h-full rounded-lg shadow-2xl animate-in zoom-in-95" alt="Preview" />
        </div>
      )}
    </div>
  );
};