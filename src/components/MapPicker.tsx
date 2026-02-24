import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, X, Check, Locate } from 'lucide-react';

// Fix for default marker icons
const markerIcon = new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href;
const markerShadow = new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href;

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

interface MapPickerProps {
    onSelect: (lat: number, lng: number) => void;
    onClose: () => void;
    initialLocation?: { lat: number, lng: number };
}

const LocationMarker = ({ position, setPosition }: { position: [number, number] | null, setPosition: (pos: [number, number]) => void }) => {
    useMapEvents({
        click(e) {
            setPosition([e.latlng.lat, e.latlng.lng]);
        },
    });

    return position === null ? null : (
        <Marker position={position} icon={DefaultIcon} />
    );
};

const MapCenterer = ({ position }: { position: [number, number] | null }) => {
    const map = useMap();
    useEffect(() => {
        if (position) {
            map.setView(position, map.getZoom());
        }
    }, [position, map]);
    return null;
};

export const MapPicker: React.FC<MapPickerProps> = ({ onSelect, onClose, initialLocation }) => {
    const [position, setPosition] = useState<[number, number] | null>(
        initialLocation ? [initialLocation.lat, initialLocation.lng] : null
    );
    const [isLocating, setIsLocating] = useState(false);

    const handleCaptureCurrent = () => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser");
            return;
        }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setPosition([pos.coords.latitude, pos.coords.longitude]);
                setIsLocating(false);
            },
            (err) => {
                console.error(err);
                alert("Unable to retrieve your location");
                setIsLocating(false);
            }
        );
    };

    const handleConfirm = () => {
        if (position) {
            onSelect(position[0], position[1]);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[80vh] animate-in zoom-in-95 duration-200">
                <div className="bg-indigo-900 px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center">
                        <MapPin className="h-5 w-5 text-indigo-300 mr-2" />
                        <h3 className="font-bold text-white">Pin Client Location</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="h-5 w-5 text-indigo-300" />
                    </button>
                </div>

                <div className="flex-1 relative">
                    <MapContainer 
                        center={position || [-13.2543, 34.3015]} 
                        zoom={position ? 15 : 7} 
                        className="h-full w-full"
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <LocationMarker position={position} setPosition={setPosition} />
                        <MapCenterer position={position} />
                    </MapContainer>

                    <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
                        <button 
                            onClick={handleCaptureCurrent}
                            disabled={isLocating}
                            className="bg-white p-3 rounded-xl shadow-lg text-indigo-600 hover:bg-indigo-50 transition-all active:scale-95 disabled:opacity-50"
                            title="Use Current Location"
                        >
                            {isLocating ? <Navigation className="h-5 w-5 animate-spin" /> : <Locate className="h-5 w-5" />}
                        </button>
                    </div>

                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-xs px-4">
                        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/20 text-center">
                            <p className="text-xs text-gray-500 mb-3 font-medium">
                                {position 
                                    ? `Selected: ${position[0].toFixed(6)}, ${position[1].toFixed(6)}` 
                                    : "Tap on the map to select a location"}
                            </p>
                            <div className="flex gap-2">
                                <button 
                                    onClick={onClose}
                                    className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleConfirm}
                                    disabled={!position}
                                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:bg-gray-300 transition-all shadow-lg shadow-indigo-200"
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};