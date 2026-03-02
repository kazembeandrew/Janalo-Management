// Domain Layer - Repository Interfaces (Extended)
// Add audit logging repository interface

import { AuditLogEntry, AuditEventType, AuditSeverity } from '../entities/AuditLogEntry';

export interface IAuditLogRepository {
  save(entry: AuditLogEntry): Promise<void>;
  findById(id: string): Promise<AuditLogEntry | null>;
  findByUserId(userId: string, limit?: number): Promise<AuditLogEntry[]>;
  findByResource(resourceType: string, resourceId: string): Promise<AuditLogEntry[]>;
  findByEventType(eventType: AuditEventType): Promise<AuditLogEntry[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<AuditLogEntry[]>;
  findSuspiciousActivity(hours: number): Promise<AuditLogEntry[]>;
  getAuditTrail(resourceType: string, resourceId: string): Promise<AuditLogEntry[]>;
}
