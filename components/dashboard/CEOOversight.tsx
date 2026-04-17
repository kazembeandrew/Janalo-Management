import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { 
  ShieldAlert, ShieldCheck, RefreshCw, Check, AlertTriangle, 
  Trash2, X, FileText, AlertOctagon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

type AuditAction = 'SYSTEM_RESET_REQUESTED' | 'SYSTEM_RESET_CANCELLED' | 'SYSTEM_FACTORY_RESET' | 'BACKUP_BEFORE_RESET';

interface PendingReset {
  id: string;
  action: AuditAction;
  user_id: string;
  created_at: string;
  details: any;
  requestedByName?: string;
}

interface PendingDeletion {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export const CEOOversight: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const navigate = useNavigate();

  const [pendingReset, setPendingReset] = useState<PendingReset | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingDeletions, setPendingDeletions] = useState<PendingDeletion[]>([]);
  const [loading, setLoading] = useState(true);

  // Authorization check - only admin and CEO can access
  const isAuthorized = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo');

  const fetchPendingItems = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    try {
      // 1. Fetch latest system reset request
      // First, check if there's a pending (not cancelled or completed) request
      const { data: logs, error: logError } = await supabase
        .from('audit_logs')
        .select('id, action, user_id, created_at, details')
        .eq('action', 'SYSTEM_RESET_REQUESTED')
        .order('created_at', { ascending: false })
        .limit(1);

      if (logError) {
      }

      if (!logError && logs && logs.length > 0) {
        const latest = logs[0] as PendingReset;
        
        // Check if this request has been cancelled or completed by looking for subsequent entries
        const { data: subsequentLogs, error: subsequentError } = await supabase
          .from('audit_logs')
          .select('action')
          .in('action', ['SYSTEM_RESET_CANCELLED', 'SYSTEM_FACTORY_RESET'])
          .gt('created_at', latest.created_at)
          .order('created_at', { ascending: false })
          .limit(1);

        if (subsequentError) {
        }

        // Only show if not cancelled or completed
        if (!subsequentLogs || subsequentLogs.length === 0) {
          const { data: userData } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', latest.user_id)
            .single();

          setPendingReset({
            ...latest,
            requestedByName: userData?.full_name || 'Administrator'
          });
        } else {
          setPendingReset(null);
        }
      } else {
        setPendingReset(null);
      }

      // 2. Fetch pending user deletions
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('deletion_status', 'pending_approval');

      if (!userError) {
        setPendingDeletions(users || []);
      }
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchPendingItems();

    const channel = supabase
      .channel('oversight-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'audit_logs' },
        () => fetchPendingItems()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users' },
        () => fetchPendingItems()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPendingItems]);

  const handleExecuteReset = async () => {
    if (!profile || !pendingReset) return;

    if (profile.id === pendingReset.user_id) {
      toast.error('Dual Authorization Required: A different administrator must authorize this reset.');
      return;
    }

    // Verify the request is still valid (not cancelled or already executed)
    const { data: currentRequest, error: fetchError } = await supabase
      .from('audit_logs')
      .select('action, details')
      .eq('id', pendingReset.id)
      .single();

    if (fetchError || !currentRequest || currentRequest.action !== 'SYSTEM_RESET_REQUESTED') {
      toast.error('This reset request is no longer valid or has been cancelled.');
      fetchPendingItems();
      return;
    }

    // Show custom modal instead of window.confirm
    setShowResetModal(true);
  };

  const confirmExecuteReset = async () => {
    if (resetConfirmText !== 'DELETE ALL DATA') {
      toast.error("Please type 'DELETE ALL DATA' to confirm");
      return;
    }

    setShowResetModal(false);
    setResetConfirmText('');
    setIsProcessing(true);
    try {
      // Execute the wipe with retry logic for resilience
      let attempts = 0;
      const maxAttempts = 3;
      let lastError: any = null;
      let wipeResult: any = null;

      while (attempts < maxAttempts) {
        attempts++;
        const { error, data } = await supabase.rpc('wipe_all_data');
        const resultData = data as any;
        
        if (!error && resultData?.success) {
          wipeResult = resultData;
          break;
        }
        
        lastError = error;
        
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }

      if (!wipeResult) {
        throw lastError || new Error('Wipe operation failed after multiple attempts');
      }

      // Create audit log for the factory reset execution
      const { error: auditError } = await supabase.from('audit_logs').insert({
        user_id: profile.id,
        action: 'SYSTEM_FACTORY_RESET',
        entity_type: 'system',
        details: {
          executed_by: profile.full_name,
          executed_by_id: profile.id,
          requested_by: pendingReset.user_id,
          executed_at: new Date().toISOString(),
          request_id: pendingReset.id,
          attempt_number: attempts,
          backup_timestamp: wipeResult.backup_timestamp,
          tables_wiped: wipeResult.tables_wiped,
          status: 'completed'
        }
      });

      if (auditError) {
        // Don't throw - the wipe succeeded, just log the issue
      }

      // Update the original request status
      await supabase.from('audit_logs').update({
        details: { 
          ...pendingReset.details,
          status: 'completed',
          completed_at: new Date().toISOString(),
          executed_by: profile.id,
          executed_by_name: profile.full_name,
          backup_timestamp: wipeResult.backup_timestamp
        }
      }).eq('id', pendingReset.id);

      toast.success('✅ System reset completed successfully. All business data has been erased.', {
        duration: 5000,
        icon: '🔄'
      });
      
      // Notify other admins about the completion
      const { data: otherAdmins } = await supabase
        .from('users')
        .select('id, full_name')
        .or('role.ilike.ceo,role.ilike.admin')
        .neq('id', profile.id);

      if (otherAdmins && otherAdmins.length > 0) {
        const notifications = otherAdmins.map((admin: any) => ({
          user_id: admin.id,
          title: 'Factory Reset Completed',
          message: `${profile.full_name} has executed a factory reset at ${new Date().toLocaleString()}. All business data has been permanently erased.`,
          type: 'warning',
          priority: 'high',
          category: 'system',
          is_read: false,
          is_archived: false
        }));

        await supabase.from('notifications').insert(notifications);
      }

      setTimeout(() => navigate('/'), 1500);
    } catch (e: any) {
      toast.error('❌ Reset failed: ' + (e?.message || String(e)));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveDeletion = async (userId: string) => {
    if (!window.confirm('Are you sure you want to AUTHORIZE the archive/erasure of this user? They will be deactivated immediately.')) return;
    
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          is_active: false, 
          deletion_status: 'approved',
          revocation_reason: 'System Erase Authorized by CEO'
        })
        .eq('id', userId);

      if (error) throw error;
      
      toast.success('User archive authorized');
      fetchPendingItems();
    } catch (e: any) {
      toast.error('Failed to authorize: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectDeletion = async (userId: string) => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ deletion_status: null })
        .eq('id', userId);

      if (error) throw error;
      
      toast.success('Erasure request rejected');
      fetchPendingItems();
    } catch (e: any) {
      toast.error('Failed to reject: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Show access denied if not authorized
  if (!isAuthorized) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-red-200 space-y-3">
        <ShieldAlert className="h-12 w-12 text-red-200 mx-auto" />
        <h3 className="text-sm font-bold text-gray-900">Access Denied</h3>
        <p className="text-xs text-gray-500">You do not have permission to view this page.</p>
        <p className="text-[10px] text-gray-400">Only Admin and CEO roles can access system oversight.</p>
      </div>
    );
  }

  const hasPending = pendingReset || pendingDeletions.length > 0;

  if (!hasPending) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-200 space-y-2">
        <ShieldCheck className="h-12 w-12 text-green-100 mx-auto" />
        <h3 className="text-sm font-bold text-gray-900">System Clear</h3>
        <p className="text-xs text-gray-500">No high-risk requests currently require authorization.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* System Reset Section */}
      {pendingReset && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <ShieldAlert className="h-5 w-5 mr-2 text-red-600" />
              Factory Reset Request
            </h3>
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full uppercase">Critical Priority</span>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-100 rounded-xl">
                <ShieldAlert className="h-6 w-6 text-red-700" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-900">Full System Wipe Requested</p>
                <p className="text-xs text-red-700 mt-1">Requested by <strong>{pendingReset.requestedByName}</strong> on {new Date(pendingReset.created_at).toLocaleString()}</p>
                {profile?.id === pendingReset.user_id ? (
                  <p className="text-[10px] text-amber-700 mt-3 font-bold bg-amber-100 px-2 py-1 rounded inline-block">⚠️ Dual authorization required - waiting for another Admin/CEO</p>
                ) : (
                  <p className="text-[10px] text-green-700 mt-3 font-bold bg-green-100 px-2 py-1 rounded inline-block">✓ You can authorize this reset</p>
                )}
              </div>
              <button
                onClick={handleExecuteReset}
                disabled={profile?.id === pendingReset.user_id || isProcessing}
                className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-700 disabled:opacity-50 flex items-center shadow-lg shadow-red-100 transition-all active:scale-95"
              >
                {isProcessing ? <RefreshCw className="h-3 w-3 animate-spin mr-2" /> : <Check className="h-3 w-3 mr-2" />}
                Authorize Wipe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Deletion Section */}
      {pendingDeletions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <ShieldAlert className="h-5 w-5 mr-2 text-indigo-600" />
              System Erase (User Archive)
            </h3>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full uppercase">Pending Review</span>
          </div>

          <div className="space-y-3">
            {pendingDeletions.map((user) => (
              <div key={user.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:border-indigo-200 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold text-lg">
                      {user.full_name?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{user.full_name}</p>
                      <p className="text-xs text-gray-500">{user.email} • {user.role?.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRejectDeletion(user.id)}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all active:scale-95"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApproveDeletion(user.id)}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                    >
                      Authorize Erase
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Factory Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Header with Gradient */}
            <div className="bg-gradient-to-r from-red-600 via-red-700 to-red-800 px-8 py-6 relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl transform translate-x-32 -translate-y-32"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full blur-3xl transform -translate-x-24 translate-y-24"></div>
              </div>
              <div className="relative z-10 flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30">
                    <AlertOctagon className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-xl mb-1">
                      Factory Reset Authorization
                    </h3>
                    <p className="text-red-100 text-sm">
                      Dual authorization required • Irreversible action
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowResetModal(false);
                    setResetConfirmText('');
                  }}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>

            {/* Body Content */}
            <div className="px-8 py-6 space-y-6">
              {/* Warning Banner */}
              <div className="bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 rounded-r-xl p-5">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="h-6 w-6 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-red-900 text-sm mb-2">
                      This action will permanently destroy all business data
                    </h4>
                    <ul className="space-y-1.5 text-xs text-red-800">
                      <li className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">•</span>
                        <span>All loans, repayments, and financial records</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">•</span>
                        <span>Journal entries, ledgers, and accounting periods</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">•</span>
                        <span>CEO repayment accounts and liquidity data</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">•</span>
                        <span>Messages, tasks, compliance documents, and audit logs</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* What Will Be Preserved */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h5 className="font-bold text-green-900 text-xs uppercase tracking-wide mb-2">
                      What Will Be Preserved
                    </h5>
                    <ul className="space-y-1 text-xs text-green-800">
                      <li className="flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-green-600"></span>
                        User accounts and authentication
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-green-600"></span>
                        System configuration settings
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-green-600"></span>
                        Internal system accounts (will be recreated)
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Request Details */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wide mb-3 flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-slate-600" />
                  Request Details
                </h5>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block mb-1">Requested By</span>
                    <span className="font-semibold text-slate-900">
                      {pendingReset?.requestedByName || 'Administrator'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">Request Time</span>
                    <span className="font-semibold text-slate-900">
                      {pendingReset?.created_at ? new Date(pendingReset.created_at).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">Executing As</span>
                    <span className="font-semibold text-slate-900">{profile?.full_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">Authorization</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                      ✓ Second Admin Verified
                    </span>
                  </div>
                </div>
              </div>

              {/* Confirmation Input */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Type <span className="text-red-600 font-mono text-sm">DELETE ALL DATA</span> to confirm
                </label>
                <input 
                  type="text"
                  className="block w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-mono font-bold focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all placeholder:text-slate-300"
                  placeholder="Type the confirmation phrase..."
                  value={resetConfirmText}
                  onChange={e => setResetConfirmText(e.target.value.toUpperCase())}
                  autoComplete="off"
                  autoFocus
                />
                <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" />
                  This action cannot be undone. All data will be permanently lost.
                </p>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-8 py-5 bg-slate-50 border-t border-slate-200 flex gap-3">
              <button 
                onClick={() => {
                  setShowResetModal(false);
                  setResetConfirmText('');
                }}
                disabled={isProcessing}
                className="flex-1 px-6 py-3 border-2 border-slate-300 rounded-xl text-sm font-bold text-slate-700 hover:bg-white hover:border-slate-400 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={confirmExecuteReset}
                disabled={isProcessing || resetConfirmText !== 'DELETE ALL DATA'}
                className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 rounded-xl text-sm font-bold hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Execute Factory Reset
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

