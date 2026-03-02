// Infrastructure Layer - Repository Implementations
// UserRoleRepository implementation using Supabase

import { Role } from '../../domain/entities/Permission';
import { IUserRoleRepository } from '../../domain/repositories/rbac-interfaces';
import { SupabaseClientWrapper } from '../external/SupabaseClientWrapper';

export class UserRoleRepository implements IUserRoleRepository {
  constructor(private readonly supabase: SupabaseClientWrapper) {}

  async assignRole(userId: string, roleId: string, assignedBy: string, organizationId?: string): Promise<void> {
    const client = this.supabase.getClient();
    const { error } = await client
      .from('user_roles')
      .upsert({
        user_id: userId,
        role_id: roleId,
        organization_id: organizationId,
        assigned_by: assignedBy,
        assigned_at: new Date().toISOString()
      });

    if (error) throw error;
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    const client = this.supabase.getClient();
    const { error } = await client
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', roleId);

    if (error) throw error;
  }

  async getUserRoles(userId: string): Promise<Role[]> {
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

    return (data || []).map((item: any) => {
      const role = item.roles;
      if (!role) return null;

      const permissions = (role.role_permissions || []).map((rp: any) => {
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
        role.id,
        role.name,
        permissions,
        role.description,
        role.is_system_role || false,
        new Date(role.created_at),
        new Date(role.updated_at)
      );
    }).filter(Boolean);
  }

  async getRoleUsers(roleId: string): Promise<string[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('user_roles')
      .select('user_id')
      .eq('role_id', roleId);

    if (error) throw error;
    return (data || []).map((item: any) => item.user_id);
  }
}
