import { supabase } from '@/lib/supabase';
import type { NotificationCategory, NotificationPriority, NotificationAction } from '@/components/NotificationBell';

// ============================================================================
// TYPES
// ============================================================================

export type NotificationType = 'success' | 'warning' | 'error' | 'info';

export interface CreateNotificationOptions {
  userId: string;
  title: string;
  message: string;
  link?: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  category?: NotificationCategory;
  actions?: NotificationAction[];
  senderId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  expiresAt?: Date;
}

export interface NotificationTemplate {
  code: string;
  variables: Record<string, string>;
}

// ============================================================================
// CORE NOTIFICATION FUNCTIONS
// ============================================================================

export const createNotification = async (options: CreateNotificationOptions): Promise<string | null> => {
  const { 
    userId, 
    title, 
    message, 
    link, 
    type = 'info',
    priority = 'normal',
    category = 'general',
    actions,
    senderId,
    relatedEntityType,
    relatedEntityId,
    expiresAt
  } = options;
  
  const { data, error } = await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    link,
    type,
    priority,
    category,
    actions: actions || [],
    sender_id: senderId,
    related_entity_type: relatedEntityType,
    related_entity_id: relatedEntityId,
    expires_at: expiresAt?.toISOString()
  }).select('id').single();

  if (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
  
  return data.id;
};

export const createNotificationFromTemplate = async (
  templateCode: string,
  userId: string,
  variables: Record<string, string>,
  options?: {
    senderId?: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }
): Promise<string | null> => {
  const { data, error } = await supabase.rpc('create_notification_from_template', {
    p_template_code: templateCode,
    p_user_id: userId,
    p_variables: variables,
    p_sender_id: options?.senderId || null,
    p_related_entity_type: options?.relatedEntityType || null,
    p_related_entity_id: options?.relatedEntityId || null
  });

  if (error) {
    console.error('Failed to create notification from template:', error);
    return null;
  }
  
  return data;
};

export const batchCreateNotifications = async (
  userIds: string[],
  title: string,
  message: string,
  options?: {
    link?: string;
    type?: NotificationType;
    priority?: NotificationPriority;
    category?: NotificationCategory;
  }
): Promise<number> => {
  const { data, error } = await supabase.rpc('batch_create_notifications', {
    p_user_ids: userIds,
    p_title: title,
    p_message: message,
    p_link: options?.link || null,
    p_type: options?.type || 'info',
    p_priority: options?.priority || 'normal',
    p_category: options?.category || 'general'
  });

  if (error) {
    console.error('Failed to batch create notifications:', error);
    return 0;
  }
  
  return data || 0;
};

// ============================================================================
// SPECIFIC NOTIFICATION HELPERS
// ============================================================================

export const notifyTaskAssigned = async (
  userId: string, 
  taskTitle: string,
  options?: { senderId?: string; taskId?: string }
): Promise<string | null> => {
  return createNotification({
    userId,
    title: 'New Task Assigned',
    message: `You have been assigned a new task: "${taskTitle}".`,
    link: '/tasks',
    type: 'success',
    priority: 'normal',
    category: 'task',
    actions: [
      { label: 'View Task', action: 'view_task', url: '/tasks', primary: true }
    ],
    senderId: options?.senderId,
    relatedEntityType: options?.taskId ? 'task' : undefined,
    relatedEntityId: options?.taskId
  });
};

export const notifyTaskCompleted = async (
  userId: string, 
  taskTitle: string,
  options?: { senderId?: string; taskId?: string }
): Promise<string | null> => {
  return createNotification({
    userId,
    title: 'Task Completed',
    message: `"${taskTitle}" has been marked as completed.`,
    link: '/tasks',
    type: 'success',
    priority: 'normal',
    category: 'task',
    senderId: options?.senderId,
    relatedEntityType: options?.taskId ? 'task' : undefined,
    relatedEntityId: options?.taskId
  });
};

export const notifyExpenseApproved = async (
  userId: string,
  description: string,
  amountFormatted: string,
  options?: { expenseId?: string; approverId?: string }
): Promise<string | null> => {
  return createNotification({
    userId,
    title: 'Expense Approved',
    message: `Your expense for "${description}" (${amountFormatted}) has been authorized.`,
    link: '/expenses',
    type: 'success',
    priority: 'normal',
    category: 'expense',
    actions: [
      { label: 'View Expense', action: 'view_expense', url: '/expenses', primary: true }
    ],
    relatedEntityType: options?.expenseId ? 'expense' : undefined,
    relatedEntityId: options?.expenseId,
    senderId: options?.approverId
  });
};

export const notifyExpenseRejected = async (
  userId: string,
  description: string,
  amountFormatted: string,
  reason?: string,
  options?: { expenseId?: string; rejectorId?: string }
): Promise<string | null> => {
  return createNotification({
    userId,
    title: 'Expense Rejected',
    message: `Your expense for "${description}" (${amountFormatted}) was not approved.${reason ? ` Reason: ${reason}` : ''}`,
    link: '/expenses',
    type: 'warning',
    priority: 'high',
    category: 'expense',
    actions: [
      { label: 'View Expense', action: 'view_expense', url: '/expenses', primary: true }
    ],
    relatedEntityType: options?.expenseId ? 'expense' : undefined,
    relatedEntityId: options?.expenseId,
    senderId: options?.rejectorId
  });
};

