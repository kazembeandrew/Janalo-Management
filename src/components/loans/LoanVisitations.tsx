import React from 'react';
import { MapPin, Camera, Clock, User } from 'lucide-react';
import { Visitation } from '@/types';

interface LoanVisitationsProps {
  visitations: Visitation[];
  imageUrls: {[key: string]: string};
  onViewImage: (url: string) => void;
}

export const LoanVisitations: React.FC<LoanVisitationsProps> = ({ 
  visitations, 
  imageUrls, 
  onViewImage 
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-100 bg-gray-50/50">
        <h3 className="font-bold text-gray-900 flex items-center">
          <MapPin className="h-4 w-4 mr-2 text-indigo-600" />
          Field Visit History
        </h3>
      </div>
      <div className="divide-y divide-gray-100">
        {visitations.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-xs italic">No field visits recorded for this loan.</div>
        ) : (
          visitations.map(v => (
            <div key={v.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center">
                  <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs mr-3">
                    {v.users?.full_name?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{v.users?.full_name}</p>
                    <p className="text-[10px] text-gray-400 flex items-center">
                      <Clock className="h-2.5 w-2.5 mr-1" />
                      {new Date(v.visit_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {v.location_lat && (
                    <div className="flex items-center text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                        <MapPin className="h-3 w-3 mr-1" />
                        GPS Tagged
                    </div>
                )}
              </div>
              
              <p className="text-xs text-gray-600 leading-relaxed mb-4">{v.notes}</p>
              
              {v.image_path && imageUrls[v.id] && (
                  <button 
                    onClick={() => onViewImage(imageUrls[v.id])}
                    className="relative h-20 w-32 rounded-xl border border-gray-200 overflow-hidden group"
                  >
                      <img src={imageUrls[v.id]} alt="Visit" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                          <Camera className="text-white h-4 w-4" />
                      </div>
                  </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};