import React from 'react';
import { FileText } from 'lucide-react';
import type { LoanDocument } from '@/types';
import { DocumentUpload } from '@/components/DocumentUpload';
import { LoanDocumentsList } from '@/components/loans/LoanDocumentsList';

export interface LoanDocumentsFeatureProps {
  loanStatus: string;
  documents: LoanDocument[];
  allDocuments: LoanDocument[];
  documentUrls: Record<string, string>;
  documentMimeTypes: Record<string, string>;
  appFormBlob: Blob | null;
  processingAction: boolean;
  onAppFormUpload: () => void;
  onAppFormSelect: (blob: Blob | null) => void;
  onViewImage: (url: string) => void;
  onViewPdf: (url: string, name: string) => void;
  onViewExcel: (url: string, name: string) => void;
}

export const LoanDocumentsFeature: React.FC<LoanDocumentsFeatureProps> = ({
  loanStatus,
  documents,
  allDocuments,
  documentUrls,
  documentMimeTypes,
  appFormBlob,
  processingAction,
  onAppFormUpload,
  onAppFormSelect,
  onViewImage,
  onViewPdf,
  onViewExcel,
}) => {
  const requiresAgreementUpload = loanStatus === 'active' && !documents.some((document) => document.type === 'application_form');

  return (
    <div className="space-y-6">
      {requiresAgreementUpload && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900 flex items-center">
              <FileText className="h-4 w-4 mr-2 text-indigo-600" />
              Loan Agreement
            </h3>
            <span className="text-[10px] font-bold text-amber-600 uppercase bg-amber-50 px-2 py-1 rounded border border-amber-100">
              Upload Required
            </span>
          </div>

          <div className="space-y-4">
            <DocumentUpload
              label="Upload Loan Agreement"
              onUpload={onAppFormSelect}
              onRemove={() => onAppFormSelect(null)}
            />

            {appFormBlob && (
              <div className="flex justify-end">
                <button
                  onClick={onAppFormUpload}
                  disabled={processingAction}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-400 transition-all"
                >
                  {processingAction ? 'Uploading...' : 'Upload Agreement'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <LoanDocumentsList
        documents={allDocuments}
        documentUrls={documentUrls}
        documentMimeTypes={documentMimeTypes}
        onViewImage={onViewImage}
        onViewPdf={onViewPdf}
        onViewExcel={onViewExcel}
      />
    </div>
  );
};