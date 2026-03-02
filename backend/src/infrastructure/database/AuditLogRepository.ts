// Infrastructure Layer - Repository Implementations
// AuditLogRepository implementation using Supabase

import { AuditLogEntry, AuditEventType, AuditSeverity } from '../../domain/entities/AuditLogEntry';
import { IAuditLogRepository } from '../../domain/repositories/audit-interfaces';
import { SupabaseClientWrapper } from '../external/SupabaseClientWrapper';

export class AuditLogRepository implements IAuditLogRepository {
  constructor(private readonly supabase: SupabaseClientWrapper) {}

  async save(entry: AuditLogEntry): Promise<void> {
    const data = this.mapToPersistence(entry);
    const client = this.supabase.getClient();
    const { error } = await client
      .from('audit_trail')
      .insert(data);

    if (error) throw error;
  }

  async findById(id: string): Promise<AuditLogEntry | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('audit_trail')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapToDomain(data);
  }

  async findByUserId(userId: string, limit: number = 100): Promise<AuditLogEntry[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('audit_trail')
      .select('*')
      .eq('changed_by', userId)
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(item => this.mapToDomain(item));
  }

  async findByResource(resourceType: string, resourceId: string): Promise<AuditLogEntry[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('audit_trail')
      .select('*')
      .eq('table_name', resourceType)
      .eq('record_id', resourceId)
      .order('changed_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(item => this.mapToDomain(item));
  }

  async findByEventType(eventType: AuditEventType): Promise<AuditLogEntry[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('audit_trail')
      .select('*')
      .eq('action', eventType)
      .order('changed_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(item => this.mapToDomain(item));
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<AuditLogEntry[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('audit_trail')
      .select('*')
      .gte('changed_at', startDate.toISOString())
      .lte('changed_at', endDate.toISOString())
      .order('changed_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(item => this.mapToDomain(item));
  }

  async findSuspiciousActivity(hours: number): Promise<AuditLogEntry[]> {
    const client = this.supabase.getClient();
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Find multiple failed logins from same IP
    const { data: failedLogins, error: failedError } = await client
      .from('audit_trail')
      .select('*')
      .eq('action', 'login_failed')
      .gte('changed_at', cutoffTime.toISOString())
      .order('ip_address');

    if (failedError) throw failedError;

    // Find multiple deletions by same user
    const { data: deletions, error: deleteError } = await client
      .from('audit_trail')
      .select('*')
      .eq('action', 'DELETE')
      .gte('changed_at', cutoffTime.toISOString());

    if (deleteError) throw deleteError;

    // Combine and filter suspicious activities
    const suspicious = [
      ...(failedLogins || []),
      ...(deletions || [])
    ].map(item => this.mapToDomain(item));

    return suspicious.filter(entry =>
      entry.severity === AuditSeverity.HIGH ||
      entry.severity === AuditSeverity.CRITICAL
    );
  }

  async getAuditTrail(resourceType: string, resourceId: string): Promise<AuditLogEntry[]> {
    return await this.findByResource(resourceType, resourceId);
  }

  private mapToDomain(data: any): AuditLogEntry {
    if (!data) return null;

    // Map database fields to domain enum values
    const severityMap: Record<string, AuditSeverity> = {
      'low': AuditSeverity.LOW,
      'medium': AuditSeverity.MEDIUM,
      'high': AuditSeverity.HIGH,
      'critical': AuditSeverity.CRITICAL
    };

    return new AuditLogEntry(
      data.id,
      data.action as AuditEventType, // Simplified mapping - could be enhanced
      data.table_name,
      data.action,
      `Audit entry for ${data.table_name} ${data.action}`,
      severityMap[data.severity] || AuditSeverity.MEDIUM,
      data.changed_by,
      data.record_id,
      data.old_data,
      data.new_data,
      data.metadata,
      data.ip_address,
      data.user_agent,
      data.session_id,
      new Date(data.changed_at)
    );
  }

  private mapToPersistence(entry: AuditLogEntry): any {
    return {
      id: entry.id,
      table_name: entry.resourceType,
      record_id: entry.resourceId,
      action: entry.action,
      old_data: entry.oldValues,
      new_data: entry.newValues,
      changed_by: entry.userId,
      changed_at: entry.timestamp.toISOString(),
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
      session_id: entry.sessionId,
      metadata: entry.metadata,
      severity: entry.severity.toLowerCase()
    };
  }
}
