import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, UserX, Banknote, Check, X, AlertCircle, ArrowRight, Receipt, ClipboardList, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/utils/finance';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export const CEOOversight: React.FC = () => {
  const [pendingLoans, setPendingLoans] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [pendingExpenses, setPendingExpenses] = useState<any[]>([]);
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOversightData();
    
    const channel = supabase.channel('oversight-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => fetchOversightData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchOversightData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => fetchOversightData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchOversightData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchOversightData = async () => {
    setLoading(true);
    try {
        const { data: loans } = await supabase
            .from('loans')
            .select('*, borrowers(full_name)')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        
        const { data: users } = await supabase
            .from('users')
            .select('*')
            .eq('deletion_status', 'pending_approval');

        const { data: expenses } = await supabase
            .from('expenses')
            .select('*, users(full_name)')
            .eq('status', 'pending_approval')
            .order('created_at', { ascending: false });

        const { data: tasks } = await supabase
            .from('tasks')
            .select('*, users(full_name)')
            .eq('status', 'pending_approval')
            .order('created_at', { ascending: false });

        setPendingLoans(loans || []);
        setPendingUsers(users || []);
        setPendingExpenses(expenses || []);
        setPendingTasks(tasks || []);
    } finally {
        setLoading(false);
    }
  };

  const handleApproveExpense = async (id: string) => {
      const { error } = await supabase.from('expenses').update({ status: 'approved' }).eq('id', id);
      if (!error) {
          toast.success("Expense authorized");
          fetchOversightData();
      }
  };

  const handleApproveTask = async (id: string) => {
      const { error } = await supabase.from('tasks').update({ status: 'approved' }).eq('id', id);
      if (!error) {
          toast.success("Task/Allocation authorized");
          fetchOversightData();
      }
  };

  const handleApproveUser = async (userId: string) => {
      const { error } = await supabase
        .from('users')
        .update({ 
            is_active: false, 
            deletion_status: 'approved',
            revocation_reason: 'Archiving approved by CEO'
        })
        .eq('id', userId);
      
      if (!error) {
          toast.success("User archive confirmed");
          fetchOversightData();
      }
  };

  const totalPending = pendingLoans.length + pendingUsers.length + pendingExpenses.length + pendingTasks.length;

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
              CEO Oversight Queue
          </h3>
          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full uppercase">
              {totalPending} Pending Actions
          </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <button onClick={() => handleApproveExpense(exp.id)} className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                          <Check className="h-4 w-4" />
                      </button>
                  </div>
              </div>
          ))}

          {/* Pending Tasks / Allocations */}
          {pendingTasks.map(task => (
              <div key={task.id} className="bg-white border border-blue-100 rounded-xl p-4 shadow-sm flex items-center justify-between hover:border-blue-200 transition-colors">
                  <div className="flex items-center">
                      <div className="p-2 bg-blue-50 rounded-lg mr-4">
                          <ClipboardList className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Task/Allocation</p>
                          <p className="text-sm font-bold text-gray-900">{task.title}</p>
                          <p className="text-xs text-gray-500">Proposed by {task.users?.full_name}</p>
                      </div>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={() => handleApproveTask(task.id)} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                          <Check className="h-4 w-4" />
                      </button>
                  </div>
              </div>
          ))}

          {/* Pending User Deletions */}
          {pendingUsers.map(user => (
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
                      <button onClick={() => handleApproveUser(user.id)} className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                          <Check className="h-4 w-4" />
                      </button>
                  </div>
              </div>
          ))}
      </div>
    </div>
  );
};