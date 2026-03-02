// Infrastructure Layer - Repository Implementations
// AccountRepository implementation using Supabase

import { Account, AccountType, AccountCategory } from '../../domain/entities/Account';
import { IAccountRepository } from '../../domain/repositories/interfaces';
import { AccountCode } from '../../domain/value-objects/AccountCode';
import { SupabaseClientWrapper } from '../external/SupabaseClientWrapper';

export class AccountRepository implements IAccountRepository {
  constructor(private readonly supabase: SupabaseClientWrapper) {}

  async findById(id: string): Promise<Account | null> {
    try {
      const data = await this.supabase.getAccountById(id);
      return this.mapToDomain(data);
    } catch (error) {
      // Return null if not found, throw for other errors
      if (error.code === 'PGRST116') return null;
      throw error;
    }
  }

  async findByCode(code: AccountCode): Promise<Account | null> {
    try {
      const data = await this.supabase.getAccountByCode(code.code);
      return this.mapToDomain(data);
    } catch (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
  }

  async findAll(): Promise<Account[]> {
    const data = await this.supabase.getAllAccounts();
    return data.map(item => this.mapToDomain(item));
  }

  async findByType(type: string): Promise<Account[]> {
    const allAccounts = await this.findAll();
    return allAccounts.filter(account => account.type === type);
  }

  async save(account: Account): Promise<void> {
    const data = this.mapToPersistence(account);
    await this.supabase.saveAccount(data);
  }

  async update(account: Account): Promise<void> {
    // For updates, we can use the same save method since it uses upsert
    await this.save(account);
  }

  async delete(id: string): Promise<void> {
    // Note: In a real system, you might want soft deletes
    // For now, we'll use a direct delete (implement in SupabaseClientWrapper if needed)
    const client = this.supabase.getClient();
    const { error } = await client
      .from('accounts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  private mapToDomain(data: any): Account {
    if (!data) return null;

    return new Account(
      data.id,
      new AccountCode(data.code),
      data.name,
      data.type as AccountType,
      data.category as AccountCategory,
      data.is_active ?? true,
      new Date(data.created_at),
      new Date(data.updated_at)
    );
  }

  private mapToPersistence(account: Account): any {
    return {
      id: account.id,
      code: account.code.code,
      name: account.name,
      type: account.type,
      category: account.category,
      is_active: account.isActive,
      created_at: account.createdAt.toISOString(),
      updated_at: account.updatedAt.toISOString()
    };
  }
}
