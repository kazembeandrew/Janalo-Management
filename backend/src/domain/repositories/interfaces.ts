// Domain Layer - Repository Interfaces
// These define the contracts for data access, keeping domain layer independent of infrastructure

import { Account } from '../entities/Account';
import { JournalEntry, JournalEntryStatus } from '../entities/JournalEntry';
import { User } from '../entities/User';
import { AccountCode } from '../value-objects/AccountCode';

export interface IAccountRepository {
  findById(id: string): Promise<Account | null>;
  findByCode(code: AccountCode): Promise<Account | null>;
  findAll(): Promise<Account[]>;
  findByType(type: string): Promise<Account[]>;
  save(account: Account): Promise<void>;
  update(account: Account): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface IJournalEntryRepository {
  findById(id: string): Promise<JournalEntry | null>;
  findByEntryNumber(entryNumber: number): Promise<JournalEntry | null>;
  findByStatus(status: JournalEntryStatus): Promise<JournalEntry[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<JournalEntry[]>;
  findByAccount(accountId: string): Promise<JournalEntry[]>;
  save(entry: JournalEntry): Promise<JournalEntry>;
  update(entry: JournalEntry): Promise<JournalEntry>;
  delete(id: string): Promise<void>;
  getNextEntryNumber(): Promise<number>;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  save(user: User): Promise<void>;
  update(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}
