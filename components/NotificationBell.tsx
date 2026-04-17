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
  CheckCheck,
  Plus
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { 
  Notification, 
  NotificationCategory, 
  NotificationPriority 
} from '@/types';

export type { Notification, NotificationCategory, NotificationPriority };

// ============================================================================
// TYPES
// ============================================================================

export interface NotificationAction {
  label: string;
  action: string;
  url?: string;
  primary?: boolean;
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
  general: { icon: Bell, color: 'text-gray-500', bgColor: 'bg-gray-50', label: 'General' },
  payroll: { icon: FileText, color: 'text-indigo-500', bgColor: 'bg-indigo-50', label: 'Payroll' }
};

const PRIORITY_CONFIG: Record<NotificationPriority, { color: string; bgColor: string; label: string; dot: string }> = {
  low: { color: 'text-gray-500', bgColor: 'bg-gray-100', label: 'Low', dot: 'bg-gray-400' },
  normal: { color: 'text-blue-500', bgColor: 'bg-blue-100', label: 'Normal', dot: 'bg-blue-400' },
  medium: { color: 'text-amber-500', bgColor: 'bg-amber-100', label: 'Medium', dot: 'bg-amber-400' },
  high: { color: 'text-orange-500', bgColor: 'bg-orange-100', label: 'High', dot: 'bg-orange-400' },
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
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'archived'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'category'>('date');
  const [viewMode, setViewMode] = useState<'comfortable' | 'compact'>('comfortable');
  const [lastAction, setLastAction] = useState<{type: 'archive' | 'delete', notification: Notification} | null>(null);
  const [undoTimer, setUndoTimer] = useState<NodeJS.Timeout | null>(null);

  // Fetch notifications - use 'any' to bypass recursive type issues from generated types
  const fetchNotifications = useCallback(async () => {
    if (!profile) return;
    setIsLoading(true);
    
    try {
      let query = (supabase as any)
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (activeTab === 'unread') {
        query = query.eq('is_read', false);
      } else if (activeTab === 'archived') {
        query = query.eq('is_archived', true);
      } else {
        query = query.eq('is_archived', false);
      }

      const { data, error } = await query;
      
      if (!error && data) {
        // Map the data to match expected interface (add missing fields with defaults)
        const mappedData = data.map((n: any) => ({
          ...n,
          priority: (n.priority || 'normal') as NotificationPriority,
          category: (n.category || 'general') as NotificationCategory,
          is_archived: n.is_archived || false,
          actions: n.actions || [],
          recipient_ids: [n.user_id],
          metadata: n.metadata || {}
        }));
        setNotifications((mappedData as unknown) as Notification[]);
      }
    } catch (e) {
      console.error('Error fetching notifications:', e);
    } finally {
      setIsLoading(false);
    }
  }, [profile, activeTab]);

  // Fetch counts
  const fetchCounts = useCallback(async () => {
    if (!profile) return;
    
    try {
      const { data, error } = await (supabase as any).rpc('get_notification_counts_detailed', {
        p_user_id: profile.id
      });
      
      if (!error && data) {
        setCounts((data as unknown) as NotificationCounts);
      } else {
        const { count } = await (supabase as any)
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('is_read', false)
          .eq('is_archived', false);
        
        setCounts({
          total_unread: count || 0,
          urgent_unread: 0,
          high_unread: 0,
          by_category: { system: 0, loan: 0, repayment: 0, expense: 0, task: 0, message: 0, security: 0, general: 0 } as any
        });
      }
    } catch (e) {
      console.error('Could not fetch notification counts:', e);
    }
  }, [profile]);

  // Initial fetch and realtime
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
        const newNotif = payload.new as any;
        const enhancedNotif: Notification = {
          id: newNotif.id,
          title: newNotif.title,
          message: newNotif.message,
          action_url: newNotif.action_url || null,
          is_read: newNotif.is_read || false,
          created_at: newNotif.created_at,
          type: newNotif.type || 'info', 
          priority: newNotif.priority || 'normal',
          category: newNotif.category || 'general',
          metadata: newNotif.metadata || {},
          status: newNotif.status || 'unread',
          recipient_ids: [profile.id],
          updated_at: newNotif.updated_at || newNotif.created_at,
          is_archived: newNotif.is_archived || false
        } as unknown as Notification;
        
        setNotifications(prev => [enhancedNotif, ...prev]);
        setCounts(prev => ({
          ...prev,
          total_unread: prev.total_unread + 1
        }));
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`
      }, (payload) => {
        const updatedNotif = payload.new as any;
        setNotifications(prev => 
          prev.map(n => n.id === updatedNotif.id ? ({
            ...n,
            ...updatedNotif,
            recipient_ids: [profile.id]
          } as unknown as Notification) : n)
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

  // Dropdown close logic
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key.toLowerCase()) {
        case 'r':
          if (e.shiftKey) {
            e.preventDefault();
            // markAllRead will be called via closure
          }
          break;
        case 'escape':
          setIsOpen(false);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Actions
  const markAsRead = async (id: string) => {
    const { error } = await (supabase as any).rpc('mark_notification_read', {
      p_notification_id: id,
      p_user_id: profile?.id
    });
    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n));
      fetchCounts();
    } else {
      await (supabase as any).from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n));
      fetchCounts();
    }
  };

  const markAllRead = async () => {
    if (!profile) return;
    const { error } = await (supabase as any).from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', profile.id).eq('is_read', false);
    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
      fetchCounts();
      toast.success('All notifications marked as read');
    }
  };

  const archiveNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const notification = notifications.find(n => n.id === id);
    if (!notification) return;

    // Optimistic update
    setNotifications(prev => prev.filter(n => n.id !== id));
    
    const { error } = await (supabase as any).rpc('archive_notification', {
      p_notification_id: id,
      p_user_id: profile?.id
    });
    
    if (!error) {
      fetchCounts();
      // Show undo toast
      setLastAction({ type: 'archive', notification });
      if (undoTimer) clearTimeout(undoTimer);
      const timer = setTimeout(() => {
        setLastAction(null);
      }, 5000);
      setUndoTimer(timer);
      toast.success(
        <div className="flex items-center justify-between gap-4">
          <span>Notification archived</span>
          <button 
            onClick={() => {
              (supabase as any).from('notifications').update({ is_archived: false }).eq('id', id);
              setNotifications(prev => [notification, ...prev]);
              setLastAction(null);
              if (timer) clearTimeout(timer);
            }}
            className="text-white underline font-bold hover:no-underline"
          >
            Undo
          </button>
        </div>,
        { duration: 5000 }
      );
    } else {
      // Revert on error
      setNotifications(prev => [notification, ...prev]);
      toast.error('Failed to archive notification');
    }
  };

  const deleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const notification = notifications.find(n => n.id === id);
    if (!notification) return;

    // Optimistic update
    setNotifications(prev => prev.filter(n => n.id !== id));
    
    const { error } = await (supabase as any).from('notifications').delete().eq('id', id);
    
    if (!error) {
      fetchCounts();
      // Show undo toast
      setLastAction({ type: 'delete', notification });
      if (undoTimer) clearTimeout(undoTimer);
      const timer = setTimeout(() => {
        setLastAction(null);
      }, 5000);
      setUndoTimer(timer);
      toast.success(
        <div className="flex items-center justify-between gap-4">
          <span>Notification deleted</span>
          <button 
            onClick={async () => {
              await (supabase as any).from('notifications').insert({
                ...notification,
                id: undefined,
                created_at: new Date().toISOString()
              });
              fetchNotifications();
              setLastAction(null);
              if (timer) clearTimeout(timer);
            }}
            className="text-white underline font-bold hover:no-underline"
          >
            Undo
          </button>
        </div>,
        { duration: 5000 }
      );
    } else {
      // Revert on error
      setNotifications(prev => [notification, ...prev]);
      toast.error('Failed to delete notification');
    }
  };

  const handleAction = async (notification: Notification, action: NotificationAction) => {
    await markAsRead(notification.id);
    if (action.url) {
      navigate(action.url);
      setIsOpen(false);
    }
  };

  const getNotificationIcon = (notification: Notification) => {
    const CategoryIcon = CATEGORY_CONFIG[notification.category]?.icon || Bell;
    const categoryConfig = CATEGORY_CONFIG[notification.category];
    if (notification.priority === 'urgent') return <AlertTriangle className="h-5 w-5 text-red-500" />;
    return (
      <div className={`p-2 rounded-lg ${categoryConfig?.bgColor || 'bg-gray-50'}`}>
        <CategoryIcon className={`h-4 w-4 ${categoryConfig?.color || 'text-gray-500'}`} />
      </div>
    );
  };

  // Date grouping utility
  const groupNotificationsByDate = (notifications: Notification[]): Array<[string, Notification[]]> => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groups: Record<string, Notification[]> = {
      'Today': [],
      'Yesterday': [],
      'This Week': [],
      'Older': []
    };

    notifications.forEach(notification => {
      const notifDate = new Date(notification.created_at);
      if (notifDate >= today) {
        groups['Today'].push(notification);
      } else if (notifDate >= yesterday) {
        groups['Yesterday'].push(notification);
      } else if (notifDate >= weekAgo) {
        groups['This Week'].push(notification);
      } else {
        groups['Older'].push(notification);
      }
    });

    return Object.entries(groups).filter(([_, items]) => items.length > 0) as Array<[string, Notification[]]>;
  };

  // Sort notifications
  const sortNotifications = (notifications: Notification[]) => {
    const sorted = [...notifications];
    switch (sortBy) {
      case 'priority':
        const priorityOrder = { urgent: 5, high: 4, medium: 3, normal: 2, low: 1 };
        sorted.sort((a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0));
        break;
      case 'category':
        sorted.sort((a, b) => a.category.localeCompare(b.category));
        break;
      case 'date':
      default:
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return sorted;
  };

  const filteredNotifications = sortNotifications(
    notifications.filter(n => filter === 'all' || n.category === filter)
  );
  const groupedNotifications = viewMode === 'comfortable' ? groupNotificationsByDate(filteredNotifications) : [['All', filteredNotifications] as const];
  const totalUnread = counts.total_unread;
  const hasUrgent = counts.urgent_unread > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors focus:outline-none active:scale-95"
      >
        <Bell className="h-5 w-5" />
        {totalUnread > 0 && (
          <span className={`absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-indigo-900 ${hasUrgent ? 'bg-red-500 animate-pulse' : 'bg-red-500'}`}>
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="fixed left-4 right-4 top-[4.5rem] sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-[420px] bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white space-y-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-indigo-100 rounded-xl"><Bell className="h-5 w-5 text-indigo-600" /></div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
                    <p className="text-[10px] text-gray-500 font-medium">
                      {totalUnread > 0 ? <span className={hasUrgent ? 'text-red-500 font-bold' : ''}>{totalUnread} unread</span> : 'All caught up!'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  {totalUnread > 0 && <button onClick={markAllRead} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Mark all as read (Shift+R)"><CheckCheck className="h-4 w-4" /></button>}
                  <button 
                    onClick={() => {
                      const mock: Notification = {
                        id: 'mock-' + Date.now(),
                        title: 'New Payslip Available',
                        message: 'Your payslip for April 2024 has been generated and is ready for viewing.',
                        type: 'info',
                        category: 'payroll',
                        priority: 'high',
                        action_url: '/storage/v1/object/sign/payslips/test.pdf', // Example internal URL
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        is_read: false,
                        is_archived: false,
                        recipient_ids: [profile?.id || ''],
                        status: 'sent',
                        metadata: {},
                        actions: [
                          { label: 'View PDF', action: 'view', url: 'https://example.com/payslip.pdf', primary: true }
                        ]
                      };
                      setNotifications(prev => [mock, ...prev]);
                      toast.success('Mock payslip notification added');
                    }}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    title="Simulate Payslip (Debug)"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <Link to="/notifications" onClick={() => setIsOpen(false)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Settings"><Settings className="h-4 w-4" /></Link>
                </div>
              </div>

              {/* Sort and View Controls */}
              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold focus:ring-2 focus:ring-indigo-500"
                  aria-label="Sort notifications"
                >
                  <option value="date">Sort by Date</option>
                  <option value="priority">Sort by Priority</option>
                  <option value="category">Sort by Category</option>
                </select>
                <button
                  onClick={() => setViewMode(viewMode === 'comfortable' ? 'compact' : 'comfortable')}
                  className="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold hover:bg-gray-50 transition-all"
                  title={`Switch to ${viewMode === 'comfortable' ? 'compact' : 'comfortable'} view`}
                >
                  {viewMode === 'comfortable' ? '☰ Compact' : '☷ Comfortable'}
                </button>
              </div>

              <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl">
                {(['all', 'unread', 'archived'] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    {tab === 'all' ? <span className="flex items-center justify-center gap-1"><Inbox className="h-3 w-3" /> All</span> : tab === 'unread' ? <span className="flex items-center justify-center gap-1"><Bell className="h-3 w-3" /> Unread</span> : <span className="flex items-center justify-center gap-1"><ArchiveIcon className="h-3 w-3" /> Archived</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[calc(100vh-18rem)] sm:max-h-[450px] overflow-y-auto">
              {isLoading ? (
                <div className="p-12 text-center"><div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" /><p className="text-xs text-gray-400 font-medium">Loading notifications...</p></div>
              ) : filteredNotifications.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-4 shadow-inner">
                    {activeTab === 'archived' ? <ArchiveIcon className="h-10 w-10 text-gray-300" /> :
                     activeTab === 'unread' ? <CheckCheck className="h-10 w-10 text-gray-300" /> :
                     <Bell className="h-10 w-10 text-gray-300" />}
                  </div>
                  <p className="text-sm font-bold text-gray-700 mb-1">
                    {activeTab === 'archived' ? 'No archived notifications'
                     : activeTab === 'unread' ? 'All caught up!'
                     : 'No notifications yet'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {activeTab === 'archived' ? 'Archived items will appear here'
                     : activeTab === 'unread' ? 'You\'ve read all your notifications'
                     : 'New notifications will show up here'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {groupedNotifications.map(([groupName, groupNotifs]) => (
                    <React.Fragment key={groupName}>
                      {viewMode === 'comfortable' && groupedNotifications.length > 1 && (
                        <div className="px-4 py-2 bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{groupName}</p>
                        </div>
                      )}
                      {groupNotifs.map((notification) => {
                        const priorityConfig = PRIORITY_CONFIG[notification.priority];
                        const isUnread = !notification.is_read;
                        const cardPadding = viewMode === 'compact' ? 'p-3' : 'p-4';
                        return (
                          <div key={notification.id} className={`${cardPadding} hover:bg-gray-50 transition-all group relative ${isUnread ? 'bg-indigo-50/30' : ''} ${notification.priority === 'urgent' ? 'border-l-4 border-l-red-500' : ''}`}>
                            <div className="flex gap-3">
                              <div className="flex-shrink-0 mt-0.5">{getNotificationIcon(notification)}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-xs font-bold truncate max-w-[150px] ${isUnread ? 'text-gray-900' : 'text-gray-600'}`}>{notification.title}</span>
                                    {notification.priority !== 'normal' && <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${priorityConfig.bgColor} ${priorityConfig.color}`}>{priorityConfig.label}</span>}
                                  </div>
                                  <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">{formatDistanceToNow(new Date(notification.created_at))}</span>
                                </div>
                                <p className={`text-xs leading-relaxed ${isUnread ? 'text-gray-700 font-medium' : 'text-gray-500'} ${viewMode === 'compact' ? 'line-clamp-2' : ''}`}>{notification.message}</p>
                                {viewMode === 'comfortable' && (
                                  <div className="mt-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {(notification as any).actions?.slice(0, 2).map((action: any, idx: number) => (
                                        <button key={idx} onClick={() => handleAction(notification, action)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${action.primary ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'}`}>{action.label}{action.url && <ExternalLink className="h-2.5 w-2.5" />}</button>
                                      ))}
                                      {isUnread && !(notification as any).actions?.length && <button onClick={() => markAsRead(notification.id)} className="text-[10px] text-gray-400 hover:text-indigo-600 font-medium flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-all"><Check className="h-3 w-3" /> Mark read</button>}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {!notification.is_archived && <button onClick={(e) => archiveNotification(e, notification.id)} className="p-1.5 text-gray-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all" title="Archive (A)"><Archive className="h-3.5 w-3.5" /></button>}
                                      <button onClick={(e) => deleteNotification(e, notification.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete (D)"><Trash2 className="h-3.5 w-3.5" /></button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              {isUnread && <div className={`flex-shrink-0 mt-2 h-2 w-2 rounded-full ${priorityConfig.dot}`} />}
                            </div>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
            <div className="p-3 bg-gray-50 border-t border-gray-100"><Link to="/notifications" onClick={() => setIsOpen(false)} className="text-xs text-gray-500 hover:text-indigo-600 font-bold transition-colors flex items-center gap-1">View Notification Center<ChevronRight className="h-3 w-3" /></Link></div>
          </div>
        </>
      )}
    </div>
  );
};
