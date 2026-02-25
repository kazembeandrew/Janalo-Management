import React from 'react';
import { FileText, FileSpreadsheet, ZoomIn, File } from 'lucide-react';
import { LoanDocument } from '@/types';

interface LoanDocumentsListProps {
  documents: LoanDocument[];
  documentUrls: {[key: string]: string};
  onViewImage: (url: string) => void;
  onViewPdf?: (url: string, name: string) => void;
  onViewExcel?: (url: string, name: string) => void;
}

export const LoanDocumentsList: React.FC<LoanDocumentsListProps> = ({ 
  documents, 
  documentUrls, 
  onViewImage,
  onViewPdf,
  onViewExcel
}) => {
  const getFileType = (url: string): 'image' | 'pdf' | 'excel' | 'other' => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.endsWith('.pdf')) return 'pdf';
    if (lowerUrl.endsWith('.xlsx') || lowerUrl.endsWith('.xls') || lowerUrl.endsWith('.csv')) return 'excel';
    if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg') || lowerUrl.endsWith('.png') || lowerUrl.endsWith('.gif')) return 'image';
    return 'other';
  };

  const handleClick = (doc: LoanDocument) => {
    const url = documentUrls[doc.id];
    const type = getFileType(url);
    const name = `${doc.type}.pdf`;

    if (type === 'image') {
      onViewImage(url);
    } else if (type === 'pdf' && onViewPdf) {
      onViewPdf(url, name);
    } else if (type === 'excel' && onViewExcel) {
      onViewExcel(url, name);
    } else {
      window.open(url, '_blank');
    }
  };

  const getFileIcon = (type: 'image' | 'pdf' | 'excel' | 'other') => {
    switch (type) {
      case 'pdf':
        return <FileText className="h-12 w-12 text-red-500" />;
      case 'excel':
        return <FileSpreadsheet className="h-12 w-12 text-green-500" />;
      case 'other':
        return <File className="h-12 w-12 text-gray-400" />;
      default:
        return null;
    }
  };

  const getFileBgColor = (type: 'image' | 'pdf' | 'excel' | 'other') => {
    switch (type) {
      case 'pdf': return 'bg-red-50';
      case 'excel': return 'bg-green-50';
      case 'other': return 'bg-gray-50';
      default: return 'bg-gray-100';
    }
  };

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
            {documents.map(doc => {
              const url = documentUrls[doc.id];
              const type = getFileType(url);
              const isImage = type === 'image';

              return (
                <div 
                  key={doc.id} 
                  onClick={() => handleClick(doc)} 
                  className={`relative aspect-square rounded-xl border border-gray-100 overflow-hidden cursor-pointer group hover:border-indigo-50 transition-all ${getFileBgColor(type)}`}
                >
                  {isImage ? (
                    <>
                      <img src={url} alt={doc.type} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        <ZoomIn className="text-white h-6 w-6" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4">
                      {getFileIcon(type)}
                      <p className="mt-2 text-xs text-center text-gray-600 font-medium capitalize">
                        {type === 'pdf' ? 'PDF' : type === 'excel' ? 'Excel' : 'File'}
                      </p>
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        <span className="text-white text-xs font-bold bg-black/50 px-2 py-1 rounded">
                          View
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1.5 text-[8px] text-white text-center font-bold uppercase truncate">
                    {doc.type.replace('_', ' ')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};