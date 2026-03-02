// Domain Layer - Repository Interfaces (Extended)
// Add interfaces for permissions and roles

import { Permission } from '../entities/Permission';
import { Role } from '../entities/Permission';

export interface IPermissionRepository {
  findById(id: string): Promise<Permission | null>;
  findByResourceAction(resource: string, action: string): Promise<Permission | null>;
  findAll(): Promise<Permission[]>;
  findByResource(resource: string): Promise<Permission[]>;
  save(permission: Permission): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface IRoleRepository {
  findById(id: string): Promise<Role | null>;
  findByName(name: string): Promise<Role | null>;
  findAll(): Promise<Role[]>;
  findByUserId(userId: string): Promise<Role[]>;
  save(role: Role): Promise<void>;
  update(role: Role): Promise<void>;
  delete(id: string): Promise<void>;
  assignPermission(roleId: string, permissionId: string, assignedBy: string): Promise<void>;
  removePermission(roleId: string, permissionId: string): Promise<void>;
}

export interface IUserRoleRepository {
  assignRole(userId: string, roleId: string, assignedBy: string, organizationId?: string): Promise<void>;
  removeRole(userId: string, roleId: string): Promise<void>;
  getUserRoles(userId: string): Promise<Role[]>;
  getRoleUsers(roleId: string): Promise<string[]>;
}
