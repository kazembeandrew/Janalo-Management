// Domain Layer - Services
// Enhanced AccountingService with caching and async processing

import { Account } from '../entities/Account';
import { JournalEntry, JournalEntryStatus, JournalEntryLine } from '../entities/JournalEntry';
import { User } from '../entities/User';
import { Money } from '../value-objects/Money';
import { IAccountRepository, IJournalEntryRepository, IUserRepository } from '../repositories/interfaces';
import { CacheService } from './CacheService';

export class EnhancedAccountingService {
  constructor(
    private readonly accountRepo: IAccountRepository,
    private readonly journalEntryRepo: IJournalEntryRepository,
    private readonly userRepo: IUserRepository,
    private readonly cacheService: CacheService
  ) {}

  // Enhanced journal entry creation with caching invalidation
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
    // Validate user permissions (unchanged)
    const user = await this.userRepo.findById(createdByUserId);
    if (!user || !user.canCreateJournalEntries()) {
      throw new Error('User does not have permission to create journal entries');
    }

    // Validate accounts (unchanged)
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
      const debit = line.debit ? new Money(line.debit) : new Money(0);
      const credit = line.credit ? new Money(line.credit) : new Money(0);

      return new JournalEntryLine(
        `temp-${index}`,
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
      '',
      entryNumber,
      description,
      entryDate,
      JournalEntryStatus.DRAFT,
      journalLines,
      createdByUserId
    );

    // Validate against account rules
    await this.validateJournalEntryAgainstAccounts(entry, accounts as Account[]);

    // Save and return
    const savedEntry = await this.journalEntryRepo.save(entry);

    // Invalidate related caches (account balances will be recalculated when posted)
    // Don't invalidate now since it's still draft

