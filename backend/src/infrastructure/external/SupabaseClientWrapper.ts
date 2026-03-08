// Infrastructure Layer - External Services
// Supabase client wrapper for domain layer abstraction

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Account } from '../../domain/entities/Account';
import { JournalEntry, JournalEntryStatus } from '../../domain/entities/JournalEntry';
import { User } from '../../domain/entities/User';
import { Money } from '../../domain/value-objects/Money';
import { AccountCode } from '../../domain/value-objects/AccountCode';

export class SupabaseClientWrapper {
  private client: SupabaseClient;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    serviceRoleKey?: string
  ) {
    // Use service role key if available for admin operations
    this.client = createClient(
      supabaseUrl,
      serviceRoleKey || supabaseKey
    );
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  // Account operations - using internal_accounts table
  async getAccountById(id: string): Promise<any> {
    const { data, error } = await this.client
      .from('internal_accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async getAccountByCode(code: string): Promise<any> {
    const { data, error } = await this.client
      .from('internal_accounts')
      .select('*')
      .eq('code', code)
      .single();

    if (error) throw error;
    return data;
  }

  async getAllAccounts(): Promise<any[]> {
    const { data, error } = await this.client
      .from('internal_accounts')
      .select('*')
      .order('code');

    if (error) throw error;
    return data || [];
  }

  async saveAccount(accountData: any): Promise<void> {
    // Map domain column names to database column names
    const dbData = {
      id: accountData.id,
      code: accountData.code,
      name: accountData.name,
      type: accountData.type,
      category: accountData.category,
      is_active: accountData.is_active ?? true
    };
    
    const { error } = await this.client
      .from('internal_accounts')
      .upsert(dbData);

    if (error) throw error;
  }

  // Journal Entry operations
  async getJournalEntryById(id: string): Promise<any> {
    const { data, error } = await this.client
      .from('journal_entries')
      .select(`
        *,
        journal_lines (*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async getNextEntryNumber(): Promise<number> {
    const { data, error } = await this.client
      .from('journal_entries')
      .select('entry_number')
      .order('entry_number', { ascending: false })
      .limit(1);

    if (error) throw error;
    return (data?.[0]?.entry_number || 0) + 1;
  }

  async saveJournalEntry(entryData: any, linesData: any[]): Promise<void> {
    const { error: entryError } = await this.client
      .from('journal_entries')
      .upsert(entryData);

    if (entryError) throw entryError;

    // Save lines if provided
    if (linesData.length > 0) {
      const { error: linesError } = await this.client
        .from('journal_lines')
        .upsert(linesData);

      if (linesError) throw linesError;
    }
  }

  // User operations
  async getUserById(id: string): Promise<any> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async getUserByEmail(email: string): Promise<any> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) throw error;
    return data;
  }

  async saveUser(userData: any): Promise<void> {
    const { error } = await this.client
      .from('users')
      .upsert(userData);

    if (error) throw error;
  }
}
