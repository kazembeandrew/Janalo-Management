// Domain Layer - Services
// AuthorizationService handles permission checks and RBAC logic

import { User } from '../entities/User';
import { Permission } from '../entities/Permission';
import { Role } from '../entities/Permission';
import { IPermissionRepository, IRoleRepository, IUserRoleRepository } from '../repositories/rbac-interfaces';

export class AuthorizationService {
  constructor(
    private readonly permissionRepo: IPermissionRepository,
    private readonly roleRepo: IRoleRepository,
    private readonly userRoleRepo: IUserRoleRepository
  ) {}

  // Check if user has specific permission
  async hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
    try {
      const userRoles = await this.userRoleRepo.getUserRoles(userId);

      // Check if any of user's roles has the required permission
      for (const role of userRoles) {
        if (role.hasPermission(resource, action)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  // Check if user has any of the specified permissions (OR logic)
  async hasAnyPermission(userId: string, permissions: Array<{ resource: string; action: string }>): Promise<boolean> {
    for (const permission of permissions) {
      if (await this.hasPermission(userId, permission.resource, permission.action)) {
        return true;
      }
    }
    return false;
  }

  // Check if user has all of the specified permissions (AND logic)
  async hasAllPermissions(userId: string, permissions: Array<{ resource: string; action: string }>): Promise<boolean> {
    for (const permission of permissions) {
      if (!(await this.hasPermission(userId, permission.resource, permission.action))) {
        return false;
      }
    }
    return true;
  }

  // Get all permissions for a user
  async getUserPermissions(userId: string): Promise<Permission[]> {
    const userRoles = await this.userRoleRepo.getUserRoles(userId);
    const allPermissions = new Map<string, Permission>();

    // Collect unique permissions from all user roles
    for (const role of userRoles) {
      for (const permission of role.permissions) {
        allPermissions.set(permission.id, permission);
      }
    }

    return Array.from(allPermissions.values());
  }

  // Get user's roles
  async getUserRoles(userId: string): Promise<Role[]> {
    return await this.userRoleRepo.getUserRoles(userId);
  }

  // Assign role to user
  async assignRoleToUser(userId: string, roleId: string, assignedBy: string): Promise<void> {
    await this.userRoleRepo.assignRole(userId, roleId, assignedBy);
  }

  // Remove role from user
  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    await this.userRoleRepo.removeRole(userId, roleId);
  }

  // Create new role with permissions
  async createRole(name: string, permissions: Permission[], description?: string): Promise<Role> {
    const role = new Role('', name, permissions, description, false);
    await this.roleRepo.save(role);
    return role;
  }

  // Add permission to role
  async addPermissionToRole(roleId: string, permissionId: string, addedBy: string): Promise<void> {
    await this.roleRepo.assignPermission(roleId, permissionId, addedBy);
  }

  // Remove permission from role
  async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    await this.roleRepo.removePermission(roleId, permissionId);
  }

  // Validate that user can perform action (throws error if not authorized)
  async requirePermission(userId: string, resource: string, action: string): Promise<void> {
    const hasPermission = await this.hasPermission(userId, resource, action);
    if (!hasPermission) {
      throw new AuthorizationError(`User does not have permission to ${action} ${resource}`);
    }
  }

  // Validate that user has any of the required permissions
  async requireAnyPermission(userId: string, permissions: Array<{ resource: string; action: string }>): Promise<void> {
    const hasPermission = await this.hasAnyPermission(userId, permissions);
    if (!hasPermission) {
      const permissionStrings = permissions.map(p => `${p.resource}:${p.action}`);
      throw new AuthorizationError(`User does not have any of the required permissions: ${permissionStrings.join(', ')}`);
    }
  }

  // Check if user is admin (for backward compatibility)
  async isAdmin(userId: string): Promise<boolean> {
    const userRoles = await this.getUserRoles(userId);
    return userRoles.some(role => role.name === 'admin' || role.name === 'ceo');
  }

  // Get all available permissions
  async getAllPermissions(): Promise<Permission[]> {
    return await this.permissionRepo.findAll();
  }

  // Get all roles
  async getAllRoles(): Promise<Role[]> {
    return await this.roleRepo.findAll();
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}
