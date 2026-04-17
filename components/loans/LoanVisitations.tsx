import React from 'react';
import { Visitation } from '@/types';
import { 
  MapPin, 
  Camera, 
  Calendar, 
  User, 
  Eye, 
  Download,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

interface LoanVisitationsProps {
  visitations: Visitation[];
  imageUrls: { [key: string]: string };
  onViewImage: (url: string) => void;
}

export const LoanVisitations: React.FC<LoanVisitationsProps> = ({
  visitations,
  imageUrls,
  onViewImage
}) => {
  const getStatusColor = (notes?: string) => {
    if (!notes) return 'bg-yellow-100 text-yellow-800';
    const n = notes.toLowerCase();
    if (n.includes('default') || n.includes('problem')) {
      return 'bg-red-100 text-red-800';
    }
    if (n.includes('good') || n.includes('positive')) {
      return 'bg-green-100 text-green-800';
    }
    return 'bg-yellow-100 text-yellow-800';
  };

  const getStatusIcon = (notes?: string) => {
    if (!notes) return <AlertTriangle className="h-4 w-4" />;
    const n = notes.toLowerCase();
    if (n.includes('default') || n.includes('problem')) {
      return <AlertTriangle className="h-4 w-4" />;
    }
    if (n.includes('good') || n.includes('positive')) {
      return <CheckCircle className="h-4 w-4" />;
    }
    return <AlertTriangle className="h-4 w-4" />;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Field Visitations</h3>
      </div>

      <div className="divide-y divide-gray-200">
        {visitations.map((visitation) => (
          <div key={visitation.id} className="p-6 hover:bg-gray-50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-4 mb-3">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      {new Date(visitation.visit_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Officer</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      {visitation.location_lat && visitation.location_long 
                        ? `${visitation.location_lat.toFixed(6)}, ${visitation.location_long.toFixed(6)}`
                        : 'Location not tagged'
                      }
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-900 leading-relaxed">{visitation.notes}</p>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(visitation.notes)}`}>
                    {getStatusIcon(visitation.notes)}
                    <span className="ml-1">
                      {visitation.notes 
                        ? (visitation.notes.toLowerCase().includes('default') || visitation.notes.toLowerCase().includes('problem') 
                          ? 'Issue Detected' 
                          : visitation.notes.toLowerCase().includes('good') || visitation.notes.toLowerCase().includes('positive')
                          ? 'Positive'
                          : 'Neutral')
                        : 'No Notes'
                      }
                    </span>
                  </span>
                </div>
              </div>

              {visitation.image_path && imageUrls[visitation.id] && (
                <div className="ml-6">
                  <img
                    src={imageUrls[visitation.id]}
                    alt="Visit evidence"
                    className="w-20 h-20 object-cover rounded-lg border border-gray-300 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => onViewImage(imageUrls[visitation.id])}
                  />
                  <div className="flex items-center justify-center mt-2 space-x-1">
                    <Camera className="h-3 w-3 text-gray-500" />
                    <span className="text-xs text-gray-500">Evidence</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {visitations.length === 0 && (
        <div className="px-6 py-12 text-center text-gray-500">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p>No field visitations recorded yet.</p>
        </div>
      )}
    </div>
  );
};