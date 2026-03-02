// Infrastructure Layer - Repository Implementations
// JournalEntryRepository implementation using Supabase

import { JournalEntry, JournalEntryStatus, JournalEntryLine } from '../../domain/entities/JournalEntry';
import { IJournalEntryRepository } from '../../domain/repositories/interfaces';
import { Money } from '../../domain/value-objects/Money';
import { SupabaseClientWrapper } from '../external/SupabaseClientWrapper';

export class JournalEntryRepository implements IJournalEntryRepository {
  constructor(private readonly supabase: SupabaseClientWrapper) {}

  async findById(id: string): Promise<JournalEntry | null> {
    try {
      const data = await this.supabase.getJournalEntryById(id);
      return this.mapToDomain(data);
    } catch (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
  }

  async findByEntryNumber(entryNumber: number): Promise<JournalEntry | null> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('journal_entries')
      .select(`
        *,
        journal_lines (*)
      `)
      .eq('entry_number', entryNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapToDomain(data);
  }

  async findByStatus(status: JournalEntryStatus): Promise<JournalEntry[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('journal_entries')
      .select(`
        *,
        journal_lines (*)
      `)
      .eq('status', status)
      .order('entry_date', { ascending: false });

    if (error) throw error;
    return (data || []).map(item => this.mapToDomain(item));
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<JournalEntry[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('journal_entries')
      .select(`
        *,
        journal_lines (*)
      `)
      .gte('entry_date', startDate.toISOString().split('T')[0])
      .lte('entry_date', endDate.toISOString().split('T')[0])
      .order('entry_date', { ascending: false });

    if (error) throw error;
    return (data || []).map(item => this.mapToDomain(item));
  }

  async findByAccount(accountId: string): Promise<JournalEntry[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('journal_entries')
      .select(`
        *,
        journal_lines!inner (*)
      `)
      .eq('journal_lines.account_id', accountId)
      .eq('status', JournalEntryStatus.POSTED)
      .order('entry_date', { ascending: false });

    if (error) throw error;
    return (data || []).map(item => this.mapToDomain(item));
  }

  async save(entry: JournalEntry): Promise<void> {
    const { entryData, linesData } = this.mapToPersistence(entry);
    await this.supabase.saveJournalEntry(entryData, linesData);
  }

  async update(entry: JournalEntry): Promise<void> {
    // Use upsert for updates
    await this.save(entry);
  }

  async delete(id: string): Promise<void> {
    const client = this.supabase.getClient();

    // Delete lines first (foreign key constraint)
    await client.from('journal_lines').delete().eq('journal_entry_id', id);

    // Delete entry
    const { error } = await client
      .from('journal_entries')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getNextEntryNumber(): Promise<number> {
    return await this.supabase.getNextEntryNumber();
  }

  private mapToDomain(data: any): JournalEntry {
    if (!data) return null;

    const lines = (data.journal_lines || []).map((line: any) =>
      new JournalEntryLine(
        line.id,
        line.account_id,
        new Money(line.debit || 0),
        new Money(line.credit || 0),
        line.description
      )
    );

    return new JournalEntry(
      data.id,
      data.entry_number,
      data.description,
      new Date(data.entry_date),
      data.status as JournalEntryStatus,
      lines,
      data.created_by,
      data.approved_by,
      new Date(data.created_at),
      new Date(data.updated_at)
    );
  }

  private mapToPersistence(entry: JournalEntry): { entryData: any, linesData: any[] } {
    const entryData = {
      id: entry.id,
      entry_number: entry.entryNumber,
      description: entry.description,
      entry_date: entry.entryDate.toISOString().split('T')[0],
      status: entry.status,
      created_by: entry.createdBy,
      approved_by: entry.approvedBy,
      created_at: entry.createdAt.toISOString(),
      updated_at: entry.updatedAt.toISOString()
    };

    const linesData = entry.lines.map(line => ({
      id: line.id,
      journal_entry_id: entry.id,
      account_id: line.accountId,
      debit: line.debit.amount,
      credit: line.credit.amount,
      description: line.description
    }));

    return { entryData, linesData };
  }
}