    return savedEntry;
  }

  // Enhanced account balance with caching
  async getAccountBalance(accountId: string, asOfDate?: Date): Promise<Money> {
    // Try cache first
    const fiscalPeriod = asOfDate ? this.formatFiscalPeriod(asOfDate) : undefined;
    const cachedBalance = await this.cacheService.getCachedAccountBalance(accountId, fiscalPeriod);

    if (cachedBalance) {
      console.log(`💰 Cache hit for account ${accountId} balance`);
      return cachedBalance;
    }

    // Cache miss - calculate from database
    console.log(`💰 Cache miss for account ${accountId} balance - calculating`);
    const balance = await this.calculateAccountBalance(accountId, asOfDate);

    // Cache the result
    await this.cacheService.setCachedAccountBalance(accountId, balance, fiscalPeriod);

    return balance;
  }

  // Enhanced trial balance with caching and async processing
  async generateTrialBalance(asOfDate: Date): Promise<Array<{
    account: Account;
    debitBalance: Money;
    creditBalance: Money;
  }>> {
    const dateKey = this.formatDateKey(asOfDate);

    // Try cache first
    const cached = await this.cacheService.getCachedTrialBalance(dateKey);
    if (cached) {
      console.log(`📊 Cache hit for trial balance ${dateKey}`);
      return cached;
    }

    // Cache miss - generate asynchronously if it's a complex operation
    console.log(`📊 Cache miss for trial balance ${dateKey} - generating`);

    // For large datasets, this could be processed asynchronously
    const trialBalance = await this.generateTrialBalanceSync(asOfDate);

    // Cache the result
    await this.cacheService.setCachedTrialBalance(dateKey, trialBalance);

    return trialBalance;
  }

  // Async report generation for complex reports
  async generateReportAsync(
    reportType: 'trial_balance' | 'income_statement' | 'balance_sheet',
    parameters: Record<string, any>,
    userId: string
  ): Promise<string> {
    // Generate a job ID for async processing
    const jobId = `report_${Date.now()}_${userId}`;

    // Start async processing (in a real system, this would use a queue like Bull or similar)
    setImmediate(async () => {
      try {
        console.log(`📋 Starting async report generation: ${reportType} for user ${userId}`);

        let reportData: any;

        switch (reportType) {
          case 'trial_balance':
            reportData = await this.generateTrialBalance(new Date(parameters.asOfDate));
            break;
          case 'income_statement':
            reportData = await this.generateIncomeStatement(parameters);
            break;
          case 'balance_sheet':
            reportData = await this.generateBalanceSheet(parameters);
            break;
        }

        // Cache the result
        await this.cacheService.setCachedReport(reportType, parameters, reportData);

        console.log(`✅ Async report generation completed: ${reportType}`);

        // In a real system, you'd update a job status table here
        // await this.updateJobStatus(jobId, 'completed', reportData);

      } catch (error) {
        console.error(`❌ Async report generation failed: ${reportType}`, error);
        // await this.updateJobStatus(jobId, 'failed', null, error.message);
      }
    });

    return jobId;
  }

  // Batch account balance calculations for performance
  async getMultipleAccountBalances(
    accountIds: string[],
    asOfDate?: Date
  ): Promise<Map<string, Money>> {
    const results = new Map<string, Money>();
    const fiscalPeriod = asOfDate ? this.formatFiscalPeriod(asOfDate) : undefined;

    // Check cache first for all accounts
    const cachePromises = accountIds.map(async (accountId) => {
      const cached = await this.cacheService.getCachedAccountBalance(accountId, fiscalPeriod);
      return { accountId, balance: cached };
    });

    const cacheResults = await Promise.all(cachePromises);

    // Separate hits and misses
    const hits: Array<{ accountId: string; balance: Money }> = [];
    const misses: string[] = [];

    cacheResults.forEach(result => {
      if (result.balance) {
        hits.push(result as { accountId: string; balance: Money });
      } else {
        misses.push(result.accountId);
      }
    });

    console.log(`💰 Cache: ${hits.length} hits, ${misses.length} misses for ${accountIds.length} accounts`);

    // Add cache hits to results
    hits.forEach(hit => results.set(hit.accountId, hit.balance));

    // Calculate misses and cache them
    if (misses.length > 0) {
      const calculationPromises = misses.map(async (accountId) => {
        const balance = await this.calculateAccountBalance(accountId, asOfDate);
        await this.cacheService.setCachedAccountBalance(accountId, balance, fiscalPeriod);
        return { accountId, balance };
      });

      const calculations = await Promise.all(calculationPromises);
      calculations.forEach(calc => results.set(calc.accountId, calc.balance));
    }

    return results;
  }

  // Enhanced posting with cache invalidation
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

    const savedEntry = await this.journalEntryRepo.save(postedEntry);

    // Invalidate caches for affected accounts
    const affectedAccountIds = entry.lines.map(line => line.accountId);
    await this.cacheService.invalidateJournalEntryRelated(affectedAccountIds);

    return savedEntry;
  }

  // Private helper methods
  private async calculateAccountBalance(accountId: string, asOfDate?: Date): Promise<Money> {
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

  private async generateTrialBalanceSync(asOfDate: Date): Promise<Array<{
    account: Account;
    debitBalance: Money;
    creditBalance: Money;
  }>> {
    const accounts = await this.accountRepo.findAll();
    const trialBalance = [];

    // Use batch balance calculation for better performance
    const accountIds = accounts.map(acc => acc.id);
    const balances = await this.getMultipleAccountBalances(accountIds, asOfDate);

    for (const account of accounts) {
      const balance = balances.get(account.id) || new Money(0);

      const balanceData = {
        account,
        debitBalance: account.canHaveDebitBalance() && balance.isPositive() ? balance : new Money(0),
        creditBalance: account.canHaveCreditBalance() && balance.isPositive() ? balance : new Money(0)
      };

      trialBalance.push(balanceData);
    }

    return trialBalance;
  }

  private async generateIncomeStatement(parameters: any): Promise<any> {
    // Implementation for income statement generation
    // This would calculate revenues, expenses, and net income
    throw new Error('Income statement generation not yet implemented');
  }

  private async generateBalanceSheet(parameters: any): Promise<any> {
    // Implementation for balance sheet generation
    // This would calculate assets, liabilities, and equity
    throw new Error('Balance sheet generation not yet implemented');
  }

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

  private validateDoubleEntryPrinciple(lines: JournalEntryLine[]): boolean {
    const totalDebits = lines
      .filter(line => line.isDebit())
      .reduce((total, line) => total.add(line.debit), new Money(0));

    const totalCredits = lines
      .filter(line => line.isCredit())
      .reduce((total, line) => total.add(line.credit), new Money(0));

    return totalDebits.equals(totalCredits);
  }

  private formatFiscalPeriod(date: Date): string {
    // Format as YYYY-MM for monthly periods
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private formatDateKey(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }
}
