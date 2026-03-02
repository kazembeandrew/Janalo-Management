// Infrastructure Layer - Repository Implementations
// PermissionRepository implementation using Supabase

import { Permission } from '../../domain/entities/Permission';
import { IPermissionRepository } from '../../domain/repositories/rbac-interfaces';
import { SupabaseClientWrapper } from '../external/SupabaseClientWrapper';

export class PermissionRepository implements IPermissionRepository {
  constructor(private readonly supabase: SupabaseClientWrapper) {}

  async findById(id: string): Promise<Permission | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('permissions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapToDomain(data);
  }

  async findByResourceAction(resource: string, action: string): Promise<Permission | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('permissions')
      .select('*')
      .eq('resource', resource)
      .eq('action', action)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapToDomain(data);
  }

  async findAll(): Promise<Permission[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('permissions')
      .select('*')
      .order('resource', { ascending: true })
      .order('action', { ascending: true });

    if (error) throw error;
    return (data || []).map(item => this.mapToDomain(item));
  }

  async findByResource(resource: string): Promise<Permission[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('permissions')
      .select('*')
      .eq('resource', resource)
      .order('action', { ascending: true });

    if (error) throw error;
    return (data || []).map(item => this.mapToDomain(item));
  }

  async save(permission: Permission): Promise<void> {
    const data = this.mapToPersistence(permission);
    const client = this.supabase.getClient();
    const { error } = await client
      .from('permissions')
      .upsert(data);

    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const client = this.supabase.getClient();
    const { error } = await client
      .from('permissions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  private mapToDomain(data: any): Permission {
    if (!data) return null;

    return new Permission(
      data.id,
      data.resource,
      data.action,
      data.description,
      new Date(data.created_at)
    );
  }

  private mapToPersistence(permission: Permission): any {
    return {
      id: permission.id,
      resource: permission.resource,
      action: permission.action,
      description: permission.description,
      created_at: permission.createdAt.toISOString()
    };
  }
}
