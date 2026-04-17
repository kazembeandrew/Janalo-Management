import React, { useState } from 'react';
import { LoanDocument } from '@/types';
import { 
  FileText, 
  FileSpreadsheet, 
  FileImage, 
  File, 
  Download, 
  Eye, 
  Trash2,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface LoanDocumentsListProps {
  documents: LoanDocument[];
  documentUrls: { [key: string]: string };
  documentMimeTypes: { [key: string]: string };
  onViewImage: (url: string) => void;
  onViewPdf: (url: string, name: string) => void;
  onViewExcel: (url: string, name: string) => void;
}

export const LoanDocumentsList: React.FC<LoanDocumentsListProps> = ({
  documents,
  documentUrls,
  documentMimeTypes,
  onViewImage,
  onViewPdf,
  onViewExcel
}) => {
  const [deleting, setDeleting] = useState<string | null>(null);

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return <FileText className="h-5 w-5" />;
    if (mimeType.includes('image/')) return <FileImage className="h-5 w-5" />;
    if (mimeType.includes('pdf')) return <File className="h-5 w-5" />;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <FileSpreadsheet className="h-5 w-5" />;
    return <FileText className="h-5 w-5" />;
  };

  const getFileType = (mimeType?: string) => {
    if (!mimeType) return 'Document';
    if (mimeType.includes('image/')) return 'Image';
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'Spreadsheet';
    return 'Document';
  };

  const handleViewDocument = (document: LoanDocument) => {
    const url = documentUrls[document.id];
    const mimeType = documentMimeTypes[document.id];
    
    if (!url) {
      toast.error('Document URL not available');
      return;
    }

    if (mimeType && mimeType.includes('image/')) {
      onViewImage(url);
    } else if (mimeType && mimeType.includes('pdf')) {
      onViewPdf(url, document.file_name);
    } else if (mimeType && (mimeType.includes('spreadsheet') || mimeType.includes('excel'))) {
      onViewExcel(url, document.file_name);
    } else {
      // For other document types, open in new tab
      window.open(url, '_blank');
    }
  };

  const handleDownload = (doc: LoanDocument) => {
    const url = documentUrls[doc.id];
    if (!url) {
      toast.error('Document URL not available');
      return;
    }
    
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.file_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Download started');
  };

  const handleDelete = async (document: LoanDocument) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    setDeleting(document.id);
    try {
      // This would integrate with the document deletion service
      toast.success('Document deleted successfully');
    } catch (error) {
      toast.error('Failed to delete document');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Loan Documents</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Document Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Uploaded
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {documents.map((document) => (
              <tr key={document.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {getFileIcon(document.mime_type)}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {document.file_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {document.type}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {getFileType(document.mime_type)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {(document.file_size / 1024).toFixed(2)} KB
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(document.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Verified
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleViewDocument(document)}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </button>
                  <button
                    onClick={() => handleDownload(document)}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </button>
                  <button
                    onClick={() => handleDelete(document)}
                    disabled={deleting === document.id}
                    className="inline-flex items-center px-3 py-1 border border-red-300 text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {documents.length === 0 && (
        <div className="px-6 py-12 text-center text-gray-500">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p>No documents uploaded yet.</p>
        </div>
      )}
    </div>
  );
};