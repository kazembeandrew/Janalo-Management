import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { FolderOpen, FileText, FileSpreadsheet, ChevronRight, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SystemDocument } from '@/types';

export const RecentDocuments: React.FC = () => {
  const [docs, setDocs] = useState<SystemDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentDocs();
  }, []);

  const fetchRecentDocs = async () => {
    const { data } = await supabase
        .from('system_documents')
        .select('*, uploader:users!uploaded_by(full_name)')
        .order('created_at', { ascending: false })
        .limit(5);
    
    if (data) setDocs(data);
    setLoading(false);
  };

  if (loading) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 flex items-center">
              <FolderOpen className="h-4 w-4 mr-2 text-indigo-600" />
              Recent Documents
          </h3>
          <Link to="/documents" className="text-[10px] font-bold text-indigo-600 uppercase hover:underline">View All</Link>
      </div>
      <div className="divide-y divide-gray-50">
          {docs.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs italic">No documents found.</div>
          ) : (
              docs.map((doc) => {
                  const isExcel = doc.name.toLowerCase().endsWith('.xlsx') || doc.name.toLowerCase().endsWith('.csv');
                  return (
                      <div key={doc.id} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                              <div className="flex items-center min-w-0">
                                  <div className={`p-2 rounded-lg mr-3 ${isExcel ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                      {isExcel ? <FileSpreadsheet className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                  </div>
                                  <div className="min-w-0">
                                      <p className="text-sm font-bold text-gray-900 truncate">{doc.name}</p>
                                      <p className="text-[10px] text-gray-500 flex items-center mt-0.5">
                                          <Clock className="h-2.5 w-2.5 mr-1" />
                                          {new Date(doc.created_at).toLocaleDateString()} • {doc.uploader?.full_name}
                                      </p>
                                  </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-gray-300" />
                          </div>
                      </div>
                  );
              })
          )}
      </div>
    </div>
  );
};