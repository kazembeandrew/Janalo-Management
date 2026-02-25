import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
    ShieldAlert, Trash2, RefreshCw, AlertTriangle, X, 
    CheckCircle2, Database, Settings, Send, Clock, 
    Sparkles, Bot, Layout, FileCode, Key, Save, Eye, EyeOff,
    ShieldCheck, Lock, Globe, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { SystemAIChat } from '@/components/SystemAIChat';
import { SystemBlueprint } from '@/components/SystemBlueprint';

export const SystemSettings: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'ai' | 'blueprint' | 'security' | 'maintenance'>('ai');
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<any>(null);

  // AI Key State
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [showKey, setShowKey] = useState(false);

  const isAuthorized = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo');

  useEffect(() => {
      fetchPendingReset();
  }, []);

  const fetchPendingReset = async () => {
      try {
          const { data: logs } = await supabase
            .from('audit_logs')
            .select('*, users!user_id(full_name)')
            .in('action', ['SYSTEM_RESET_REQUESTED', 'SYSTEM_RESET_CANCELLED', 'SYSTEM_FACTORY_RESET'])
            .order('created_at', { ascending: false })
            .limit(1);
          
          const latest = logs?.[0];
          if (latest && latest.action === 'SYSTEM_RESET_REQUESTED') {
              setPendingRequest(latest);
          } else {
              setPendingRequest(null);
          }
      } catch (err) {
          console.error("Pending reset fetch error:", err);
      }
  };

  const handleSaveApiKey = () => {
      if (!apiKey.trim()) {
          localStorage.removeItem('gemini_api_key');
          toast.success("AI Key reset to system default.");
      } else {
          localStorage.setItem('gemini_api_key', apiKey.trim());
          toast.success("Gemini API Key updated successfully.");
      }
      setTimeout(() => window.location.reload(), 1000);
  };

  const handleOptimize = async () => {
      setIsOptimizing(true);
      try {
          const { data, error } = await supabase.rpc('optimize_database');
          if (error) throw error;
          toast.success(data.message || "Database optimization complete.");
      } catch (e: any) {
          toast.error("Optimization failed: " + e.message);
      } finally {
          setIsOptimizing(false);
      }
  };

  const handleRequestReset = async () => {
      if (confirmText !== 'ERASE') {
          toast.error("Please type 'ERASE' to confirm your intent.");
          return;
      }

      setIsProcessing(true);
      try {
          // 1. Log the request
          const { error: logError } = await supabase.from('audit_logs').insert({
              user_id: profile?.id,
              action: 'SYSTEM_RESET_REQUESTED',
              entity_type: 'system',
              details: { status: 'pending', requested_at: new Date().toISOString() }
          });

          if (logError) throw logError;

          // 2. Notify all CEOs (The "Wiring")
          const { data: ceos } = await supabase.from('users').select('id').eq('role', 'ceo');
          if (ceos && ceos.length > 0) {
              const notifications = ceos
                .filter(c => c.id !== profile?.id) // Don't notify self
                .map(c => ({
                  user_id: c.id,
                  title: 'CRITICAL: System Reset Requested',
                  message: `${profile?.full_name} has requested a factory reset. Your authorization is required to proceed.`,
                  link: '/',
                  type: 'error'
                }));
              
              if (notifications.length > 0) {
                  await supabase.from('notifications').insert(notifications);
              }
          }

          toast.success("Reset request submitted. A second administrator must now authorize this.");
          setShowWipeModal(false);
          setConfirmText('');
          fetchPendingReset();
      } catch (e: any) {
          toast.error("Request failed: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleCancelRequest = async () => {
      if (!profile) return;
      setIsProcessing(true);
      try {
          const { error } = await supabase.from('audit_logs').insert({
              user_id: profile.id,
              action: 'SYSTEM_RESET_CANCELLED',
              entity_type: 'system',
              details: { cancelled_at: new Date().toISOString() }
          });
          
          if (error) throw error;
          toast.success("Reset request cancelled.");
          fetchPendingReset();
      } catch (e: any) {
          toast.error("Cancellation failed: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  if (!isAuthorized) {
      return <div className="p-8 text-center">Access Denied</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <Settings className="h-6 w-6 mr-2 text-indigo-600" />
                System Settings
            </h1>
            <p className="text-sm text-gray-500">Manage global application state and maintenance tasks.</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            <button 
                onClick={() => setActiveTab('ai')}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center whitespace-nowrap ${activeTab === 'ai' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                <Bot className="h-3.5 w-3.5 mr-2" /> AI Assistant
            </button>
            <button 
                onClick={() => setActiveTab('blueprint')}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center whitespace-nowrap ${activeTab === 'blueprint' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                <FileCode className="h-3.5 w-3.5 mr-2" /> Blueprint
            </button>
            <button 
                onClick={() => setActiveTab('security')}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center whitespace-nowrap ${activeTab === 'security' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                <ShieldCheck className="h-3.5 w-3.5 mr-2" /> Security
            </button>
            <button 
                onClick={() => setActiveTab('maintenance')}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center whitespace-nowrap ${activeTab === 'maintenance' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                <Database className="h-3.5 w-3.5 mr-2" /> Maintenance
            </button>
        </div>
      </div>

      {activeTab === 'ai' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                      <Bot className="h-5 w-5 text-indigo-600" />
                      <h2 className="text-lg font-bold text-gray-900">System Architect AI</h2>
                  </div>
                  <SystemAIChat />
              </div>
              <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <h3 className="font-bold text-gray-900 flex items-center mb-4">
                          <Key className="h-4 w-4 mr-2 text-indigo-600" />
                          AI Configuration
                      </h3>
                      <div className="space-y-4">
                          <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Gemini API Key</label>
                              <div className="relative">
                                  <input 
                                    type={showKey ? "text" : "password"}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="Enter API Key..."
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                  />
                                  <button 
                                    onClick={() => setShowKey(!showKey)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors"
                                  >
                                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </button>
                              </div>
                              <p className="mt-2 text-[10px] text-gray-500 leading-relaxed">
                                  This key is used for financial analysis and risk assessment. Leave blank to use the system default.
                              </p>
                          </div>
                          <button 
                            onClick={handleSaveApiKey}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                          >
                              <Save className="h-3.5 w-3.5" />
                              Save Configuration
                          </button>
                      </div>
                  </div>

                  <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                      <h3 className="font-bold text-indigo-900 flex items-center mb-3">
                          <Sparkles className="h-4 w-4 mr-2" />
                          AI Capabilities
                      </h3>
                      <ul className="space-y-3">
                          <li className="text-xs text-indigo-700 flex items-start">
                              <div className="h-1 w-1 rounded-full bg-indigo-400 mt-1.5 mr-2 shrink-0" />
                              Analyze audit logs for anomalies.
                          </li>
                          <li className="text-xs text-indigo-700 flex items-start">
                              <div className="h-1 w-1 rounded-full bg-indigo-400 mt-1.5 mr-2 shrink-0" />
                              Suggest operational improvements.
                          </li>
                          <li className="text-xs text-indigo-700 flex items-start">
                              <div className="h-1 w-1 rounded-full bg-indigo-400 mt-1.5 mr-2 shrink-0" />
                              Real-time liquidity forecasting.
                          </li>
                      </ul>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'blueprint' && (
          <div className="space-y-6">
              <div className="flex items-center gap-2 mb-2">
                  <FileCode className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-gray-900">Technical System Blueprint</h2>
              </div>
              <SystemBlueprint />
          </div>
      )}

      {activeTab === 'security' && (
          <div className="space-y-6">
              <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-gray-900">Security & Firewall Status</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                          <Lock className="h-5 w-5 text-green-600" />
                          <span className="text-[10px] font-bold text-green-600 uppercase bg-green-50 px-2 py-0.5 rounded">Active</span>
                      </div>
                      <h4 className="text-sm font-bold text-gray-900">Database RLS</h4>
                      <p className="text-[10px] text-gray-500 mt-1">Row Level Security prevents unauthorized data access.</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                          <Shield className="h-5 w-5 text-indigo-600" />
                          <span className="text-[10px] font-bold text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded">Active</span>
                      </div>
                      <h4 className="text-sm font-bold text-gray-900">AI PII Firewall</h4>
                      <p className="text-[10px] text-gray-500 mt-1">Sensitive client data is scrubbed before AI analysis.</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                          <Globe className="h-5 w-5 text-blue-600" />
                          <span className="text-[10px] font-bold text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded">Active</span>
                      </div>
                      <h4 className="text-sm font-bold text-gray-900">SSL Encryption</h4>
                      <p className="text-[10px] text-gray-500 mt-1">All data in transit is encrypted via HTTPS/TLS.</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                          <Key className="h-5 w-5 text-amber-600" />
                          <span className="text-[10px] font-bold text-amber-600 uppercase bg-amber-50 px-2 py-0.5 rounded">Active</span>
                      </div>
                      <h4 className="text-sm font-bold text-gray-900">Dual Auth Reset</h4>
                      <p className="text-[10px] text-gray-500 mt-1">Critical system actions require two administrators.</p>
                  </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 bg-slate-50 border-b border-gray-100">
                      <h3 className="font-bold text-gray-900">Security Architecture Overview</h3>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Data Protection</h4>
                          <div className="space-y-3">
                              <div className="flex items-start gap-3">
                                  <div className="mt-1 p-1 bg-green-100 rounded-full"><CheckCircle2 className="h-3 w-3 text-green-600" /></div>
                                  <div>
                                      <p className="text-sm font-bold text-gray-900">Immutable Audit Trail</p>
                                      <p className="text-xs text-gray-500">Every administrative action is logged with a timestamp and actor ID.</p>
                                  </div>
                              </div>
                              <div className="flex items-start gap-3">
                                  <div className="mt-1 p-1 bg-green-100 rounded-full"><CheckCircle2 className="h-3 w-3 text-green-600" /></div>
                                  <div>
                                      <p className="text-sm font-bold text-gray-900">Role-Based Access (RBAC)</p>
                                      <p className="text-xs text-gray-500">Permissions are strictly enforced based on staff roles (Officer, HR, CEO).</p>
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="space-y-4">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">AI Privacy Firewall</h4>
                          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                              <p className="text-xs text-indigo-800 leading-relaxed">
                                  The system automatically anonymizes data before it leaves the application. 
                                  <strong> Names</strong> are reduced to initials, and <strong>Phone Numbers/Addresses</strong> are completely redacted.
                              </p>
                              <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-indigo-600 uppercase">
                                  <Shield className="h-3 w-3" />
                                  Compliant with Rule #4
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'maintenance' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="px-6 py-4 bg-slate-50 border-b border-gray-100">
                          <h3 className="font-bold text-gray-900 flex items-center">
                              <Database className="h-4 w-4 mr-2 text-indigo-600" />
                              Database Maintenance
                          </h3>
                      </div>
                      <div className="p-8 space-y-8">
                          <div>
                              <h4 className="text-sm font-bold text-gray-900">Performance Optimization</h4>
                              <p className="text-xs text-gray-500 mt-1 mb-4">Run a system-wide analysis to update table statistics and optimize query execution plans.</p>
                              <button 
                                onClick={handleOptimize}
                                disabled={isOptimizing}
                                className="inline-flex items-center px-6 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50 shadow-sm"
                              >
                                  {isOptimizing ? (
                                      <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Optimizing...</>
                                  ) : (
                                      <><Sparkles className="h-4 w-4 mr-2 text-indigo-500" /> Run Optimization</>
                                  )}
                              </button>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="space-y-6">
                  <div className="bg-red-50 border border-red-100 rounded-2xl overflow-hidden">
                      <div className="px-6 py-4 border-b border-red-100 bg-red-100/30">
                          <h3 className="font-bold text-red-900 flex items-center">
                              <ShieldAlert className="h-4 w-4 mr-2 text-red-600" />
                              Danger Zone
                          </h3>
                      </div>
                      <div className="p-6 space-y-6">
                          {pendingRequest ? (
                              <div className="bg-white rounded-xl p-5 border border-red-200 shadow-sm">
                                  <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center">
                                          <Clock className="h-5 w-5 text-amber-500 mr-2" />
                                          <span className="text-sm font-bold text-gray-900">Reset Pending</span>
                                      </div>
                                      <span className="text-[10px] font-bold text-amber-600 uppercase bg-amber-50 px-2 py-0.5 rounded">Awaiting 2nd Auth</span>
                                  </div>
                                  <p className="text-xs text-gray-600 mb-4">
                                      Requested by <strong>{pendingRequest.users?.full_name || 'Administrator'}</strong>.
                                      Must be authorized by a <strong>different</strong> admin in the Oversight Queue.
                                  </p>
                                  <button 
                                    onClick={handleCancelRequest}
                                    disabled={isProcessing}
                                    className="text-xs font-bold text-red-600 hover:underline"
                                  >
                                      Cancel Request
                                  </button>
                              </div>
                          ) : (
                              <>
                                <p className="text-xs text-red-700 leading-relaxed mb-4">
                                    The <strong>Factory Reset</strong> will permanently delete all business data. 
                                    Requires <strong>Dual Authorization</strong>.
                                </p>
                                <button 
                                    onClick={() => setShowWipeModal(true)}
                                    className="w-full inline-flex justify-center items-center px-6 py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-100 active:scale-95"
                                >
                                    <Send className="h-4 w-4 mr-2" />
                                    Request Reset
                                </button>
                              </>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Wipe Confirmation Modal */}
      {showWipeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-red-600 px-6 py-5 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center text-lg">
                          <AlertTriangle className="mr-3 h-6 w-6 text-red-200" /> 
                          Initiate Dual Auth Reset
                      </h3>
                      <button onClick={() => setShowWipeModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5 text-red-200" /></button>
                  </div>
                  <div className="p-8 space-y-6">
                      <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                          <p className="text-xs text-red-700 leading-relaxed font-medium">
                              You are initiating a system-wide erasure. This request will be sent to the Oversight Queue for a second administrator to verify and execute.
                          </p>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                              Type <span className="text-red-600">ERASE</span> to confirm intent
                          </label>
                          <input 
                            type="text"
                            className="block w-full border-2 border-red-100 rounded-xl px-4 py-3 text-center text-lg font-bold focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                            placeholder="Type here..."
                            value={confirmText}
                            onChange={e => setConfirmText(e.target.value.toUpperCase())}
                          />
                      </div>

                      <div className="flex gap-3 pt-2">
                          <button 
                            onClick={() => setShowWipeModal(false)}
                            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all"
                          >
                              Cancel
                          </button>
                          <button 
                            onClick={handleRequestReset}
                            disabled={isProcessing || confirmText !== 'ERASE'}
                            className="flex-1 bg-red-600 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50 shadow-lg shadow-red-100 transition-all active:scale-95"
                          >
                              {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin mx-auto" /> : 'Submit Request'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};