import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Loan, Repayment, LoanNote, LoanDocument, Visitation, InterestType } from '@/types';
import { formatCurrency, calculateLoanDetails } from '@/utils/finance';
import Markdown from 'react-markdown';
import { analyzeFinancialData, assessLoanRisk } from '@/services/aiService';
import { exportToCSV, generateReceiptPDF, generateStatementPDF } from '@/utils/export';
import { 
    ArrowLeft, AlertOctagon, AlertTriangle, ThumbsUp, ThumbsDown, MessageSquare, Send, 
    FileImage, ExternalLink, X, ZoomIn, Trash2, Edit, RefreshCw, Mail, MapPin, Camera, User, Calendar, Printer, Locate, Sparkles, ShieldCheck, Download, FileText, Receipt, Eraser
} from 'lucide-react';
import { DocumentUpload } from '@/components/DocumentUpload';
import toast from 'react-hot-toast';

export const LoanDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { profile, effectiveRoles } = useAuth();
  const navigate = useNavigate();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [notes, setNotes] = useState<LoanNote[]>([]);
  const [documents, setDocuments] = useState<LoanDocument[]>([]);
  const [visitations, setVisitations] = useState<Visitation[]>([]);
  const [documentUrls, setDocumentUrls] = useState<{[key: string]: string}>({});
  const [visitationUrls, setVisitationUrls] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [leftTab, setLeftTab] = useState<'repayments' | 'schedule'>('repayments');

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
  const [viewImage, setViewImage] = useState<string | null>(null);
  
  // AI Analysis State
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [riskAssessment, setRiskAssessment] = useState<string | null>(null);
  
  // Form States
  const [repayAmount, setRepayAmount] = useState<number>(0);
  const [penaltyAmount, setPenaltyAmount] = useState<number>(0);
  const [waiveData, setWaiveData] = useState({ interest: 0, penalty: 0 });
  const [newNote, setNewNote] = useState('');
  
  // Decision Form States
  const [decisionReason, setDecisionReason] = useState('');
  const [sendToChat, setSendToChat] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

  // Restructure Form State
  const [restructureData, setRestructureData] = useState({
      new_rate: 5,
      new_term: 6,
      new_type: 'flat' as InterestType
  });

  // Visit Form State
  const [visitNote, setVisitNote] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [visitImageBlob, setVisitImageBlob] = useState<Blob | null>(null);
  const [visitLocation, setVisitLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locating, setLocating] = useState(false);

  // Officer List for Reassignment
  const [officers, setOfficers] = useState<{id: string, full_name: string}[]>([]);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedOfficer, setSelectedOfficer] = useState('');

  useEffect(() => {
    fetchData();
    if (effectiveRoles.includes('admin') || effectiveRoles.includes('ceo')) {
        fetchOfficers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchOfficers = async () => {
      const { data } = await supabase.from('users').select('id, full_name').eq('role', 'loan_officer');
      setOfficers(data || []);
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

  const handleReassign = async () => {
      if (!loan || !selectedOfficer) return;
      setProcessingAction(true);
      try {
          const { error } = await supabase
            .from('loans')
            .update({ officer_id: selectedOfficer })
            .eq('id', loan.id);
          
          if (error) throw error;
          
          const newOfficerName = officers.find(o => o.id === selectedOfficer)?.full_name || 'New Officer';
          await addNote(`Loan reassigned to ${newOfficerName} by ${profile?.full_name}.`, true);
          await logAudit('Loan Reassigned', { to_officer: newOfficerName });
          
          await createNotification(
              selectedOfficer,
              'Loan Reassigned',
              `A loan for ${loan.borrowers?.full_name} has been reassigned to you.`,
              `/loans/${loan.id}`
          );

          toast.success(`Loan reassigned to ${newOfficerName}`);
          setShowReassignModal(false);
          fetchData();
      } catch (error) {
          console.error(error);
          toast.error('Failed to reassign loan.');
      } finally {
          setProcessingAction(false);
      }
  };

  const createNotification = async (userId: string, title: string, message: string, link: string) => {
      await supabase.from('notifications').insert({
          user_id: userId,
          title,
          message,
          link
      });
  };

  const amortizationSchedule = useMemo(() => {
      if (!loan) return [];
      return calculateLoanDetails(
          loan.principal_amount,
          loan.interest_rate,
          loan.term_months,
          loan.interest_type
      ).schedule;
  }, [loan]);

  const fetchData = async () => {
    if (!id) return;
    try {
      const { data: loanData, error: loanError } = await supabase
        .from('loans')
        .select(`
            *, 
            borrowers(id, full_name, address, phone),
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
              if (data) {
                  urlMap[doc.id] = data.publicUrl;
              }
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

  const captureLocation = () => {
      if (!navigator.geolocation) {
          toast.error('Geolocation is not supported');
          return;
      }
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
          (position) => {
              setVisitLocation({
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
              });
              setLocating(false);
              toast.success('Location tagged');
          },
          (error) => {
              console.error(error);
              toast.error('Unable to retrieve location');
              setLocating(false);
          },
          { enableHighAccuracy: true }
      );
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
        setAiAnalysis(`Failed to generate analysis. Error: ${e.message || 'Unknown error'}`);
    } finally {
        setAnalyzing(false);
    }
  };

  const sendNotificationEmail = async (subject: string, htmlContent: string) => {
    if (!loan?.users?.email) return;
    try {
        await fetch('/api/admin/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: loan.users.email,
                subject: subject,
                html: htmlContent
            })
        });
    } catch (e) {
        console.warn("Email dispatch error:", e);
    }
  };

  const sendDirectMessage = async (recipientId: string, message: string) => {
      if (!profile || !message.trim()) return;
      if (recipientId === profile.id) return;

      try {
          const { data: myConvos } = await supabase.from('conversation_participants').select('conversation_id').eq('user_id', profile.id);
          const myConvoIds = myConvos?.map(c => c.conversation_id) || [];
          
          let conversationId = null;

          if (myConvoIds.length > 0) {
              const { data: targetConvos } = await supabase
                .from('conversation_participants')
                .select('conversation_id')
                .eq('user_id', recipientId)
                .in('conversation_id', myConvoIds)
                .limit(1);
              
              if (targetConvos && targetConvos.length > 0) {
                  conversationId = targetConvos[0].conversation_id;
              }
          }

          if (!conversationId) {
              const { data: newConvoId, error: createError } = await supabase.rpc('create_new_conversation', {
                  recipient_id: recipientId
              });
              
              if (createError) throw createError;
              conversationId = newConvoId;
          }

          await supabase.from('direct_messages').insert({
              conversation_id: conversationId,
              sender_id: profile.id,
              content: message
          });

          navigate('/messages');

      } catch (error) {
          console.error("Failed to send direct message", error);
          toast.error("Failed to open chat.");
      }
  };

  const handleApproveLoan = async () => {
      if (!loan) return;
      setProcessingAction(true);

      try {
          const { error } = await supabase
            .from('loans')
            .update({
                status: 'active',
                disbursement_date: new Date().toISOString().split('T')[0]
            })
            .eq('id', loan.id);
        
        if (error) throw error;
        
        const noteText = `Loan Approved and Disbursed by ${profile?.full_name}. ${decisionReason ? `Note: ${decisionReason}` : ''}`;
        await addNote(noteText, true);
        await logAudit('Loan Approved', { amount: loan.principal_amount, borrower: loan.borrowers?.full_name });

        await createNotification(
            loan.officer_id,
            'Loan Approved',
            `The loan for ${loan.borrowers?.full_name} has been approved.`,
            `/loans/${loan.id}`
        );

        toast.success(`Loan for ${loan.borrowers?.full_name} approved.`);

        const emailBody = `
            <p>Dear ${loan.users?.full_name},</p>
            <p>The loan application for <strong>${loan.borrowers?.full_name}</strong> has been <strong>APPROVED</strong> and marked as Active.</p>
            <p><strong>Amount:</strong> ${formatCurrency(loan.principal_amount)}<br/>
            <strong>Disbursement Date:</strong> ${new Date().toLocaleDateString()}</p>
            ${decisionReason ? `<p><strong>Note:</strong> ${decisionReason}</p>` : ''}
            <p>Please proceed with the fund disbursement process.</p>
        `;
        sendNotificationEmail(`Loan Approved: ${loan.borrowers?.full_name}`, emailBody);

        if (sendToChat && loan.officer_id) {
            await sendDirectMessage(loan.officer_id, `[System: Loan Approved] ${decisionReason || 'Your loan application for ' + loan.borrowers?.full_name + ' has been approved.'}`);
        }
        
        setShowApproveModal(false);
        setDecisionReason('');
        setSendToChat(false);
        fetchData();
      } catch (error) {
          console.error(error);
          toast.error('Error approving loan');
      } finally {
          setProcessingAction(false);
      }
  };

  const handleRejectLoan = async () => {
      if (!loan) return;
      if (!decisionReason.trim()) {
          toast.error("Please provide a reason for rejection.");
          return;
      }
      setProcessingAction(true);

      try {
          const { error } = await supabase
            .from('loans')
            .update({ status: 'rejected' })
            .eq('id', loan.id);
        
        if (error) throw error;
        
        await addNote(`Loan Rejected by ${profile?.full_name}. Reason: ${decisionReason}`, true);
        await logAudit('Loan Rejected', { reason: decisionReason });

        await createNotification(
            loan.officer_id,
            'Loan Rejected',
            `The loan for ${loan.borrowers?.full_name} was rejected.`,
            `/loans/${loan.id}`
        );

        toast.success(`Loan for ${loan.borrowers?.full_name} rejected.`);

        const emailBody = `
            <p>Dear ${loan.users?.full_name},</p>
            <p>The loan application for <strong>${loan.borrowers?.full_name}</strong> has been <strong>REJECTED</strong>.</p>
            <p><strong>Reason:</strong> ${decisionReason}</p>
            <p>Please review the application and contact administration if you have questions.</p>
        `;
        sendNotificationEmail(`Loan Rejected: ${loan.borrowers?.full_name}`, emailBody);

        if (sendToChat && loan.officer_id) {
            await sendDirectMessage(loan.officer_id, `[System: Loan Rejected] Regarding ${loan.borrowers?.full_name}: ${decisionReason}`);
        }
        
        setShowRejectModal(false);
        setDecisionReason('');
        setSendToChat(false);
        fetchData();
      } catch (error) {
          console.error(error);
          toast.error('Error rejecting loan');
      } finally {
          setProcessingAction(false);
      }
  };
  
  const handleReassess = async () => {
      if (!loan) return;
      if (!decisionReason.trim()) {
          toast.error("Please provide instructions for reassessment.");
          return;
      }
      setProcessingAction(true);
      
      try {
          const { error } = await supabase
            .from('loans')
            .update({ status: 'reassess' })
            .eq('id', loan.id);
            
          if (error) throw error;
          await addNote(`Application moved to Reassessment by ${profile?.full_name}. Note: ${decisionReason}`, true);
          await logAudit('Loan Reassessment Requested', { instructions: decisionReason });

          await createNotification(
              loan.officer_id,
              'Reassessment Required',
              `The application for ${loan.borrowers?.full_name} needs reassessment.`,
              `/loans/${loan.id}`
          );

          toast.success(`Application returned for reassessment.`);

          const emailBody = `
            <p>Dear ${loan.users?.full_name},</p>
            <p>The loan application for <strong>${loan.borrowers?.full_name}</strong> has been flagged for <strong>REASSESSMENT</strong>.</p>
            <p><strong>Instructions:</strong> ${decisionReason}</p>
            <p>Please update the application details as requested and resubmit.</p>
          `;
          sendNotificationEmail(`Action Required: Reassess ${loan.borrowers?.full_name}`, emailBody);

          if (sendToChat && loan.officer_id) {
            await sendDirectMessage(loan.officer_id, `[System: Reassessment Requested] Please review the application for ${loan.borrowers?.full_name}. Instructions: ${decisionReason}`);
          }

          setShowReassessModal(false);
          setDecisionReason('');
          setSendToChat(false);
          fetchData();
      } catch (e: any) {
          console.error("Reassess error", e);
          toast.error("Failed to update status");
      } finally {
          setProcessingAction(false);
      }
  };

  const handleResubmit = async () => {
      if (!loan) return;
      setProcessingAction(true);
      try {
          const { error } = await supabase
            .from('loans')
            .update({ status: 'pending' })
            .eq('id', loan.id);
          
          if (error) throw error;
          await addNote(`Application resubmitted for approval by ${profile?.full_name}.`, true);
          await logAudit('Loan Resubmitted', { borrower: loan.borrowers?.full_name });
          
          toast.success("Application resubmitted successfully.");
          fetchData();
      } catch (e) {
          console.error(e);
          toast.error("Failed to resubmit application.");
      } finally {
          setProcessingAction(false);
      }
  };

  const handleDefault = async () => {
      if (!loan) return;
      if (!decisionReason.trim()) {
          toast.error("Please provide a reason for marking this as Bad Debt.");
          return;
      }
      setProcessingAction(true);

      try {
          const { error } = await supabase
            .from('loans')
            .update({ status: 'defaulted' })
            .eq('id', loan.id);
        
        if (error) throw error;
        
        await addNote(`MARKED AS BAD DEBT (Defaulted) by ${profile?.full_name}. Justification: ${decisionReason}`, true);
        await logAudit('Loan Defaulted', { reason: decisionReason });
        
        toast.success('Loan marked as defaulted');
        setShowDefaultModal(false);
        setDecisionReason('');
        fetchData();
      } catch (error) {
          console.error(error);
          toast.error('Error updating status');
      } finally {
          setProcessingAction(false);
      }
  };

  const handleRestructure = async () => {
      if (!loan) return;
      setProcessingAction(true);
      
      try {
          const outstandingPrincipal = loan.principal_outstanding;
          const outstandingInterest = loan.interest_outstanding;
          const outstandingPenalty = loan.penalty_outstanding || 0;
          const newPrincipal = outstandingPrincipal + outstandingInterest + outstandingPenalty;
          
          const details = calculateLoanDetails(
              newPrincipal,
              restructureData.new_rate,
              restructureData.new_term,
              restructureData.new_type
          );
          
          const { error } = await supabase
            .from('loans')
            .update({
                principal_amount: newPrincipal,
                interest_rate: restructureData.new_rate,
                term_months: restructureData.new_term,
                interest_type: restructureData.new_type,
                principal_outstanding: newPrincipal,
                interest_outstanding: details.totalInterest,
                penalty_outstanding: 0,
                monthly_installment: details.monthlyInstallment,
                total_payable: details.totalPayable,
                updated_at: new Date().toISOString()
            })
            .eq('id', loan.id);
            
          if (error) throw error;
          
          await addNote(`LOAN RESTRUCTURED by ${profile?.full_name}. New Principal: ${formatCurrency(newPrincipal)}, Term: ${restructureData.new_term} months.`, true);
          await logAudit('Loan Restructured', { new_principal: newPrincipal, term: restructureData.new_term });
          
          toast.success('Loan successfully restructured');
          setShowRestructureModal(false);
          fetchData();
      } catch (e: any) {
          console.error(e);
          toast.error('Failed to restructure loan');
      } finally {
          setProcessingAction(false);
      }
  };

  const handlePenalty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan || !profile) return;
    
    try {
        const newPenalty = (loan.penalty_outstanding || 0) + Number(penaltyAmount);
        const { error } = await supabase
            .from('loans')
            .update({ penalty_outstanding: newPenalty })
            .eq('id', loan.id);
        
        if (error) throw error;
        
        await addNote(`Late Fee of ${formatCurrency(penaltyAmount)} applied.`, true);
        await logAudit('Penalty Applied', { amount: penaltyAmount });

        toast.success('Late fee applied');
        setShowPenaltyModal(false);
        setPenaltyAmount(0);
        fetchData();
    } catch (error) {
        toast.error('Failed to apply penalty');
    }
  };

  const handleWaive = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!loan || !profile) return;
      setProcessingAction(true);

      try {
          const newInterest = Math.max(0, loan.interest_outstanding - waiveData.interest);
          const newPenalty = Math.max(0, (loan.penalty_outstanding || 0) - waiveData.penalty);

          const { error } = await supabase
            .from('loans')
            .update({
                interest_outstanding: newInterest,
                penalty_outstanding: newPenalty
            })
            .eq('id', loan.id);
          
          if (error) throw error;

          let note = `CHARGES WAIVED by ${profile.full_name}. `;
          if (waiveData.interest > 0) note += `Interest: ${formatCurrency(waiveData.interest)}. `;
          if (waiveData.penalty > 0) note += `Penalty: ${formatCurrency(waiveData.penalty)}. `;
          if (decisionReason) note += `Reason: ${decisionReason}`;

          await addNote(note, true);
          await logAudit('Charges Waived', { interest: waiveData.interest, penalty: waiveData.penalty, reason: decisionReason });

          toast.success('Charges waived successfully');
          setShowWaiveModal(false);
          setWaiveData({ interest: 0, penalty: 0 });
          setDecisionReason('');
          fetchData();
      } catch (error) {
          console.error(error);
          toast.error('Failed to waive charges');
      } finally {
          setProcessingAction(false);
      }
  };

  const handleRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan || !profile) return;

    const amountToProcess = Number(repayAmount);
    if (isNaN(amountToProcess) || amountToProcess <= 0) {
        toast.error("Please enter a valid repayment amount.");
        return;
    }

    setProcessingAction(true);

    let remaining = amountToProcess;
    let penPaid = 0;
    let intPaid = 0;
    let prinPaid = 0;

    const currentPenalty = loan.penalty_outstanding || 0;
    
    if (currentPenalty > 0) {
        if (remaining >= currentPenalty) {
            penPaid = currentPenalty;
            remaining -= penPaid;
        } else {
            penPaid = remaining;
            remaining = 0;
        }
    }

    if (remaining > 0 && loan.interest_outstanding > 0) {
        if (remaining >= loan.interest_outstanding) {
            intPaid = loan.interest_outstanding;
            remaining -= intPaid;
        } else {
            intPaid = remaining;
            remaining = 0;
        }
    }
    
    if (remaining > 0) {
        prinPaid = remaining;
    }

    const newPenOutstanding = Math.max(0, currentPenalty - penPaid);
    const newIntOutstanding = Math.max(0, loan.interest_outstanding - intPaid);
    const newPrinOutstanding = Math.max(0, loan.principal_outstanding - prinPaid);
    
    const isCompleted = newPrinOutstanding <= 0.01 && newIntOutstanding <= 0.01 && newPenOutstanding <= 0.01;

    try {
      const { data: rData, error: rError } = await supabase.from('repayments').insert([{
        loan_id: loan.id,
        amount_paid: amountToProcess,
        principal_paid: prinPaid,
        interest_paid: intPaid,
        penalty_paid: penPaid,
        payment_date: new Date().toISOString().split('T')[0],
        recorded_by: profile.id
      }]).select().single();

      if (rError) throw new Error(rError.message);

      const { error: lError } = await supabase
        .from('loans')
        .update({
            penalty_outstanding: newPenOutstanding,
            interest_outstanding: newIntOutstanding,
            principal_outstanding: newPrinOutstanding,
            status: isCompleted ? 'completed' : 'active'
        })
        .eq('id', loan.id);
      
      if (lError) throw new Error(lError.message);

      if (isCompleted) {
          await addNote('Loan fully repaid and marked as Completed.', true);
          await logAudit('Loan Completed', { total_paid: amountToProcess });
          toast.success('Loan fully repaid!');
      } else {
          await addNote(`Repayment of ${formatCurrency(amountToProcess)} recorded.`, true);
          await logAudit('Repayment Recorded', { amount: amountToProcess });
          toast.success('Repayment recorded');
      }

      setShowRepayModal(false);
      setRepayAmount(0);
      fetchData();
      
      if (rData) {
          setTimeout(() => {
              if (window.confirm("Repayment recorded. Would you like to download the receipt?")) {
                  generateReceiptPDF(loan, rData, profile.full_name);
              }
          }, 500);
      }

    } catch (error: any) {
      console.error("Repayment failed:", error);
      toast.error(`Failed to record repayment: ${error.message || 'Unknown error'}`);
    } finally {
      setProcessingAction(false);
    }
  };

  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    await addNote(newNote, false);
    setNewNote('');
    toast.success('Note added');
  };

  const handleRecordVisit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!loan || !profile) return;
      setProcessingAction(true);

      try {
          let imagePath = null;
          if (visitImageBlob) {
              const fileName = `visit_${loan.id}_${Date.now()}.jpg`;
              const { data, error } = await supabase.storage.from('loan-documents').upload(`${loan.id}/${fileName}`, visitImageBlob);
              if (error) throw error;
              imagePath = data.path;
          }

          const { error } = await supabase.from('visitations').insert({
              loan_id: loan.id,
              officer_id: profile.id,
              visit_date: visitDate,
              notes: visitNote,
              image_path: imagePath,
              location_lat: visitLocation?.lat,
              location_long: visitLocation?.lng
          });

          if (error) throw error;

          const locationText = visitLocation ? ' (with Geotag)' : '';
          await addNote(`Official Client Visitation recorded on ${visitDate}${locationText}.`, true);
          await logAudit('Field Visit Recorded', { date: visitDate, geotagged: !!visitLocation });
          
          toast.success('Visitation recorded');
          setShowVisitModal(false);
          setVisitNote('');
          setVisitImageBlob(null);
          setVisitLocation(null);
          fetchVisitations();
          fetchNotes();
      } catch (error) {
          console.error(error);
          toast.error('Failed to record visitation');
      } finally {
          setProcessingAction(false);
      }
  };

  const handleDelete = async () => {
      if (!loan) return;
      if (!window.confirm("Are you sure you want to permanently delete this application?")) return;
      
      try {
          const { error } = await supabase.from('loans').delete().eq('id', loan.id);
          if (error) throw error;
          await logAudit('Loan Application Deleted', { borrower: loan.borrowers?.full_name });
          toast.success('Application deleted');
          navigate('/loans');
      } catch (error) {
          console.error(error);
          toast.error('Failed to delete application');
      }
  };

  const handleEdit = () => {
      if (!loan) return;
      navigate(`/loans/edit/${loan.id}`);
  };

  const handleExportRepayments = () => {
      if (!loan || repayments.length === 0) return;
      const data = repayments.map(r => ({
          Date: new Date(r.payment_date).toLocaleDateString(),
          Total_Paid: r.amount_paid,
          Principal: r.principal_paid,
          Interest: r.interest_paid,
          Penalty: r.penalty_paid
      }));
      exportToCSV(data, `Repayments_${loan.borrowers?.full_name.replace(/\s+/g, '_')}`);
  };

  const handleDownloadStatement = () => {
      if (!loan) return;
      generateStatementPDF(loan, repayments);
  };

  const openDecisionModal = (type: 'approve' | 'reject' | 'reassess') => {
      setDecisionReason('');
      setSendToChat(false);
      if (type === 'approve') setShowApproveModal(true);
      if (type === 'reject') setShowRejectModal(true);
      if (type === 'reassess') setShowReassessModal(true);
  }

  if (loading || !loan) return <div className="p-4">Loading details...</div>;

  // Role-Based Logic
  const isExecutive = effectiveRoles.includes('ceo') || effectiveRoles.includes('admin');
  const isAccountant = effectiveRoles.includes('accountant') || effectiveRoles.includes('admin');
  const isOfficer = effectiveRoles.includes('loan_officer') || effectiveRoles.includes('admin');
  const isOwner = profile?.id === loan.officer_id || effectiveRoles.includes('admin');
  
  const isPending = loan.status === 'pending';
  const isReassess = loan.status === 'reassess';
  const isRejected = loan.status === 'rejected';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
         <button onClick={() => navigate('/loans')} className="flex items-center text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to List
         </button>
         <div className="flex flex-wrap gap-2 justify-end">
            <button
                onClick={handleAnalyzeLoan}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-md shadow-sm text-sm font-medium border border-indigo-200 flex items-center"
            >
                <Sparkles className="h-4 w-4 mr-1" /> Smart Analysis
            </button>

            <button 
                onClick={handleDownloadStatement}
                className="bg-white hover:bg-gray-50 text-indigo-600 px-3 py-2 rounded-md shadow-sm text-sm font-medium border border-indigo-200 flex items-center"
            >
                <FileText className="h-4 w-4 mr-1" /> Download Statement
            </button>

            <button 
                onClick={() => window.print()}
                className="bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-md shadow-sm text-sm font-medium border border-gray-300 flex items-center"
            >
                <Printer className="h-4 w-4 mr-1" /> Print View
            </button>

            {(isPending || isRejected || isReassess) && isOwner && (
                <div className="flex space-x-2 border-l pl-2 border-gray-300">
                    <button 
                        onClick={handleDelete}
                        className="text-red-600 hover:text-red-800 px-3 py-2 text-sm font-medium flex items-center"
                        title="Delete Application"
                    >
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </button>
                    <button 
                        onClick={handleEdit}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md shadow-sm text-sm font-medium border border-gray-300 flex items-center"
                    >
                        <Edit className="h-4 w-4 mr-1" /> Edit
                    </button>
                </div>
            )}

            {isReassess && isOwner && (
                <button 
                    onClick={handleResubmit}
                    disabled={processingAction}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md shadow-sm text-sm font-medium flex items-center"
                >
                    <Send className="h-4 w-4 mr-1" /> Resubmit for Approval
                </button>
            )}
            
            {isExecutive && (
                <button 
                    onClick={() => setShowReassignModal(true)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md shadow-sm text-sm font-medium flex items-center border border-gray-300"
                >
                    <User className="h-4 w-4 mr-1" /> Reassign
                </button>
            )}

            {(isPending || isReassess) && isExecutive && (
                <div className="flex space-x-2 border-l pl-2 border-gray-300">
                     <button 
                        onClick={() => openDecisionModal('reassess')}
                        className="bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-2 rounded-md shadow-sm text-sm font-medium border border-purple-200 flex items-center"
                    >
                        <RefreshCw className="h-4 w-4 mr-1" /> Reassess
                    </button>
                     <button 
                        onClick={() => openDecisionModal('reject')}
                        className="bg-white hover:bg-red-50 text-red-700 px-3 py-2 rounded-md shadow-sm text-sm font-medium border border-red-200 flex items-center"
                    >
                        <ThumbsDown className="h-4 w-4 mr-1" /> Reject
                    </button>
                    <button 
                        onClick={() => openDecisionModal('approve')}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-md shadow-sm text-sm font-medium flex items-center"
                    >
                        <ThumbsUp className="h-4 w-4 mr-1" /> Approve
                    </button>
                </div>
            )}

            {loan.status === 'active' && (
                <div className="flex space-x-2 border-l pl-2 border-gray-300">
                    {isExecutive && (
                        <button 
                            onClick={() => setShowRestructureModal(true)}
                            className="bg-orange-50 hover:bg-orange-100 text-orange-700 px-4 py-2 rounded-md shadow-sm text-sm font-medium border border-orange-200 flex items-center"
                        >
                            <RefreshCw className="h-4 w-4 mr-1" /> Restructure
                        </button>
                    )}
                    {isAccountant && (
                        <>
                            <button 
                                onClick={() => setShowWaiveModal(true)}
                                className="bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-2 rounded-md shadow-sm text-sm font-medium border border-amber-200 flex items-center"
                            >
                                <Eraser className="h-4 w-4 mr-1" /> Waive
                            </button>
                            <button 
                                onClick={() => setShowPenaltyModal(true)}
                                className="bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 rounded-md shadow-sm text-sm font-medium border border-red-200"
                            >
                                + Late Fee
                            </button>
                        </>
                    )}
                    {(isAccountant || isOfficer) && (
                        <button 
                            onClick={() => setShowRepayModal(true)}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md shadow-sm text-sm font-medium"
                        >
                            Record Repayment
                        </button>
                    )}
                </div>
            )}

            {loan.status === 'active' && (
                <div className="flex space-x-2 border-l pl-2 border-gray-300">
                    {isOfficer && (
                        <button
                            onClick={() => setShowVisitModal(true)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-md shadow-sm text-sm font-medium flex items-center"
                        >
                            <MapPin className="h-4 w-4 mr-1" /> Visit
                        </button>
                    )}
                    
                    {isExecutive && (
                        <button
                            onClick={() => { setDecisionReason(''); setShowDefaultModal(true); }}
                            className="bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-md shadow-sm text-sm font-medium flex items-center"
                            title="Mark as Bad Debt"
                        >
                            <AlertOctagon className="h-4 w-4 mr-1" /> Default
                        </button>
                    )}
                </div>
            )}
         </div>
      </div>

      <div id="print-area" className="bg-white shadow rounded-lg overflow-hidden print:shadow-none print:w-full">
        <div className="hidden print:block px-6 py-4 border-b border-gray-200 text-center">
            <h1 className="text-2xl font-bold text-gray-900">JANALO ENTERPRISES</h1>
            <p className="text-sm text-gray-500">Loan Account Statement</p>
            <p className="text-xs text-gray-400 mt-1">Generated on {new Date().toLocaleString()}</p>
        </div>

        <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex justify-between items-start">
                <div>
                    <Link to={`/borrowers/${loan.borrower_id}`} className="text-xl font-bold text-gray-900 hover:text-indigo-600 flex items-center">
                        {loan.borrowers?.full_name}
                        <ExternalLink className="h-4 w-4 ml-2 opacity-50" />
                    </Link>
                    <div className="mt-1 text-sm text-gray-500 space-y-1">
                        <p>Loan ID: {loan.id.slice(0, 8)}</p>
                        <div className="flex items-center space-x-2">
                            <p className="flex items-center">
                                <User className="h-3 w-3 mr-1" /> 
                                Officer: <span className="font-medium text-gray-700 ml-1">{loan.users?.full_name || 'Unassigned'}</span>
                            </p>
                        </div>
                        <p className="flex items-center">
                            <MapPin className="h-3 w-3 mr-1" /> 
                            {loan.borrowers?.address || 'No Address'} • {loan.borrowers?.phone || 'No Phone'}
                        </p>
                    </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${
                    loan.status === 'active' ? 'bg-blue-100 text-blue-800' : 
                    loan.status === 'completed' ? 'bg-green-100 text-green-800' : 
                    loan.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    loan.status === 'reassess' ? 'bg-purple-100 text-purple-800' :
                    'bg-red-100 text-red-800'
                }`}>
                    {loan.status === 'reassess' ? 'Under Reassessment' : loan.status === 'defaulted' ? 'Bad Debt (Defaulted)' : loan.status}
                </span>
            </div>
        </div>
        
        <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 p-4 rounded-lg print:border print:bg-white">
                <div className="text-xs text-gray-500 uppercase">Total Outstanding</div>
                <div className="text-2xl font-bold text-indigo-900">
                    {formatCurrency(loan.principal_outstanding + loan.interest_outstanding + (loan.penalty_outstanding || 0))}
                </div>
                <div className="text-xs text-gray-500 mt-1 flex flex-col gap-1">
                    <span>Prin: {formatCurrency(loan.principal_outstanding)}</span>
                    <span>Int: {formatCurrency(loan.interest_outstanding)}</span>
                    {loan.penalty_outstanding > 0 && (
                        <span className="text-red-600 font-medium">Penalty: {formatCurrency(loan.penalty_outstanding)}</span>
                    )}
                </div>
            </div>
             <div className="p-4 border rounded-lg">
                <div className="text-xs text-gray-500 uppercase">Loan Terms</div>
                <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                        <span>Amount:</span> <span className="font-medium">{formatCurrency(loan.principal_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Rate:</span> <span className="font-medium">{loan.interest_rate}% Monthly ({loan.interest_type})</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Duration:</span> <span className="font-medium">{loan.term_months} Months</span>
                    </div>
                </div>
            </div>
             <div className="p-4 border rounded-lg">
                <div className="text-xs text-gray-500 uppercase">Payment Info</div>
                <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                        <span>Installment:</span> <span className="font-medium">{formatCurrency(loan.monthly_installment)}</span>
                    </div>
                     <div className="flex justify-between">
                        <span>Disbursed:</span> <span className="font-medium">{new Date(loan.disbursement_date).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    
      {/* ... rest of the component (documents, visitations, activity log) */}
    </div>
  );
};