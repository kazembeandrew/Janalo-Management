import { 
  BaseServiceClass, 
  ServiceResult, 
  ServiceError, 
  PaginationParams, 
  SortParams, 
  FilterParams, 
  ListResponse, 
  AuditLogEntry 
} from './_shared/baseService';
import { Notification, User } from '../types';
import { 
  validateRequiredFields, 
  formatCurrency, 
  formatDate 
} from './_shared/utils';
import { auditService } from './audit';
import { searchService } from './search';
import { usersService } from './users';
import { supabase } from '@/lib/supabase';

interface CreateNotificationInput {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  recipient_ids: string[];
  sender_id?: string;
  metadata?: Record<string, any>;
  scheduled_for?: string;
  expires_at?: string;
  action_url?: string;
  category?: NotificationCategory;
}

interface UpdateNotificationInput {
  id: string;
  title?: string;
  message?: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  recipient_ids?: string[];
  metadata?: Record<string, any>;
  expires_at?: string;
}

interface NotificationFilters extends FilterParams {
  type?: string;
  priority?: string;
  status?: string;
  sender_id?: string;
  recipient_id?: string;
  date_from?: string;
  date_to?: string;
  unread_only?: boolean;
}

/**
 * Notifications Service for managing notification operations
 */
export class NotificationsService extends BaseServiceClass {
  private static instance: NotificationsService;
  private unreadCountCache: Map<string, { count: number; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds

  /**
   * Get singleton instance
   */
  public static getInstance(): NotificationsService {
    if (!NotificationsService.instance) {
      NotificationsService.instance = new NotificationsService();
    }
    return NotificationsService.instance;
  }

  /**
   * Create a new notification
   */
  async createNotification(input: CreateNotificationInput): Promise<ServiceResult<Notification>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['title', 'message', 'type', 'priority', 'recipient_ids'];
      const missing = validateRequiredFields(input, requiredFields);
      
      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
      }

      if (!input.recipient_ids || input.recipient_ids.length === 0) {
        throw new Error('At least one recipient is required');
      }

      // Validate recipients exist
      const recipientsResult = await this.validateRecipients(input.recipient_ids);
      if (!recipientsResult.success) {
        throw new Error(`Invalid recipients: ${recipientsResult.invalidRecipients.join(', ')}`);
      }

      const sender_id = input.sender_id || (await (supabase as any).auth.getUser()).data.user?.id;

      // Insert individual notifications for each recipient
      const notificationRows = input.recipient_ids.map(uid => ({
          title: input.title.trim(),
          message: input.message.trim(),
          type: input.type,
          priority: input.priority,
          user_id: uid,
          sender_id: sender_id,
          status: 'unread',
          metadata: input.metadata || {},
          scheduled_for: input.scheduled_for,
          expires_at: input.expires_at,
          action_url: input.action_url,
          category: input.category || 'general'
      }));

      const { data, error } = await (supabase as any)
          .from('notifications')
          .insert(notificationRows as any)
          .select();

      if (error) throw error;
      
      // Return a synthesized Notification object representing this batch
      const first = (data as any[])[0];
      const notification: Notification = {
          id: first.id, 
          title: first.title,
          message: first.message,
          type: first.type as any,
          priority: first.priority as any,
          recipient_ids: input.recipient_ids,
          sender_id: first.sender_id,
          status: first.status || 'unread',
          metadata: first.metadata || {},
          scheduled_for: first.scheduled_for,
          expires_at: first.expires_at,
          created_at: first.created_at,
          updated_at: first.updated_at,
          category: (first.category || 'general') as any
      } as unknown as Notification;

      // Log audit
      await this.logAudit('create_notification', 'notification', notification.id, {
        action: 'create',
        notification_id: notification.id,
        title: notification.title,
        type: notification.type,
        priority: notification.priority,
        recipient_count: notification.recipient_ids.length
      });

      // Update search index
      await searchService.indexNotification(notification);

