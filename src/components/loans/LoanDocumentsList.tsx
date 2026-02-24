import React from 'react';
import { FileText, ZoomIn } from 'lucide-react';
import { LoanDocument } from '@/types';

interface LoanDocumentsListProps {
  documents: LoanDocument[];
  documentUrls: {[key: string]: string};
  onViewImage: (url: string) => void;
}

export const LoanDocumentsList: React.FC<LoanDocumentsListProps> = ({ 
  documents, 
  documentUrls, 
  onViewImage 
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-100 bg-gray-50/50">
        <h3 className="font-bold text-gray-900 flex items-center">
          <FileText className="h-4 w-4 mr-2 text-indigo-600" />
          Loan Documents
        </h3>
      </div>
      <div className="p-6">
        {documents.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-4">No documents uploaded.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {documents.map(doc => (
              <div 
                key={doc.id} 
                onClick={() => onViewImage(documentUrls[doc.id])} 
                className="relative aspect-square rounded-xl border border-gray-100 overflow-hidden cursor-pointer group hover:border-indigo-50 transition-all"
              >
                <img src={documentUrls[doc.id]} alt={doc.type} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                  <ZoomIn className="text-white h-6 w-6" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1.5 text-[8px] text-white text-center font-bold uppercase truncate">
                  {doc.type.replace('_', ' ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};