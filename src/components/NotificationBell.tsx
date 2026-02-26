import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { 
  Bell, 
  Check, 
  Trash2, 
  ExternalLink, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Info, 
  X,
  Settings,
  Archive,
  Filter,
  ChevronRight,
  MoreHorizontal,
  Pin,
  AlertTriangle,
  MessageSquare,
  DollarSign,
  FileText,
  Shield,
  User,
  Inbox,
  Archive as ArchiveIcon,
  CheckCheck
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

// ============================================================================
// TYPES
// ============================================================================

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationCategory = 'system' | 'loan' | 'repayment' | 'expense' | 'task' | 'message' | 'security' | 'general';

export interface NotificationAction {
  label: string;
  action: string;
  url?: string;
  primary?: boolean;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  type: 'success' | 'warning' | 'error' | 'info';
  priority: NotificationPriority;
  category: NotificationCategory;
  actions: NotificationAction[];
  is_archived: boolean;
  expires_at: string | null;
  sender_id: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
}

export interface NotificationCounts {
  total_unread: number;
  urgent_unread: number;
  high_unread: number;
  by_category: Record<NotificationCategory, number>;
}

// ============================================================================
// CATEGORY CONFIGURATION
// ============================================================================

const CATEGORY_CONFIG: Record<NotificationCategory, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  system: { icon: Info, color: 'text-blue-500', bgColor: 'bg-blue-50', label: 'System' },
  loan: { icon: DollarSign, color: 'text-green-500', bgColor: 'bg-green-50', label: 'Loan' },
  repayment: { icon: CheckCircle, color: 'text-emerald-500', bgColor: 'bg-emerald-50', label: 'Repayment' },
  expense: { icon: FileText, color: 'text-amber-500', bgColor: 'bg-amber-50', label: 'Expense' },
  task: { icon: Check, color: 'text-purple-500', bgColor: 'bg-purple-50', label: 'Task' },
  message: { icon: MessageSquare, color: 'text-indigo-500', bgColor: 'bg-indigo-50', label: 'Message' },
  security: { icon: Shield, color: 'text-red-500', bgColor: 'bg-red-50', label: 'Security' },
  general: { icon: Bell, color: 'text-gray-500', bgColor: 'bg-gray-50', label: 'General' }
};

const PRIORITY_CONFIG: Record<NotificationPriority, { color: string; bgColor: string; label: string; dot: string }> = {
  low: { color: 'text-gray-500', bgColor: 'bg-gray-100', label: 'Low', dot: 'bg-gray-400' },
  normal: { color: 'text-blue-500', bgColor: 'bg-blue-100', label: 'Normal', dot: 'bg-blue-400' },
  high: { color: 'text-amber-500', bgColor: 'bg-amber-100', label: 'High', dot: 'bg-amber-400' },
  urgent: { color: 'text-red-500', bgColor: 'bg-red-100', label: 'Urgent', dot: 'bg-red-500 animate-pulse' }
};

// ============================================================================
// DATE UTILITY
// ============================================================================

