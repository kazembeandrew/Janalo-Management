import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L, { Icon, DivIcon } from 'leaflet';
import type { MapContainerProps, TileLayerProps, MarkerProps, PopupProps } from 'react-leaflet';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/utils/finance';
import { MapPin, User, Phone, Banknote, ExternalLink, Navigation, Search, Filter, ChevronRight, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

// Custom Marker Component to handle "Fly To" animations
const MapController = ({ center, zoom }: { center: [number, number], zoom: number }) => {
    const map = useMap();
    useEffect(() => {
        map.flyTo(center, zoom, { duration: 1.5 });
    }, [center, zoom, map]);
    return null;
};

// Helper to create colored markers using DivIcon
const createColoredIcon = (color: string): DivIcon => {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${color}; width: 12px; height: 12px; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });
};

interface ClientLocation {
    borrower_id: string;
    full_name: string;
    phone: string;
    lat: number;
    lng: number;
    last_visit: string;
    loan_id: string;
    principal: number;
    status: string;
    officer_name: string;
    officer_id: string;
    is_par: boolean;
}

export const ClientMap: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [locations, setLocations] = useState<ClientLocation[]>([]);
  const [officers, setOfficers] = useState<{id: string, full_name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOfficer, setSelectedOfficer] = useState('all');
  const [mapCenter, setMapCenter] = useState<[number, number]>([-13.2543, 34.3015]);
  const [mapZoom, setMapZoom] = useState(7);

  const isExec = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo');

  useEffect(() => {
    fetchData();
  }, [profile]);

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // 1. Fetch Officers for filter
      if (isExec) {
          const { data: offData } = await supabase.from('users').select('id, full_name').eq('role', 'loan_officer');
          setOfficers(offData || []);
      }

      // 2. Fetch visitations with coordinates, joined with loans and borrowers
      const { data, error } = await supabase
        .from('visitations')
        .select(`
            location_lat,
            location_long,
            visit_date,
            loan_id,
            loans (
                principal_amount,
                borrower_id,
                officer_id,
                status,
                updated_at,
                borrowers (
                    full_name,
                    phone
                ),
                users!officer_id (
                    full_name
                )
            )
        `)
        .not('location_lat', 'is', null)
        .order('visit_date', { ascending: false });

      if (error) throw error;

      // Group by borrower to show only the latest location
      const latestMap = new Map<string, ClientLocation>();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      data?.forEach((v: any) => {
          const loan = v.loans;
          const borrower = loan?.borrowers;
          const bId = loan?.borrower_id;
          
          if (borrower && bId && !latestMap.has(bId)) {
              const lastUpdate = new Date(loan.updated_at);
              const isPar = loan.status === 'active' && lastUpdate < thirtyDaysAgo;

              latestMap.set(bId, {
                  borrower_id: bId,
                  full_name: borrower.full_name,
                  phone: borrower.phone,
                  lat: v.location_lat,
                  lng: v.location_long,
                  last_visit: v.visit_date,
                  loan_id: v.loan_id,
                  principal: loan.principal_amount,
                  status: loan.status,
                  officer_name: loan.users?.full_name || 'Unknown',
                  officer_id: loan.officer_id,
                  is_par: isPar
              });
          }
      });

      const locArray = Array.from(latestMap.values());
      setLocations(locArray);

      if (locArray.length > 0) {
          setMapCenter([locArray[0].lat, locArray[0].lng]);
          setMapZoom(10);
      }
    } catch (error) {
      console.error('Error fetching map data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLocations = useMemo(() => {
      return locations.filter(loc => {
          const matchesSearch = loc.full_name.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesOfficer = selectedOfficer === 'all' || loc.officer_id === selectedOfficer;
          return matchesSearch && matchesOfficer;
      });
  }, [locations, searchTerm, selectedOfficer]);

  const handleFocusClient = (loc: ClientLocation) => {
      setMapCenter([loc.lat, loc.lng]);
      setMapZoom(16);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin h-8 w-8 text-indigo-600" /></div>;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Client Distribution Map</h1>
            <p className="text-sm text-gray-500">Visualizing field operations and portfolio density.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center px-3 py-1 border-r border-gray-100">
                <div className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                <span className="text-[10px] font-bold text-gray-500 uppercase">Active</span>
            </div>
            <div className="flex items-center px-3 py-1">
                <div className="w-2 h-2 rounded-full bg-red-500 mr-2" />
                <span className="text-[10px] font-bold text-gray-500 uppercase">At Risk (PAR)</span>
            </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
        {/* Sidebar */}
        <div className="w-full lg:w-80 border-r border-gray-100 flex flex-col bg-gray-50/30">
            <div className="p-4 space-y-4 bg-white border-b border-gray-100">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Search clients..." 
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {isExec && (
                    <div className="flex items-center gap-2">
                        <Filter className="h-3.5 w-3.5 text-gray-400" />
                        <select 
                            className="flex-1 bg-gray-50 border-none rounded-lg text-xs py-1.5 focus:ring-2 focus:ring-indigo-500"
                            value={selectedOfficer}
                            onChange={(e) => setSelectedOfficer(e.target.value)}
                            aria-label="Filter by loan officer"
                        >
                            <option value="all">All Officers</option>
                            {officers.map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
                        </select>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filteredLocations.length === 0 ? (
                    <div className="p-8 text-center opacity-50">
                        <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-xs font-bold text-gray-400 uppercase">No clients found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {filteredLocations.map(loc => (
                            <button 
                                key={loc.borrower_id}
                                onClick={() => handleFocusClient(loc)}
                                className="w-full p-4 text-left hover:bg-white transition-all group flex items-center justify-between"
                            >
                                <div className="min-w-0">
                                    <h4 className="text-sm font-bold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">{loc.full_name}</h4>
                                    <p className="text-[10px] text-gray-500 flex items-center mt-0.5">
                                        <User className="h-2.5 w-2.5 mr-1" /> {loc.officer_name}
                                    </p>
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${loc.is_par ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                            {loc.is_par ? 'At Risk' : loc.status}
                                        </span>
                                        <span className="text-[9px] font-bold text-gray-400">{formatCurrency(loc.principal)}</span>
                                    </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-400 transition-all" />
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="p-3 bg-white border-t border-gray-100 text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Showing {filteredLocations.length} Locations</p>
            </div>
        </div>

        {/* Map Area */}
        <div className="flex-1 relative">
            {locations.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
                    <Navigation className="h-12 w-12 text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">No location data available</h3>
                    <p className="text-sm text-gray-500 mt-1 max-w-xs text-center">
                        Locations are captured when loan officers record a "Visit" with GPS tagging enabled.
                    </p>
                </div>
            ) : (
                <MapContainer center={mapCenter} zoom={mapZoom} scrollWheelZoom={true} className="h-full w-full">
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {filteredLocations.map((loc) => (
                        <Marker 
                            key={loc.borrower_id} 
                            position={[loc.lat, loc.lng]}
                            icon={createColoredIcon(loc.is_par ? '#EF4444' : '#3B82F6')}
                        >
                            <Popup className="custom-popup">
                                <div className="p-1 min-w-[220px]">
                                    <div className="flex items-center mb-3">
                                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold mr-3 shadow-lg ${loc.is_par ? 'bg-red-500' : 'bg-blue-500'}`}>
                                            {loc.full_name.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-gray-900 leading-tight truncate">{loc.full_name}</h4>
                                            <p className="text-[10px] text-gray-500 flex items-center">
                                                <Phone className="h-2.5 w-2.5 mr-1" /> {loc.phone}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-100 mb-3">
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-gray-500 font-bold uppercase">Loan Amount</span>
                                            <span className="font-bold text-gray-900">{formatCurrency(loc.principal)}</span>
                                        </div>
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-gray-500 font-bold uppercase">Status</span>
                                            <span className={`font-bold uppercase ${loc.is_par ? 'text-red-600' : 'text-blue-600'}`}>
                                                {loc.is_par ? 'Overdue (PAR)' : loc.status}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-gray-500 font-bold uppercase">Last Visit</span>
                                            <span className="font-medium text-gray-700">{new Date(loc.last_visit).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Link 
                                            to={`/borrowers/${loc.borrower_id}`}
                                            className="flex-1 text-center bg-white border border-gray-200 text-gray-700 text-[10px] font-bold py-2 rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                            Profile
                                        </Link>
                                        <Link 
                                            to={`/loans/${loc.loan_id}`}
                                            className="flex-1 text-center bg-indigo-600 text-white text-[10px] font-bold py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100"
                                        >
                                            Loan Details
                                        </Link>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                    <MapController center={mapCenter} zoom={mapZoom} />
                </MapContainer>
            )}
        </div>
      </div>
    </div>
  );
};