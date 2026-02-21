import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, UserX, Banknote, Check, X, AlertCircle, ArrowRight, Clock } from 'lucide-react';
import { formatCurrency } from '@/utils/finance';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export const CEOOversight: React.FC = () => {
  const [pendingLoans, setPendingLoans] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOversightData();
    
    const channel = supabase.channel('oversight-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans', filter: 'status=eq.pending' }, () => fetchOversightData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchOversightData())
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

        setPendingLoans(loans || []);
        setPendingUsers(users || []);
    } finally {
        setLoading(false);
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

  if (loading && pendingLoans.length === 0 && pendingUsers.length === 0) return null;

  if (pendingLoans.length === 0 && pendingUsers.length === 0) return (
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
              {pendingLoans.length + pendingUsers.length} Pending Actions
          </span>
      </div>

      <div className="grid grid-cols-1 gap-4">
          {/* Pending Loans */}
          {pendingLoans.map(loan => (
              <div key={loan.id} className="bg-white border border-amber-100 rounded-xl p-4 shadow-sm flex items-center justify-between hover:border-amber-200 transition-colors">
                  <div className="flex items-center">
                      <div className="p-2 bg-amber-50 rounded-lg mr-4">
                          <Banknote className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Loan Approval Required</p>
                          <p className="text-sm font-bold text-gray-900">{loan.borrowers?.full_name}</p>
                          <p className="text-xs text-gray-500">{formatCurrency(loan.principal_amount)} • {loan.term_months} Months</p>
                      </div>
                  </div>
                  <Link 
                    to={`/loans/${loan.id}`}
                    className="flex items-center px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all"
                  >
                      Review <ArrowRight className="ml-1.5 h-3 w-3" />
                  </Link>
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
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Archive Request</p>
                          <p className="text-sm font-bold text-gray-900">{user.full_name}</p>
                          <p className="text-xs text-gray-500">Requested by HR Manager</p>
                      </div>
                  </div>
                  <div className="flex gap-2">
                      <button 
                        onClick={() => handleApproveUser(user.id)}
                        className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                        title="Confirm Archive"
                      >
                          <Check className="h-4 w-4" />
                      </button>
                      <Link 
                        to="/users"
                        className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                          <X className="h-4 w-4" />
                      </Link>
                  </div>
              </div>
          ))}
      </div>
    </div>
  );
};