// Domain Layer - Entities
// User represents a system user with roles and permissions

export enum UserRole {
  ADMIN = 'admin',
  CEO = 'ceo',
  HR = 'hr',
  ACCOUNTANT = 'accountant',
  VIEWER = 'viewer'
}

export class User {
  private readonly _id: string;
  private readonly _email: string;
  private readonly _fullName: string;
  private readonly _role: UserRole;
  private readonly _isActive: boolean;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;

  constructor(
    id: string,
    email: string,
    fullName: string,
    role: UserRole,
    isActive: boolean = true,
    createdAt: Date = new Date(),
    updatedAt: Date = new Date()
  ) {
    if (!id) throw new Error('User ID is required');
    if (!email || !this.isValidEmail(email)) throw new Error('Valid email is required');
    if (!fullName || fullName.trim().length === 0) throw new Error('Full name is required');
    if (!Object.values(UserRole).includes(role)) throw new Error('Invalid user role');

    this._id = id;
    this._email = email.toLowerCase().trim();
    this._fullName = fullName.trim();
    this._role = role;
    this._isActive = isActive;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  get id(): string { return this._id; }
  get email(): string { return this._email; }
  get fullName(): string { return this._fullName; }
  get role(): UserRole { return this._role; }
  get isActive(): boolean { return this._isActive; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  // Business rules for permissions
  canCreateJournalEntries(): boolean {
    return [UserRole.ADMIN, UserRole.CEO, UserRole.ACCOUNTANT].includes(this._role);
  }

  canApproveJournalEntries(): boolean {
    return [UserRole.ADMIN, UserRole.CEO, UserRole.ACCOUNTANT].includes(this._role);
  }

  canViewAllFinancialData(): boolean {
    return [UserRole.ADMIN, UserRole.CEO, UserRole.ACCOUNTANT, UserRole.HR].includes(this._role);
  }

  canManageUsers(): boolean {
    return [UserRole.ADMIN, UserRole.CEO].includes(this._role);
  }

  canViewAuditLogs(): boolean {
    return [UserRole.ADMIN, UserRole.CEO].includes(this._role);
  }

  canRunFinancialReports(): boolean {
    return [UserRole.ADMIN, UserRole.CEO, UserRole.ACCOUNTANT, UserRole.VIEWER].includes(this._role);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  toJSON(): object {
    return {
      id: this._id,
      email: this._email,
      fullName: this._fullName,
      role: this._role,
      isActive: this._isActive,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString()
    };
  }

  equals(other: User): boolean {
    return this._id === other._id;
  }
}
