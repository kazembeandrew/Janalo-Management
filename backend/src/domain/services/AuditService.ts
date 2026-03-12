// Domain Layer - Services
// AuditService provides comprehensive audit logging for financial operations

import { randomUUID } from 'crypto';
import { AuditLogEntry, AuditEventType, AuditSeverity } from '../entities/AuditLogEntry';
import { IAuditLogRepository } from '../repositories/audit-interfaces';

export class AuditService {
  constructor(private readonly auditRepo: IAuditLogRepository) {}

  // Log authentication events
  async logLogin(userId: string, ipAddress?: string, userAgent?: string, sessionId?: string): Promise<void> {
    const entry = new AuditLogEntry(
      randomUUID(),
      AuditEventType.LOGIN,
      'user',
      'login',
      'User logged in to the system',
      AuditSeverity.LOW,
      userId,
      userId,
      undefined,
      undefined,
      { sessionId },
      ipAddress,
      userAgent,
      sessionId
    );
    await this.auditRepo.save(entry);
  }

  async logLogout(userId: string, sessionId?: string): Promise<void> {
    const entry = new AuditLogEntry(
      randomUUID(),
      AuditEventType.LOGOUT,
      'user',
      'logout',
      'User logged out of the system',
      AuditSeverity.LOW,
      userId,
      userId,
      undefined,
      undefined,
      { sessionId },
      undefined,
      undefined,
      sessionId
    );
    await this.auditRepo.save(entry);
  }

  async logLoginFailed(email: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const entry = new AuditLogEntry(
      randomUUID(),
      AuditEventType.LOGIN_FAILED,
      'user',
      'login_failed',
      `Failed login attempt for email: ${email}`,
      AuditSeverity.MEDIUM,
      undefined,
      undefined,
      undefined,
      undefined,
      { email },
      ipAddress,
      userAgent
    );
    await this.auditRepo.save(entry);
  }

  // Log financial operations
  async logJournalEntryCreated(entryId: string, userId: string, entryData: any, ipAddress?: string, userAgent?: string): Promise<void> {
    const entryNumber = entryData?.entryNumber ?? entryData?.entry_number ?? 'unknown';
    const entry = new AuditLogEntry(
      randomUUID(),
      AuditEventType.JOURNAL_ENTRY_CREATED,
      'journal_entry',
      'create',
      `Journal entry ${entryNumber} created`,
      AuditSeverity.HIGH,
      userId,
      entryId,
      undefined,
      entryData,
      undefined,
      ipAddress,
      userAgent
    );
    await this.auditRepo.save(entry);
  }

  async logJournalEntryPosted(entryId: string, userId: string, entryData: any, approvedBy?: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const entryNumber = entryData?.entryNumber ?? entryData?.entry_number ?? 'unknown';
    const entry = new AuditLogEntry(
      randomUUID(),
      AuditEventType.JOURNAL_ENTRY_POSTED,
      'journal_entry',
      'post',
      `Journal entry ${entryNumber} posted`,
      AuditSeverity.CRITICAL,
      userId,
      entryId,
      undefined,
      entryData,
      { approvedBy },
      ipAddress,
      userAgent
    );
    await this.auditRepo.save(entry);
  }

  async logJournalEntryVoided(entryId: string, userId: string, reason: string, entryData: any, ipAddress?: string, userAgent?: string): Promise<void> {
    const entryNumber = entryData?.entryNumber ?? entryData?.entry_number ?? 'unknown';
    const entry = new AuditLogEntry(
      randomUUID(),
      AuditEventType.JOURNAL_ENTRY_VOIDED,
      'journal_entry',
      'void',
      `Journal entry ${entryNumber} voided: ${reason}`,
      AuditSeverity.CRITICAL,
      userId,
      entryId,
      entryData,
      undefined,
      { reason },
      ipAddress,
      userAgent
    );
    await this.auditRepo.save(entry);
  }

  // Log account operations
  async logAccountCreated(accountId: string, userId: string, accountData: any, ipAddress?: string, userAgent?: string): Promise<void> {
    const entry = new AuditLogEntry(
      randomUUID(),
      AuditEventType.ACCOUNT_CREATED,
      'account',
      'create',
      `Account ${accountData.code} created: ${accountData.name}`,
      AuditSeverity.HIGH,
      userId,
      accountId,
      undefined,
      accountData,
      undefined,
      ipAddress,
      userAgent
    );
    await this.auditRepo.save(entry);
  }

  async logAccountUpdated(accountId: string, userId: string, oldData: any, newData: any, ipAddress?: string, userAgent?: string): Promise<void> {
    const entry = new AuditLogEntry(
      randomUUID(),
      AuditEventType.ACCOUNT_UPDATED,
      'account',
      'update',
      `Account ${newData.code} updated`,
      AuditSeverity.MEDIUM,
      userId,
      accountId,
      oldData,
      newData,
      undefined,
      ipAddress,
      userAgent
    );
    await this.auditRepo.save(entry);
  }

  // Log user and role operations
  async logUserRoleAssigned(userId: string, roleId: string, assignedBy: string, roleName: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const entry = new AuditLogEntry(
      randomUUID(),
      AuditEventType.USER_ROLE_ASSIGNED,
      'user_role',
      'assign',
      `Role '${roleName}' assigned to user`,
      AuditSeverity.HIGH,
      assignedBy,
      userId,
      undefined,
      { roleId, roleName },
      undefined,
      ipAddress,
      userAgent
    );
    await this.auditRepo.save(entry);
  }

  async logUserRoleRemoved(userId: string, roleId: string, removedBy: string, roleName: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const entry = new AuditLogEntry(
      randomUUID(),
      AuditEventType.USER_ROLE_REMOVED,
      'user_role',
      'remove',
      `Role '${roleName}' removed from user`,
      AuditSeverity.HIGH,
      removedBy,
      userId,
      { roleId, roleName },
      undefined,
      undefined,
      ipAddress,
      userAgent
    );
    await this.auditRepo.save(entry);
  }

  // Log report operations
  async logReportGenerated(userId: string, reportType: string, parameters: any, ipAddress?: string, userAgent?: string): Promise<void> {
    const entry = new AuditLogEntry(
      randomUUID(),
      AuditEventType.REPORT_GENERATED,
      'report',
      'generate',
      `${reportType} report generated`,
      AuditSeverity.LOW,
      userId,
      undefined,
      undefined,
      undefined,
      { reportType, parameters },
      ipAddress,
      userAgent
    );
    await this.auditRepo.save(entry);
  }

  // Get audit trail for a resource
  async getAuditTrail(resourceType: string, resourceId: string): Promise<AuditLogEntry[]> {
    return await this.auditRepo.getAuditTrail(resourceType, resourceId);
  }

  // Get user activity logs
  async getUserActivity(userId: string, limit: number = 100): Promise<AuditLogEntry[]> {
    return await this.auditRepo.findByUserId(userId, limit);
  }

  // Detect suspicious activity
  async detectSuspiciousActivity(hours: number = 24): Promise<AuditLogEntry[]> {
    return await this.auditRepo.findSuspiciousActivity(hours);
  }

  // Get security events
  async getSecurityEvents(hours: number = 24): Promise<AuditLogEntry[]> {
    const allEvents = await this.auditRepo.findSuspiciousActivity(hours);
    return allEvents.filter(entry => entry.isSecurityEvent());
  }

  // Get financial operations audit
  async getFinancialOperationsAudit(startDate: Date, endDate: Date): Promise<AuditLogEntry[]> {
    const events = await this.auditRepo.findByDateRange(startDate, endDate);
    return events.filter(entry => entry.isFinancialOperation());
  }
}