export const notifyLoanApproved = async (
  userId: string,
  borrowerName: string,
  amount: string,
  options?: { loanId?: string; approverId?: string }
): Promise<string | null> => {
  return createNotification({
    userId,
    title: `Loan Approved: ${borrowerName}`,
    message: `The loan application for ${borrowerName} has been approved for ${amount}.`,
    link: options?.loanId ? `/loans/${options.loanId}` : '/loans',
    type: 'success',
    priority: 'high',
    category: 'loan',
    actions: [
      { label: 'View Loan', action: 'view_loan', url: options?.loanId ? `/loans/${options.loanId}` : '/loans', primary: true }
    ],
    relatedEntityType: options?.loanId ? 'loan' : undefined,
    relatedEntityId: options?.loanId,
    senderId: options?.approverId
  });
};

export const notifyRepaymentReceived = async (
  userId: string,
  borrowerName: string,
  amount: string,
  options?: { loanId?: string; repaymentId?: string }
): Promise<string | null> => {
  return createNotification({
    userId,
    title: `Repayment Received: ${amount}`,
    message: `A repayment of ${amount} has been received from ${borrowerName}.`,
    link: options?.loanId ? `/loans/${options.loanId}` : '/repayments',
    type: 'success',
    priority: 'normal',
    category: 'repayment',
    actions: [
      { label: 'View Details', action: 'view_repayment', url: options?.loanId ? `/loans/${options.loanId}` : '/repayments', primary: true }
    ],
    relatedEntityType: options?.repaymentId ? 'repayment' : undefined,
    relatedEntityId: options?.repaymentId
  });
};

export const notifySecurityAlert = async (
  userIds: string[],
  alertType: string,
  message: string,
  options?: { priority?: 'high' | 'urgent'; link?: string }
): Promise<number> => {
  return batchCreateNotifications(
    userIds,
    `Security Alert: ${alertType}`,
    message,
    {
      link: options?.link || '/settings',
      type: 'error',
      priority: options?.priority || 'urgent',
      category: 'security'
    }
  );
};

export const notifySystemMaintenance = async (
  userIds: string[],
  maintenanceType: string,
  scheduledDate: string,
  duration: string
): Promise<number> => {
  return batchCreateNotifications(
    userIds,
    `Scheduled Maintenance: ${maintenanceType}`,
    `The system will undergo ${maintenanceType} maintenance on ${scheduledDate}. Expected downtime: ${duration}.`,
    {
      type: 'info',
      priority: 'low',
      category: 'system'
    }
  );
};

// ============================================================================
// NOTIFICATION MANAGEMENT
// ============================================================================

export const markNotificationAsRead = async (notificationId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
    p_user_id: (await supabase.auth.getUser()).data.user?.id
  });

  if (error) {
    console.error('Failed to mark notification as read:', error);
    return false;
  }
  
  return data || false;
};

export const archiveNotification = async (notificationId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('archive_notification', {
    p_notification_id: notificationId,
    p_user_id: (await supabase.auth.getUser()).data.user?.id
  });

  if (error) {
    console.error('Failed to archive notification:', error);
    return false;
  }
  
  return data || false;
};

export const deleteNotification = async (notificationId: string): Promise<boolean> => {
  const { error } = await supabase.from('notifications').delete().eq('id', notificationId);

  if (error) {
    console.error('Failed to delete notification:', error);
    return false;
  }
  
  return true;
};

export const getNotificationCounts = async (): Promise<{
  total_unread: number;
  urgent_unread: number;
  high_unread: number;
  by_category: Record<string, number>;
} | null> => {
  const { data, error } = await supabase.rpc('get_notification_counts_detailed');

  if (error) {
    console.error('Failed to get notification counts:', error);
    return null;
  }
  
  return data;
};

// ============================================================================
// NOTIFICATION PREFERENCES
// ============================================================================

export interface NotificationPreferences {
  email_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  category_preferences: Record<string, { in_app: boolean; email: boolean; push: boolean }>;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  digest_enabled: boolean;
  digest_frequency: 'hourly' | 'daily' | 'weekly';
}

export const getNotificationPreferences = async (): Promise<NotificationPreferences | null> => {
  const { data, error } = await supabase.rpc('get_or_create_notification_preferences');

  if (error) {
    console.error('Failed to get notification preferences:', error);
    return null;
  }
  
  return data;
};

export const updateNotificationPreferences = async (
  preferences: Partial<NotificationPreferences>
): Promise<boolean> => {
  const { error } = await supabase
    .from('notification_preferences')
    .update(preferences)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

  if (error) {
    console.error('Failed to update notification preferences:', error);
    return false;
  }
  
  return true;
};

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

export const cleanupOldNotifications = async (): Promise<{ deleted: number; archived: number } | null> => {
  const { data, error } = await supabase.rpc('cleanup_old_notifications');

  if (error) {
    console.error('Failed to cleanup old notifications:', error);
    return null;
  }
  
  return {
    deleted: data?.deleted_count || 0,
    archived: data?.archived_count || 0
  };
};
