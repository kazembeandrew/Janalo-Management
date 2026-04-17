import React from 'react';
import { Filter, Search, RefreshCw, Calendar, Inbox, Archive, CheckCircle } from 'lucide-react';
import type { NotificationCategory, NotificationPriority } from '@/components/NotificationBell';

interface NotificationFiltersProps {
  activeTab: 'all' | 'unread' | 'archived';
  categoryFilter: NotificationCategory | 'all';
  priorityFilter: NotificationPriority | 'all';
  searchQuery: string;
  onTabChange: (tab: 'all' | 'unread' | 'archived') => void;
  onCategoryChange: (category: NotificationCategory | 'all') => void;
  onPriorityChange: (priority: NotificationPriority | 'all') => void;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const NotificationFilters: React.FC<NotificationFiltersProps> = ({
  activeTab,
  categoryFilter,
  priorityFilter,
  searchQuery,
  onTabChange,
  onCategoryChange,
  onPriorityChange,
  onSearchChange,
  onRefresh,
  isLoading
}) => {
  const categories: Array<{ value: NotificationCategory | 'all'; label: string }> = [
    { value: 'all', label: 'All Categories' },
    { value: 'system', label: 'System' },
    { value: 'loan', label: 'Loans' },
    { value: 'repayment', label: 'Repayments' },
    { value: 'expense', label: 'Expenses' },
    { value: 'task', label: 'Tasks' },
    { value: 'message', label: 'Messages' },
    { value: 'security', label: 'Security' },
    { value: 'general', label: 'General' }
  ];

  const priorities: Array<{ value: NotificationPriority | 'all'; label: string }> = [
    { value: 'all', label: 'All Priorities' },
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' }
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      {/* Tabs and Actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onTabChange('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'all'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Inbox className="h-4 w-4" />
            All
          </button>
          <button
            onClick={() => onTabChange('unread')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'unread'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <CheckCircle className="h-4 w-4" />
            Unread
          </button>
          <button
            onClick={() => onTabChange('archived')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'archived'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Archive className="h-4 w-4" />
            Archived
          </button>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search notifications..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryChange(e.target.value as NotificationCategory | 'all')}
          className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        >
          {categories.map(cat => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>

        {/* Priority Filter */}
        <select
          value={priorityFilter}
          onChange={(e) => onPriorityChange(e.target.value as NotificationPriority | 'all')}
          className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        >
          {priorities.map(pri => (
            <option key={pri.value} value={pri.value}>
              {pri.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
