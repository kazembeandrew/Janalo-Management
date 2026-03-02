// Domain Layer - Entities
// Audit log entities for comprehensive financial audit trail

export enum AuditEventType {
  // Authentication events
  LOGIN = 'login',
  LOGOUT = 'logout',
  LOGIN_FAILED = 'login_failed',

  // Financial operations
  JOURNAL_ENTRY_CREATED = 'journal_entry_created',
  JOURNAL_ENTRY_UPDATED = 'journal_entry_updated',
  JOURNAL_ENTRY_POSTED = 'journal_entry_posted',
  JOURNAL_ENTRY_VOIDED = 'journal_entry_voided',
  JOURNAL_ENTRY_DELETED = 'journal_entry_deleted',

  // Account operations
  ACCOUNT_CREATED = 'account_created',
  ACCOUNT_UPDATED = 'account_updated',
  ACCOUNT_DELETED = 'account_deleted',

  // User and role operations
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  USER_ROLE_ASSIGNED = 'user_role_assigned',
  USER_ROLE_REMOVED = 'user_role_removed',
  ROLE_CREATED = 'role_created',
  ROLE_UPDATED = 'role_updated',
  ROLE_DELETED = 'role_deleted',

  // Report operations
  REPORT_GENERATED = 'report_generated',
  REPORT_EXPORTED = 'report_exported',

  // System operations
  BACKUP_CREATED = 'backup_created',
  SYSTEM_MAINTENANCE = 'system_maintenance'
}

export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export class AuditLogEntry {
  private readonly _id: string;
  private readonly _eventType: AuditEventType;
  private readonly _userId?: string;
  private readonly _resourceType: string;
  private readonly _resourceId?: string;
  private readonly _action: string;
  private readonly _oldValues?: Record<string, any>;
  private readonly _newValues?: Record<string, any>;
  private readonly _metadata?: Record<string, any>;
  private readonly _ipAddress?: string;
  private readonly _userAgent?: string;
  private readonly _sessionId?: string;
  private readonly _severity: AuditSeverity;
  private readonly _timestamp: Date;
  private readonly _description: string;

  constructor(
    id: string,
    eventType: AuditEventType,
    resourceType: string,
    action: string,
    description: string,
    severity: AuditSeverity = AuditSeverity.MEDIUM,
    userId?: string,
    resourceId?: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    metadata?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
    sessionId?: string,
    timestamp: Date = new Date()
  ) {
    if (!id) throw new Error('Audit log entry ID is required');
    if (!resourceType) throw new Error('Resource type is required');
    if (!action) throw new Error('Action is required');
    if (!description) throw new Error('Description is required');

    this._id = id;
    this._eventType = eventType;
    this._userId = userId;
    this._resourceType = resourceType;
    this._resourceId = resourceId;
    this._action = action;
    this._oldValues = oldValues;
    this._newValues = newValues;
    this._metadata = metadata;
    this._ipAddress = ipAddress;
    this._userAgent = userAgent;
    this._sessionId = sessionId;
    this._severity = severity;
    this._timestamp = timestamp;
    this._description = description;
  }

  get id(): string { return this._id; }
  get eventType(): AuditEventType { return this._eventType; }
  get userId(): string | undefined { return this._userId; }
  get resourceType(): string { return this._resourceType; }
  get resourceId(): string | undefined { return this._resourceId; }
  get action(): string { return this._action; }
  get oldValues(): Record<string, any> | undefined { return this._oldValues; }
  get newValues(): Record<string, any> | undefined { return this._newValues; }
  get metadata(): Record<string, any> | undefined { return this._metadata; }
  get ipAddress(): string | undefined { return this._ipAddress; }
  get userAgent(): string | undefined { return this._userAgent; }
  get sessionId(): string | undefined { return this._sessionId; }
  get severity(): AuditSeverity { return this._severity; }
  get timestamp(): Date { return this._timestamp; }
  get description(): string { return this._description; }

  // Check if this is a financial operation
  isFinancialOperation(): boolean {
    return this._resourceType === 'journal_entry' ||
           this._resourceType === 'account' ||
           this._resourceType === 'loan' ||
           this._resourceType === 'repayment';
  }

  // Check if this is a security-related event
  isSecurityEvent(): boolean {
    return this._eventType === AuditEventType.LOGIN ||
           this._eventType === AuditEventType.LOGIN_FAILED ||
           this._eventType === AuditEventType.USER_ROLE_ASSIGNED ||
           this._eventType === AuditEventType.USER_ROLE_REMOVED;
  }

  toJSON(): object {
    return {
      id: this._id,
      eventType: this._eventType,
      userId: this._userId,
      resourceType: this._resourceType,
      resourceId: this._resourceId,
      action: this._action,
      oldValues: this._oldValues,
      newValues: this._newValues,
      metadata: this._metadata,
      ipAddress: this._ipAddress,
      userAgent: this._userAgent,
      sessionId: this._sessionId,
      severity: this._severity,
      timestamp: this._timestamp.toISOString(),
      description: this._description
    };
  }
}
