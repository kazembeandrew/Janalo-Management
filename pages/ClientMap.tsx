import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import { useMapAdmin } from '@/hooks/useMapAdmin';
import { formatCurrency } from '@/utils/finance';
import { exportToCSV, generateTablePDF } from '@/utils/export';
import { 
  MapPin, User, Phone, Banknote, RefreshCw, Search, Filter, 
  AlertTriangle, CheckCircle2, Download, Layers, BarChart3, Globe
} from 'lucide-react';
import { Link } from 'react-router-dom';

// Fix for default marker icons
const markerIcon = new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href;
const markerShadow = new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href;

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

// Custom colored markers using DivIcon
const createColoredIcon = (color: string): L.DivIcon => {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${color}; width: 14px; height: 14px; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });
};

// Map controller for fly-to animations
const MapController = ({ center, zoom }: { center: [number, number], zoom: number }) => {
    const map = useMap();
    React.useEffect(() => {
        map.flyTo(center, zoom, { duration: 1.5 });
    }, [center, zoom, map]);
    return null;
};

export const ClientMap: React.FC = () => {
  const { 
    locations, 
    loading, 
    filters, 
    setFilter, 
    fetchLocations,
    stats,
    territories
  } = useMapAdmin();

  const [mapCenter, setMapCenter] = useState<[number, number]>([-13.2543, 34.3015]);
  const [mapZoom, setMapZoom] = useState(7);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Get unique officers for filter dropdown
  const officers = useMemo(() => {
    const officerMap = new Map<string, string>();
    locations.forEach(loc => {
      if (!officerMap.has(loc.officer_id)) {
        officerMap.set(loc.officer_id, loc.officer_name);
      }
    });
    return Array.from(officerMap.entries()).map(([id, name]) => ({ id, full_name: name }));
  }, [locations]);

  // Filtered locations (already filtered server-side by the hook)
  const filteredLocations = useMemo(() => locations, [locations]);

  // Calculate map bounds based on filtered locations
  React.useEffect(() => {
    if (filteredLocations.length > 0) {
      const lats = filteredLocations.map(loc => loc.lat);
      const lngs = filteredLocations.map(loc => loc.lng);
      const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
      const centerLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;
      setMapCenter([centerLat, centerLng]);
      setMapZoom(10);
    }
  }, [filteredLocations]);

  // Export functions
  const handleExportCSV = () => {
    const data = filteredLocations.map(loc => ({
      'Client Name': loc.full_name,
      'Phone': loc.phone,
      'Latitude': loc.lat,
      'Longitude': loc.lng,
      'Loan Amount': loc.principal,
      'Status': loc.is_par ? 'At Risk (PAR)' : loc.status,
      'Officer': loc.officer_name,
      'Last Visit': new Date(loc.last_visit).toLocaleDateString()
    }));
    exportToCSV(data, 'Client_Locations');
  };

  const handleExportPDF = () => {
    const headers = ['Client Name', 'Phone', 'Loan Amount', 'Status', 'Officer', 'Last Visit'];
    const rows = filteredLocations.map(loc => [
      loc.full_name,
      loc.phone,
      formatCurrency(loc.principal),
      loc.is_par ? 'At Risk (PAR)' : loc.status,
      loc.officer_name,
      new Date(loc.last_visit).toLocaleDateString()
    ]);
    generateTablePDF('Client Location Report', headers, rows, 'Client_Locations_Report');
  };

  if (loading.locations) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="h-7 w-7 text-indigo-600" />
            Map Administration
          </h1>
          <p className="text-sm text-gray-500">Visualizing field operations and portfolio density.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center px-3 py-1 border-r border-gray-100">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
            <span className="text-xs font-medium text-gray-600">Active</span>
          </div>
          <div className="flex items-center px-3 py-1">
            <div className="w-3 h-3 rounded-full bg-red-500 mr-2" />
            <span className="text-xs font-medium text-gray-600">At Risk (PAR)</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Total Clients</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalClients}</p>
            </div>
            <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <User className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Active Loans</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.activeLoans}</p>
            </div>
            <div className="h-12 w-12 bg-emerald-50 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">At Risk (PAR)</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.parCount}</p>
            </div>
            <div className="h-12 w-12 bg-red-50 rounded-xl flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Total Outstanding</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.totalOutstanding)}</p>
            </div>
            <div className="h-12 w-12 bg-purple-50 rounded-xl flex items-center justify-center">
              <Banknote className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
        {/* Sidebar */}
        <div className="w-full lg:w-80 border-r border-gray-100 flex flex-col bg-gray-50/30">
          {/* Filters */}
          <div className="p-4 space-y-3 bg-white border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search clients..." 
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                value={filters.search_term}
                onChange={(e) => setFilter('search_term', e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-gray-400" />
              <select 
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg text-xs py-2 px-2 focus:ring-2 focus:ring-indigo-500"
                value={filters.status}
                onChange={(e) => setFilter('status', e.target.value)}
                aria-label="Filter by status"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="par">At Risk (PAR)</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-gray-400" />
              <select 
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg text-xs py-2 px-2 focus:ring-2 focus:ring-indigo-500"
                value={filters.officer_id}
                onChange={(e) => setFilter('officer_id', e.target.value)}
                aria-label="Filter by loan officer"
              >
                <option value="all">All Officers</option>
                {officers.map(o => (
                  <option key={o.id} value={o.id}>{o.full_name}</option>
                ))}
              </select>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => fetchLocations()}
                className="flex-1 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
              <button
                onClick={handleExportCSV}
                className="flex-1 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </button>
            </div>
          </div>

          {/* Client List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filteredLocations.length === 0 ? (
              <div className="p-8 text-center opacity-50">
                <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-xs font-medium text-gray-400 uppercase">No clients found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filteredLocations.map(loc => (
                  <div 
                    key={loc.borrower_id}
                    className="w-full p-4 text-left hover:bg-white transition-all group"
                  >
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                        {loc.full_name}
                      </h4>
                      <p className="text-[10px] text-gray-500 flex items-center mt-0.5">
                        <User className="h-2.5 w-2.5 mr-1" /> {loc.officer_name}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${
                          loc.is_par 
                            ? 'bg-red-50 text-red-600 border-red-100' 
                            : 'bg-blue-50 text-blue-600 border-blue-100'
                        }`}>
                          {loc.is_par ? 'At Risk' : loc.status}
                        </span>
                        <span className="text-[9px] font-medium text-gray-400">
                          {formatCurrency(loc.principal)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-3 bg-white border-t border-gray-100 text-center">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
              Showing {filteredLocations.length} Locations
            </p>
          </div>
        </div>

        {/* Map Area */}
        <div className="flex-1 relative">
          {filteredLocations.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
              <Layers className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No location data available</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-xs text-center">
                Locations are captured when loan officers record a "Visit" with GPS tagging enabled.
              </p>
            </div>
          ) : (
            <MapContainer 
              center={mapCenter} 
              zoom={mapZoom} 
              scrollWheelZoom={true} 
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {/* Markers */}
              {filteredLocations.map((loc) => (
                <Marker 
                  key={loc.borrower_id} 
                  position={[loc.lat, loc.lng]}
                  icon={createColoredIcon(loc.is_par ? '#EF4444' : '#3B82F6')}
                >
                  <Popup className="custom-popup">
                    <div className="p-2 min-w-[220px]">
                      <div className="flex items-center mb-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold mr-3 shadow-lg ${
                          loc.is_par ? 'bg-red-500' : 'bg-blue-500'
                        }`}>
                          {loc.full_name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-gray-900 leading-tight truncate">
                            {loc.full_name}
                          </h4>
                          <p className="text-[10px] text-gray-500 flex items-center">
                            <Phone className="h-2.5 w-2.5 mr-1" /> {loc.phone}
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-100 mb-3">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-gray-500 font-medium uppercase">Loan Amount</span>
                          <span className="font-semibold text-gray-900">
                            {formatCurrency(loc.principal)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-gray-500 font-medium uppercase">Status</span>
                          <span className={`font-semibold uppercase ${
                            loc.is_par ? 'text-red-600' : 'text-blue-600'
                          }`}>
                            {loc.is_par ? 'Overdue (PAR)' : loc.status}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-gray-500 font-medium uppercase">Last Visit</span>
                          <span className="font-medium text-gray-700">
                            {new Date(loc.last_visit).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Link 
                          to={`/borrowers/${loc.borrower_id}`}
                          className="flex-1 text-center bg-white border border-gray-200 text-gray-700 text-[10px] font-semibold py-2 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Profile
                        </Link>
                        <Link 
                          to={`/loans/${loc.loan_id}`}
                          className="flex-1 text-center bg-indigo-600 text-white text-[10px] font-semibold py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100"
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
