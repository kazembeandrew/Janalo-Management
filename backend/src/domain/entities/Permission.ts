// Domain Layer - Entities
// Permission and Role entities for RBAC system

export class Permission {
  private readonly _id: string;
  private readonly _resource: string;
  private readonly _action: string;
  private readonly _description?: string;
  private readonly _createdAt: Date;

  constructor(
    id: string,
    resource: string,
    action: string,
    description?: string,
    createdAt: Date = new Date()
  ) {
    if (!id) throw new Error('Permission ID is required');
    if (!resource || resource.trim().length === 0) throw new Error('Resource is required');
    if (!action || action.trim().length === 0) throw new Error('Action is required');

    this._id = id;
    this._resource = resource.trim();
    this._action = action.trim();
    this._description = description;
    this._createdAt = createdAt;
  }

  get id(): string { return this._id; }
  get resource(): string { return this._resource; }
  get action(): string { return this._action; }
  get description(): string | undefined { return this._description; }
  get createdAt(): Date { return this._createdAt; }

  get fullName(): string {
    return `${this._resource}:${this._action}`;
  }

  equals(other: Permission): boolean {
    return this._id === other._id;
  }

  matches(resource: string, action: string): boolean {
    return this._resource === resource && this._action === action;
  }

  toJSON(): object {
    return {
      id: this._id,
      resource: this._resource,
      action: this._action,
      description: this._description,
      fullName: this.fullName,
      createdAt: this._createdAt.toISOString()
    };
  }
}

export class Role {
  private readonly _id: string;
  private readonly _name: string;
  private readonly _description?: string;
  private readonly _isSystemRole: boolean;
  private readonly _permissions: Permission[];
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;

  constructor(
    id: string,
    name: string,
    permissions: Permission[] = [],
    description?: string,
    isSystemRole: boolean = false,
    createdAt: Date = new Date(),
    updatedAt: Date = new Date()
  ) {
    if (!id) throw new Error('Role ID is required');
    if (!name || name.trim().length === 0) throw new Error('Role name is required');

    this._id = id;
    this._name = name.trim();
    this._description = description;
    this._isSystemRole = isSystemRole;
    this._permissions = [...permissions]; // Defensive copy
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  get id(): string { return this._id; }
  get name(): string { return this._name; }
  get description(): string | undefined { return this._description; }
  get isSystemRole(): boolean { return this._isSystemRole; }
  get permissions(): Permission[] { return [...this._permissions]; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  hasPermission(resource: string, action: string): boolean {
    return this._permissions.some(permission => permission.matches(resource, action));
  }

  addPermission(permission: Permission): void {
    if (!this.hasPermission(permission.resource, permission.action)) {
      this._permissions.push(permission);
    }
  }

  removePermission(resource: string, action: string): void {
    const index = this._permissions.findIndex(p => p.matches(resource, action));
    if (index >= 0) {
      this._permissions.splice(index, 1);
    }
  }

  equals(other: Role): boolean {
    return this._id === other._id;
  }

  toJSON(): object {
    return {
      id: this._id,
      name: this._name,
      description: this._description,
      isSystemRole: this._isSystemRole,
      permissions: this._permissions.map(p => p.toJSON()),
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString()
    };
  }
}
