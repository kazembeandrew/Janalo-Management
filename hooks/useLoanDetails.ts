import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import type { InternalAccount, Loan, LoanDocument, LoanNote, Repayment, UserProfile, Visitation } from '@/types';
import { formatCurrency } from '@/utils/finance';
import { generateReceiptPDF, generateStatementPDF } from '@/utils/export';
// Removed missing utility import
import { loanService } from '@/services/loans';
import type { PaymentMethod } from '@/components/loans/RepaymentModal';

const LOAN_DOCUMENTS_BUCKET = 'loan-documents';
const VISIT_IMAGE_PREFIX = 'visit_';
const APPLICATION_FORM_PREFIX = 'application_form_';

// ─── Account keyword mapping (hidden from Loan Officer) ───────────────────────
// Maps each payment button to the keywords used to find the correct internal
// account. Never surfaced in any UI — the officer only sees the button labels.
const PAYMENT_METHOD_ACCOUNT_KEYWORDS: Record<PaymentMethod, string[]> = {
  cash:         ['cash'],
  bank:         ['main bank', 'bank'],
  airtel_money: ['airtel'],
  mpamba:       ['mpamba'],
};

export type LoanDetailsModal =
  | 'repay'
  | 'approve'
  | 'reassess'
  | 'reject'
  | 'visit'
  | 'reverse'
  | 'writeoff'
  | null;

export interface BorrowerDocumentRecord {
  id: string;
  borrower_id: string;
  type: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
}

export interface LoanDetailsBorrowerProfile {
  id: string;
  full_name: string;
  address: string | null;
  phone: string | null;
  employment: string | null;
  created_at: string;
}

export interface LoanDetailsOfficerProfile {
  full_name: string | null;
  email: string | null;
}

export interface LoanDetailsLoan extends Loan {
  borrowers?: LoanDetailsBorrowerProfile | null;
  users?: LoanDetailsOfficerProfile | null;
}

export interface LoanDetailsDocumentItem extends LoanDocument {
  source: 'loan' | 'borrower';
}

export interface LoanDocumentViewerState {
  image: string | null;
  pdf: { url: string; name: string } | null;
  excel: { url: string; name: string } | null;
}

export interface VisitFormState {
  notes: string;
  lat: number | null;
  lng: number | null;
  imageBlob: Blob | null;
}

export interface UseLoanDetailsOptions {
  loanId?: string;
  profile: UserProfile | null;
  effectiveRoles: string[];
}

export interface UseLoanDetailsResult {
  loan: LoanDetailsLoan | null;
  repayments: Repayment[];
  notes: LoanNote[];
  documents: LoanDocument[];
  borrowerDocuments: BorrowerDocumentRecord[];
  visitations: Visitation[];
  documentUrls: Record<string, string>;
  documentMimeTypes: Record<string, string>;
  visitImageUrls: Record<string, string>;
  allDocuments: LoanDetailsDocumentItem[];
  loading: boolean;
  processingAction: boolean;
  activeModal: LoanDetailsModal;
  showMapPicker: boolean;
  viewer: LoanDocumentViewerState;
  repayAmount: number;
  displayRepayAmount: string;
  // Repayment payment method — exposed so the modal can be controlled
  paymentMethod: PaymentMethod | null;
  transactionRef: string;
  newNote: string;
  decisionReason: string;
  selectedRepayment: Repayment | null;
  appFormBlob: Blob | null;
  visitForm: VisitFormState;
  isExecutive: boolean;
  isAccountant: boolean;
  isOfficer: boolean;
  principalPaid: number;
  recoveryPercent: number;
  refresh: () => Promise<void>;
  setActiveModal: (modal: LoanDetailsModal) => void;
  setShowMapPicker: (value: boolean) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setTransactionRef: (ref: string) => void;
  setNewNote: (value: string) => void;
  setDecisionReason: (value: string) => void;
  setSelectedRepayment: (repayment: Repayment | null) => void;
  setAppFormBlob: (blob: Blob | null) => void;
  setVisitForm: (value: VisitFormState | ((previous: VisitFormState) => VisitFormState)) => void;
  openImage: (url: string) => void;
  closeImage: () => void;
  openPdf: (url: string, name: string) => void;
  closePdf: () => void;
  openExcel: (url: string, name: string) => void;
  closeExcel: () => void;
  closeActiveModal: () => void;
  handleRepayAmountChange: (value: string) => void;
  handlePostNote: (event: FormEvent) => Promise<void>;
  handleLogVisit: (event: FormEvent) => Promise<void>;
  handleRepayment: (event: FormEvent) => Promise<void>;
  handleReverseRepayment: () => Promise<void>;
  handleWriteOff: () => Promise<void>;
  handleStatusUpdate: (status: string, note: string, accountId?: string) => Promise<void>;
  handleDownloadStatement: () => void;
  handleDeleteLoan: () => Promise<void>;
  handleAppFormUpload: () => Promise<void>;
}

