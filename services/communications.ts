import { 
  BaseServiceClass, 
  ServiceResult, 
  PaginationParams, 
  SortParams, 
  FilterParams, 
  ListResponse 
} from './_shared/baseService';
import { 
  NotificationPreference, 
  Conversation, 
  ConversationParticipant 
} from '../types';
import { validateRequiredFields } from './_shared/utils';
import { auditService } from './audit';
import { supabase } from '@/lib/supabase';

// ============================================
// NOTIFICATION PREFERENCE SERVICE
// ============================================

interface NotificationPreferenceFilters extends FilterParams {
  user_id?: string;
  notification_type?: 'email' | 'sms' | 'push' | 'in_app';
  event_type?: string;
  is_enabled?: boolean;
}

export class NotificationPreferenceService extends BaseServiceClass {
  private static instance: NotificationPreferenceService;

  public static getInstance(): NotificationPreferenceService {
    if (!NotificationPreferenceService.instance) {
      NotificationPreferenceService.instance = new NotificationPreferenceService();
    }
    return NotificationPreferenceService.instance;
  }

  async createNotificationPreference(input: Omit<NotificationPreference, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<NotificationPreference>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['user_id', 'notification_type', 'event_type'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('notification_preferences')
        .insert([{ ...input, is_enabled: input.is_enabled !== false, frequency: input.frequency || 'immediate' }])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'notification_preference', (data as any).id, input);
      return data as NotificationPreference;
    }, 'Failed to create notification preference');
  }

  async getNotificationPreference(id: string): Promise<ServiceResult<NotificationPreference>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('notification_preferences').select().eq('id', id).single();
      if (error) throw error;
      return data as NotificationPreference;
    }, 'Failed to get notification preference');
  }

  async getNotificationPreferences(filters?: NotificationPreferenceFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<NotificationPreference>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('notification_preferences').select('*', { count: 'exact' });
      
      if (filters?.user_id) query = query.eq('user_id', filters.user_id);
      if (filters?.notification_type) query = query.eq('notification_type', filters.notification_type);
      if (filters?.event_type) query = query.eq('event_type', filters.event_type);
      if (filters?.is_enabled !== undefined) query = query.eq('is_enabled', filters.is_enabled);

      if (sort) {
        query = query.order(sort.sortBy || 'created_at', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as NotificationPreference[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get notification preferences');
  }

  async getPreferencesByUser(userId: string): Promise<ServiceResult<NotificationPreference[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .eq('is_enabled', true)
        .order('notification_type', { ascending: true });

      if (error) throw error;
      return data as NotificationPreference[];
    }, 'Failed to get preferences by user');
  }

  async updateNotificationPreference(id: string, updates: Partial<NotificationPreference>): Promise<ServiceResult<NotificationPreference>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('notification_preferences').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'notification_preference', id, updates);
      return data as NotificationPreference;
    }, 'Failed to update notification preference');
  }

  async deleteNotificationPreference(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('notification_preferences').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'notification_preference', id, {});
      return true;
    }, 'Failed to delete notification preference');
  }

  async isNotificationEnabled(userId: string, eventType: string, notificationType: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('notification_preferences')
        .select('id')
        .eq('user_id', userId)
        .eq('event_type', eventType)
        .eq('notification_type', notificationType)
        .eq('is_enabled', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return !!data;
    }, 'Failed to check notification preference');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// ============================================
// CONVERSATION SERVICE
// ============================================

interface ConversationFilters extends FilterParams {
  type?: 'direct' | 'group' | 'announcement';
  created_by?: string;
  is_active?: boolean;
}

export class ConversationService extends BaseServiceClass {
  private static instance: ConversationService;

  public static getInstance(): ConversationService {
    if (!ConversationService.instance) {
      ConversationService.instance = new ConversationService();
    }
    return ConversationService.instance;
  }

