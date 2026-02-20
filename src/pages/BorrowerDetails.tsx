import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Borrower, Loan, LoanDocument } from '@/types';
import { formatCurrency } from '@/utils/finance';
import { ArrowLeft, User, Phone, MapPin, Briefcase, Banknote, Clock, CheckCircle, AlertCircle, ChevronRight, History, FileText, ZoomIn, ExternalLink, X } from 'lucide-react';

export const BorrowerDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [borrower, setBorrower] = useState<Borrower | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [allDocuments, setAllDocuments] = useState<LoanDocument[]>([]);
  const [documentUrls, setDocumentUrls] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(true);
  const [viewImage, setViewImage] = useState<string | null>(null);

  useEffect(() => {
    fetchBorrowerData();
  }, [id]);

  const fetchBorrowerData = async () => {
    if (!id) return;
    try {
      // 1. Fetch Borrower
      const { data: bData, error: bError } = await supabase
        .from('borrowers')
        .select('*')
        .eq('id', id)
        .single();
      
      if (bError) throw bError;
      setBorrower(bData);

      // 2. Fetch Loans
      const { data: lData, error: lError } = await supabase
        .from('loans')
        .select('*')
        .eq('borrower_id', id)
        .order('created_at', { ascending: false });
      
      if (lError) throw lError;
      setLoans(lData || []);

      // 3. Fetch All Documents for all loans of this borrower
      if (lData && lData.length > 0) {
          const loanIds = lData.map(l => l.id);
          const { data: dData } = await supabase
            .from('loan_documents')
            .select('*')
            .in('loan_id', loanIds)
            .order('created_at', { ascending: false });
          
          if (dData) {
              setAllDocuments(dData);
              const urlMap: {[key: string]: string} = {};
              for (const doc of dData) {
                  const { data: pUrl } = supabase.storage.from('loan-documents').getPublicUrl(doc.storage_path);
                  if (pUrl) urlMap[doc.id] = pUrl.publicUrl;
              }
              setDocumentUrls(urlMap);
          }
      }

    } catch (error) {
      console.error(error);
      navigate('/borrowers');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !borrower) return <div className="p-8 text-center">Loading profile...</div>;

  const totalBorrowed = loans.reduce((sum, l) => sum + Number(l.principal_amount), 0);
  const totalOutstanding = loans.reduce((sum, l) => sum + (l.principal_outstanding + l.interest_outstanding + (l.penalty_outstanding || 0)), 0);

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/borrowers')} className="flex items-center text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Borrowers
      </button>

      <div className="bg-white shadow rounded-xl overflow-hidden border border-gray-200">
        <div className="bg-indigo-900 px-6 py-8 text-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center">
                    <div className="h-20 w-20 rounded-full bg-indigo-800 border-4 border-indigo-700 flex items-center justify-center text-3xl font-bold">
                        {borrower.full_name.charAt(0)}
                    </div>
                    <div className="ml-6">
                        <h1 className="text-3xl font-bold">{borrower.full_name}</h1>
                        <p className="text-indigo-300 flex items-center mt-1">
                            <Clock className="h-4 w-4 mr-1" /> Client since {new Date(borrower.created_at).toLocaleDateString()}
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 md:gap-8">
                    <div className="text-center md:text-left">
                        <p className="text-xs uppercase tracking-wider text-indigo-300 font-semibold">Total Borrowed</p>
                        <p className="text-xl font-bold">{formatCurrency(totalBorrowed)}</p>
                    </div>
                    <div className="text-center md:text-left">
                        <p className="text-xs uppercase tracking-wider text-indigo-300 font-semibold">Current Balance</p>
                        <p className="text-xl font-bold text-green-400">{formatCurrency(totalOutstanding)}</p>
                    </div>
                </div>
            </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-6">
                <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-tight border-b pb-2 mb-4">Contact Information</h3>
                    <div className="space-y-3">
                        <div className="flex items-start">
                            <Phone className="h-5 w-5 text-gray-400 mr-3 shrink-0" />
                            <div>
                                <p className="text-xs text-gray-500">Phone Number</p>
                                <p className="text-sm font-medium text-gray-900">{borrower.phone || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex items-start">
                            <MapPin className="h-5 w-5 text-gray-400 mr-3 shrink-0" />
                            <div>
                                <p className="text-xs text-gray-500">Residential Address</p>
                                <p className="text-sm font-medium text-gray-900">{borrower.address || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex items-start">
                            <Briefcase className="h-5 w-5 text-gray-400 mr-3 shrink-0" />
                            <div>
                                <p className="text-xs text-gray-500">Employment / Business</p>
                                <p className="text-sm font-medium text-gray-900">{borrower.employment || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-tight border-b pb-2 mb-4">Document Hub</h3>
                    {allDocuments.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No documents uploaded yet.</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {allDocuments.map(doc => (
                                <div 
                                    key={doc.id} 
                                    onClick={() => setViewImage(documentUrls[doc.id])}
                                    className="relative aspect-square rounded border overflow-hidden cursor-pointer group hover:border-indigo-500 transition-colors"
                                >
                                    <img src={documentUrls[doc.id]} alt={doc.type} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 flex items-center justify-center transition-all">
                                        <ZoomIn className="text-white opacity-0 group-hover:opacity-100 h-5 w-5" />
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-[8px] text-white p-1 truncate">
                                        {doc.type.replace('_', ' ')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="md:col-span-2">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-tight border-b pb-2 mb-4">Loan History</h3>
                {loans.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed">
                        <Banknote className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No loan records found for this client.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {loans.map(loan => (
                            <Link 
                                key={loan.id} 
                                to={`/loans/${loan.id}`}
                                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors group"
                            >
                                <div className="flex items-center">
                                    <div className={`p-2 rounded-lg mr-4 ${
                                        loan.status === 'active' ? 'bg-blue-50 text-blue-600' :
                                        loan.status === 'completed' ? 'bg-green-50 text-green-600' :
                                        loan.status === 'pending' ? 'bg-yellow-50 text-yellow-600' :
                                        'bg-gray-50 text-gray-600'
                                    }`}>
                                        <Banknote className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">{formatCurrency(loan.principal_amount)}</p>
                                        <p className="text-xs text-gray-500">{new Date(loan.created_at).toLocaleDateString()} • {loan.term_months} Months</p>
                                    </div>
                                </div>
                                <div className="flex items-center">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase mr-4 ${
                                        loan.status === 'active' ? 'bg-blue-100 text-blue-700' :
                                        loan.status === 'completed' ? 'bg-green-100 text-green-700' :
                                        loan.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-gray-100 text-gray-700'
                                    }`}>
                                        {loan.status}
                                    </span>
                                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-600 transition-colors" />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </div>

      {viewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-95 p-4" onClick={() => setViewImage(null)}>
            <button className="absolute top-4 right-4 text-white p-2 bg-gray-800 rounded-full"><X className="h-6 w-6" /></button>
            <img src={viewImage} alt="Full View" className="max-w-full max-h-screen object-contain" />
        </div>
      )}
    </div>
  );
};