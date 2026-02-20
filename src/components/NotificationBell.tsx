import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Bell, Check, Trash2, ExternalLink, Clock, AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
  type: string;
}

export const NotificationBell: React.FC = () => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!profile) return;
    fetchNotifications();

    const channel = supabase
      .channel('realtime-notifications')
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`
      }, (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(c => c + 1);
          
          // Show toast with appropriate icon
          const icon = getNotificationIcon(newNotif.type);
          toast(newNotif.message, { icon: '🔔' });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15);
    
    if (!error && data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    if (!profile) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (!error) {
          setNotifications(prev => prev.filter(n => n.id !== id));
          const wasUnread = notifications.find(n => n.id === id)?.is_read === false;
          if (wasUnread) setUnreadCount(c => Math.max(0, c - 1));
      }
  };

  const getNotificationIcon = (type: string) => {
      switch (type) {
          case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
          case 'warning': return <AlertCircle className="h-4 w-4 text-amber-500" />;
          case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
          default: return <Info className="h-4 w-4 text-blue-500" />;
      }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-indigo-200 hover:text-white transition-all focus:outline-none active:scale-95"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-indigo-900 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl ring-1 ring-black ring-opacity-5 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
                <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">You have {unreadCount} unread updates</p>
              </div>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-indigo-600 hover:text-indigo-800 font-bold transition-colors">
                  Mark all read
                </button>
              )}
            </div>
            
            <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="bg-gray-50 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                    <Bell className="h-8 w-8 text-gray-200" />
                  </div>
                  <p className="text-sm text-gray-500 font-medium">All caught up!</p>
                  <p className="text-xs text-gray-400 mt-1">No new notifications to show.</p>
                </div>
              ) : (
                notifications.map(n => (
                  <div 
                    key={n.id} 
                    className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition-all relative group ${!n.is_read ? 'bg-indigo-50/30' : ''}`}
                  >
                    <div className="flex gap-3">
                        <div className="mt-1 flex-shrink-0">
                            {getNotificationIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-xs font-bold truncate pr-4 ${!n.is_read ? 'text-indigo-900' : 'text-gray-700'}`}>{n.title}</span>
                                <span className="text-[10px] text-gray-400 flex items-center whitespace-nowrap">
                                    <Clock className="h-2.5 w-2.5 mr-1" />
                                    {new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                </span>
                            </div>
                            <p className={`text-xs leading-relaxed ${!n.is_read ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
                                {n.message}
                            </p>
                            
                            <div className="mt-3 flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    {n.link && (
                                        <Link 
                                            to={n.link} 
                                            onClick={() => { markAsRead(n.id); setIsOpen(false); }}
                                            className="text-[10px] text-indigo-600 font-bold flex items-center hover:underline"
                                        >
                                            View Details <ExternalLink className="h-2.5 w-2.5 ml-1" />
                                        </Link>
                                    )}
                                    {!n.is_read && (
                                        <button 
                                            onClick={() => markAsRead(n.id)}
                                            className="text-[10px] text-gray-400 hover:text-indigo-600 font-bold flex items-center transition-colors"
                                        >
                                            <Check className="h-2.5 w-2.5 mr-1" /> Mark read
                                        </button>
                                    )}
                                </div>
                                <button 
                                    onClick={(e) => deleteNotification(e, n.id)}
                                    className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Delete"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-3 bg-gray-50 text-center border-t border-gray-100">
               <Link to="/messages" onClick={() => setIsOpen(false)} className="text-xs text-gray-500 hover:text-indigo-600 font-bold transition-colors">
                  Go to Inbox
               </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
};