// Domain Layer - Services
// AccountingService contains core business logic for double-entry accounting

import { randomUUID } from 'crypto';
import { Account, AccountType } from '../entities/Account';
import { JournalEntry, JournalEntryStatus, JournalEntryLine } from '../entities/JournalEntry';
import { User } from '../entities/User';
import { Money } from '../value-objects/Money';
import { AccountCode } from '../value-objects/AccountCode';
import { IAccountRepository, IJournalEntryRepository, IUserRepository } from '../repositories/interfaces';

export class AccountingService {
  constructor(
    private readonly accountRepo: IAccountRepository,
    private readonly journalEntryRepo: IJournalEntryRepository,
    private readonly userRepo: IUserRepository
  ) {}

  async getJournalEntryById(id: string): Promise<JournalEntry | null> {
    return await this.journalEntryRepo.findById(id);
  }

  async getJournalEntries(options: {
    status?: JournalEntryStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ entries: JournalEntry[]; total: number }> {
    const { status, startDate, endDate, limit = 50, offset = 0 } = options;

    let entries: JournalEntry[];

    if (startDate && endDate) {
      entries = await this.journalEntryRepo.findByDateRange(startDate, endDate);
    } else if (status) {
      entries = await this.journalEntryRepo.findByStatus(status);
    } else {
      // No "find all" method exists yet; approximate by pulling posted then draft then voided.
      const [posted, draft, voided] = await Promise.all([
        this.journalEntryRepo.findByStatus(JournalEntryStatus.POSTED),
        this.journalEntryRepo.findByStatus(JournalEntryStatus.DRAFT),
        this.journalEntryRepo.findByStatus(JournalEntryStatus.VOIDED)
      ]);
      entries = [...posted, ...draft, ...voided].sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime());
    }

    if (status && !(startDate && endDate)) {
      // already filtered
    } else if (status) {
      entries = entries.filter(e => e.status === status);
    }

    const total = entries.length;
    const paginated = entries.slice(offset, offset + limit);

    return { entries: paginated, total };
  }

  // Core business operation: Create a journal entry
  async createJournalEntry(
    description: string,
    entryDate: Date,
    lines: Array<{
      accountId: string;
      debit?: number;
      credit?: number;
      description?: string;
    }>,
    createdByUserId: string
  ): Promise<JournalEntry> {
    // Validate user permissions
    const user = await this.userRepo.findById(createdByUserId);
    if (!user || !user.canCreateJournalEntries()) {
      throw new Error('User does not have permission to create journal entries');
    }

    // Validate all accounts exist and are active
    const accountIds = [...new Set(lines.map(line => line.accountId))];
    const accounts = await Promise.all(
      accountIds.map(id => this.accountRepo.findById(id))
    );

    const invalidAccounts = accounts.filter(acc => !acc || !acc.isActive);
    if (invalidAccounts.length > 0) {
      throw new Error('One or more accounts are invalid or inactive');
    }

    // Convert to domain objects
    const journalLines = lines.map((line, index) => {
      const debit = typeof line.debit === 'number' && line.debit > 0 ? new Money(line.debit) : new Money(0);
      const credit = typeof line.credit === 'number' && line.credit > 0 ? new Money(line.credit) : new Money(0);

      return new JournalEntryLine(
        randomUUID(),
        line.accountId,
        debit,
        credit,
        line.description
      );
    });

    // Get next entry number
    const entryNumber = await this.journalEntryRepo.getNextEntryNumber();

    // Create journal entry (validation happens in constructor)
    const entry = new JournalEntry(
      randomUUID(),
      entryNumber,
      description,
      entryDate,
      JournalEntryStatus.DRAFT,
      journalLines,
      createdByUserId
    );

    // Validate against account rules
    await this.validateJournalEntryAgainstAccounts(entry, accounts as Account[]);

    return await this.journalEntryRepo.save(entry);
  }

