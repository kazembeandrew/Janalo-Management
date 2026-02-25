import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ShieldAlert, CheckCircle, ChevronRight, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const OversightIndicator: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const isExec = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo');

  const fetchCounts = useCallback(async () => {
    if (!profile || !isExec) return;
    
    try {
        const [loans, users, expenses, tasks, logs] = await Promise.all([
            supabase.from('loans').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('users').select('id', { count: 'exact', head: true }).eq('deletion_status', 'pending_approval'),
            supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
            supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
            supabase.from('audit_logs').select('id', { count: 'exact', head: true }).eq('action', 'SYSTEM_RESET_REQUESTED')
        ]);

        const total = (loans.count || 0) + (users.count || 0) + (expenses.count || 0) + (tasks.count || 0) + (logs.count || 0);
        setPendingCount(total);
    } catch (err) {
        console.error("Oversight count fetch error", err);
    }
  }, [profile, isExec]);

  useEffect(() => {
    if (!isExec) return;
    fetchCounts();
    
    const channel = supabase.channel('oversight-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => fetchCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => fetchCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, () => fetchCounts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchCounts, isExec]);

  if (!isExec || pendingCount === 0) return null;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-100 rounded-full text-red-600 animate-pulse hover:bg-red-100 transition-all"
      >
        <ShieldAlert className="h-4 w-4" />
        <span className="text-[10px] font-extrabold uppercase tracking-wider">{pendingCount} Actions Required</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl ring-1 ring-black ring-opacity-5 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
            <div className="p-4 border-b border-gray-100 bg-red-50/30">
                <h3 className="text-xs font-bold text-red-900 uppercase tracking-widest">Oversight Queue</h3>
            </div>
            <div className="p-4 space-y-3">
                <p className="text-xs text-gray-600 leading-relaxed">
                    There are <strong>{pendingCount}</strong> items awaiting executive authorization.
                </p>
                <Link 
                    to="/" 
                    onClick={() => setIsOpen(false)}
                    className="w-full flex items-center justify-between p-3 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all"
                >
                    Go to Oversight Queue
                    <ChevronRight className="h-4 w-4" />
                </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
};