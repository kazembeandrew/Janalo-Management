import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Clock, User, CheckCircle, AlertCircle, Banknote, UserPlus, ShieldAlert } from 'lucide-react';

interface Activity {
  id: string;
  action: string;
  created_at: string;
  users: { full_name: string } | null;
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
    try {
        // Fetch audit logs without join first
        const { data, error } = await supabase
          .from('audit_logs')
          .select('id, action, created_at, details, user_id')
          .order('created_at', { ascending: false })
          .limit(8);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            // Fetch user names separately
            const userIds = [...new Set(data.map(d => d.user_id).filter(Boolean))];
            let userMap: Record<string, { full_name: string }> = {};
            
            if (userIds.length > 0) {
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, full_name')
                    .in('id', userIds);
                
                if (usersData) {
                    usersData.forEach(u => {
                        userMap[u.id] = { full_name: u.full_name };
                    });
                }
            }
            
            // Map with user info
            const mappedData = data.map(a => ({
                ...a,
                users: a.user_id ? userMap[a.user_id] : null
            }));
            setActivities(mappedData as any);
        } else {
            setActivities([]);
        }
    } catch (e) {
        console.error("Error fetching activity:", e);
        // Fallback: try fetching without any fields
        const { data: fallbackData } = await supabase
            .from('audit_logs')
            .select('id, action, created_at, details')
            .order('created_at', { ascending: false })
            .limit(8);
        
        if (fallbackData) {
            setActivities(fallbackData.map(a => ({ ...a, users: null })));
        }
    } finally {
        setLoading(false);
    }
  };

  const getIcon = (action: string) => {
      const a = action.toLowerCase();
      if (a.includes('approve')) return <CheckCircle className="h-4 w-4 text-green-500" />;
      if (a.includes('reject') || a.includes('delete') || a.includes('revoke') || a.includes('reset')) return <AlertCircle className="h-4 w-4 text-red-500" />;
      if (a.includes('repayment') || a.includes('loan') || a.includes('disburse')) return <Banknote className="h-4 w-4 text-blue-500" />;
      if (a.includes('user') || a.includes('borrower') || a.includes('promote')) return <UserPlus className="h-4 w-4 text-indigo-500" />;
      if (a.includes('system')) return <ShieldAlert className="h-4 w-4 text-amber-500" />;
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
                                  <User className="h-3 w-3 mr-1" /> {activity.users?.full_name || 'System'} 
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