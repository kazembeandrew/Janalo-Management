import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ShieldAlert, ShieldCheck, RefreshCw, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

type AuditAction = 'SYSTEM_RESET_REQUESTED' | 'SYSTEM_RESET_CANCELLED' | 'SYSTEM_FACTORY_RESET';

interface PendingReset {
  id: string;
  action: AuditAction;
  user_id: string;
  created_at: string;
  details: any;
  requestedByName?: string;
}

export const CEOOversight: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [pendingReset, setPendingReset] = useState<PendingReset | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchPendingReset = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    try {
      // Fetch latest system reset-related audit event (resilient: even if realtime fails).
      const { data: logs, error: logError } = await supabase
        .from('audit_logs')
        .select('id, action, user_id, created_at, details')
        .in('action', ['SYSTEM_RESET_REQUESTED', 'SYSTEM_RESET_CANCELLED', 'SYSTEM_FACTORY_RESET'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (logError) {
        console.error('[CEOOversight] Audit log fetch failed:', logError);
        setPendingReset(null);
        return;
      }

      const latest = logs?.[0] as PendingReset | undefined;
      if (latest && latest.action === 'SYSTEM_RESET_REQUESTED') {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', latest.user_id)
          .single();

        if (userError) {
          console.error('[CEOOversight] User lookup failed:', userError);
        }

        setPendingReset({
          ...latest,
          requestedByName: userData?.full_name || 'Administrator'
        });
      } else {
        setPendingReset(null);
      }
    } catch (err) {
      console.error('[CEOOversight] Critical fetch error:', err);
      setPendingReset(null);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchPendingReset();

    const channel = supabase
      .channel('oversight-realtime-reset')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'audit_logs' },
        () => {
          fetchPendingReset();
        }
      )
      .subscribe((status) => {
        if (status === 'TIMED_OUT' || status === 'CLOSED') {
          // Fallback: refresh periodically if realtime fails.
          const fallbackInterval = setInterval(fetchPendingReset, 30000);
          setTimeout(() => clearInterval(fallbackInterval), 300000); // stop after 5 minutes
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPendingReset]);

  const handleExecuteReset = async () => {
    if (!profile || !pendingReset) return;

    if (profile.id === pendingReset.user_id) {
      toast.error('Dual Authorization Required: A different administrator must authorize this reset.');
      return;
    }

    if (!window.confirm('CRITICAL: You are about to execute a system-wide Factory Reset. This will erase all business data. Continue?')) {
      return;
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase.rpc('wipe_all_data');
      if (error) throw error;

      toast.success('System reset successful.');
      setTimeout(() => navigate('/'), 1500);
    } catch (e: any) {
      toast.error('Reset failed: ' + (e?.message || String(e)));
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

  if (!pendingReset) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-200 space-y-2">
        <ShieldCheck className="h-12 w-12 text-green-100 mx-auto" />
        <h3 className="text-sm font-bold text-gray-900">System Clear</h3>
        <p className="text-xs text-gray-500">No system reset requests currently require authorization.</p>
      </div>
    );
  }

  const canExecute = profile?.id !== pendingReset.user_id;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center">
          <ShieldAlert className="h-5 w-5 mr-2 text-indigo-600" />
          System Reset Authorization
        </h3>

        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full uppercase">
          Pending Authorization
        </span>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-indigo-100 rounded-xl">
            <ShieldAlert className="h-4 w-4 text-indigo-700" />
          </div>

          <div className="flex-1">
            <p className="text-xs text-indigo-700 leading-relaxed">
              Requested by <strong>{pendingReset.requestedByName || 'Administrator'}</strong>.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Submitted on {new Date(pendingReset.created_at).toLocaleDateString()}
            </p>

            {!canExecute && (
              <p className="text-xs text-amber-700 mt-3">
                This reset was requested by you. Dual authorization is required before execution.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end">
          <button
            onClick={handleExecuteReset}
            disabled={!canExecute || isProcessing}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-700 transition-all flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            title="Authorize and execute factory reset"
          >
            {isProcessing ? <RefreshCw className="h-3 w-3 animate-spin mr-2" /> : <Check className="h-3 w-3 mr-2" />}
            Authorize & Execute
          </button>
        </div>
      </div>
    </div>
  );
};