  async createConversation(input: Omit<Conversation, 'id' | 'created_at' | 'updated_at' | 'message_count'>): Promise<ServiceResult<Conversation>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['subject', 'type', 'created_by'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('conversations')
        .insert([{ ...input, is_active: input.is_active !== false, message_count: 0 }])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'conversation', (data as any).id, input);
      return data as Conversation;
    }, 'Failed to create conversation');
  }

  async getConversation(id: string): Promise<ServiceResult<Conversation>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('conversations').select().eq('id', id).single();
      if (error) throw error;
      return data as Conversation;
    }, 'Failed to get conversation');
  }

  async getConversations(filters?: ConversationFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<Conversation>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('conversations').select('*', { count: 'exact' });
      
      if (filters?.type) query = query.eq('type', filters.type);
      if (filters?.created_by) query = query.eq('created_by', filters.created_by);
      if (filters?.is_active !== undefined) query = query.eq('is_active', filters.is_active);

      if (sort) {
        query = query.order(sort.sortBy || 'last_message_at', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('last_message_at', { ascending: false, nullsFirst: true });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as Conversation[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get conversations');
  }

  async getConversationsByUser(userId: string): Promise<ServiceResult<Conversation[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('conversations')
        .select('*, conversation_participants!inner(role)')
        .eq('conversation_participants.user_id', userId)
        .eq('conversation_participants.is_active', true)
        .order('last_message_at', { ascending: false, nullsFirst: true });

      if (error) throw error;
      return data as Conversation[];
    }, 'Failed to get conversations by user');
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<ServiceResult<Conversation>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('conversations').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'conversation', id, updates);
      return data as Conversation;
    }, 'Failed to update conversation');
  }

  async incrementMessageCount(id: string): Promise<ServiceResult<Conversation>> {
    return this.handleAsyncOperation(async () => {
      const { error: rpcError } = await (supabase as any).rpc('increment_message_count', { conversation_id: id });
      if (rpcError) throw rpcError;
      
      const result = await this.getConversation(id);
      if (result.error) throw result.error;
      if (!result.data) throw new Error('Conversation not found after incrementing message count');
      
      return result.data;
    }, 'Failed to increment message count');
  }

  async deleteConversation(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('conversations').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'conversation', id, {});
      return true;
    }, 'Failed to delete conversation');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// ============================================
// CONVERSATION PARTICIPANT SERVICE
// ============================================

interface ConversationParticipantFilters extends FilterParams {
  conversation_id?: string;
  user_id?: string;
  role?: 'owner' | 'participant' | 'admin';
  is_active?: boolean;
}

export class ConversationParticipantService extends BaseServiceClass {
  private static instance: ConversationParticipantService;

  public static getInstance(): ConversationParticipantService {
    if (!ConversationParticipantService.instance) {
      ConversationParticipantService.instance = new ConversationParticipantService();
    }
    return ConversationParticipantService.instance;
  }

  async addParticipant(input: Omit<ConversationParticipant, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<ConversationParticipant>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['conversation_id', 'user_id', 'role'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('conversation_participants')
        .insert([{ ...input, joined_at: input.joined_at || new Date().toISOString(), is_active: input.is_active !== false }])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('add_participant', 'conversation_participant', (data as any).id, input);
      return data as ConversationParticipant;
    }, 'Failed to add participant');
  }

  async getParticipant(id: string): Promise<ServiceResult<ConversationParticipant>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('conversation_participants').select().eq('id', id).single();
      if (error) throw error;
      return data as ConversationParticipant;
    }, 'Failed to get participant');
  }

  async getParticipants(filters?: ConversationParticipantFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<ConversationParticipant>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('conversation_participants').select('*', { count: 'exact' });
      
      if (filters?.conversation_id) query = query.eq('conversation_id', filters.conversation_id);
      if (filters?.user_id) query = query.eq('user_id', filters.user_id);
      if (filters?.role) query = query.eq('role', filters.role);
      if (filters?.is_active !== undefined) query = query.eq('is_active', filters.is_active);

      if (sort) {
        query = query.order(sort.sortBy || 'joined_at', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('joined_at', { ascending: false });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 50;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as ConversationParticipant[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get participants');
  }

  async getParticipantsByConversation(conversationId: string): Promise<ServiceResult<ConversationParticipant[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('conversation_participants')
        .select('*, user_profiles(full_name, email)')
        .eq('conversation_id', conversationId)
        .eq('is_active', true)
        .order('role', { ascending: true })
        .order('joined_at', { ascending: true });

      if (error) throw error;
      return data as ConversationParticipant[];
    }, 'Failed to get participants by conversation');
  }

  async updateParticipant(id: string, updates: Partial<ConversationParticipant>): Promise<ServiceResult<ConversationParticipant>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('conversation_participants').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'conversation_participant', id, updates);
      return data as ConversationParticipant;
    }, 'Failed to update participant');
  }

  async removeParticipant(participantId: string): Promise<ServiceResult<ConversationParticipant>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('conversation_participants')
        .update({ is_active: false, left_at: new Date().toISOString() })
        .eq('id', participantId)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('remove_participant', 'conversation_participant', participantId, {});
      return data as ConversationParticipant;
    }, 'Failed to remove participant');
  }

  async updateLastRead(participantId: string): Promise<ServiceResult<ConversationParticipant>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('id', participantId)
        .select()
        .single();

      if (error) throw error;
      return data as ConversationParticipant;
    }, 'Failed to update last read');
  }

  async deleteParticipant(participantId: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('conversation_participants').delete().eq('id', participantId);
      if (error) throw error;
      await this.logAudit('delete', 'conversation_participant', participantId, {});
      return true;
    }, 'Failed to delete participant');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// Export singleton instances
export const notificationPreferenceService = NotificationPreferenceService.getInstance();
export const conversationService = ConversationService.getInstance();
export const conversationParticipantService = ConversationParticipantService.getInstance();
