import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { 
    FolderOpen, FileText, FileSpreadsheet, Download, 
    Eye, Trash2, Search, Filter, RefreshCw, 
    Upload, X, Clock, User, ChevronRight, File
} from 'lucide-react';
import { ExcelViewer } from '@/components/ExcelViewer';
import toast from 'react-hot-toast';

interface SystemFile {
    name: string;
    id: string;
    updated_at: string;
    created_at: string;
    metadata: {
        size: number;
        mimetype: string;
    };
}

export const DocumentCenter: React.FC = () => {
  const { profile } = useAuth();
  const [files, setFiles] = useState<SystemFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'excel' | 'pdf'>('all');
  
  // Viewer State
  const [viewingExcel, setViewingExcel] = useState<{url: string, name: string} | null>(null);
  const [viewingPdf, setViewingPdf] = useState<{url: string, name: string} | null>(null);
  
  // Upload State
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    setLoading(true);
    try {
        const { data, error } = await supabase.storage
            .from('loan-documents')
            .list('system', {
                limit: 100,
                offset: 0,
                sortBy: { column: 'created_at', order: 'desc' }
            });
        
        if (error) throw error;
        setFiles(data as any || []);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      try {
          const path = `system/${Date.now()}_${file.name}`;
          const { error } = await supabase.storage
            .from('loan-documents')
            .upload(path, file);
          
          if (error) throw error;
          toast.success("File uploaded to Document Center");
          fetchFiles();
      } catch (e: any) {
          toast.error("Upload failed: " + e.message);
      } finally {
          setIsUploading(false);
      }
  };

  const handleDelete = async (fileName: string) => {
      if (!window.confirm("Are you sure you want to delete this file?")) return;
      
      try {
          const { error } = await supabase.storage
            .from('loan-documents')
            .remove([`system/${fileName}`]);
          
          if (error) throw error;
          toast.success("File removed");
          fetchFiles();
      } catch (e: any) {
          toast.error("Delete failed");
      }
  };

  const handleView = async (file: SystemFile) => {
      const { data } = supabase.storage
        .from('loan-documents')
        .getPublicUrl(`system/${file.name}`);
      
      if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls') || file.name.toLowerCase().endsWith('.csv')) {
          setViewingExcel({ url: data.publicUrl, name: file.name });
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
          setViewingPdf({ url: data.publicUrl, name: file.name });
      } else {
          window.open(data.publicUrl, '_blank');
      }
  };

  const filteredFiles = files.filter(f => {
      const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase());
      const isExcel = f.name.toLowerCase().endsWith('.xlsx') || f.name.toLowerCase().endsWith('.xls') || f.name.toLowerCase().endsWith('.csv');
      const isPdf = f.name.toLowerCase().endsWith('.pdf');
      
      if (activeTab === 'excel') return matchesSearch && isExcel;
      if (activeTab === 'pdf') return matchesSearch && isPdf;
      return matchesSearch;
  });

  const formatSize = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <FolderOpen className="h-6 w-6 mr-2 text-indigo-600" />
                Document Center
            </h1>
            <p className="text-sm text-gray-500">Centralized storage for imports, reports, and system templates.</p>
        </div>
        <div className="flex gap-2">
            <label className="cursor-pointer inline-flex items-center px-4 py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95">
                {isUploading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Upload File
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Filters */}
          <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                  <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Search Files</label>
                      <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input 
                            type="text" 
                            placeholder="Filename..." 
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                      </div>
                  </div>

                  <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">File Type</label>
                      <div className="space-y-1">
                          <button 
                            onClick={() => setActiveTab('all')}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
                          >
                              <div className="flex items-center"><File className="h-4 w-4 mr-2" /> All Files</div>
                              <span className="text-[10px] font-bold opacity-50">{files.length}</span>
                          </button>
                          <button 
                            onClick={() => setActiveTab('excel')}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'excel' ? 'bg-green-50 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}
                          >
                              <div className="flex items-center"><FileSpreadsheet className="h-4 w-4 mr-2" /> Spreadsheets</div>
                              <span className="text-[10px] font-bold opacity-50">{files.filter(f => f.name.endsWith('.xlsx') || f.name.endsWith('.csv')).length}</span>
                          </button>
                          <button 
                            onClick={() => setActiveTab('pdf')}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'pdf' ? 'bg-red-50 text-red-700' : 'text-gray-500 hover:bg-gray-50'}`}
                          >
                              <div className="flex items-center"><FileText className="h-4 w-4 mr-2" /> PDF Documents</div>
                              <span className="text-[10px] font-bold opacity-50">{files.filter(f => f.name.endsWith('.pdf')).length}</span>
                          </button>
                      </div>
                  </div>
              </div>

              <div className="bg-indigo-900 p-6 rounded-2xl text-white shadow-xl">
                  <h3 className="font-bold mb-2 flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-indigo-300" />
                      Auto-Archive
                  </h3>
                  <p className="text-xs text-indigo-200 leading-relaxed">
                      Every file uploaded via the <strong>Data Importer</strong> is automatically saved here for audit and historical reference.
                  </p>
              </div>
          </div>

          {/* File List */}
          <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                              <tr>
                                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">File Name</th>
                                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Size</th>
                                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Modified</th>
                                  <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                              </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100">
                              {loading ? (
                                  <tr><td colSpan={4} className="px-6 py-12 text-center"><RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600" /></td></tr>
                              ) : filteredFiles.length === 0 ? (
                                  <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500 italic">No files found in this folder.</td></tr>
                              ) : (
                                  filteredFiles.map(file => {
                                      const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.csv');
                                      const isPdf = file.name.toLowerCase().endsWith('.pdf');

                                      return (
                                          <tr key={file.id} className="hover:bg-gray-50 transition-colors group">
                                              <td className="px-6 py-4 whitespace-nowrap">
                                                  <div className="flex items-center">
                                                      <div className={`p-2 rounded-lg mr-3 ${isExcel ? 'bg-green-50 text-green-600' : isPdf ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'}`}>
                                                          {isExcel ? <FileSpreadsheet className="h-5 w-5" /> : isPdf ? <FileText className="h-5 w-5" /> : <File className="h-5 w-5" />}
                                                      </div>
                                                      <div className="min-w-0">
                                                          <p className="text-sm font-bold text-gray-900 truncate max-w-xs">{file.name.split('_').slice(1).join('_') || file.name}</p>
                                                          <p className="text-[10px] text-gray-400 font-medium uppercase">{file.metadata.mimetype}</p>
                                                      </div>
                                                  </div>
                                              </td>
                                              <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-medium">
                                                  {formatSize(file.metadata.size)}
                                              </td>
                                              <td className="px-6 py-4 whitespace-nowrap">
                                                  <p className="text-xs text-gray-900 font-medium">{new Date(file.created_at).toLocaleDateString()}</p>
                                                  <p className="text-[10px] text-gray-400">{new Date(file.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                              </td>
                                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                                  <div className="flex justify-end gap-2">
                                                      <button 
                                                        onClick={() => handleView(file)}
                                                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                        title="View File"
                                                      >
                                                          <Eye className="h-4 w-4" />
                                                      </button>
                                                      <button 
                                                        onClick={() => handleDelete(file.name)}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        title="Delete"
                                                      >
                                                          <Trash2 className="h-4 w-4" />
                                                      </button>
                                                  </div>
                                              </td>
                                          </tr>
                                      );
                                  })
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      </div>

      {/* Excel Viewer Modal */}
      {viewingExcel && (
          <ExcelViewer 
            url={viewingExcel.url} 
            fileName={viewingExcel.name} 
            onClose={() => setViewingExcel(null)} 
          />
      )}

      {/* PDF Viewer Modal */}
      {viewingPdf && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                  <div className="bg-indigo-900 px-6 py-4 flex justify-between items-center">
                      <div className="flex items-center">
                          <FileText className="h-5 w-5 text-indigo-300 mr-3" />
                          <h3 className="font-bold text-white text-sm">{viewingPdf.name}</h3>
                      </div>
                      <button onClick={() => setViewingPdf(null)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                          <X className="h-5 w-5 text-indigo-300" />
                      </button>
                  </div>
                  <iframe src={viewingPdf.url} className="flex-1 w-full border-none" title="PDF Viewer" />
              </div>
          </div>
      )}
    </div>
  );
};