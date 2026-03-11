// Infrastructure Layer - Repository Implementations
// RoleRepository implementation using Supabase

import { Permission, Role } from '../../domain/entities/Permission';
import { IRoleRepository, IUserRoleRepository } from '../../domain/repositories/rbac-interfaces';
import { SupabaseClientWrapper } from '../external/SupabaseClientWrapper';

export class RoleRepository implements IRoleRepository {
  constructor(private readonly supabase: SupabaseClientWrapper) {}

  async findById(id: string): Promise<Role | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('roles')
      .select(`
        *,
        role_permissions (
          permissions (*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapToDomain(data);
  }

  async findByName(name: string): Promise<Role | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('roles')
      .select(`
        *,
        role_permissions (
          permissions (*)
        )
      `)
      .eq('name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapToDomain(data);
  }

  async findAll(): Promise<Role[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('roles')
      .select(`
        *,
        role_permissions (
          permissions (*)
        )
      `)
      .order('name');

    if (error) throw error;
    return (data || []).map(item => this.mapToDomain(item));
  }

  async findByUserId(userId: string): Promise<Role[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('user_roles')
      .select(`
        roles (
          *,
          role_permissions (
            permissions (*)
          )
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;
    return (data || []).map(item => this.mapToDomain(item.roles)).filter(Boolean);
  }

  async save(role: Role): Promise<void> {
    const data = this.mapToPersistence(role);
    const client = this.supabase.getClient();

    // Save role
    const { error: roleError } = await client
      .from('roles')
      .upsert(data.role);

    if (roleError) throw roleError;

    // Save role permissions
    if (data.permissions.length > 0) {
      const { error: permissionsError } = await client
        .from('role_permissions')
        .upsert(data.permissions);

      if (permissionsError) throw permissionsError;
    }
  }

  async update(role: Role): Promise<void> {
    await this.save(role);
  }

  async delete(id: string): Promise<void> {
    const client = this.supabase.getClient();

    // Delete role permissions first (foreign key constraint)
    await client.from('role_permissions').delete().eq('role_id', id);

    // Delete user roles
    await client.from('user_roles').delete().eq('role_id', id);

    // Delete role
    const { error } = await client
      .from('roles')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async assignPermission(roleId: string, permissionId: string, assignedBy: string): Promise<void> {
    const client = this.supabase.getClient();
    const { error } = await client
      .from('role_permissions')
      .upsert({
        role_id: roleId,
        permission_id: permissionId,
        granted_by: assignedBy,
        granted_at: new Date().toISOString()
      });

    if (error) throw error;
  }

  async removePermission(roleId: string, permissionId: string): Promise<void> {
    const client = this.supabase.getClient();
    const { error } = await client
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)
      .eq('permission_id', permissionId);

    if (error) throw error;
  }

  private mapToDomain(data: any): Role {
    if (!data) return null;

    // Extract permissions from role_permissions join
    const permissions = (data.role_permissions || []).map((rp: any) => {
      const perm = rp.permissions;
      return new Permission(
        perm.id,
        perm.resource,
        perm.action,
        perm.description,
        new Date(perm.created_at)
      );
    });

    return new Role(
      data.id,
      data.name,
      permissions,
      data.description,
      data.is_system_role || false,
      new Date(data.created_at),
      new Date(data.updated_at)
    );
  }

  private mapToPersistence(role: Role): { role: any, permissions: any[] } {
    const roleData = {
      id: role.id,
      name: role.name,
      description: role.description,
      is_system_role: role.isSystemRole,
      created_at: role.createdAt.toISOString(),
      updated_at: role.updatedAt.toISOString()
    };

    const permissionsData = role.permissions.map(permission => ({
      role_id: role.id,
      permission_id: permission.id
    }));

    return { role: roleData, permissions: permissionsData };
  }
}
