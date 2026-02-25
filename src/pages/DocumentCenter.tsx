import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { SystemDocument, DocumentCategory, UserRole } from '@/types';
import { 
    FolderOpen, FileText, FileSpreadsheet, Download, 
    Eye, Trash2, Search, Filter, RefreshCw, 
    Upload, X, Clock, User, ChevronRight, File,
    ShieldCheck, Check, Lock, Globe, Shield, UserCircle
} from 'lucide-react';
import { ExcelViewer } from '@/components/ExcelViewer';
import toast from 'react-hot-toast';

export const DocumentCenter: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [files, setFiles] = useState<SystemDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<DocumentCategory | 'all' | 'mine'>('all');
  
  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SystemDocument | null>(null);
  const [viewingExcel, setViewingExcel] = useState<{url: string, name: string} | null>(null);
  const [viewingPdf, setViewingPdf] = useState<{url: string, name: string} | null>(null);
  const [viewingImage, setViewingImage] = useState<{url: string, name: string} | null>(null);
  
  // Role Checks
  const isCEO = effectiveRoles.includes('ceo') || effectiveRoles.includes('admin');
  const isHR = effectiveRoles.includes('hr');
  const isAccountant = effectiveRoles.includes('accountant');
  const isOfficer = effectiveRoles.includes('loan_officer');
  
  const isStrictAccountant = isAccountant && !isCEO && !isHR;
  const isStrictOfficer = isOfficer && !isCEO && !isHR && !isAccountant;
  
  const canUpload = isCEO || isHR || isAccountant || isOfficer;
  const canManagePermissions = isCEO || isHR;

  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
      name: '',
      category: (isStrictAccountant ? 'financial' : isStrictOfficer ? 'loan_application' : 'general') as DocumentCategory,
      file: null as File | null
  });

  // Permissions State
  const [filePermissions, setFilePermissions] = useState<UserRole[]>([]);

  useEffect(() => {
    fetchFiles();
  }, [activeCategory]);

  useEffect(() => {
      if (showUploadModal) {
          setUploadForm(prev => ({
              ...prev,
              category: isStrictAccountant ? 'financial' : isStrictOfficer ? 'loan_application' : 'general'
          }));
      }
  }, [showUploadModal, isStrictAccountant, isStrictOfficer]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
        let query = supabase
            .from('system_documents')
            .select('*, uploader:users!uploaded_by(full_name)')
            .order('created_at', { ascending: false });
        
        if (activeCategory === 'mine') {
            query = query.eq('uploaded_by', profile?.id);
        } else if (activeCategory !== 'all') {
            query = query.eq('category', activeCategory);
        }

        const { data, error } = await query;
        if (error) throw error;
        setFiles(data || []);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!uploadForm.file || !profile) return;

      setIsUploading(true);
      try {
          const file = uploadForm.file;
          const path = `system/${Date.now()}_${file.name}`;
          
          const { error: storageError } = await supabase.storage
            .from('loan-documents')
            .upload(path, file);
          
          if (storageError) throw storageError;

          const { error: dbError } = await supabase
            .from('system_documents')
            .insert({
                name: uploadForm.name || file.name,
                storage_path: path,
                category: uploadForm.category,
                file_type: file.type,
                file_size: file.size,
                uploaded_by: profile.id
            });
          
          if (dbError) throw dbError;

          toast.success("Document uploaded successfully");
          setShowUploadModal(false);
          setUploadForm({ name: '', category: isStrictAccountant ? 'financial' : isStrictOfficer ? 'loan_application' : 'general', file: null });
          fetchFiles();
      } catch (e: any) {
          toast.error("Upload failed: " + e.message);
      } finally {
          setIsUploading(false);
      }
  };

  const handleDelete = async (file: SystemDocument) => {
      if (!window.confirm("Are you sure you want to delete this document?")) return;
      
      try {
          await supabase.storage.from('loan-documents').remove([file.storage_path]);
          await supabase.from('system_documents').delete().eq('id', file.id);
          toast.success("Document removed");
          fetchFiles();
      } catch (e: any) {
          toast.error("Delete failed");
      }
  };

  const handleView = async (file: SystemDocument) => {
      try {
          // Try signed URL first (more reliable)
          const { data: signedData } = await supabase.storage
            .from('loan-documents')
            .createSignedUrl(file.storage_path, 3600); // 1 hour expiry
          
          const url = signedData?.signedUrl;
          if (!url) {
              // Fallback to public URL
              const { data } = supabase.storage
                .from('loan-documents')
                .getPublicUrl(file.storage_path);
              
              const fileType = file.file_type?.toLowerCase() || file.name.toLowerCase();
              if (fileType.includes('excel') || fileType.includes('spreadsheet') || 
                  file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls') || 
                  file.name.toLowerCase().endsWith('.csv')) {
                  setViewingExcel({ url: data.publicUrl, name: file.name });
              } else if (fileType.includes('pdf') || file.name.toLowerCase().endsWith('.pdf')) {
                  setViewingPdf({ url: data.publicUrl, name: file.name });
              } else if (fileType.includes('image') || 
                  file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg') || 
                  file.name.toLowerCase().endsWith('.png') || file.name.toLowerCase().endsWith('.gif')) {
                  setViewingImage({ url: data.publicUrl, name: file.name });
              } else {
                  // For unknown types, try to determine by extension
                  const name = file.name.toLowerCase();
                  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
                      setViewingExcel({ url: data.publicUrl, name: file.name });
                  } else if (name.endsWith('.pdf')) {
                      setViewingPdf({ url: data.publicUrl, name: file.name });
                  } else if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.gif')) {
                      setViewingImage({ url: data.publicUrl, name: file.name });
                  } else {
                      // Fallback: open in new tab for unknown types
                      window.open(data.publicUrl, '_blank');
                  }
              }
              return;
          }
          
          // Use signed URL with better type detection
          const fileType = file.file_type?.toLowerCase() || file.name.toLowerCase();
          if (fileType.includes('excel') || fileType.includes('spreadsheet') || 
              file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls') || 
              file.name.toLowerCase().endsWith('.csv')) {
              setViewingExcel({ url, name: file.name });
          } else if (fileType.includes('pdf') || file.name.toLowerCase().endsWith('.pdf')) {
              setViewingPdf({ url, name: file.name });
          } else if (fileType.includes('image') || 
              file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg') || 
              file.name.toLowerCase().endsWith('.png') || file.name.toLowerCase().endsWith('.gif')) {
              setViewingImage({ url, name: file.name });
          } else {
              // Fallback: open in new tab for unknown types
              window.open(url, '_blank');
          }
      } catch (error) {
          console.error('Error generating URL:', error);
          toast.error('Failed to load document. Please try again.');
      }
  };

  const openPermissions = async (file: SystemDocument) => {
      setSelectedFile(file);
      const { data } = await supabase
        .from('document_permissions')
        .select('role')
        .eq('document_id', file.id);
      
      setFilePermissions(data?.map(p => p.role as UserRole) || []);
      setShowPermissionsModal(true);
  };

  const togglePermission = async (role: UserRole) => {
      if (!selectedFile) return;

      const hasPermission = filePermissions.includes(role);
      if (hasPermission) {
          await supabase
            .from('document_permissions')
            .delete()
            .eq('document_id', selectedFile.id)
            .eq('role', role);
          setFilePermissions(prev => prev.filter(r => r !== role));
      } else {
          await supabase
            .from('document_permissions')
            .insert({ document_id: selectedFile.id, role });
          setFilePermissions(prev => [...prev, role]);
      }
      toast.success(`Permissions updated for ${role.replace('_', ' ')}`);
  };

  const filteredFiles = files.filter(f => 
      f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <p className="text-sm text-gray-500">Secure institutional storage with role-based access control.</p>
        </div>
        {canUpload && (
            <button 
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center px-4 py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95"
            >
                <Upload className="h-4 w-4 mr-2" /> Upload Document
            </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                  <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Search Repository</label>
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
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Categories</label>
                      <div className="space-y-1">
                          <button 
                            onClick={() => setActiveCategory('all')}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all ${activeCategory === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
                          >
                              All Documents
                          </button>
                          <button 
                            onClick={() => setActiveCategory('mine')}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all ${activeCategory === 'mine' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
                          >
                              <div className="flex items-center"><UserCircle className="h-4 w-4 mr-2" /> My Uploads</div>
                          </button>
                          {(['loan_application', 'financial', 'hr', 'operational', 'general', 'template'] as const).map(cat => (
                              <button 
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all capitalize ${activeCategory === cat ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
                              >
                                  {cat.replace('_', ' ')}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>

              <div className="bg-indigo-900 p-6 rounded-2xl text-white shadow-xl">
                  <h3 className="font-bold mb-2 flex items-center">
                      <ShieldCheck className="h-4 w-4 mr-2 text-indigo-300" />
                      Access Control
                  </h3>
                  <p className="text-xs text-indigo-200 leading-relaxed">
                      Documents are restricted by default. HR and CEO can grant access to specific roles using the <strong>Permissions</strong> tool.
                  </p>
              </div>
          </div>

          <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                              <tr>
                                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">File Name</th>
                                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Category</th>
                                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Uploaded By</th>
                                  <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                              </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100">
                              {loading ? (
                                  <tr><td colSpan={4} className="px-6 py-12 text-center"><RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600" /></td></tr>
                              ) : filteredFiles.length === 0 ? (
                                  <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500 italic">No accessible documents found.</td></tr>
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
                                                          <button 
                                                            onClick={() => handleView(file)}
                                                            className="text-sm font-bold text-gray-900 truncate max-w-xs text-left hover:text-indigo-600 transition-colors"
                                                            title={`View ${file.name}`}
                                                          >
                                                            {file.name}
                                                          </button>
                                                          <p className="text-[10px] text-gray-400 font-medium uppercase">{formatSize(file.file_size)}</p>
                                                      </div>
                                                  </div>
                                              </td>
                                              <td className="px-6 py-4 whitespace-nowrap">
                                                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gray-100 text-gray-700 uppercase border border-gray-200">
                                                      {file.category.replace('_', ' ')}
                                                  </span>
                                              </td>
                                              <td className="px-6 py-4 whitespace-nowrap">
                                                  <p className="text-xs text-gray-900 font-medium">{file.uploader?.full_name || 'System'}</p>
                                                  <p className="text-[10px] text-gray-400">{new Date(file.created_at).toLocaleDateString()}</p>
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
                                                      {canManagePermissions && (
                                                          <button 
                                                            onClick={() => openPermissions(file)}
                                                            className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                                            title="Manage Permissions"
                                                          >
                                                              <ShieldCheck className="h-4 w-4" />
                                                          </button>
                                                      )}
                                                      {(isCEO || file.uploaded_by === profile?.id) && (
                                                          <button 
                                                            onClick={() => handleDelete(file)}
                                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                            title="Delete"
                                                          >
                                                              <Trash2 className="h-4 w-4" />
                                                          </button>
                                                      )}
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

      {/* Upload Modal */}
      {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-indigo-900 px-6 py-5 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center text-lg"><Upload className="mr-3 h-6 w-6 text-indigo-300" /> Upload Document</h3>
                      <button onClick={() => setShowUploadModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5 text-indigo-300" /></button>
                  </div>
                  <form onSubmit={handleFileUpload} className="p-8 space-y-5">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Document Name</label>
                          <input 
                            required
                            type="text"
                            className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="e.g. Q1 Financial Report"
                            value={uploadForm.name}
                            onChange={e => setUploadForm({...uploadForm, name: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Category</label>
                          <select 
                            className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                            value={uploadForm.category}
                            onChange={e => setUploadForm({...uploadForm, category: e.target.value as DocumentCategory})}
                            disabled={isStrictAccountant || isStrictOfficer}
                          >
                              {isStrictAccountant ? (
                                  <option value="financial">Financial</option>
                              ) : isStrictOfficer ? (
                                  <option value="loan_application">Loan Application</option>
                              ) : (
                                  <>
                                      <option value="general">General</option>
                                      <option value="loan_application">Loan Application</option>
                                      <option value="financial">Financial</option>
                                      <option value="hr">HR / Personnel</option>
                                      <option value="operational">Operational</option>
                                      <option value="template">System Template</option>
                                  </>
                              )}
                          </select>
                          {(isStrictAccountant || isStrictOfficer) && (
                              <p className="mt-1 text-[10px] text-indigo-600 font-bold">
                                  {isStrictAccountant ? 'Accountants are restricted to financial documents.' : 'Loan Officers are restricted to loan applications.'}
                              </p>
                          )}
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Select File</label>
                          <input 
                            required
                            type="file"
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                            onChange={e => setUploadForm({...uploadForm, file: e.target.files?.[0] || null})}
                          />
                      </div>
                      <div className="pt-4">
                          <button 
                            type="submit"
                            disabled={isUploading || !uploadForm.file}
                            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-400 transition-all shadow-lg shadow-indigo-100 active:scale-[0.98]"
                          >
                              {isUploading ? 'Uploading...' : 'Upload to Repository'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && selectedFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-amber-600 px-6 py-5 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center text-lg"><ShieldCheck className="mr-3 h-6 w-6 text-amber-200" /> Access Permissions</h3>
                      <button onClick={() => setShowPermissionsModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5 text-amber-200" /></button>
                  </div>
                  <div className="p-8 space-y-6">
                      <div>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Managing Access For</p>
                          <p className="text-sm font-bold text-gray-900 truncate">{selectedFile.name}</p>
                      </div>

                      <div className="space-y-3">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Grant Access To Roles:</p>
                          {(['loan_officer', 'accountant', 'hr', 'ceo'] as UserRole[]).map(role => (
                              <button 
                                key={role}
                                onClick={() => togglePermission(role)}
                                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${filePermissions.includes(role) ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-100 text-gray-500 hover:border-indigo-200'}`}
                              >
                                  <div className="flex items-center">
                                      {filePermissions.includes(role) ? <Check className="h-4 w-4 mr-3" /> : <Lock className="h-4 w-4 mr-3 opacity-30" />}
                                      <span className="text-sm font-bold capitalize">{role.replace('_', ' ')}</span>
                                  </div>
                                  {filePermissions.includes(role) && <span className="text-[10px] font-bold uppercase">Authorized</span>}
                              </button>
                          ))}
                      </div>

                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <p className="text-[10px] text-gray-500 leading-relaxed italic">
                              Note: Administrators and the original uploader always have access to this document.
                          </p>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Viewers */}
      {viewingExcel && <ExcelViewer url={viewingExcel.url} fileName={viewingExcel.name} onClose={() => setViewingExcel(null)} />}
      {viewingPdf && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                  <div className="bg-indigo-900 px-6 py-4 flex justify-between items-center">
                      <div className="flex items-center">
                          <FileText className="h-5 w-5 text-indigo-300 mr-3" />
                          <h3 className="font-bold text-white text-sm">{viewingPdf.name}</h3>
                      </div>
                      <button onClick={() => setViewingPdf(null)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5 text-indigo-300" /></button>
                  </div>
                  <iframe src={viewingPdf.url} className="flex-1 w-full border-none" title="PDF Viewer" />
              </div>
          </div>
      )}
      {viewingImage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-sm" onClick={() => setViewingImage(null)}>
              <div className="relative max-w-full max-h-full">
                  <img src={viewingImage.url} alt={viewingImage.name} className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
                  <button 
                      onClick={() => setViewingImage(null)}
                      className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all"
                      title="Close"
                  >
                      <X className="h-6 w-6 text-white" />
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};