  // Post a draft journal entry
  async postJournalEntry(entryId: string, approvedByUserId: string): Promise<JournalEntry> {
    const entry = await this.journalEntryRepo.findById(entryId);
    if (!entry) {
      throw new Error('Journal entry not found');
    }

    if (!entry.canBePosted()) {
      throw new Error('Journal entry cannot be posted');
    }

    // Validate approver permissions
    const approver = await this.userRepo.findById(approvedByUserId);
    if (!approver || !approver.canApproveJournalEntries()) {
      throw new Error('User does not have permission to approve journal entries');
    }

    // Create posted version
    const postedEntry = new JournalEntry(
      entry.id,
      entry.entryNumber,
      entry.description,
      entry.entryDate,
      JournalEntryStatus.POSTED,
      entry.lines,
      entry.createdBy,
      approvedByUserId,
      entry.createdAt,
      new Date()
    );

    return await this.journalEntryRepo.update(postedEntry);
  }

  // Calculate account balance
  async getAccountBalance(accountId: string, asOfDate?: Date): Promise<Money> {
    const account = await this.accountRepo.findById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    // Get all posted journal entries affecting this account
    const entries = await this.journalEntryRepo.findByAccount(accountId);

    let balance = new Money(0);

    for (const entry of entries) {
      // Skip entries after the specified date
      if (asOfDate && entry.entryDate > asOfDate) {
        continue;
      }

      // Only consider posted entries
      if (entry.status !== JournalEntryStatus.POSTED) {
        continue;
      }

      // Find lines for this account
      const accountLines = entry.lines.filter(line => line.accountId === accountId);

      for (const line of accountLines) {
        if (line.isDebit()) {
          balance = account.canHaveDebitBalance()
            ? balance.add(line.debit)
            : balance.subtract(line.debit);
        } else {
          balance = account.canHaveCreditBalance()
            ? balance.add(line.credit)
            : balance.subtract(line.credit);
        }
      }
    }

    return balance;
  }

  // Validate journal entry against account rules
  private async validateJournalEntryAgainstAccounts(
    entry: JournalEntry,
    accounts: Account[]
  ): Promise<void> {
    const accountMap = new Map(accounts.map(acc => [acc.id, acc]));

    for (const line of entry.lines) {
      const account = accountMap.get(line.accountId);
      if (!account) {
        throw new Error(`Account ${line.accountId} not found`);
      }

      // Validate account balance rules
      if (line.isDebit() && !account.canHaveDebitBalance()) {
        throw new Error(`Account ${account.code.code} (${account.type}) cannot have debit balances`);
      }

      if (line.isCredit() && !account.canHaveCreditBalance()) {
        throw new Error(`Account ${account.code.code} (${account.type}) cannot have credit balances`);
      }
    }
  }

  // Generate trial balance
  async generateTrialBalance(asOfDate: Date): Promise<Array<{
    account: Account;
    debitBalance: Money;
    creditBalance: Money;
  }>> {
    const accounts = await this.accountRepo.findAll();
    const trialBalance = [];

    for (const account of accounts) {
      const balance = await this.getAccountBalance(account.id, asOfDate);

      const balanceData = {
        account,
        debitBalance: account.canHaveDebitBalance() && balance.isPositive() ? balance : new Money(0),
        creditBalance: account.canHaveCreditBalance() && balance.isPositive() ? balance : new Money(0)
      };

      trialBalance.push(balanceData);
    }

    return trialBalance;
  }

  // Validate double-entry compliance
  validateDoubleEntryPrinciple(lines: JournalEntryLine[]): boolean {
    const totalDebits = lines
      .filter(line => line.isDebit())
      .reduce((total, line) => total.add(line.debit), new Money(0));

    const totalCredits = lines
      .filter(line => line.isCredit())
      .reduce((total, line) => total.add(line.credit), new Money(0));

    return totalDebits.equals(totalCredits);
  }
}
