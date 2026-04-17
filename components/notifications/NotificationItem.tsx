import React from 'react';
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
import type { Notification, NotificationCategory, NotificationPriority } from '@/types';

// Category configuration
const CATEGORY_CONFIG: Record<NotificationCategory, { icon: React.ElementType; color: string; bgColor: string; borderColor: string; label: string }> = {
  system: { icon: Info, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', label: 'System' },
  loan: { icon: DollarSign, color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200', label: 'Loans' },
  repayment: { icon: CheckCircle, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', label: 'Repayments' },
  expense: { icon: FileText, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', label: 'Expenses' },
  task: { icon: Check, color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', label: 'Tasks' },
  message: { icon: MessageSquare, color: 'text-indigo-600', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200', label: 'Messages' },
  security: { icon: Shield, color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200', label: 'Security' },
  general: { icon: Bell, color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200', label: 'General' },
  payroll: { icon: FileText, color: 'text-indigo-600', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200', label: 'Payroll' }
};

const PRIORITY_CONFIG: Record<NotificationPriority, { color: string; bgColor: string; label: string; borderColor: string }> = {
  low: { color: 'text-gray-600', bgColor: 'bg-gray-100', borderColor: 'border-gray-200', label: 'Low' },
  normal: { color: 'text-blue-600', bgColor: 'bg-blue-100', borderColor: 'border-blue-200', label: 'Normal' },
  medium: { color: 'text-orange-600', bgColor: 'bg-orange-100', borderColor: 'border-orange-200', label: 'Medium' },
  high: { color: 'text-amber-600', bgColor: 'bg-amber-100', borderColor: 'border-amber-200', label: 'High' },
  urgent: { color: 'text-red-600', bgColor: 'bg-red-100', borderColor: 'border-red-200', label: 'Urgent' }
};

interface NotificationItemProps {
  notification: Notification;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  isSelected,
  onToggleSelect,
  onMarkAsRead,
  onDelete,
  onArchive
}) => {
  const categoryConfig = CATEGORY_CONFIG[notification.category];
  const priorityConfig = PRIORITY_CONFIG[notification.priority];
  const IconComponent = categoryConfig.icon;

  return (
    <div className={`group relative bg-white rounded-lg border p-4 hover:shadow-md transition-all duration-200 ${
      !notification.is_read ? 'border-l-4 border-l-blue-500' : 'border-gray-200'
    } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(notification.id)}
          className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        
        {/* Icon */}
        <div className={`p-2 rounded-lg ${categoryConfig.bgColor} ${categoryConfig.borderColor} border`}>
          <IconComponent className={`h-5 w-5 ${categoryConfig.color}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h3 className={`text-sm font-semibold truncate ${
                !notification.is_read ? 'text-gray-900' : 'text-gray-600'
              }`}>
                {notification.title}
              </h3>
              {notification.message && (
                <p className={`text-sm mt-1 line-clamp-2 ${
                  !notification.is_read ? 'text-gray-700' : 'text-gray-500'
                }`}>
                  {notification.message}
                </p>
              )}
            </div>
            
            {/* Priority Badge */}
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${priorityConfig.bgColor} ${priorityConfig.color}`}>
              {priorityConfig.label}
            </span>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(notification.created_at).toLocaleDateString()}
            </span>
            {notification.due_date && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Due: {new Date(notification.due_date).toLocaleDateString()}
              </span>
            )}
            {notification.action_url && (
              <a
                href={notification.action_url}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                target="_blank"
                rel="noopener noreferrer"
              >
                View Details <ArrowRight className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!notification.is_read && (
            <button
              onClick={() => onMarkAsRead(notification.id)}
              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Mark as read"
            >
              <Check className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => onArchive(notification.id)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Archive"
          >
            <Archive className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(notification.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
