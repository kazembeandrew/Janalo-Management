// Domain Layer - Entities
// JournalEntry represents a double-entry accounting transaction

import { Money } from '../value-objects/Money';

export enum JournalEntryStatus {
  DRAFT = 'draft',
  POSTED = 'posted',
  VOIDED = 'voided'
}

export class JournalEntryLine {
  private readonly _id: string;
  private readonly _accountId: string;
  private readonly _debit: Money;
  private readonly _credit: Money;
  private readonly _description?: string;

  constructor(
    id: string,
    accountId: string,
    debit: Money,
    credit: Money,
    description?: string
  ) {
    if (!id) throw new Error('Journal entry line ID is required');
    if (!accountId) throw new Error('Account ID is required');

    // Validate that only one side has value (debit or credit, not both)
    if (debit.isPositive() && credit.isPositive()) {
      throw new Error('Journal entry line cannot have both debit and credit amounts');
    }
    if (debit.isZero() && credit.isZero()) {
      throw new Error('Journal entry line must have either debit or credit amount');
    }

    this._id = id;
    this._accountId = accountId;
    this._debit = debit;
    this._credit = credit;
    this._description = description;
  }

  get id(): string { return this._id; }
  get accountId(): string { return this._accountId; }
  get debit(): Money { return this._debit; }
  get credit(): Money { return this._credit; }
  get description(): string | undefined { return this._description; }

  getAmount(): Money {
    return this._debit.isPositive() ? this._debit : this._credit;
  }

  isDebit(): boolean {
    return this._debit.isPositive();
  }

  isCredit(): boolean {
    return this._credit.isPositive();
  }

  toJSON(): object {
    return {
      id: this._id,
      accountId: this._accountId,
      debit: this._debit.toJSON(),
      credit: this._credit.toJSON(),
      description: this._description
    };
  }
}

export class JournalEntry {
  private readonly _id: string;
  private readonly _entryNumber: number;
  private readonly _description: string;
  private readonly _entryDate: Date;
  private readonly _status: JournalEntryStatus;
  private readonly _lines: JournalEntryLine[];
  private readonly _createdBy: string;
  private readonly _approvedBy?: string;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;

  constructor(
    id: string,
    entryNumber: number,
    description: string,
    entryDate: Date,
    status: JournalEntryStatus,
    lines: JournalEntryLine[],
    createdBy: string,
    approvedBy?: string,
    createdAt: Date = new Date(),
    updatedAt: Date = new Date()
  ) {
    if (!id) throw new Error('Journal entry ID is required');
    if (!description || description.trim().length === 0) throw new Error('Description is required');
    if (!lines || lines.length === 0) throw new Error('Journal entry must have at least one line');
    if (!createdBy) throw new Error('Created by user ID is required');

    // Business rule: Journal entry must balance
    this.validateBalance(lines);

    // Business rule: Must have at least one debit and one credit (unless single line adjusting entry)
    this.validateDebitCreditPresence(lines);

    this._id = id;
    this._entryNumber = entryNumber;
    this._description = description;
    this._entryDate = entryDate;
    this._status = status;
    this._lines = [...lines]; // Defensive copy
    this._createdBy = createdBy;
    this._approvedBy = approvedBy;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  get id(): string { return this._id; }
  get entryNumber(): number { return this._entryNumber; }
  get description(): string { return this._description; }
  get entryDate(): Date { return this._entryDate; }
  get status(): JournalEntryStatus { return this._status; }
  get lines(): JournalEntryLine[] { return [...this._lines]; }
  get createdBy(): string { return this._createdBy; }
  get approvedBy(): string | undefined { return this._approvedBy; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  get totalDebit(): Money {
    return this._lines
      .filter(line => line.isDebit())
      .reduce((total, line) => total.add(line.debit), new Money(0));
  }

  get totalCredit(): Money {
    return this._lines
      .filter(line => line.isCredit())
      .reduce((total, line) => total.add(line.credit), new Money(0));
  }

  isBalanced(): boolean {
    return this.totalDebit.equals(this.totalCredit);
  }

  canBePosted(): boolean {
    return this._status === JournalEntryStatus.DRAFT && this.isBalanced();
  }

  canBeVoided(): boolean {
    return this._status === JournalEntryStatus.POSTED;
  }

  canBeEdited(): boolean {
    return this._status === JournalEntryStatus.DRAFT;
  }

  private validateBalance(lines: JournalEntryLine[]): void {
    const totalDebit = lines
      .filter(line => line.isDebit())
      .reduce((total, line) => total.add(line.debit), new Money(0));

    const totalCredit = lines
      .filter(line => line.isCredit())
      .reduce((total, line) => total.add(line.credit), new Money(0));

    if (!totalDebit.equals(totalCredit)) {
      throw new Error(`Journal entry must balance. Debits: ${totalDebit.toString()}, Credits: ${totalCredit.toString()}`);
    }
  }

  private validateDebitCreditPresence(lines: JournalEntryLine[]): void {
    const hasDebit = lines.some(line => line.isDebit());
    const hasCredit = lines.some(line => line.isCredit());

    if (!hasDebit || !hasCredit) {
      // Allow single-line entries only if they are adjusting entries (zero net effect)
      if (lines.length === 1) {
        throw new Error('Single-line journal entries are not allowed');
      }
      throw new Error('Journal entry must have at least one debit and one credit line');
    }
  }

  toJSON(): object {
    return {
      id: this._id,
      entryNumber: this._entryNumber,
      description: this._description,
      entryDate: this._entryDate.toISOString(),
      status: this._status,
      lines: this._lines.map(line => line.toJSON()),
      totalDebit: this.totalDebit.toJSON(),
      totalCredit: this.totalCredit.toJSON(),
      createdBy: this._createdBy,
      approvedBy: this._approvedBy,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString()
    };
  }

  equals(other: JournalEntry): boolean {
    return this._id === other._id;
  }
}
