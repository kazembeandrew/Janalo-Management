import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AuditLog } from '@/types';
import { 
    History, User, Clock, ShieldAlert, Search, Filter, 
    Eye, X, FileText, Database, ChevronRight, Info,
    Banknote, UserCog, Receipt, ClipboardList, RefreshCw
} from 'lucide-react';

type EntityFilter = 'all' | 'loan' | 'user' | 'expense' | 'task';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<EntityFilter>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [activeFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
        // Try with join first
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*, users!user_id(full_name)')
          .order('created_at', { ascending: false })
          .limit(150);
        
        if (error) {
            // Fallback if join fails
            const { data: fallbackData } = await supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(150);
            setLogs(fallbackData || []);
        } else {
            setLogs(data || []);
        }
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.users?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.entity_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = activeFilter === 'all' || log.entity_type === activeFilter;
    
    return matchesSearch && matchesFilter;
  });

  const getEntityIcon = (type: string) => {
      switch(type) {
          case 'loan': return <Banknote className="h-4 w-4 text-blue-500" />;
          case 'user': return <UserCog className="h-4 w-4 text-indigo-500" />;
          case 'expense': return <Receipt className="h-4 w-4 text-emerald-500" />;
          case 'task': return <ClipboardList className="h-4 w-4 text-orange-500" />;
          default: return <Database className="h-4 w-4 text-gray-400" />;
      }
  };

  const getActionColor = (action: string) => {
      const a = action.toLowerCase();
      if (a.includes('delete') || a.includes('reject') || a.includes('revoke')) return 'bg-red-50 text-red-700 border-red-100';
      if (a.includes('approve') || a.includes('create') || a.includes('success')) return 'bg-green-50 text-green-700 border-green-100';
      if (a.includes('update') || a.includes('edit') || a.includes('promote')) return 'bg-blue-50 text-blue-700 border-blue-100';
      return 'bg-gray-50 text-gray-600 border-gray-100';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <History className="h-6 w-6 mr-2 text-indigo-600" />
                System Audit Logs
            </h1>
            <p className="text-sm text-gray-500">A permanent, immutable record of all administrative and financial actions.</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
            {(['all', 'loan', 'user', 'expense', 'task'] as EntityFilter[]).map((f) => (
                <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                        activeFilter === f 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                >
                    {f}s
                </button>
            ))}
        </div>
      </div>

      <div className="relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          placeholder="Search by action, user, or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
                <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actor</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Target</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Details</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500"><RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" /> Syncing logs...</td></tr>
                ) : filteredLogs.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No audit records found for this criteria.</td></tr>
                ) : (
                    filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-900">{new Date(log.created_at).toLocaleDateString()}</span>
                                <span className="text-[10px] text-gray-400 flex items-center">
                                    <Clock className="h-2.5 w-2.5 mr-1" />
                                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                                <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs mr-3">
                                    {(log.users?.full_name || 'S').charAt(0)}
                                </div>
                                <span className="text-sm font-bold text-gray-700">{log.users?.full_name || 'System'}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border ${getActionColor(log.action)}`}>
                                {log.action}
                            </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                                {getEntityIcon(log.entity_type)}
                                <span className="ml-2 text-xs font-medium text-gray-500 capitalize">{log.entity_type}</span>
                                <span className="ml-2 text-[10px] text-gray-400 font-mono">#{log.entity_id?.slice(0, 8)}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                            <button 
                                onClick={() => setSelectedLog(log)}
                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title="View Metadata"
                            >
                                <Eye className="h-4 w-4" />
                            </button>
                        </td>
                    </tr>
                    ))
                )}
            </tbody>
            </table>
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-indigo-900 px-6 py-5 flex justify-between items-center">
                      <div className="flex items-center">
                          <div className="p-2 bg-white/10 rounded-lg mr-3">
                              <FileText className="h-5 w-5 text-indigo-200" />
                          </div>
                          <h3 className="font-bold text-white">Audit Metadata</h3>
                      </div>
                      <button onClick={() => setSelectedLog(null)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                          <X className="h-5 w-5 text-indigo-300" />
                      </button>
                  </div>
                  <div className="p-8 space-y-6">
                      <div className="flex justify-between items-start">
                          <div>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Action Performed</p>
                              <h2 className="text-xl font-bold text-gray-900">{selectedLog.action}</h2>
                          </div>
                          <div className="text-right">
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Entity ID</p>
                              <p className="text-xs font-mono text-gray-500">{selectedLog.entity_id}</p>
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Performed By</p>
                              <p className="text-sm font-bold text-gray-900">{selectedLog.users?.full_name || 'System'}</p>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Timestamp</p>
                              <p className="text-sm font-bold text-gray-900">{new Date(selectedLog.created_at).toLocaleString()}</p>
                          </div>
                      </div>

                      <div>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2 flex items-center">
                              <Database className="h-3 w-3 mr-1.5" />
                              Raw Payload (JSON)
                          </p>
                          <div className="bg-slate-900 rounded-2xl p-5 overflow-x-auto">
                              <pre className="text-[11px] text-indigo-300 font-mono leading-relaxed">
                                  {JSON.stringify(selectedLog.details, null, 2)}
                              </pre>
                          </div>
                      </div>

                      <div className="pt-4">
                          <button 
                            onClick={() => setSelectedLog(null)}
                            className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all"
                          >
                              Close Inspection
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};