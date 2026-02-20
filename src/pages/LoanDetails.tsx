import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Loan, Repayment, LoanNote, LoanDocument, Visitation } from '@/types';
import { formatCurrency, calculateLoanDetails } from '@/utils/finance';
import Markdown from 'react-markdown';
import { analyzeFinancialData } from '@/services/aiService';
import { 
    ArrowLeft, AlertOctagon, AlertTriangle, ThumbsUp, ThumbsDown, MessageSquare, Send, 
    FileImage, ExternalLink, X, ZoomIn, Trash2, Edit, RefreshCw, Mail, MapPin, Camera, User, Calendar, Printer, Locate, Sparkles
} from 'lucide-react';
import { DocumentUpload } from '@/components/DocumentUpload';
import toast from 'react-hot-toast';

export const LoanDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
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
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showReassessModal, setShowReassessModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showDefaultModal, setShowDefaultModal] = useState(false);
  const [viewImage, setViewImage] = useState<string | null>(null);
  
  // AI Analysis State
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  
  // Form States
  const [repayAmount, setRepayAmount] = useState<number>(0);
  const [penaltyAmount, setPenaltyAmount] = useState<number>(0);
  const [newNote, setNewNote] = useState('');
  
  // Decision Form States
  const [decisionReason, setDecisionReason] = useState('');
  const [sendToChat, setSendToChat] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

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
    if (profile?.role === 'admin' || profile?.role === 'ceo') {
        fetchOfficers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchOfficers = async () => {
      const { data } = await supabase.from('users').select('id, full_name').eq('role', 'loan_officer');
      setOfficers(data || []);
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

  // Calculate Amortization Schedule
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
            borrowers(full_name, address, phone),
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

    } catch (e: any) {
        console.error("AI Error:", e);
        setAiAnalysis(`Failed to generate analysis. Error: ${e.message || 'Unknown error'}`);
    } finally {
        setAnalyzing(false);
    }
  };

  const sendNotificationEmail = async (subject: string, htmlContent: string) => {
    if (!loan?.users?.email) {
        console.warn("No officer email found, skipping notification.");
        return;
    }
    
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

        toast.success('Late fee applied');
        setShowPenaltyModal(false);
        setPenaltyAmount(0);
        fetchData();
    } catch (error) {
        toast.error('Failed to apply penalty');
    }
  };

  const handleRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan || !profile) return;

    let amount = Number(repayAmount);
    let penPaid = 0;
    let intPaid = 0;
    let prinPaid = 0;

    const currentPenalty = loan.penalty_outstanding || 0;
    
    if (currentPenalty > 0) {
        if (amount >= currentPenalty) {
            penPaid = currentPenalty;
            amount -= penPaid;
        } else {
            penPaid = amount;
            amount = 0;
        }
    }

    if (amount > 0 && loan.interest_outstanding > 0) {
        if (amount >= loan.interest_outstanding) {
            intPaid = loan.interest_outstanding;
            amount -= intPaid;
        } else {
            intPaid = amount;
            amount = 0;
        }
    }
    
    if (amount > 0) {
        prinPaid = amount;
    }

    const newPenOutstanding = Math.max(0, currentPenalty - penPaid);
    const newIntOutstanding = Math.max(0, loan.interest_outstanding - intPaid);
    const newPrinOutstanding = Math.max(0, loan.principal_outstanding - prinPaid);
    
    const isCompleted = newPrinOutstanding <= 0.01 && newIntOutstanding <= 0.01 && newPenOutstanding <= 0.01;

    try {
      const { error: rError } = await supabase.from('repayments').insert([{
        loan_id: loan.id,
        amount_paid: Number(repayAmount),
        principal_paid: prinPaid,
        interest_paid: intPaid,
        penalty_paid: penPaid,
        payment_date: new Date().toISOString().split('T')[0],
        recorded_by: profile.id
      }]);

      if (rError) throw rError;

      const { error: lError } = await supabase
        .from('loans')
        .update({
            penalty_outstanding: newPenOutstanding,
            interest_outstanding: newIntOutstanding,
            principal_outstanding: newPrinOutstanding,
            status: isCompleted ? 'completed' : 'active'
        })
        .eq('id', loan.id);
      
      if (lError) throw lError;

      if (isCompleted) {
          await addNote('Loan fully repaid and marked as Completed.', true);
          toast.success('Loan fully repaid!');
      } else {
          await addNote(`Repayment of ${formatCurrency(Number(repayAmount))} recorded.`, true);
          toast.success('Repayment recorded');
      }

      setShowRepayModal(false);
      setRepayAmount(0);
      fetchData();

    } catch (error) {
      console.error("Repayment failed", error);
      toast.error("Failed to record repayment");
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

  const openDecisionModal = (type: 'approve' | 'reject' | 'reassess') => {
      setDecisionReason('');
      setSendToChat(false);
      if (type === 'approve') setShowApproveModal(true);
      if (type === 'reject') setShowRejectModal(true);
      if (type === 'reassess') setShowReassessModal(true);
  }

  if (loading || !loan) return <div className="p-4">Loading details...</div>;

  const isExecutive = profile?.role === 'ceo' || profile?.role === 'admin';
  const isOwner = profile?.id === loan.officer_id || profile?.role === 'admin';
  const isPending = loan.status === 'pending';
  const isReassess = loan.status === 'reassess';
  const isRejected = loan.status === 'rejected';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
         <button onClick={() => navigate('/loans')} className="flex items-center text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to List
         </button>
         <div className="flex space-x-2">
            <button
                onClick={handleAnalyzeLoan}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-md shadow-sm text-sm font-medium border border-indigo-200 flex items-center mr-4"
            >
                <Sparkles className="h-4 w-4 mr-1" /> Smart Analysis
            </button>

            <button 
                onClick={() => window.print()}
                className="bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-md shadow-sm text-sm font-medium border border-gray-300 flex items-center mr-4"
            >
                <Printer className="h-4 w-4 mr-1" /> Print Statement
            </button>

            {(isPending || isRejected || isReassess) && isOwner && (
                <div className="flex space-x-2 mr-4 border-r pr-4 border-gray-300">
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
            
            {isExecutive && (
                <button 
                    onClick={() => setShowReassignModal(true)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md shadow-sm text-sm font-medium flex items-center mr-4 border border-gray-300"
                >
                    <User className="h-4 w-4 mr-1" /> Reassign
                </button>
            )}

            {isRejected && profile?.role === 'ceo' && (
                <button 
                    onClick={() => openDecisionModal('reassess')}
                    className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-2 rounded-md shadow-sm text-sm font-medium flex items-center mr-4"
                >
                    <RefreshCw className="h-4 w-4 mr-1" /> Reassess Application
                </button>
            )}

            {(isPending || isReassess) && isExecutive && (
                <div className="flex space-x-2 mr-4 border-r pr-4 border-gray-300">
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
                <>
                    <button 
                        onClick={() => setShowPenaltyModal(true)}
                        className="bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 rounded-md shadow-sm text-sm font-medium border border-red-200"
                    >
                        + Late Fee
                    </button>
                    {profile?.role !== 'ceo' && (
                        <button 
                            onClick={() => setShowRepayModal(true)}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md shadow-sm text-sm font-medium"
                        >
                            Record Repayment
                        </button>
                    )}
                </>
            )}

            {loan.status === 'active' && (
                <div className="ml-2 border-l pl-4 border-gray-300 flex space-x-2">
                    <button
                        onClick={() => setShowVisitModal(true)}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-md shadow-sm text-sm font-medium flex items-center"
                    >
                        <MapPin className="h-4 w-4 mr-1" /> Visit
                    </button>
                    
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
            <h1 className="text-2xl font-bold text-gray-900">JANALO MANAGEMENT</h1>
            <p className="text-sm text-gray-500">Loan Account Statement</p>
            <p className="text-xs text-gray-400 mt-1">Generated on {new Date().toLocaleString()}</p>
        </div>

        <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">{loan.borrowers?.full_name}</h2>
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
    
      {documents.length > 0 && (
          <div className="bg-white shadow rounded-lg overflow-hidden print:hidden">
             <div className="px-6 py-4 border-b border-gray-200">
                 <h3 className="text-lg font-medium text-gray-900 flex items-center">
                     <FileImage className="mr-2 h-5 w-5 text-gray-500"/> Documentation
                 </h3>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
                 {documents.map(doc => (
                     <div key={doc.id} className="border rounded-lg p-2 group relative">
                         <div className="aspect-w-16 aspect-h-9 bg-gray-100 mb-2 rounded overflow-hidden relative group-hover:opacity-90 transition-opacity">
                             {documentUrls[doc.id] ? (
                                <div className="relative h-32 w-full cursor-pointer" onClick={() => setViewImage(documentUrls[doc.id])}>
                                    <img 
                                        src={documentUrls[doc.id]} 
                                        alt={doc.type} 
                                        className="object-cover w-full h-full"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black bg-opacity-30 transition-opacity">
                                        <ZoomIn className="text-white h-6 w-6" />
                                    </div>
                                </div>
                             ) : (
                                 <div className="flex items-center justify-center h-32 text-xs text-gray-400">Loading...</div>
                             )}
                         </div>
                         <div className="flex justify-between items-start mt-2">
                             <div className="flex flex-col">
                                <span className="text-xs font-semibold uppercase text-indigo-700">{doc.type.replace('_', ' ')}</span>
                                {doc.file_name && <span className="text-xs text-gray-500 truncate w-24">{doc.file_name}</span>}
                             </div>
                             {documentUrls[doc.id] && (
                                <a href={documentUrls[doc.id]} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800" title="Open in new tab">
                                    <ExternalLink className="h-4 w-4"/>
                                </a>
                             )}
                         </div>
                     </div>
                 ))}
             </div>
          </div>
      )}

      {visitations.length > 0 && (
          <div className="bg-white shadow rounded-lg overflow-hidden print:hidden">
             <div className="px-6 py-4 border-b border-gray-200">
                 <h3 className="text-lg font-medium text-gray-900 flex items-center">
                     <MapPin className="mr-2 h-5 w-5 text-gray-500"/> Client Visitations
                 </h3>
             </div>
             <div className="divide-y divide-gray-200">
                 {visitations.map(visit => (
                     <div key={visit.id} className="p-6 hover:bg-gray-50">
                         <div className="flex justify-between items-start">
                             <div className="flex-1">
                                 <div className="flex items-center text-sm font-medium text-indigo-900 mb-1">
                                    <User className="h-4 w-4 mr-1 text-indigo-500" />
                                    {visit.users?.full_name} 
                                    <span className="text-gray-400 font-normal mx-2">•</span>
                                    <span className="text-gray-500 font-normal">{new Date(visit.visit_date).toLocaleDateString()}</span>
                                    {visit.location_lat && visit.location_long && (
                                        <a 
                                            href={`https://www.google.com/maps?q=${visit.location_lat},${visit.location_long}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="ml-3 flex items-center text-xs text-green-600 hover:text-green-800 border border-green-200 bg-green-50 px-2 py-0.5 rounded-full"
                                        >
                                            <MapPin className="h-3 w-3 mr-1" />
                                            View Location
                                        </a>
                                    )}
                                 </div>
                                 <p className="text-gray-700 text-sm mt-2">{visit.notes}</p>
                             </div>
                             {visitationUrls[visit.id] && (
                                <div className="ml-4 flex-shrink-0 cursor-pointer" onClick={() => setViewImage(visitationUrls[visit.id])}>
                                    <img src={visitationUrls[visit.id]} alt="Visit Proof" className="h-16 w-16 object-cover rounded shadow-sm border" />
                                </div>
                             )}
                         </div>
                     </div>
                 ))}
             </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:block">
        <div className="bg-white shadow rounded-lg overflow-hidden h-full print:shadow-none print:border print:mb-6">
            <div className="border-b border-gray-200 flex print:hidden">
                <button
                    onClick={() => setLeftTab('repayments')}
                    className={`px-6 py-4 text-sm font-medium focus:outline-none ${
                        leftTab === 'repayments' 
                        ? 'border-b-2 border-indigo-500 text-indigo-600 bg-gray-50' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Repayment History
                </button>
                <button
                    onClick={() => setLeftTab('schedule')}
                    className={`px-6 py-4 text-sm font-medium focus:outline-none flex items-center ${
                        leftTab === 'schedule' 
                        ? 'border-b-2 border-indigo-500 text-indigo-600 bg-gray-50' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <Calendar className="h-4 w-4 mr-2" /> Amortization Schedule
                </button>
            </div>
            
            <div className="overflow-x-auto">
                <div className={leftTab === 'repayments' ? 'block' : 'hidden print:block'}>
                    <div className="hidden print:block px-4 py-2 font-bold bg-gray-100 border-b">Repayment History</div>
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Breakdown</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {repayments.length === 0 ? (
                                <tr><td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">No repayments recorded.</td></tr>
                            ) : (
                                repayments.map(r => (
                                    <tr key={r.id}>
                                        <td className="px-4 py-4 text-sm text-gray-900">{new Date(r.payment_date).toLocaleDateString()}</td>
                                        <td className="px-4 py-4 text-sm font-semibold text-green-700">{formatCurrency(r.amount_paid)}</td>
                                        <td className="px-4 py-4 text-xs text-gray-500">
                                            P: {formatCurrency(r.principal_paid)}<br/>
                                            I: {formatCurrency(r.interest_paid)}
                                            {r.penalty_paid > 0 && <span className="text-red-500 block">Late: {formatCurrency(r.penalty_paid)}</span>}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className={leftTab === 'schedule' ? 'block' : 'hidden print:block print:mt-6'}>
                    <div className="hidden print:block px-4 py-2 font-bold bg-gray-100 border-b">Amortization Schedule</div>
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mo</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Installment</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Principal</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Interest</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {amortizationSchedule.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">Schedule unavailable.</td></tr>
                            ) : (
                                amortizationSchedule.map(item => (
                                    <tr key={item.month}>
                                        <td className="px-4 py-2 text-sm text-gray-900">{item.month}</td>
                                        <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(item.installment)}</td>
                                        <td className="px-4 py-2 text-xs text-right text-gray-500">{formatCurrency(item.principal)}</td>
                                        <td className="px-4 py-2 text-xs text-right text-gray-500">{formatCurrency(item.interest)}</td>
                                        <td className="px-4 py-2 text-xs text-right text-gray-700 font-semibold">{formatCurrency(item.balance)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden flex flex-col h-full print:hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                    <MessageSquare className="h-5 w-5 mr-2 text-gray-500"/> 
                    Activity Log
                </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-96 bg-gray-50">
                {notes.length === 0 ? (
                    <div className="text-center text-sm text-gray-500 py-4">No activity recorded yet.</div>
                ) : (
                    notes.map(note => (
                        <div key={note.id} className={`flex ${note.is_system ? 'justify-center' : 'justify-start'}`}>
                             {note.is_system ? (
                                 <div className="text-center w-full">
                                     <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                                         {note.content} • {new Date(note.created_at).toLocaleDateString()}
                                     </span>
                                 </div>
                             ) : (
                                <div className="flex items-start max-w-xs">
                                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 mr-2">
                                        {note.users?.full_name?.charAt(0) || 'U'}
                                    </div>
                                    <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                                        <p className="text-xs text-gray-500 mb-1 font-semibold">{note.users?.full_name}</p>
                                        <p className="text-sm text-gray-800">{note.content}</p>
                                        <p className="text-xs text-gray-400 mt-1 text-right">{new Date(note.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                             )}
                        </div>
                    ))
                )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-white">
                <form onSubmit={handlePostNote} className="flex gap-2">
                    <input 
                        type="text"
                        className="flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Add a note or comment..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                    />
                    <button 
                        type="submit"
                        disabled={!newNote.trim()}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:bg-gray-400"
                    >
                        <Send className="h-4 w-4" />
                    </button>
                </form>
            </div>
        </div>
      </div>

      {showAIModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => setShowAIModal(false)}></div>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl w-full">
                    <div className="bg-indigo-900 px-6 py-4 flex justify-between items-center">
                         <div className="flex items-center text-white">
                            <Sparkles className="h-6 w-6 mr-3 text-indigo-300" />
                            <h3 className="text-lg font-medium">Smart Loan Analysis</h3>
                         </div>
                         <button onClick={() => setShowAIModal(false)} className="text-indigo-300 hover:text-white">
                            <X className="h-6 w-6" />
                         </button>
                    </div>
                    <div className="p-6 max-h-[70vh] overflow-y-auto bg-gray-50">
                        {analyzing ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                                <p className="text-gray-600 font-medium">Analyzing repayment patterns and notes...</p>
                                <p className="text-sm text-gray-500 mt-2">Powered by Gemini AI</p>
                            </div>
                        ) : (
                            <div className="prose prose-indigo max-w-none text-sm text-gray-800 markdown-body">
                                <Markdown>{aiAnalysis}</Markdown>
                            </div>
                        )}
                    </div>
                    <div className="bg-white px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-200">
                        <button
                            type="button"
                            onClick={() => setShowAIModal(false)}
                            className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:ml-3 sm:w-auto sm:text-sm"
                        >
                            Close Analysis
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {showVisitModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => setShowVisitModal(false)}></div>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                    <div className="p-6">
                        <div className="flex items-center mb-4">
                             <div className="bg-indigo-100 rounded-full p-2 mr-3">
                                <MapPin className="h-6 w-6 text-indigo-600" />
                             </div>
                             <h3 className="text-lg font-medium text-gray-900">Record Visitation</h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">
                            Log an official site visit to the client. This will be stored in the visitation history.
                        </p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Date of Visit</label>
                                <input 
                                    type="date"
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={visitDate}
                                    onChange={(e) => setVisitDate(e.target.value)}
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                <div className="flex items-center space-x-2">
                                    <button
                                        type="button"
                                        onClick={captureLocation}
                                        disabled={locating}
                                        className={`flex-1 inline-flex justify-center items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium transition-colors ${
                                            visitLocation 
                                            ? 'bg-green-50 border-green-200 text-green-700' 
                                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        {locating ? (
                                            <>Loading GPS...</>
                                        ) : visitLocation ? (
                                            <><MapPin className="h-4 w-4 mr-2" /> Location Tagged ({visitLocation.lat.toFixed(4)}, {visitLocation.lng.toFixed(4)})</>
                                        ) : (
                                            <><Locate className="h-4 w-4 mr-2" /> Tag Current Location</>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Observations / Notes</label>
                                <textarea
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    rows={3}
                                    placeholder="Condition of business, location verification, etc."
                                    value={visitNote}
                                    onChange={(e) => setVisitNote(e.target.value)}
                                ></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Photo Evidence (Optional)</label>
                                <DocumentUpload 
                                    label="Site Photo"
                                    onUpload={setVisitImageBlob}
                                    onRemove={() => setVisitImageBlob(null)}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 mt-4">
                            <button
                                type="button"
                                onClick={() => setShowVisitModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleRecordVisit}
                                disabled={processingAction || !visitNote.trim()}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {processingAction ? 'Saving...' : 'Save Record'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {showDefaultModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => setShowDefaultModal(false)}></div>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                    <div className="p-6">
                        <div className="flex items-center mb-4">
                             <div className="bg-red-100 rounded-full p-2 mr-3">
                                <AlertOctagon className="h-6 w-6 text-red-600" />
                             </div>
                             <h3 className="text-lg font-medium text-gray-900">Mark as Bad Debt</h3>
                        </div>
                        <p className="text-sm text-red-600 bg-red-50 p-3 rounded mb-4">
                            <strong>Warning:</strong> You are about to mark this loan as Defaulted/Bad Debt. This indicates that recovery is unlikely.
                        </p>
                        
                        <label className="block text-sm font-medium text-gray-700 mb-1">Justification / Reason</label>
                        <textarea
                            className="w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            rows={3}
                            placeholder="Why is this being marked as bad debt?"
                            value={decisionReason}
                            onChange={(e) => setDecisionReason(e.target.value)}
                        ></textarea>

                        <div className="flex justify-end space-x-3 mt-4">
                            <button
                                type="button"
                                onClick={() => setShowDefaultModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDefault}
                                disabled={processingAction || !decisionReason.trim()}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50"
                            >
                                {processingAction ? 'Processing...' : 'Confirm Bad Debt'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {showReassignModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => setShowReassignModal(false)}></div>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                    <div className="p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Reassign Loan Officer</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Select a new loan officer to manage this application.
                        </p>
                        
                        <select
                            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                            value={selectedOfficer}
                            onChange={(e) => setSelectedOfficer(e.target.value)}
                        >
                            <option value="">-- Select Officer --</option>
                            {officers.map(o => (
                                <option key={o.id} value={o.id}>{o.full_name}</option>
                            ))}
                        </select>

                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                type="button"
                                onClick={() => setShowReassignModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleReassign}
                                disabled={processingAction || !selectedOfficer}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {processingAction ? 'Saving...' : 'Confirm Reassignment'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {showRepayModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
             <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => setShowRepayModal(false)}></div>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                    <form onSubmit={handleRepayment} className="p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Record Repayment</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Expected Monthly Installment: <span className="font-bold">{formatCurrency(loan.monthly_installment)}</span>
                        </p>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700">Amount Received (MK)</label>
                            <input 
                                type="number" 
                                required
                                min="0.01"
                                step="0.01"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                value={repayAmount}
                                onChange={e => setRepayAmount(Number(e.target.value))}
                            />
                        </div>

                        <div className="flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={() => setShowRepayModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                            >
                                Confirm Payment
                            </button>
                        </div>
                    </form>
                </div>
             </div>
        </div>
      )}

      {showPenaltyModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
             <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => setShowPenaltyModal(false)}></div>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                    <form onSubmit={handlePenalty} className="p-6">
                        <div className="flex items-center mb-4">
                            <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
                            <h3 className="text-lg font-medium text-gray-900">Apply Late Fee</h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">
                            Adding a penalty increases the total outstanding amount. This will be collected first in the next repayment.
                        </p>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700">Penalty Amount (MK)</label>
                            <input 
                                type="number" 
                                required
                                min="1"
                                step="0.01"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                value={penaltyAmount}
                                onChange={e => setPenaltyAmount(Number(e.target.value))}
                            />
                        </div>

                        <div className="flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={() => setShowPenaltyModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                            >
                                Apply Penalty
                            </button>
                        </div>
                    </form>
                </div>
             </div>
        </div>
      )}

      {showApproveModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => setShowApproveModal(false)}></div>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                    <div className="p-6">
                        <div className="flex items-center mb-4">
                             <div className="bg-indigo-100 rounded-full p-2 mr-3">
                                <ThumbsUp className="h-6 w-6 text-indigo-600" />
                             </div>
                             <h3 className="text-lg font-medium text-gray-900">Approve Loan Disbursement</h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">
                            Are you sure you want to approve this loan for <strong>{loan.borrowers?.full_name}</strong>? 
                            This will activate the loan and set the disbursement date to today ({new Date().toLocaleDateString()}).
                        </p>
                        
                        <div className="mb-4">
                             <label className="block text-sm font-medium text-gray-700 mb-1">Optional Approval Note</label>
                             <textarea
                                className="w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                rows={2}
                                placeholder="Any specific instructions..."
                                value={decisionReason}
                                onChange={(e) => setDecisionReason(e.target.value)}
                            ></textarea>
                        </div>

                        <div className="flex items-center mb-4">
                            <input
                                id="send-chat-approve"
                                type="checkbox"
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                checked={sendToChat}
                                onChange={(e) => setSendToChat(e.target.checked)}
                            />
                            <label htmlFor="send-chat-approve" className="ml-2 block text-sm text-gray-900 flex items-center">
                                <Mail className="h-3 w-3 mr-1 text-gray-500" />
                                Send notification as direct message to officer
                            </label>
                        </div>

                        <div className="flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={() => setShowApproveModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleApproveLoan}
                                disabled={processingAction}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {processingAction ? 'Processing...' : 'Confirm Approval'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => setShowRejectModal(false)}></div>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                    <div className="p-6">
                        <div className="flex items-center mb-4">
                             <div className="bg-red-100 rounded-full p-2 mr-3">
                                <ThumbsDown className="h-6 w-6 text-red-600" />
                             </div>
                             <h3 className="text-lg font-medium text-gray-900">Reject Loan Application</h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">
                            Please provide a reason for rejecting this application. This will be recorded in the system notes.
                        </p>
                        
                        <textarea
                            className="w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            rows={3}
                            placeholder="Reason for rejection..."
                            value={decisionReason}
                            onChange={(e) => setDecisionReason(e.target.value)}
                        ></textarea>

                        <div className="flex items-center mt-3 mb-1">
                            <input
                                id="send-chat-reject"
                                type="checkbox"
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                checked={sendToChat}
                                onChange={(e) => setSendToChat(e.target.checked)}
                            />
                            <label htmlFor="send-chat-reject" className="ml-2 block text-sm text-gray-900 flex items-center">
                                <Mail className="h-3 w-3 mr-1 text-gray-500" />
                                Send reason as direct message to officer
                            </label>
                        </div>

                        <div className="flex justify-end space-x-3 mt-4">
                            <button
                                type="button"
                                onClick={() => setShowRejectModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleRejectLoan}
                                disabled={processingAction || !decisionReason.trim()}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                            >
                                {processingAction ? 'Processing...' : 'Confirm Rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

       {showReassessModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => setShowReassessModal(false)}></div>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
                    <div className="p-6">
                        <div className="flex items-center mb-4">
                             <div className="bg-purple-100 rounded-full p-2 mr-3">
                                <RefreshCw className="h-6 w-6 text-purple-600" />
                             </div>
                             <h3 className="text-lg font-medium text-gray-900">Request Reassessment</h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">
                            Move this application to 'Reassess' status. Please provide instructions on what needs to be changed or verified.
                        </p>
                        
                        <textarea
                            className="w-full border border-gray-300 rounded-md shadow-sm p-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            rows={3}
                            placeholder="Instructions for the loan officer..."
                            value={decisionReason}
                            onChange={(e) => setDecisionReason(e.target.value)}
                        ></textarea>

                        <div className="flex items-center mt-3 mb-1">
                            <input
                                id="send-chat-reassess"
                                type="checkbox"
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                checked={sendToChat}
                                onChange={(e) => setSendToChat(e.target.checked)}
                            />
                            <label htmlFor="send-chat-reassess" className="ml-2 block text-sm text-gray-900 flex items-center">
                                <Mail className="h-3 w-3 mr-1 text-gray-500" />
                                Send instructions as direct message to officer
                            </label>
                        </div>

                        <div className="flex justify-end space-x-3 mt-4">
                            <button
                                type="button"
                                onClick={() => setShowReassessModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleReassess}
                                disabled={processingAction || !decisionReason.trim()}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                            >
                                {processingAction ? 'Processing...' : 'Confirm Reassessment'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {viewImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-95 p-4" onClick={() => setViewImage(null)}>
            <button 
                className="absolute top-4 right-4 text-white hover:text-gray-300 focus:outline-none bg-gray-800 bg-opacity-50 rounded-full p-2" 
                onClick={() => setViewImage(null)}
            >
                <X className="h-6 w-6" />
            </button>
            <img 
                src={viewImage} 
                alt="Full View" 
                className="max-w-full max-h-screen object-contain rounded shadow-2xl" 
                onClick={(e) => e.stopPropagation()} 
            />
        </div>
      )}
    </div>
  );
};