const formatDistanceToNow = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.round(diffMs / 1000);
  const diffMins = Math.round(diffSecs / 60);
  const diffHours = Math.round(diffMins / 60);
  const diffDays = Math.round(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

// ============================================================================
// COMPONENT
// ============================================================================

export const NotificationBell: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [counts, setCounts] = useState<NotificationCounts>({
    total_unread: 0,
    urgent_unread: 0,
    high_unread: 0,
    by_category: {} as Record<NotificationCategory, number>
  });
  const [filter, setFilter] = useState<NotificationCategory | 'all'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'archived'>('all');

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!profile) return;
    setIsLoading(true);
    
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .eq('is_archived', showArchived)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter !== 'all') {
        query = query.eq('category', filter);
      }

      if (activeTab === 'unread') {
        query = query.eq('is_read', false);
      }

      const { data, error } = await query;
      
      if (!error && data) {
        setNotifications(data as Notification[]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [profile, filter, showArchived, activeTab]);

  // Fetch counts
  const fetchCounts = useCallback(async () => {
    if (!profile) return;
    
    const { data, error } = await supabase.rpc('get_notification_counts_detailed', {
      p_user_id: profile.id
    });
    
    if (!error && data) {
      setCounts(data as NotificationCounts);
    }
  }, [profile]);

  // Initial fetch and realtime subscription
  useEffect(() => {
    if (!profile) return;
    
    fetchNotifications();
    fetchCounts();

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
        setCounts(prev => ({
          ...prev,
          total_unread: prev.total_unread + 1,
          urgent_unread: newNotif.priority === 'urgent' ? prev.urgent_unread + 1 : prev.urgent_unread,
          high_unread: newNotif.priority === 'high' ? prev.high_unread + 1 : prev.high_unread,
          by_category: {
            ...prev.by_category,
            [newNotif.category]: (prev.by_category[newNotif.category] || 0) + 1
          }
        }));
        
        if (newNotif.priority === 'high' || newNotif.priority === 'urgent') {
          toast(newNotif.message, { 
            icon: newNotif.priority === 'urgent' ? '🔴' : '⚠️',
            duration: 5000
          });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`
      }, (payload) => {
        const updatedNotif = payload.new as Notification;
        setNotifications(prev => 
          prev.map(n => n.id === updatedNotif.id ? updatedNotif : n)
        );
        fetchCounts();
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`
      }, (payload) => {
        setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
        fetchCounts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, fetchCounts, fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Mark single notification as read
  const markAsRead = async (id: string) => {
    const { error } = await supabase.rpc('mark_notification_read', {
      p_notification_id: id,
      p_user_id: profile?.id
    });
    
    if (!error) {
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
      fetchCounts();
    }
  };

  // Mark all notifications as read
  const markAllRead = async () => {
    if (!profile) return;
    
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', profile.id)
      .eq('is_read', false);
    
    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
      fetchCounts();
      toast.success('All notifications marked as read');
    }
  };

  // Archive notification
  const archiveNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const { error } = await supabase.rpc('archive_notification', {
      p_notification_id: id,
      p_user_id: profile?.id
    });
    
    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== id));
      fetchCounts();
      toast.success('Notification archived');
    }
  };

  // Delete notification
  const deleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    
    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== id));
      fetchCounts();
    }
  };

  // Handle action click
  const handleAction = async (notification: Notification, action: NotificationAction) => {
    await markAsRead(notification.id);
    
    if (action.url) {
      navigate(action.url);
      setIsOpen(false);
    }
  };

  // Get notification icon
  const getNotificationIcon = (notification: Notification) => {
    const CategoryIcon = CATEGORY_CONFIG[notification.category]?.icon || Bell;
    const categoryConfig = CATEGORY_CONFIG[notification.category];
    
    if (notification.priority === 'urgent') {
      return <AlertTriangle className="h-5 w-5 text-red-500" />;
    }
    
    return (
      <div className={`p-2 rounded-lg ${categoryConfig?.bgColor || 'bg-gray-50'}`}>
        <CategoryIcon className={`h-4 w-4 ${categoryConfig?.color || 'text-gray-500'}`} />
      </div>
    );
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'unread') return !n.is_read;
    if (activeTab === 'archived') return n.is_archived;
    return true;
  });

  const totalUnread = counts.total_unread;
  const hasUrgent = counts.urgent_unread > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-indigo-200 hover:text-white transition-all focus:outline-none active:scale-95 rounded-lg hover:bg-indigo-800/50"
      >
        <Bell className="h-6 w-6" />
        
        {totalUnread > 0 && (
          <span className={`absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-indigo-900 ${
            hasUrgent ? 'bg-red-500 animate-pulse' : 'bg-red-500'
          }`}>
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
        
        {hasUrgent && totalUnread === 0 && (
          <span className="absolute top-1 right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse ring-2 ring-indigo-900" />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" 
            onClick={() => setIsOpen(false)} 
          />
          
          <div className="absolute right-0 mt-3 w-[420px] bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
            
            {/* Header */}
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-indigo-100 rounded-xl">
                    <Bell className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
                    <p className="text-[10px] text-gray-500 font-medium">
                      {totalUnread > 0 ? (
                        <span className={hasUrgent ? 'text-red-500 font-bold' : ''}>
                          {totalUnread} unread{hasUrgent && ` (${counts.urgent_unread} urgent)`}
                        </span>
                      ) : 'All caught up!'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-1">
                  {totalUnread > 0 && (
                    <button 
                      onClick={markAllRead}
                      className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      title="Mark all as read"
                    >
                      <CheckCheck className="h-4 w-4" />
                    </button>
                  )}
                  <Link 
                    to="/notifications"
                    onClick={() => setIsOpen(false)}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    title="Notification Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl">
                {(['all', 'unread', 'archived'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                      activeTab === tab 
                        ? 'bg-white text-indigo-600 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab === 'all' && (
                      <span className="flex items-center justify-center gap-1">
                        <Inbox className="h-3 w-3" /> All
                      </span>
                    )}
                    {tab === 'unread' && (
                      <span className="flex items-center justify-center gap-1">
                        <Bell className="h-3 w-3" /> 
                        Unread{totalUnread > 0 && <span className="ml-1 text-red-500">({totalUnread})</span>}
                      </span>
                    )}
                    {tab === 'archived' && (
                      <span className="flex items-center justify-center gap-1">
                        <ArchiveIcon className="h-3 w-3" /> Archived
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Category Filters */}
              {activeTab === 'all' && (
                <div className="flex items-center space-x-1 mt-3 overflow-x-auto pb-1 scrollbar-hide">
                  <button
                    onClick={() => setFilter('all')}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                      filter === 'all' 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    All Types
                  </button>
                  {(Object.keys(CATEGORY_CONFIG) as NotificationCategory[]).map((cat) => {
                    const count = counts.by_category[cat] || 0;
                    if (count === 0 && filter !== cat) return null;
                    
                    const config = CATEGORY_CONFIG[cat];
                    return (
                      <button
                        key={cat}
                        onClick={() => setFilter(filter === cat ? 'all' : cat)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center space-x-1 ${
                          filter === cat 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <config.icon className="h-3 w-3" />
                        <span>{config.label}</span>
                        {count > 0 && <span className="ml-1 opacity-75">({count})</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Notification List */}
            <div className="max-h-[450px] overflow-y-auto">
              {isLoading ? (
                <div className="p-12 text-center">
                  <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
                  <p className="text-xs text-gray-400 font-medium">Loading notifications...</p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-4 shadow-inner">
                    {activeTab === 'archived' ? (
                      <ArchiveIcon className="h-10 w-10 text-gray-300" />
                    ) : activeTab === 'unread' ? (
                      <CheckCheck className="h-10 w-10 text-gray-300" />
                    ) : (
                      <Bell className="h-10 w-10 text-gray-300" />
                    )}
                  </div>
                  <p className="text-sm font-bold text-gray-700">
                    {activeTab === 'archived' ? 'No archived notifications' : 
                     activeTab === 'unread' ? 'No unread notifications' : 
                     'All caught up!'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {activeTab === 'archived' ? 'Archived notifications will appear here' :
                     activeTab === 'unread' ? 'You have read all your notifications' :
                     filter !== 'all' ? `No ${CATEGORY_CONFIG[filter]?.label} notifications` :
                     'No new notifications to show'}
                  </p>
                  {filter !== 'all' && (
                    <button
                      onClick={() => setFilter('all')}
                      className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filteredNotifications.map((notification) => {
                    const priorityConfig = PRIORITY_CONFIG[notification.priority];
                    const isUnread = !notification.is_read;
                    
                    return (
                      <div 
                        key={notification.id}
                        className={`p-4 hover:bg-gray-50 transition-all group relative ${
                          isUnread ? 'bg-indigo-50/30' : ''
                        } ${notification.priority === 'urgent' ? 'border-l-4 border-l-red-500' : ''}`}
                      >
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {getNotificationIcon(notification)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-bold truncate max-w-[150px] ${
                                  isUnread ? 'text-gray-900' : 'text-gray-600'
                                }`}>
                                  {notification.title}
                                </span>
                                
                                {notification.priority !== 'normal' && (
                                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${priorityConfig.bgColor} ${priorityConfig.color}`}>
                                    {priorityConfig.label}
                                  </span>
                                )}
                              </div>
                              
                              <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                                {formatDistanceToNow(new Date(notification.created_at))}
                              </span>
                            </div>
                            
                            <p className={`text-xs leading-relaxed ${
                              isUnread ? 'text-gray-700 font-medium' : 'text-gray-500'
                            }`}>
                              {notification.message}
                            </p>
                            
                            <div className="mt-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {notification.actions?.slice(0, 2).map((action, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => handleAction(notification, action)}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
                                      action.primary 
                                        ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                                        : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
                                    }`}
                                  >
                                    {action.label}
                                    {action.url && <ExternalLink className="h-2.5 w-2.5" />}
                                  </button>
                                ))}
                                
                                {isUnread && !notification.actions?.length && (
                                  <button
                                    onClick={() => markAsRead(notification.id)}
                                    className="text-[10px] text-gray-400 hover:text-indigo-600 font-medium flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-all"
                                  >
                                    <Check className="h-3 w-3" /> Mark read
                                  </button>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!notification.is_archived && (
                                  <button
                                    onClick={(e) => archiveNotification(e, notification.id)}
                                    className="p-1.5 text-gray-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all"
                                    title="Archive"
                                  >
                                    <Archive className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => deleteNotification(e, notification.id)}
                                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                          
                          {isUnread && (
                            <div className={`flex-shrink-0 mt-2 h-2 w-2 rounded-full ${priorityConfig.dot}`} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-3 bg-gray-50 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <Link 
                  to="/notifications"
                  onClick={() => setIsOpen(false)}
                  className="text-xs text-gray-500 hover:text-indigo-600 font-bold transition-colors flex items-center gap-1"
                >
                  View Notification Center
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};