import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Clock, User, CheckCircle, AlertCircle, Banknote, UserPlus } from 'lucide-react';

interface Activity {
  id: string;
  action: string;
  created_at: string;
  users: { full_name: string };
  details: any;
}

export const RecentActivity: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivity();
    
    const channel = supabase
      .channel('audit-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, () => {
          fetchActivity();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchActivity = async () => {
    const { data } = await supabase
      .from('audit_logs')
      .select('id, action, created_at, details, users(full_name)')
      .order('created_at', { ascending: false })
      .limit(6);
    
    if (data) setActivities(data as any);
    setLoading(false);
  };

  const getIcon = (action: string) => {
      if (action.includes('Approve')) return <CheckCircle className="h-4 w-4 text-green-500" />;
      if (action.includes('Reject') || action.includes('Delete')) return <AlertCircle className="h-4 w-4 text-red-500" />;
      if (action.includes('Repayment') || action.includes('Loan')) return <Banknote className="h-4 w-4 text-blue-500" />;
      if (action.includes('User') || action.includes('Borrower')) return <UserPlus className="h-4 w-4 text-indigo-500" />;
      return <Clock className="h-4 w-4 text-gray-400" />;
  };

  if (loading) return <div className="p-4 text-center text-sm text-gray-500">Loading activity...</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
          <h3 className="font-bold text-gray-900 flex items-center">
              <Clock className="h-4 w-4 mr-2 text-indigo-600" />
              Recent System Activity
          </h3>
      </div>
      <div className="divide-y divide-gray-50">
          {activities.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm italic">No recent activity logged.</div>
          ) : (
              activities.map((activity) => (
                  <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start">
                          <div className="mt-0.5 mr-3">{getIcon(activity.action)}</div>
                          <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                  {activity.action}
                              </p>
                              <p className="text-xs text-gray-500 flex items-center mt-0.5">
                                  <User className="h-3 w-3 mr-1" /> {activity.users?.full_name} 
                                  <span className="mx-1.5">•</span>
                                  {new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                          </div>
                      </div>
                  </div>
              ))
          )}
      </div>
    </div>
  );
};