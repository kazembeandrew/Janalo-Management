import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, UserX, Banknote, Check, X, AlertCircle, ArrowRight, Receipt, ClipboardList, TrendingUp, ShieldAlert, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/utils/finance';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export const CEOOversight: React.FC = () => {
  const { effectiveRoles } = useAuth();
  const navigate = useNavigate();
  const [pendingLoans, setPendingLoans] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [pendingExpenses, setPendingExpenses] = useState<any[]>([]);
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [pendingReset, setPendingReset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const isAdmin = effectiveRoles.includes('admin');

  useEffect(() => {
    fetchOversightData();
    
    const channel = supabase.channel('oversight-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => fetchOversightData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchOversightData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => fetchOversightData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchOversightData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, () => fetchOversightData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchOversightData = async () => {
    setLoading(true);
    try {
        const [loansRes, usersRes, expensesRes, tasksRes, resetRes] = await Promise.all([
            supabase
                .from('loans')
                .select('*, borrowers(full_name)')
                .eq('status', 'pending')
                .order('created_at', { ascending: false }),
            supabase
                .from('users')
                .select('*')
                .eq('deletion_status', 'pending_approval'),
            supabase
                .from('expenses')
                .select('*, users!recorded_by(full_name)')
                .eq('status', 'pending_approval')
                .order('created_at', { ascending: false }),
            supabase
                .from('tasks')
                .select('*, users!assigned_to(full_name)')
                .eq('status', 'pending_approval')
                .order('created_at', { ascending: false }),
            supabase
                .from('audit_logs')
                .select('*, users(full_name)')
                .eq('action', 'SYSTEM_RESET_REQUESTED')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
        ]);

        setPendingLoans(loansRes.data || []);
        setPendingUsers(usersRes.data || []);
        setPendingExpenses(expensesRes.data || []);
        setPendingTasks(tasksRes.data || []);
        
        if (resetRes.data && !resetRes.data.details?.executed) {
            setPendingReset(resetRes.data);
        } else {
            setPendingReset(null);
        }
    } finally {
        setLoading(false);
    }
  };

  const logAudit = async (action: string, type: string, id: string, details: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('audit_logs').insert({
          user_id: user.id,
          action,
          entity_type: type,
          entity_id: id,
          details
      });
  };

  const createNotification = async (userId: string, title: string, message: string, link: string) => {
      await supabase.from('notifications').insert({
          user_id: userId,
          title,
          message,
          link,
          type: 'success'
      });
  };

  const handleApproveExpense = async (exp: any) => {
      const { error } = await supabase.from('expenses').update({ status: 'approved' }).eq('id', exp.id);
      if (!error) {
          await logAudit('Expense Approved', 'expense', exp.id, { amount: exp.amount, description: exp.description });
          await createNotification(exp.recorded_by, 'Expense Authorized', `CEO has authorized your expense for "${exp.description}" (${formatCurrency(exp.amount)}).`, '/expenses');
          toast.success("Expense authorized");
          fetchOversightData();
      }
  };

  const handleApproveTask = async (task: any) => {
      const { error } = await supabase.from('tasks').update({ status: 'approved' }).eq('id', task.id);
      if (!error) {
          await logAudit('Task Approved', 'task', task.id, { title: task.title });
          await createNotification(task.assigned_to, 'New Task Assigned', `CEO has authorized the task: "${task.title}".`, '/tasks');
          toast.success("Task authorized");
          fetchOversightData();
      }
  };

  const handleApproveUser = async (user: any) => {
      if (!isAdmin) return;
      const { error } = await supabase
        .from('users')
        .update({ 
            is_active: false, 
            deletion_status: 'approved',
            revocation_reason: 'Archiving approved by Admin'
        })
        .eq('id', user.id);
      
      if (!error) {
          await logAudit('User Archive Approved', 'user', user.id, { email: user.email });
          toast.success("User archive confirmed");
          fetchOversightData();
      }
  };

  const handleExecuteReset = async () => {
      if (!isAdmin) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !pendingReset) return;

      if (user.id === pendingReset.user_id) {
          toast.error("Dual Authorization Required: A different administrator must authorize this reset.");
          return;
      }

      if (!window.confirm("CRITICAL: You are about to execute a system-wide Factory Reset. This will erase all business data. Continue?")) return;

      setIsProcessing(true);
      try {
          const { error } = await supabase.rpc('wipe_all_data');
          if (error) throw error;

          await supabase
            .from('audit_logs')
            .update({ details: { ...pendingReset.details, executed: true, authorized_by: user.id } })
            .eq('id', pendingReset.id);

          toast.success("System reset successful.");
          setTimeout(() => navigate('/'), 1500);
      } catch (e: any) {
          toast.error("Reset failed: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const totalPending = pendingLoans.length + 
                       (isAdmin ? pendingUsers.length : 0) + 
                       pendingExpenses.length + 
                       pendingTasks.length + 
                       (isAdmin && pendingReset ? 1 : 0);

  if (loading && totalPending === 0) return null;

  if (totalPending === 0) return (
      <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-200">
          <ShieldCheck className="h-12 w-12 text-green-100 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-gray-900">System Clear</h3>
          <p className="text-xs text-gray-500">No actions currently require your oversight.</p>
      </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <ShieldCheck className="h-5 w-5 mr-2 text-indigo-600" />
              Oversight Queue
          </h3>
          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full uppercase">
              {totalPending} Pending Actions
          </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pending Reset (Admin Only) */}
          {isAdmin && pendingReset && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm flex items-center justify-between md:col-span-2 animate-pulse">
                  <div className="flex items-center">
                      <div className="p-2 bg-red-100 rounded-lg mr-4">
                          <ShieldAlert className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                          <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Critical: Factory Reset Request</p>
                          <p className="text-sm font-bold text-gray-900">Requested by {pendingReset.users?.full_name}</p>
                          <p className="text-xs text-gray-500">Requires 2nd Authorization to execute.</p>
                      </div>
                  </div>
                  <button 
                    onClick={handleExecuteReset}
                    disabled={isProcessing}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-700 transition-all flex items-center"
                  >
                      {isProcessing ? <RefreshCw className="h-3 w-3 animate-spin mr-2" /> : <Check className="h-3 w-3 mr-2" />}
                      Authorize & Execute
                  </button>
              </div>
          )}

          {/* Pending Loans */}
          {pendingLoans.map(loan => (
              <div key={loan.id} className="bg-white border border-amber-100 rounded-xl p-4 shadow-sm flex items-center justify-between hover:border-amber-200 transition-colors">
                  <div className="flex items-center">
                      <div className="p-2 bg-amber-50 rounded-lg mr-4">
                          <Banknote className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Loan Approval</p>
                          <p className="text-sm font-bold text-gray-900">{loan.borrowers?.full_name}</p>
                          <p className="text-xs text-gray-500">{formatCurrency(loan.principal_amount)}</p>
                      </div>
                  </div>
                  <Link to={`/loans/${loan.id}`} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all">
                      <ArrowRight className="h-4 w-4" />
                  </Link>
              </div>
          ))}

          {/* Pending Expenses */}
          {pendingExpenses.map(exp => (
              <div key={exp.id} className="bg-white border border-emerald-100 rounded-xl p-4 shadow-sm flex items-center justify-between hover:border-emerald-200 transition-colors">
                  <div className="flex items-center">
                      <div className="p-2 bg-emerald-50 rounded-lg mr-4">
                          <Receipt className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Expense Authorization</p>
                          <p className="text-sm font-bold text-gray-900">{exp.description}</p>
                          <p className="text-xs text-emerald-600 font-bold">{formatCurrency(exp.amount)}</p>
                      </div>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={() => handleApproveExpense(exp)} className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                          <Check className="h-4 w-4" />
                      </button>
                  </div>
              </div>
          ))}

          {/* Pending Tasks */}
          {pendingTasks.map(task => (
              <div key={task.id} className="bg-white border border-blue-100 rounded-xl p-4 shadow-sm flex items-center justify-between hover:border-blue-200 transition-colors">
                  <div className="flex items-center">
                      <div className="p-2 bg-blue-50 rounded-lg mr-4">
                          <ClipboardList className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Task/Allocation</p>
                          <p className="text-sm font-bold text-gray-900">{task.title}</p>
                          <p className="text-xs text-gray-500">Assigned to {task.users?.full_name}</p>
                      </div>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={() => handleApproveTask(task)} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                          <Check className="h-4 w-4" />
                      </button>
                  </div>
              </div>
          ))}

          {/* Pending User Deletions (Admin Only) */}
          {isAdmin && pendingUsers.map(user => (
              <div key={user.id} className="bg-white border border-red-100 rounded-xl p-4 shadow-sm flex items-center justify-between hover:border-red-200 transition-colors">
                  <div className="flex items-center">
                      <div className="p-2 bg-red-50 rounded-lg mr-4">
                          <UserX className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Archive Request</p>
                          <p className="text-sm font-bold text-gray-900">{user.full_name}</p>
                          <p className="text-xs text-gray-500">HR Request</p>
                      </div>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={() => handleApproveUser(user)} className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                          <Check className="h-4 w-4" />
                      </button>
                  </div>
              </div>
          ))}
      </div>
    </div>
  );
};