import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  Bell, 
  Check, 
  Trash2, 
  Archive, 
  Settings, 
  Filter,
  ChevronLeft,
  CheckCheck,
  Inbox,
  AlertTriangle,
  Shield,
  DollarSign,
  FileText,
  CheckCircle,
  MessageSquare,
  Info,
  Search,
  MoreVertical,
  RefreshCw,
  Calendar,
  Clock,
  ArrowRight
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { Notification, NotificationCategory, NotificationPriority, NotificationCounts } from '@/components/NotificationBell';
import { archiveNotification, markNotificationAsRead, deleteNotification } from '@/utils/notifications';

// ============================================================================
// CATEGORY CONFIGURATION
// ============================================================================

const CATEGORY_CONFIG: Record<NotificationCategory, { icon: React.ElementType; color: string; bgColor: string; borderColor: string; label: string }> = {
  system: { icon: Info, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', label: 'System' },
  loan: { icon: DollarSign, color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200', label: 'Loans' },
  repayment: { icon: CheckCircle, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', label: 'Repayments' },
  expense: { icon: FileText, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', label: 'Expenses' },
  task: { icon: Check, color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', label: 'Tasks' },
  message: { icon: MessageSquare, color: 'text-indigo-600', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200', label: 'Messages' },
  security: { icon: Shield, color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200', label: 'Security' },
  general: { icon: Bell, color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200', label: 'General' }
};

const PRIORITY_CONFIG: Record<NotificationPriority, { color: string; bgColor: string; label: string; borderColor: string }> = {
  low: { color: 'text-gray-600', bgColor: 'bg-gray-100', borderColor: 'border-gray-200', label: 'Low' },
  normal: { color: 'text-blue-600', bgColor: 'bg-blue-100', borderColor: 'border-blue-200', label: 'Normal' },
  high: { color: 'text-amber-600', bgColor: 'bg-amber-100', borderColor: 'border-amber-200', label: 'High' },
  urgent: { color: 'text-red-600', bgColor: 'bg-red-100', borderColor: 'border-red-200', label: 'Urgent' }
};

// ============================================================================
// DATE UTILITY
// ============================================================================

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays === 1) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'long', hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

export const NotificationsPage: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  // State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [counts, setCounts] = useState<NotificationCounts>({
    total_unread: 0,
    urgent_unread: 0,
    high_unread: 0,
    by_category: {} as Record<NotificationCategory, number>
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'archived'>('all');
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<NotificationPriority | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const perPage = 20;

  // Fetch notifications
  const fetchNotifications = useCallback(async (reset = false) => {
    if (!profile) return;
    
    if (reset) {
      setPage(1);
      setNotifications([]);
    }
    
    setIsLoading(true);
    
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .eq('is_archived', activeTab === 'archived')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .range((page - 1) * perPage, page * perPage - 1);

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }

      if (activeTab === 'unread') {
        query = query.eq('is_read', false);
      }

      const { data, error } = await query;
      
      if (!error && data) {
        const newNotifications = data as Notification[];
        if (reset) {
          setNotifications(newNotifications);
        } else {
          setNotifications(prev => [...prev, ...newNotifications]);
        }
        setHasMore(newNotifications.length === perPage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [profile, activeTab, categoryFilter, priorityFilter, page]);

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

  // Apply filters
  useEffect(() => {
    let filtered = notifications;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(n => 
        n.title.toLowerCase().includes(query) || 
        n.message.toLowerCase().includes(query)
      );
    }
    
    setFilteredNotifications(filtered);
  }, [notifications, searchQuery]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications(true);
    fetchCounts();
  }, [fetchNotifications, fetchCounts, activeTab, categoryFilter, priorityFilter]);

  // Mark as read
  const handleMarkAsRead = async (id: string) => {
    const success = await markNotificationAsRead(id);
    if (success) {
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
      fetchCounts();
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
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

  // Archive
  const handleArchive = async (id: string) => {
    const success = await archiveNotification(id);
    if (success) {
      setNotifications(prev => prev.filter(n => n.id !== id));
      fetchCounts();
      toast.success('Notification archived');
    }
  };

  // Delete
  const handleDelete = async (id: string) => {
    const success = await deleteNotification(id);
    if (success) {
      setNotifications(prev => prev.filter(n => n.id !== id));
      fetchCounts();
    }
  };

  // Bulk actions
  const handleBulkMarkAsRead = async () => {
    if (selectedNotifications.length === 0) return;
    
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', selectedNotifications);
    
    if (!error) {
      setNotifications(prev => 
        prev.map(n => selectedNotifications.includes(n.id) ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
      setSelectedNotifications([]);
      fetchCounts();
      toast.success(`${selectedNotifications.length} notifications marked as read`);
    }
  };

  const handleBulkArchive = async () => {
    if (selectedNotifications.length === 0) return;
    
    const { error } = await supabase
      .from('notifications')
      .update({ is_archived: true })
      .in('id', selectedNotifications);
    
    if (!error) {
      setNotifications(prev => prev.filter(n => !selectedNotifications.includes(n.id)));
      setSelectedNotifications([]);
      fetchCounts();
      toast.success(`${selectedNotifications.length} notifications archived`);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedNotifications.length === 0) return;
    
    const { error } = await supabase
      .from('notifications')
      .delete()
      .in('id', selectedNotifications);
    
    if (!error) {
      setNotifications(prev => prev.filter(n => !selectedNotifications.includes(n.id)));
      setSelectedNotifications([]);
      fetchCounts();
      toast.success(`${selectedNotifications.length} notifications deleted`);
    }
  };

  // Toggle selection
  const toggleSelection = (id: string) => {
    setSelectedNotifications(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  // Select all
  const selectAll = () => {
    if (selectedNotifications.length === filteredNotifications.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(filteredNotifications.map(n => n.id));
    }
  };

  // Get icon for notification
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

  const totalUnread = counts.total_unread;
  const hasUrgent = counts.urgent_unread > 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link 
            to="/"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="h-6 w-6 text-indigo-600" />
              Notification Center
            </h1>
            <p className="text-sm text-gray-500">
              {totalUnread > 0 ? (
                <span className={hasUrgent ? 'text-red-500 font-medium' : ''}>
                  You have {totalUnread} unread notification{totalUnread !== 1 ? 's' : ''}
                  {hasUrgent && ` including ${counts.urgent_unread} urgent`}
                </span>
              ) : 'All caught up! No unread notifications'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {totalUnread > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </button>
          )}
          <Link
            to="/notifications/settings"
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Unread</span>
            <Inbox className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{counts.total_unread}</p>
        </div>
        
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Urgent</span>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <p className={`text-2xl font-bold ${counts.urgent_unread > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {counts.urgent_unread}
          </p>
        </div>
        
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">High Priority</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <p className={`text-2xl font-bold ${counts.high_unread > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
            {counts.high_unread}
          </p>
        </div>
        
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-2xl shadow-sm text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider opacity-75">Categories</span>
            <Filter className="h-4 w-4" />
          </div>
          <p className="text-2xl font-bold">{Object.keys(counts.by_category).filter(k => counts.by_category[k as NotificationCategory] > 0).length}</p>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(CATEGORY_CONFIG) as NotificationCategory[]).map((cat) => {
          const count = counts.by_category[cat] || 0;
          if (count === 0 && categoryFilter !== cat) return null;
          
          const config = CATEGORY_CONFIG[cat];
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? 'all' : cat)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                categoryFilter === cat
                  ? `${config.bgColor} ${config.color} ring-2 ${config.borderColor}`
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <config.icon className="h-4 w-4" />
              <span>{config.label}</span>
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${config.bgColor} ${config.color}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          
          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as NotificationPriority | 'all')}
            aria-label="Filter by priority"
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl">
          {(['all', 'unread', 'archived'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === tab
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'all' && (
                <span className="flex items-center justify-center gap-2">
                  <Inbox className="h-4 w-4" /> All
                </span>
              )}
              {tab === 'unread' && (
                <span className="flex items-center justify-center gap-2">
                  <Bell className="h-4 w-4" /> 
                  Unread{totalUnread > 0 && <span className="ml-1 text-red-500">({totalUnread})</span>}
                </span>
              )}
              {tab === 'archived' && (
                <span className="flex items-center justify-center gap-2">
                  <Archive className="h-4 w-4" /> Archived
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedNotifications.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl flex items-center justify-between">
          <span className="text-sm font-bold text-indigo-900">
            {selectedNotifications.length} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkMarkAsRead}
              className="px-3 py-1.5 bg-white text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all"
            >
              Mark as read
            </button>
            <button
              onClick={handleBulkArchive}
              className="px-3 py-1.5 bg-white text-amber-600 rounded-lg text-xs font-bold hover:bg-amber-100 transition-all"
            >
              Archive
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 bg-white text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-all"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Notification List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* List Header */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-4">
          <input
            type="checkbox"
            checked={selectedNotifications.length === filteredNotifications.length && filteredNotifications.length > 0}
            onChange={selectAll}
            aria-label="Select all notifications"
            className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
          />
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Select all</span>
        </div>

        {/* List Content */}
        {isLoading && notifications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="animate-spin h-12 w-12 border-3 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-sm text-gray-500 font-medium">Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-16 text-center">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-full h-24 w-24 flex items-center justify-center mx-auto mb-6 shadow-inner">
              {activeTab === 'archived' ? (
                <Archive className="h-12 w-12 text-gray-300" />
              ) : activeTab === 'unread' ? (
                <CheckCheck className="h-12 w-12 text-gray-300" />
              ) : (
                <Bell className="h-12 w-12 text-gray-300" />
              )}
            </div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">
              {activeTab === 'archived' ? 'No archived notifications' : 
               activeTab === 'unread' ? 'No unread notifications' : 
               'All caught up!'}
            </h3>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              {activeTab === 'archived' ? 'Archived notifications will appear here' :
               activeTab === 'unread' ? 'You have read all your notifications' :
               searchQuery ? 'No notifications match your search' :
               categoryFilter !== 'all' ? `No ${CATEGORY_CONFIG[categoryFilter]?.label} notifications` :
               'No new notifications to show'}
            </p>
            {(searchQuery || categoryFilter !== 'all' || priorityFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setPriorityFilter('all');
                }}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {filteredNotifications.map((notification) => {
                const priorityConfig = PRIORITY_CONFIG[notification.priority];
                const categoryConfig = CATEGORY_CONFIG[notification.category];
                const isUnread = !notification.is_read;
                const isSelected = selectedNotifications.includes(notification.id);
                
                return (
                  <div 
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-all group ${
                      isUnread ? 'bg-indigo-50/20' : ''
                    } ${notification.priority === 'urgent' ? 'border-l-4 border-l-red-500' : ''} ${
                      isSelected ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(notification.id)}
                        aria-label={`Select notification: ${notification.title}`}
                        className="mt-1 h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                      
                      {/* Icon */}
                      <div className="flex-shrink-0">
                        {getNotificationIcon(notification)}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`font-bold text-sm ${isUnread ? 'text-gray-900' : 'text-gray-600'}`}>
                                {notification.title}
                              </span>
                              
                              {/* Badges */}
                              <div className="flex items-center gap-1">
                                {notification.priority !== 'normal' && (
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${priorityConfig.bgColor} ${priorityConfig.color}`}>
                                    {priorityConfig.label}
                                  </span>
                                )}
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${categoryConfig.borderColor} ${categoryConfig.color} ${categoryConfig.bgColor}`}>
                                  {categoryConfig.label}
                                </span>
                              </div>
                              
                              {isUnread && (
                                <span className="h-2 w-2 bg-indigo-500 rounded-full" />
                              )}
                            </div>
                            
                            <p className={`text-sm ${isUnread ? 'text-gray-700 font-medium' : 'text-gray-500'} mb-2`}>
                              {notification.message}
                            </p>
                            
                            {/* Metadata */}
                            <div className="flex items-center gap-4 text-xs text-gray-400">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(notification.created_at)}
                              </span>
                              {notification.read_at && (
                                <span className="flex items-center gap-1">
                                  <Check className="h-3 w-3" />
                                  Read
                                </span>
                              )}
                              {notification.is_archived && (
                                <span className="flex items-center gap-1 text-amber-500">
                                  <Archive className="h-3 w-3" />
                                  Archived
                                </span>
                              )}
                            </div>
                            
                            {/* Actions */}
                            {notification.actions && notification.actions.length > 0 && (
                              <div className="flex items-center gap-2 mt-3">
                                {notification.actions.map((action, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      handleMarkAsRead(notification.id);
                                      if (action.url) navigate(action.url);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                                      action.primary
                                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                        : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
                                    }`}
                                  >
                                    {action.label}
                                    {action.url && <ArrowRight className="h-3 w-3" />}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isUnread && (
                              <button
                                onClick={() => handleMarkAsRead(notification.id)}
                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Mark as read"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                            )}
                            {!notification.is_archived && (
                              <button
                                onClick={() => handleArchive(notification.id)}
                                className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                title="Archive"
                              >
                                <Archive className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(notification.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Load More */}
            {hasMore && !isLoading && (
              <div className="p-4 border-t border-gray-100 text-center">
                <button
                  onClick={() => setPage(prev => prev + 1)}
                  className="px-6 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all"
                >
                  Load more notifications
                </button>
              </div>
            )}
            
            {isLoading && (
              <div className="p-4 text-center">
                <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