      return notification;
    }, 'Failed to create notification');
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(id: string): Promise<ServiceResult<Notification>> {
    return this.handleAsyncOperation(async () => {
      if (!id) {
        throw new Error('Notification ID is required');
      }

      // Simulate database query
      const notification = await this.fetchNotificationFromDatabase(id);
      
      if (!notification) {
        throw new Error('Notification not found');
      }

      return notification;
    }, 'Failed to get notification');
  }

  /**
   * Get all notifications with pagination and filtering
   */
  async getNotifications(
    filters?: NotificationFilters, 
    pagination?: PaginationParams, 
    sort?: SortParams
  ): Promise<ServiceResult<ListResponse<Notification>>> {
    return this.handleAsyncOperation(async () => {
      // Simulate database query
      const result = await this.fetchNotificationsFromDatabase(filters, pagination, sort);
      
      return result;
    }, 'Failed to get notifications');
  }

  /**
   * Get notifications for a specific user
   */
  async getUserNotifications(
    userId: string, 
    filters?: Omit<NotificationFilters, 'recipient_id'>, 
    pagination?: PaginationParams, 
    sort?: SortParams
  ): Promise<ServiceResult<ListResponse<Notification>>> {
    return this.handleAsyncOperation(async () => {
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Simulate database query
      const result = await this.fetchUserNotificationsFromDatabase(userId, filters, pagination, sort);
      
      return result;
    }, 'Failed to get user notifications');
  }

  /**
   * Update notification
   */
  async updateNotification(input: UpdateNotificationInput): Promise<ServiceResult<Notification>> {
    return this.handleAsyncOperation(async () => {
      if (!input.id) {
        throw new Error('Notification ID is required');
      }

      const existingNotification = await this.getNotificationById(input.id);
      if (!existingNotification.data) {
        throw new Error('Notification not found');
      }

      const updatedNotification: Notification = {
        ...existingNotification.data,
        ...input,
        created_at: existingNotification.data.created_at // Keep original creation date
      } as unknown as Notification;

      // Log audit
      await this.logAudit('update_notification', 'notification', input.id, {
        action: 'update',
        notification_id: input.id,
        changes: input
      });

      // Update search index
      await searchService.updateNotificationIndex(updatedNotification);

      return updatedNotification;
    }, 'Failed to update notification');
  }

  /**
   * Delete notification
   */
  async deleteNotification(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      if (!id) {
        throw new Error('Notification ID is required');
      }

      const existingNotification = await this.getNotificationById(id);
      if (!existingNotification.data) {
        throw new Error('Notification not found');
      }

      // Log audit
      await this.logAudit('delete_notification', 'notification', id, {
        action: 'delete',
        notification_id: id,
        title: existingNotification.data.title
      });

      // Remove from search index
      await searchService.removeFromIndex('notification', id);

      return true;
    }, 'Failed to delete notification');
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<ServiceResult<Notification>> {
    return this.handleAsyncOperation(async () => {
      if (!notificationId || !userId) {
        throw new Error('Notification ID and User ID are required');
      }

      const existingNotification = await this.getNotificationById(notificationId);
      if (!existingNotification.data) {
        throw new Error('Notification not found');
      }

      // Mark as read for specific user
      const updatedNotification = await this.markNotificationReadForUser(notificationId, userId);

      // Log audit
      await this.logAudit('mark_notification_read', 'notification', notificationId, {
        action: 'mark_read',
        notification_id: notificationId,
        user_id: userId
      });

      // Update search index
      await searchService.updateNotificationIndex(updatedNotification);

      return updatedNotification;
    }, 'Failed to mark notification as read');
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Mark all unread notifications as read for user
      await this.markAllNotificationsReadForUser(userId);

      // Log audit
      await this.logAudit('mark_all_notifications_read', 'notification', userId, {
        action: 'mark_all_read',
        user_id: userId
      });

      return true;
    }, 'Failed to mark all notifications as read');
  }

  /**
   * Send notification
   */
  async sendNotification(notification: Notification): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      // Simulate sending notification
      // In a real implementation, this would integrate with email, SMS, push notification services
      
      const result = await this.sendNotificationToRecipients(notification);
      
      if (result.success) {
        // Update notification status
        await this.updateNotificationStatus(notification.id, 'sent');
      }

      return result.data ?? false;
    }, 'Failed to send notification');
  }

  /**
   * Get notification statistics
   */
  async getNotificationStatistics(): Promise<ServiceResult<{
    totalNotifications: number;
    unreadCount: number;
    readCount: number;
    typeDistribution: Array<{
      type: string;
      count: number;
      percentage: number;
    }>;
    priorityDistribution: Array<{
      priority: string;
      count: number;
      percentage: number;
    }>;
    recentActivity: Array<{
      date: string;
      count: number;
    }>;
  }>> {
    return this.handleAsyncOperation(async () => {
      const notificationsResult = await this.getNotifications();
      const notifications = notificationsResult.data?.data || [];

      const totalNotifications = notifications.length;
      const unreadCount = notifications.filter(n => n.status === 'unread').length;
      const readCount = notifications.filter(n => n.status === 'read').length;

      // Type distribution
      const typeMap = new Map<string, number>();
      notifications.forEach(notification => {
        const count = typeMap.get(notification.type) || 0;
        typeMap.set(notification.type, count + 1);
      });

      const typeDistribution = Array.from(typeMap.entries()).map(([type, count]) => ({
        type,
        count,
        percentage: totalNotifications > 0 ? (count / totalNotifications) * 100 : 0
      }));

      // Priority distribution
      const priorityMap = new Map<string, number>();
      notifications.forEach(notification => {
        const count = priorityMap.get(notification.priority) || 0;
        priorityMap.set(notification.priority, count + 1);
      });

      const priorityDistribution = Array.from(priorityMap.entries()).map(([priority, count]) => ({
        priority,
        count,
        percentage: totalNotifications > 0 ? (count / totalNotifications) * 100 : 0
      }));

      // Recent activity (last 7 days)
      const recentActivity = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const count = notifications.filter(n => 
          n.created_at.startsWith(dateStr)
        ).length;

        recentActivity.push({ date: dateStr, count });
      }

      return {
        totalNotifications,
        unreadCount,
        readCount,
        typeDistribution,
        priorityDistribution,
        recentActivity
      };
    }, 'Failed to get notification statistics');
  }

  /**
   * Search notifications
   */
  async searchNotifications(query: string, filters?: NotificationFilters): Promise<ServiceResult<ListResponse<Notification>>> {
    return this.handleAsyncOperation(async () => {
      if (!query || query.trim() === '') {
        throw new Error('Search query is required');
      }

      // Use search service
      const result = await searchService.searchNotifications(query);
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Search failed');
      }

      const notifications = (result.data || []) as Notification[];

      return {
        data: notifications,
        total: notifications.length,
        page: 1,
        limit: notifications.length,
        totalPages: 1
      };
    }, 'Failed to search notifications');
  }

  /**
   * Get unread notifications count for user with caching
   */
  async getUnreadCount(userId: string): Promise<ServiceResult<number>> {
    return this.handleAsyncOperation(async () => {
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Check cache
      const cached = this.unreadCountCache.get(userId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.count;
      }

      const count = await this.fetchUnreadCountFromDatabase(userId);
      
      // Update cache
      this.unreadCountCache.set(userId, { count, timestamp: Date.now() });
      
      return count;
    }, 'Failed to get unread count');
  }

  /**
   * Clear unread count cache
   */
  clearUnreadCountCache(userId?: string): void {
    if (userId) {
      this.unreadCountCache.delete(userId);
    } else {
      this.unreadCountCache.clear();
    }
  }

  /**
   * Schedule notification
   */
  async scheduleNotification(input: CreateNotificationInput): Promise<ServiceResult<Notification>> {
    return this.handleAsyncOperation(async () => {
      // Set scheduled_for to future date
      const scheduledFor = input.scheduled_for || new Date(Date.now() + 60000).toISOString(); // 1 minute from now
      
      const result = await this.createNotification({
        ...input,
        scheduled_for: scheduledFor
      });
      return result.data!;
    }, 'Failed to schedule notification');
  }

  /**
   * Validate recipients exist
   */
  private async validateRecipients(recipientIds: string[]): Promise<{
    success: boolean;
    invalidRecipients: string[];
    recipients: User[];
  }> {
    const recipients: User[] = [];
    const invalidRecipients: string[] = [];

    for (const recipientId of recipientIds) {
      const userResult = await usersService.getUserById(recipientId);
      if (userResult.data) {
        recipients.push(userResult.data);
      } else {
        invalidRecipients.push(recipientId);
      }
    }

    return {
      success: invalidRecipients.length === 0,
      invalidRecipients,
      recipients
    };
  }

  /**
   * Send notification to recipients
   */
  private async sendNotificationToRecipients(notification: Notification): Promise<ServiceResult<boolean>> {
    // Simulate sending notification
    // In a real implementation, this would integrate with actual notification services
    return { success: true, data: true, error: null };
  }

  /**
   * Mark notification as read for specific user
   */
  private async markNotificationReadForUser(notificationId: string, userId: string): Promise<Notification> {
    const { data, error } = await (supabase as any)
        .from('notifications')
        .update({ status: 'read' } as any)
        .eq('id', notificationId)
        .eq('user_id', userId)
        .select()
        .single();
    
    if (error) throw error;
    
    return {
        ...(data as any),
        recipient_ids: [(data as any).user_id],
        category: ((data as any).category || 'general') as any,
        metadata: (data as any).metadata || {}
    } as unknown as Notification;
  }

  /**
   * Mark all notifications as read for user
   */
  private async markAllNotificationsReadForUser(userId: string): Promise<void> {
    const { error } = await (supabase as any)
        .from('notifications')
        .update({ status: 'read' } as any)
        .eq('user_id', userId)
        .eq('status', 'unread');
    
    if (error) throw error;
  }

  /**
   * Update notification status
   */
  private async updateNotificationStatus(notificationId: string, status: string): Promise<void> {
     await (supabase as any)
        .from('notifications')
        .update({ status } as any)
        .eq('id', notificationId);
  }

  // Private helper methods for database operations
  // In a real implementation, these would query the actual database

  private async fetchNotificationFromDatabase(id: string): Promise<Notification | null> {
    const { data, error } = await (supabase as any)
        .from('notifications')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) return null;
    return {
        ...(data as any),
        recipient_ids: [(data as any).user_id],
        category: ((data as any).category || 'general') as any,
        metadata: (data as any).metadata || {}
    } as unknown as Notification;
  }

  private async fetchNotificationsFromDatabase(
    filters?: NotificationFilters, 
    pagination?: PaginationParams, 
    sort?: SortParams
  ): Promise<ListResponse<Notification>> {
    let query = (supabase as any).from('notifications').select('*', { count: 'exact' });

    if (filters?.type) query = query.eq('type', filters.type);
    if (filters?.priority) query = query.eq('priority', filters.priority);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.recipient_id) query = query.eq('user_id', filters.recipient_id);
    if (filters?.sender_id) query = query.eq('sender_id', filters.sender_id);
    if (filters?.date_from) query = query.gte('created_at', filters.date_from);
    if (filters?.date_to) query = query.lte('created_at', filters.date_to);

    if (sort) {
      query = query.order((sort as any).sortBy || 'created_at', { ascending: sort.sortOrder === 'asc' });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const start = (page - 1) * limit;

    const { data, count, error } = await query.range(start, start + limit - 1);

    if (error) throw error;

    const notifications = (data || []).map(n => ({
        ...(n as any),
        recipient_ids: [(n as any).user_id],
        category: ((n as any).category || 'general') as any,
        metadata: (n as any).metadata || {}
    })) as unknown as Notification[];

    return {
      data: notifications,
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0
    };
  }

  private async fetchUserNotificationsFromDatabase(
    userId: string,
    filters?: Omit<NotificationFilters, 'recipient_id'>, 
    pagination?: PaginationParams, 
    sort?: SortParams
  ): Promise<ListResponse<Notification>> {
     return this.fetchNotificationsFromDatabase(
         { ...filters, recipient_id: userId },
         pagination,
         sort
     );
  }

  private async fetchUnreadCountFromDatabase(userId: string): Promise<number> {
    const { count, error } = await (supabase as any)
        .from('notifications')
        .select('*', { count: 'exact', head: true } as any)
        .eq('user_id', userId)
        .eq('status', 'unread');
    
    if (error) return 0;
    return count || 0;
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    // Fire and forget - don't block notification operations
    auditService.logAudit(action, entityType, entityId, details).catch(err => {
      console.error('Failed to log audit:', err);
    });
  }
}

// Export singleton instance
export const notificationsService = NotificationsService.getInstance();
