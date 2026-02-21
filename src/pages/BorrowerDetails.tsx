import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '@/lib/supabase';
import { Borrower, Loan, LoanDocument } from '@/types';
import { formatCurrency } from '@/utils/finance';
import { assessLoanRisk } from '@/services/aiService';
import Markdown from 'react-markdown';
import { 
    ArrowLeft, User, Phone, MapPin, Briefcase, Banknote, Clock, ChevronRight, 
    ZoomIn, X, Sparkles, ShieldAlert, RefreshCw, Wallet, ArrowUpRight, ArrowDownLeft,
    Home, Building2, Map as MapIcon, ExternalLink
} from 'lucide-react';

// Fix for default marker icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

// Helper component to center map when triggered from sidebar
const MapRecenter = ({ position }: { position: [number, number] | null }) => {
    const map = useMap();
    useEffect(() => {
        if (position) {
            map.setView(position, 16);
        }
    }, [position, map]);
    return null;
};

export const BorrowerDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [borrower, setBorrower] = useState<Borrower | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [allDocuments, setAllDocuments] = useState<LoanDocument[]>([]);
  const [documentUrls, setDocumentUrls] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(true);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'loans' | 'documents' | 'map'>('loans');
  const [mapFocus, setMapFocus] = useState<[number, number] | null>(null);
  
  // AI Risk State
  const [riskAssessment, setRiskAssessment] = useState<string | null>(null);
  const [isAssessing, setIsAssessing] = useState(false);

  useEffect(() => {
    fetchBorrowerData();
  }, [id]);

  const fetchBorrowerData = async () => {
    if (!id) return;
    try {
      const { data: bData, error: bError } = await supabase.from('borrowers').select('*').eq('id', id).single();
      if (bError) throw bError;
      setBorrower(bData);

      const { data: lData } = await supabase.from('loans').select('*').eq('borrower_id', id).order('created_at', { ascending: false });
      setLoans(lData || []);

      if (lData && lData.length > 0) {
          const loanIds = lData.map(l => l.id);
          const { data: dData } = await supabase.from('loan_documents').select('*').in('loan_id', loanIds).order('created_at', { ascending: false });
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

  const handleAssessRisk = async () => {
      setIsAssessing(true);
      try {
          const risk = await assessLoanRisk({
              borrower,
              loanHistory: loans.map(l => ({ amount: l.principal_amount, status: l.status, term: l.term_months })),
              totalLoans: loans.length,
              activeLoans: loans.filter(l => l.status === 'active').length
          });
          setRiskAssessment(risk);
      } catch (e) {
          console.error(e);
      } finally {
          setIsAssessing(false);
      }
  };

  const parseCoords = (str: string): [number, number] | null => {
      if (!str || !str.includes(',')) return null;
      const parts = str.split(',').map(p => parseFloat(p.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          return [parts[0], parts[1]];
      }
      return null;
  };

  const jumpToMap = (coords: [number, number]) => {
      setMapFocus(coords);
      setActiveTab('map');
      // Scroll to map section if on mobile
      const mapElement = document.getElementById('borrower-tabs');
      if (mapElement) mapElement.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading || !borrower) return <div className="p-8 text-center">Loading profile...</div>;

  const totalBorrowed = loans.reduce((sum, l) => sum + Number(l.principal_amount), 0);
  const totalOutstanding = loans.reduce((sum, l) => sum + (l.principal_outstanding + l.interest_outstanding + (l.penalty_outstanding || 0)), 0);

  const residenceCoords = parseCoords(borrower.address);
  const businessCoords = parseCoords(borrower.employment);
  const hasAnyCoords = !!residenceCoords || !!businessCoords;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/borrowers')} className="flex items-center text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Borrowers
      </button>

      <div className="bg-white shadow-xl rounded-3xl overflow-hidden border border-gray-100">
        <div className="bg-indigo-900 px-8 py-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <User className="h-48 w-48" />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div className="flex items-center">
                    <div className="h-24 w-24 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-4xl font-bold shadow-2xl">
                        {borrower.full_name.charAt(0)}
                    </div>
                    <div className="ml-8">
                        <h1 className="text-4xl font-bold tracking-tight">{borrower.full_name}</h1>
                        <p className="text-indigo-300 flex items-center mt-2 font-medium">
                            <Clock className="h-4 w-4 mr-2" /> Client since {new Date(borrower.created_at).toLocaleDateString()}
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-8 md:gap-12">
                    <div className="text-center md:text-left">
                        <p className="text-[10px] uppercase tracking-widest text-indigo-300 font-bold mb-1">Total Borrowed</p>
                        <p className="text-2xl font-bold">{formatCurrency(totalBorrowed)}</p>
                    </div>
                    <div className="text-center md:text-left">
                        <p className="text-[10px] uppercase tracking-widest text-indigo-300 font-bold mb-1">Current Balance</p>
                        <p className="text-2xl font-bold text-red-400">{formatCurrency(totalOutstanding)}</p>
                    </div>
                </div>
            </div>
        </div>

        <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="space-y-8">
                <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-3 mb-6">Contact & Location</h3>
                    <div className="space-y-5">
                        <div className="flex items-start group">
                            <div className="p-2 bg-gray-50 rounded-lg mr-4 group-hover:bg-indigo-50 transition-colors">
                                <Phone className="h-5 w-5 text-gray-400 group-hover:text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Phone Number</p>
                                <p className="text-sm font-bold text-gray-900">{borrower.phone || 'N/A'}</p>
                            </div>
                        </div>
                        
                        <div className="flex items-start group">
                            <div className="p-2 bg-gray-50 rounded-lg mr-4 group-hover:bg-indigo-50 transition-colors">
                                <Home className="h-5 w-5 text-gray-400 group-hover:text-indigo-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex justify-between items-start">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Residence Address</p>
                                    {residenceCoords && (
                                        <button 
                                            onClick={() => jumpToMap(residenceCoords)}
                                            className="text-[10px] text-indigo-600 font-bold hover:underline flex items-center"
                                        >
                                            <MapPin className="h-2.5 w-2.5 mr-1" /> View on Map
                                        </button>
                                    )}
                                </div>
                                <p className="text-sm font-bold text-gray-900 break-words">{borrower.address || 'N/A'}</p>
                            </div>
                        </div>

                        <div className="flex items-start group">
                            <div className="p-2 bg-gray-50 rounded-lg mr-4 group-hover:bg-indigo-50 transition-colors">
                                <Building2 className="h-5 w-5 text-gray-400 group-hover:text-indigo-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex justify-between items-start">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Business / Work</p>
                                    {businessCoords && (
                                        <button 
                                            onClick={() => jumpToMap(businessCoords)}
                                            className="text-[10px] text-indigo-600 font-bold hover:underline flex items-center"
                                        >
                                            <MapPin className="h-2.5 w-2.5 mr-1" /> View on Map
                                        </button>
                                    )}
                                </div>
                                <p className="text-sm font-bold text-gray-900 break-words">{borrower.employment || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl p-6 border border-indigo-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-indigo-900 flex items-center">
                            <Sparkles className="h-4 w-4 mr-2 text-indigo-600" />
                            AI Risk Assessment
                        </h3>
                        {!riskAssessment && (
                            <button 
                                onClick={handleAssessRisk} 
                                disabled={isAssessing}
                                className="text-[10px] bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-700 disabled:bg-gray-400 transition-all"
                            >
                                {isAssessing ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Run Analysis'}
                            </button>
                        )}
                    </div>
                    {riskAssessment ? (
                        <div className="prose prose-sm text-[11px] text-indigo-800 leading-relaxed">
                            <Markdown>{riskAssessment}</Markdown>
                            <button onClick={() => setRiskAssessment(null)} className="mt-4 text-[10px] font-bold text-indigo-600 hover:underline">Clear Analysis</button>
                        </div>
                    ) : (
                        <p className="text-[11px] text-indigo-600/70 italic leading-relaxed">Generate an automated risk profile based on this client's historical data and location stability.</p>
                    )}
                </div>
            </div>

            <div className="lg:col-span-2" id="borrower-tabs">
                <div className="flex border-b border-gray-100 mb-8">
                    <button onClick={() => setActiveTab('loans')} className={`px-6 py-4 text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'loans' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>Loan History</button>
                    <button onClick={() => setActiveTab('documents')} className={`px-6 py-4 text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'documents' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>Documents</button>
                    <button onClick={() => setActiveTab('map')} className={`px-6 py-4 text-xs font-bold uppercase tracking-widest transition-all flex items-center ${activeTab === 'map' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
                        <MapIcon className="h-3.5 w-3.5 mr-2" />
                        Location Map
                    </button>
                </div>

                {activeTab === 'loans' && (
                    <div className="space-y-4">
                        {loans.length === 0 ? (
                            <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                <Banknote className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                                <p className="text-sm text-gray-500 font-medium">No loan records found for this client.</p>
                            </div>
                        ) : (
                            loans.map(loan => (
                                <Link key={loan.id} to={`/loans/${loan.id}`} className="flex items-center justify-between p-5 bg-white border border-gray-100 rounded-2xl hover:border-indigo-200 hover:shadow-md transition-all group">
                                    <div className="flex items-center">
                                        <div className={`p-3 rounded-xl mr-5 ${loan.status === 'active' ? 'bg-blue-50 text-blue-600' : loan.status === 'completed' ? 'bg-green-50 text-green-600' : loan.status === 'pending' ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-50 text-gray-600'}`}>
                                            <Banknote className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <p className="text-base font-bold text-gray-900">{formatCurrency(loan.principal_amount)}</p>
                                            <p className="text-xs text-gray-500 font-medium">{new Date(loan.created_at).toLocaleDateString()} • {loan.term_months} Months</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase mr-6 border ${
                                            loan.status === 'active' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                                            loan.status === 'completed' ? 'bg-green-50 text-green-700 border-green-100' : 
                                            loan.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 
                                            'bg-gray-50 text-gray-700 border-gray-100'
                                        }`}>{loan.status}</span>
                                        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-indigo-600 transition-colors" />
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'documents' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                        {allDocuments.length === 0 ? (
                            <div className="col-span-full text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                <p className="text-sm text-gray-500 font-medium italic">No documents uploaded yet.</p>
                            </div>
                        ) : (
                            allDocuments.map(doc => (
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

                {activeTab === 'map' && (
                    <div className="h-[450px] rounded-2xl overflow-hidden border border-gray-200 shadow-inner relative">
                        {hasAnyCoords ? (
                            <MapContainer 
                                center={mapFocus || residenceCoords || businessCoords || [-13.2543, 34.3015]} 
                                zoom={14} 
                                className="h-full w-full"
                            >
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                {residenceCoords && (
                                    <Marker position={residenceCoords} icon={DefaultIcon}>
                                        <Popup>
                                            <div className="text-center">
                                                <p className="font-bold text-indigo-600">Residence</p>
                                                <p className="text-xs text-gray-500">{borrower.full_name}</p>
                                            </div>
                                        </Popup>
                                    </Marker>
                                )}
                                {businessCoords && (
                                    <Marker position={businessCoords} icon={DefaultIcon}>
                                        <Popup>
                                            <div className="text-center">
                                                <p className="font-bold text-green-600">Business / Work</p>
                                                <p className="text-xs text-gray-500">{borrower.full_name}</p>
                                            </div>
                                        </Popup>
                                    </Marker>
                                )}
                                <MapRecenter position={mapFocus} />
                            </MapContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center bg-gray-50 text-center p-8">
                                <MapPin className="h-12 w-12 text-gray-300 mb-4" />
                                <h3 className="text-lg font-bold text-gray-900">No Geodata Available</h3>
                                <p className="text-sm text-gray-500 mt-2 max-w-xs">
                                    This client does not have any pinned map locations. Edit their profile to add GPS coordinates for their residence or business.
                                </p>
                            </div>
                        )}
                        
                        {hasAnyCoords && (
                            <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-lg border border-white/20">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Map Legend</p>
                                <div className="space-y-1.5">
                                    {residenceCoords && <div className="flex items-center text-xs font-bold text-gray-700"><div className="w-2 h-2 rounded-full bg-indigo-600 mr-2" /> Residence</div>}
                                    {businessCoords && <div className="flex items-center text-xs font-bold text-gray-700"><div className="w-2 h-2 rounded-full bg-green-600 mr-2" /> Business</div>}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
      </div>

      {viewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4" onClick={() => setViewImage(null)}>
            <button className="absolute top-6 right-6 text-white p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all"><X className="h-6 w-6" /></button>
            <img src={viewImage} alt="Full View" className="max-w-full max-h-screen object-contain rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
};