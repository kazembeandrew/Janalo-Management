// Infrastructure Layer - Repository Implementations
// UserRepository implementation using Supabase

import { User, UserRole } from '../../domain/entities/User';
import { IUserRepository } from '../../domain/repositories/interfaces';
import { SupabaseClientWrapper } from '../external/SupabaseClientWrapper';

export class UserRepository implements IUserRepository {
  constructor(private readonly supabase: SupabaseClientWrapper) {}

  async findById(id: string): Promise<User | null> {
    try {
      const data = await this.supabase.getUserById(id);
      return this.mapToDomain(data);
    } catch (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const data = await this.supabase.getUserByEmail(email);
      return this.mapToDomain(data);
    } catch (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
  }

  async findAll(): Promise<User[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(item => this.mapToDomain(item));
  }

  async save(user: User): Promise<void> {
    const data = this.mapToPersistence(user);
    await this.supabase.saveUser(data);
  }

  async update(user: User): Promise<void> {
    // Use upsert for updates
    await this.save(user);
  }

  async delete(id: string): Promise<void> {
    const client = this.supabase.getClient();
    const { error } = await client
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  private mapToDomain(data: any): User {
    if (!data) return null;

    return new User(
      data.id,
      data.email,
      data.full_name,
      data.role as UserRole,
      data.is_active ?? true,
      new Date(data.created_at),
      new Date(data.updated_at)
    );
  }

  private mapToPersistence(user: User): any {
    return {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      role: user.role,
      is_active: user.isActive,
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString()
    };
  }
}
