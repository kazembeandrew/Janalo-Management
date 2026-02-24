import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/utils/finance';
import { MapPin, User, Phone, Banknote, ExternalLink, Navigation } from 'lucide-react';
import { Link } from 'react-router-dom';

// Fix for default marker icons in Leaflet with React
const markerIcon = new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href;
const markerShadow = new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href;

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface ClientLocation {
    borrower_id: string;
    full_name: string;
    phone: string;
    lat: number;
    lng: number;
    last_visit: string;
    loan_id: string;
    principal: number;
}

export const ClientMap: React.FC = () => {
  const { profile } = useAuth();
  const [locations, setLocations] = useState<ClientLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [center, setCenter] = useState<[number, number]>([-13.2543, 34.3015]); // Default to Malawi center

  useEffect(() => {
    fetchClientLocations();
  }, [profile]);

  const fetchClientLocations = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // Fetch visitations with coordinates, joined with loans and borrowers
      let query = supabase
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
                borrowers (
                    full_name,
                    phone
                )
            )
        `)
        .not('location_lat', 'is', null)
        .order('visit_date', { ascending: false });

      if (profile.role === 'loan_officer') {
          // Filter by officer if needed, though usually maps are for oversight
          // query = query.eq('loans.officer_id', profile.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Group by borrower to show only the latest location
      const latestMap = new Map<string, ClientLocation>();
      
      data?.forEach((v: any) => {
          const borrower = v.loans?.borrowers;
          const bId = v.loans?.borrower_id;
          
          if (borrower && bId && !latestMap.has(bId)) {
              latestMap.set(bId, {
                  borrower_id: bId,
                  full_name: borrower.full_name,
                  phone: borrower.phone,
                  lat: v.location_lat,
                  lng: v.location_long,
                  last_visit: v.visit_date,
                  loan_id: v.loan_id,
                  principal: v.loans.principal_amount
              });
          }
      });

      const locArray = Array.from(latestMap.values());
      setLocations(locArray);

      if (locArray.length > 0) {
          // Center on the first location found
          setCenter([locArray[0].lat, locArray[0].lng]);
      }
    } catch (error) {
      console.error('Error fetching map data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Client Distribution Map</h1>
            <p className="text-sm text-gray-500">Visualizing last known locations from field visitations.</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-100 flex items-center">
            <MapPin className="h-4 w-4 text-indigo-600 mr-2" />
            <span className="text-sm font-bold text-gray-700">{locations.length} Geotagged Clients</span>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
        {locations.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
                <Navigation className="h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No location data available</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-xs text-center">
                    Locations are captured when loan officers record a "Visit" with GPS tagging enabled.
                </p>
            </div>
        ) : (
            <MapContainer center={center} zoom={10} scrollWheelZoom={true}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {locations.map((loc) => (
                    <Marker key={loc.borrower_id} position={[loc.lat, loc.lng]}>
                        <Popup>
                            <div className="p-1 min-w-[200px]">
                                <div className="flex items-center mb-2">
                                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold mr-2">
                                        {loc.full_name.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 leading-tight">{loc.full_name}</h4>
                                        <p className="text-[10px] text-gray-500 flex items-center">
                                            <Phone className="h-2 w-2 mr-1" /> {loc.phone}
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-1 border-t pt-2 mt-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Loan Amount:</span>
                                        <span className="font-bold text-indigo-600">{formatCurrency(loc.principal)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Last Visit:</span>
                                        <span className="font-medium">{new Date(loc.last_visit).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="mt-3 flex gap-2">
                                    <Link 
                                        to={`/borrowers/${loc.borrower_id}`}
                                        className="flex-1 text-center bg-indigo-600 text-white text-[10px] font-bold py-1.5 rounded hover:bg-indigo-700 transition-colors"
                                    >
                                        View Profile
                                    </Link>
                                    <Link 
                                        to={`/loans/${loc.loan_id}`}
                                        className="flex-1 text-center bg-gray-100 text-gray-700 text-[10px] font-bold py-1.5 rounded hover:bg-gray-200 transition-colors"
                                    >
                                        Loan Details
                                    </Link>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        )}
      </div>
    </div>
  );
};