export function useLoanDetails(options: UseLoanDetailsOptions): UseLoanDetailsResult {
  const { loanId, profile, effectiveRoles } = options;
  const navigate = useNavigate();

  const [loan, setLoan] = useState<LoanDetailsLoan | null>(null);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [notes, setNotes] = useState<LoanNote[]>([]);
  const [documents, setDocuments] = useState<LoanDocument[]>([]);
  const [borrowerDocuments, setBorrowerDocuments] = useState<BorrowerDocumentRecord[]>([]);
  const [visitations, setVisitations] = useState<Visitation[]>([]);
  const [accounts, setAccounts] = useState<InternalAccount[]>([]);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [documentMimeTypes, setDocumentMimeTypes] = useState<Record<string, string>>({});
  const [visitImageUrls, setVisitImageUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState(false);

  const [viewer, setViewer] = useState<LoanDocumentViewerState>({
    image: null,
    pdf: null,
    excel: null,
  });

  const [activeModal, setActiveModal] = useState<LoanDetailsModal>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const [repayAmount, setRepayAmount] = useState(0);
  const [displayRepayAmount, setDisplayRepayAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [transactionRef, setTransactionRef] = useState('');
  const [newNote, setNewNote] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [selectedRepayment, setSelectedRepayment] = useState<Repayment | null>(null);
  const [appFormBlob, setAppFormBlob] = useState<Blob | null>(null);
  const [visitForm, setVisitForm] = useState<VisitFormState>({
    notes: '',
    lat: null,
    lng: null,
    imageBlob: null,
  });

  // ── Internal account resolver ──────────────────────────────────────────────
  // Translates the officer's button selection into the correct internal account ID.
  // This mapping is completely hidden from the Loan Officer UI.
  const resolveAccountId = useCallback(
    (method: PaymentMethod | null): string => {
      if (!method) return '';

      const keywords = PAYMENT_METHOD_ACCOUNT_KEYWORDS[method];
      const match = accounts.find((acc) =>
        keywords.some((k) => acc.name.toLowerCase().includes(k)),
      );

      return match?.id ?? '';
    },
    [accounts],
  );

  const fetchAccounts = useCallback(async () => {
    // Accounts are fetched silently for internal mapping only.
    const { data } = await (supabase as any)
      .from('internal_accounts')
      .select('id, name, account_code')        // minimal projection — no balance exposed
      .eq('is_active', true)
      .order('name', { ascending: true });
    setAccounts((data as InternalAccount[]) || []);
  }, []);

  const fetchData = useCallback(async () => {
    if (!loanId) {
      setLoan(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data: loanData, error: loanError } = await (supabase as any)
        .from('loans')
        .select(`
          *,
          borrowers(id, full_name, address, phone, employment, created_at),
          users!officer_id(full_name)
        `)
        .eq('id', loanId)
        .single();

      if (loanError) {
        throw loanError;
      }

      const typedLoan = loanData as LoanDetailsLoan;
      setLoan(typedLoan);

      const [repayRes, noteRes, docRes, visitRes, borrowerDocRes] = await Promise.all([
        (supabase as any).from('repayments').select('*').eq('loan_id', loanId).order('payment_date', { ascending: false }),
        (supabase as any).from('loan_notes').select('*, users(full_name)').eq('loan_id', loanId).order('created_at', { ascending: false }),
        (supabase as any).from('loan_documents').select('*').eq('loan_id', loanId),
        (supabase as any).from('visitations').select('*, users(full_name)').eq('loan_id', loanId).order('visit_date', { ascending: false }),
        (supabase as any).from('borrower_documents').select('*').eq('borrower_id', typedLoan.borrower_id),
      ]);

      const repaymentRows = (repayRes.data as Repayment[]) || [];
      const noteRows = (noteRes.data as LoanNote[]) || [];
      const documentRows = (docRes.data as LoanDocument[]) || [];
      const visitationRows = (visitRes.data as Visitation[]) || [];
      const borrowerDocumentRows = (borrowerDocRes.data as BorrowerDocumentRecord[]) || [];

      setRepayments(repaymentRows);
      setNotes(noteRows);
      setDocuments(documentRows);
      setBorrowerDocuments(borrowerDocumentRows);
      setVisitations(visitationRows);

      const urlMap: Record<string, string> = {};
      const mimeMap: Record<string, string> = {};

      for (const document of documentRows) {
        const { data } = (supabase as any).storage.from(LOAN_DOCUMENTS_BUCKET).getPublicUrl(document.storage_path);
        if (data?.publicUrl) {
          urlMap[document.id] = data.publicUrl;
        }
        mimeMap[document.id] = document.mime_type;
      }

      for (const document of borrowerDocumentRows) {
        const { data } = (supabase as any).storage.from(LOAN_DOCUMENTS_BUCKET).getPublicUrl(document.storage_path);
        if (data?.publicUrl) {
          urlMap[document.id] = data.publicUrl;
        }
        mimeMap[document.id] = document.mime_type;
      }

      setDocumentUrls(urlMap);
      setDocumentMimeTypes(mimeMap);

      const visitUrlMap: Record<string, string> = {};
      for (const visitation of visitationRows) {
        if (!visitation.image_path) {
          continue;
        }

        const { data } = (supabase as any).storage.from(LOAN_DOCUMENTS_BUCKET).getPublicUrl(visitation.image_path);
        if (data?.publicUrl) {
          visitUrlMap[visitation.id] = data.publicUrl;
        }
      }
      setVisitImageUrls(visitUrlMap);
    } catch (error) {
      console.error('Error loading loan details:', error);
      toast.error('Error loading loan details');
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    void fetchData();
    void fetchAccounts();
  }, [fetchAccounts, fetchData]);

  const allDocuments = useMemo<LoanDetailsDocumentItem[]>(
    () => [
      ...documents.map((document) => ({ ...document, source: 'loan' as const })),
      ...borrowerDocuments.map((document) => ({
        id: document.id,
        loan_id: loanId || '',
        type: document.type,
        file_name: document.file_name,
        mime_type: document.mime_type,
        file_size: document.file_size,
        storage_path: document.storage_path,
        created_at: document.created_at,
        source: 'borrower' as const,
      })),
    ],
    [borrowerDocuments, documents, loanId],
  );

  const isExecutive = effectiveRoles.includes('ceo') || effectiveRoles.includes('admin');
  const isAccountant = effectiveRoles.includes('accountant') || effectiveRoles.includes('admin');
  const isOfficer = effectiveRoles.includes('loan_officer') || effectiveRoles.includes('admin');

  const principalPaid = loan ? Number(loan.principal_amount) - Number(loan.principal_outstanding) : 0;
  const recoveryPercent = loan && Number(loan.principal_amount) > 0 ? (principalPaid / Number(loan.principal_amount)) * 100 : 0;

  const closeActiveModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  const openImage = useCallback((url: string) => {
    setViewer((previous) => ({ ...previous, image: url }));
  }, []);

  const closeImage = useCallback(() => {
    setViewer((previous) => ({ ...previous, image: null }));
  }, []);

  const openPdf = useCallback((url: string, name: string) => {
    setViewer((previous) => ({ ...previous, pdf: { url, name } }));
  }, []);

  const closePdf = useCallback(() => {
    setViewer((previous) => ({ ...previous, pdf: null }));
  }, []);

  const openExcel = useCallback((url: string, name: string) => {
    setViewer((previous) => ({ ...previous, excel: { url, name } }));
  }, []);

  const closeExcel = useCallback(() => {
    setViewer((previous) => ({ ...previous, excel: null }));
  }, []);

  const handleRepayAmountChange = useCallback((value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    setDisplayRepayAmount(cleaned);
    setRepayAmount(Number.parseFloat(cleaned) || 0);
  }, []);

  const handlePostNote = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();

      if (!newNote.trim() || !profile || !loanId) {
        return;
      }

      const { error } = await (supabase as any).from('loan_notes').insert([
        {
          loan_id: loanId,
          user_id: profile.id,
          content: newNote,
          is_system: false,
        },
      ]);

      if (!error) {
        setNewNote('');
        await fetchData();
        toast.success('Note added');
      }
    },
    [fetchData, loanId, newNote, profile],
  );

  const handleLogVisit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();

      if (!profile || !loanId) {
        return;
      }

      setProcessingAction(true);

      try {
        let imagePath: string | null = null;

        if (visitForm.imageBlob) {
          const fileName = `${VISIT_IMAGE_PREFIX}${Date.now()}.jpg`;
          const path = `${loanId}/${fileName}`;
          const { data, error: uploadError } = await (supabase as any).storage.from(LOAN_DOCUMENTS_BUCKET).upload(path, visitForm.imageBlob);

          if (uploadError) {
            throw uploadError;
          }

          imagePath = data.path;
        }

        const { error } = await (supabase as any).from('visitations').insert({
          loan_id: loanId,
          officer_id: profile.id,
          notes: visitForm.notes,
          location_lat: visitForm.lat,
          location_long: visitForm.lng,
          image_path: imagePath,
          visit_date: new Date().toISOString().split('T')[0],
        });

        if (error) {
          throw error;
        }

        toast.success('Field visit logged');
        setActiveModal(null);
        setVisitForm({ notes: '', lat: null, lng: null, imageBlob: null });
        await fetchData();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to log visit';
        toast.error(message);
      } finally {
        setProcessingAction(false);
      }
    },
    [fetchData, loanId, profile, visitForm],
  );

  const handleRepayment = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();

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
        const idempotencyKey = `repayment-${loan.id}-${Date.now()}`;

        const { data, error } = await (supabase as any).rpc('process_repayment', {
          p_loan_id:         loan.id,
          p_amount:          amount,
          p_account_id:      resolvedAccountId,          // auto-mapped — hidden from officer
          p_user_id:         profile.id,
          p_idempotency_key: idempotencyKey,
          p_payment_method:  paymentMethod,              // stored for audit trail
          p_transaction_ref: transactionRef.trim() || null, // stored for ledger tracking
        });

        if (error) {
          throw error;
        }

        const result = data as {
          success: boolean;
          error?: string;
          repayment_id?: string;
          distribution?: {
            principal_paid: number;
            interest_paid: number;
            penalty_paid: number;
            overpayment: number;
            is_fully_paid: boolean;
          };
        };

        if (!result.success || !result.distribution || !result.repayment_id) {
          throw new Error(result.error || 'Repayment processing failed');
        }

        generateReceiptPDF(
          loan,
          {
            id: result.repayment_id,
            loan_id: loan.id,
            amount_paid: amount,
            payment_date: new Date().toISOString(),
            principal_paid: result.distribution.principal_paid,
            interest_paid: result.distribution.interest_paid,
            penalty_paid: result.distribution.penalty_paid,
            recorded_by: profile.id,
            created_at: new Date().toISOString(),
          },
          profile.full_name || 'System',
        );

        if (result.distribution.overpayment > 0) {
          toast.success(
            `Repayment recorded with overpayment of ${formatCurrency(result.distribution.overpayment)}`,
          );
        } else if (result.distribution.is_fully_paid) {
          toast.success('Loan fully paid! Receipt generated.');
        } else {
          toast.success('Repayment recorded. Receipt generated.');
        }

        // Reset all repayment form state
        setActiveModal(null);
        setDisplayRepayAmount('');
        setRepayAmount(0);
        setPaymentMethod(null);
        setTransactionRef('');
        await fetchData();
      } catch (error) {
        console.error('Repayment error:', error);
        const message = error instanceof Error ? error.message : 'Failed to record repayment';
        toast.error(message);
      } finally {
        setProcessingAction(false);
      }
    },
    [fetchData, loan, paymentMethod, profile, repayAmount, resolveAccountId, transactionRef],
  );

  const handleReverseRepayment = useCallback(async () => {
    if (!loan || !selectedRepayment || !profile) {
      return;
    }

    // Try to resolve account from the original repayment method if available, 
    // otherwise fallback to default or require selection if we were tracking it in modal state.
    // For now, assuming selectedRepayment might have method info or we use a default.
    // If selectedRepayment doesn't store method, we might need to pass it via state.
    // Assuming for now we might need to select method for reversal too, or it's stored.
    // Let's assume we use the resolved ID from current context or a default if not strictly tied.
    // However, usually reversals go back to the source. If source isn't stored in repayment table, 
    // we might need user to select or default. 
    // Given the prompt implies using paymentMethod state, let's assume the modal sets it.
    
    const accountId = resolveAccountId(paymentMethod) || accounts[0]?.id;
    if (!accountId) {
        toast.error('Cannot determine target account for reversal');
        return;
    }

    setProcessingAction(true);

    try {
      const { data, error } = await (supabase as any).rpc('reverse_repayment', {
        p_loan_id: loan.id,
        p_repayment_id: selectedRepayment.id,
        p_user_id: profile.id,
        p_reason: decisionReason,
        p_account_id: accountId,
      });

      if (error) {
        throw error;
      }

      const result = data as { success: boolean; error?: string; amount_reversed?: number };
      if (!result.success) {
        throw new Error(result.error || 'Reversal failed');
      }

      toast.success(`Repayment reversed and balance restored (${formatCurrency(result.amount_reversed || 0)})`);
      setActiveModal(null);
      setDecisionReason('');
      await fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Reversal failed';
      toast.error(`Reversal failed: ${message}`);
    } finally {
      setProcessingAction(false);
    }
  }, [accounts, decisionReason, fetchData, loan, profile, selectedRepayment, paymentMethod, resolveAccountId]);

  const handleWriteOff = useCallback(async () => {
    if (!profile || !loan) {
      return;
    }

    setProcessingAction(true);

    try {
      const { data, error } = await (supabase as any).rpc('write_off_loan', {
        p_loan_id: loan.id,
        p_user_id: profile.id,
        p_reason: decisionReason,
      });

      if (error) {
        throw error;
      }

      const result = data as { success: boolean; error?: string; total_loss?: number };
      if (!result.success) {
        throw new Error(result.error || 'Write-off failed');
      }

      toast.success(`Loan written off. Total loss of ${formatCurrency(result.total_loss || 0)} recognized.`);
      setActiveModal(null);
      setDecisionReason('');
      await fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Write-off failed';
      toast.error(`Write-off failed: ${message}`);
    } finally {
      setProcessingAction(false);
    }
  }, [decisionReason, fetchData, loan, profile]);

  const handleStatusUpdate = useCallback(
    async (status: string, note: string, accountId?: string) => {
      if (!loan) {
        return;
      }

      setProcessingAction(true);

      try {
        if (status === 'active' && accountId) {
          const { data, error } = await (supabase as any).rpc('disburse_loan', {
            p_loan_id: loan.id,
            p_account_id: accountId,
            p_user_id: profile?.id,
            p_note: note,
          });

          if (error) {
            throw error;
          }

          const result = data as { success: boolean; error?: string; reference_no?: string };
          if (!result.success) {
            throw new Error(result.error || 'Disbursement failed');
          }

          toast.success(`Loan approved and disbursed (${result.reference_no})`);
        } else {
          await (supabase as any).from('loans').update({ status }).eq('id', loan.id);

          await (supabase as any).from('loan_notes').insert([
            {
              loan_id: loanId,
              user_id: profile?.id,
              content: `${status.charAt(0).toUpperCase() + status.slice(1)}: ${note}`,
              is_system: true,
            },
          ]);

          toast.success(`Loan ${status}`);
        }

        setActiveModal(null);
        setDecisionReason('');
        await fetchData();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Action failed';
        toast.error(`Action failed: ${message}`);
      } finally {
        setProcessingAction(false);
      }
    },
    [fetchData, loan, loanId, profile],
  );

  const handleDownloadStatement = useCallback(() => {
    if (!loan) {
      return;
    }

    generateStatementPDF(loan, repayments);
    toast.success('Statement generated');
  }, [loan, repayments]);

  const handleDeleteLoan = useCallback(async () => {
    if (!loan || !profile) {
      return;
    }

    const isDisbursed = Boolean(loan.disbursement_date) || ['active', 'completed', 'defaulted'].includes(loan.status);
    if (isDisbursed && import.meta.env.PROD) {
      toast.error('Deletion is disabled in production for disbursed loans. Use write-off/void workflows instead.');
      return;
    }

    if (isDisbursed && !effectiveRoles.includes('admin')) {
      toast.error('Only admins can delete disbursed loans (test cleanup).');
      return;
    }

    const reason = (window.prompt('Reason for deleting this loan (required):') || '').trim();
    if (!reason) {
      toast.error('Deletion reason is required');
      return;
    }

    setProcessingAction(true);

    try {
      const deleteResult = await loanService.deleteLoan(loan.id);
      if (!deleteResult.success) {
          throw new Error(deleteResult.error?.message || 'Delete failed');
      }

      toast.success('Loan deleted successfully');
      navigate('/loans');

      toast.success('Loan deleted successfully');
      navigate('/loans');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Delete failed';
      toast.error(`Delete failed: ${message}`);
    } finally {
      setProcessingAction(false);
    }
  }, [effectiveRoles, loan, navigate, profile]);

  const handleAppFormUpload = useCallback(async () => {
    if (!appFormBlob || !loan || !profile) {
      return;
    }

    setProcessingAction(true);

    try {
      const fileName = `${APPLICATION_FORM_PREFIX}${Date.now()}.pdf`;
      const path = `${loan.id}/${fileName}`;

      const { data, error: uploadError } = await (supabase as any).storage.from(LOAN_DOCUMENTS_BUCKET).upload(path, appFormBlob);
      if (uploadError) {
        throw uploadError;
      }

      const { error: insertError } = await (supabase as any).from('loan_documents').insert({
        loan_id: loan.id,
        type: 'application_form',
        file_name: 'Application Form',
        mime_type: appFormBlob.type || 'application/pdf',
        file_size: appFormBlob.size,
        storage_path: data.path,
      });

      if (insertError) {
        throw insertError;
      }

      toast.success('Loan agreement uploaded successfully');
      setAppFormBlob(null);
      await fetchData();
    } catch (error) {
      console.error('Upload error:', error);
      const message = error instanceof Error ? error.message : 'Failed to upload agreement';
      toast.error(message);
    } finally {
      setProcessingAction(false);
    }
  }, [appFormBlob, fetchData, loan, profile]);

  return {
    loan,
    repayments,
    notes,
    documents,
    borrowerDocuments,
    visitations,
    documentUrls,
    documentMimeTypes,
    visitImageUrls,
    allDocuments,
    loading,
    processingAction,
    activeModal,
    showMapPicker,
    viewer,
    repayAmount,
    displayRepayAmount,
    paymentMethod,
    transactionRef,
    newNote,
    decisionReason,
    selectedRepayment,
    appFormBlob,
    visitForm,
    isExecutive,
    isAccountant,
    isOfficer,
    principalPaid,
    recoveryPercent,
    refresh: fetchData,
    setActiveModal,
    setShowMapPicker,
    setPaymentMethod,
    setTransactionRef,
    setNewNote,
    setDecisionReason,
    setSelectedRepayment,
    setAppFormBlob,
    setVisitForm,
    openImage,
    closeImage,
    openPdf,
    closePdf,
    openExcel,
    closeExcel,
    closeActiveModal,
    handleRepayAmountChange,
    handlePostNote,
    handleLogVisit,
    handleRepayment,
    handleReverseRepayment,
    handleWriteOff,
    handleStatusUpdate,
    handleDownloadStatement,
    handleDeleteLoan,
    handleAppFormUpload,
  };
}
