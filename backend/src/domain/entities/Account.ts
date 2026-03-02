// Domain Layer - Entities
// Account represents a chart of accounts entry

export enum AccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSE = 'expense'
}

export enum AccountCategory {
  CURRENT_ASSET = 'current_asset',
  FIXED_ASSET = 'fixed_asset',
  CURRENT_LIABILITY = 'current_liability',
  LONG_TERM_LIABILITY = 'long_term_liability',
  OWNERS_EQUITY = 'owners_equity',
  RETAINED_EARNINGS = 'retained_earnings',
  OPERATING_REVENUE = 'operating_revenue',
  OTHER_REVENUE = 'other_revenue',
  COST_OF_GOODS_SOLD = 'cost_of_goods_sold',
  OPERATING_EXPENSE = 'operating_expense',
  OTHER_EXPENSE = 'other_expense'
}

export class Account {
  private readonly _id: string;
  private readonly _code: AccountCode;
  private readonly _name: string;
  private readonly _type: AccountType;
  private readonly _category: AccountCategory;
  private readonly _isActive: boolean;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;

  constructor(
    id: string,
    code: AccountCode,
    name: string,
    type: AccountType,
    category: AccountCategory,
    isActive: boolean = true,
    createdAt: Date = new Date(),
    updatedAt: Date = new Date()
  ) {
    if (!id) throw new Error('Account ID is required');
    if (!name || name.trim().length === 0) throw new Error('Account name is required');
    if (!Object.values(AccountType).includes(type)) throw new Error('Invalid account type');
    if (!Object.values(AccountCategory).includes(category)) throw new Error('Invalid account category');

    // Validate type-category consistency
    this.validateTypeCategoryConsistency(type, category);

    this._id = id;
    this._code = code;
    this._name = name;
    this._type = type;
    this._category = category;
    this._isActive = isActive;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  get id(): string { return this._id; }
  get code(): AccountCode { return this._code; }
  get name(): string { return this._name; }
  get type(): AccountType { return this._type; }
  get category(): AccountCategory { return this._category; }
  get isActive(): boolean { return this._isActive; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  // Business rules
  canHaveDebitBalance(): boolean {
    return [AccountType.ASSET, AccountType.EXPENSE].includes(this._type);
  }

  canHaveCreditBalance(): boolean {
    return [AccountType.LIABILITY, AccountType.EQUITY, AccountType.REVENUE].includes(this._type);
  }

  isBalanceSheetAccount(): boolean {
    return [AccountType.ASSET, AccountType.LIABILITY, AccountType.EQUITY].includes(this._type);
  }

  isIncomeStatementAccount(): boolean {
    return [AccountType.REVENUE, AccountType.EXPENSE].includes(this._type);
  }

  private validateTypeCategoryConsistency(type: AccountType, category: AccountCategory): void {
    const typeCategoryMap: Record<AccountType, AccountCategory[]> = {
      [AccountType.ASSET]: [AccountCategory.CURRENT_ASSET, AccountCategory.FIXED_ASSET],
      [AccountType.LIABILITY]: [AccountCategory.CURRENT_LIABILITY, AccountCategory.LONG_TERM_LIABILITY],
      [AccountType.EQUITY]: [AccountCategory.OWNERS_EQUITY, AccountCategory.RETAINED_EARNINGS],
      [AccountType.REVENUE]: [AccountCategory.OPERATING_REVENUE, AccountCategory.OTHER_REVENUE],
      [AccountType.EXPENSE]: [AccountCategory.COST_OF_GOODS_SOLD, AccountCategory.OPERATING_EXPENSE, AccountCategory.OTHER_EXPENSE]
    };

    if (!typeCategoryMap[type].includes(category)) {
      throw new Error(`Account category ${category} is not valid for account type ${type}`);
    }
  }

  toJSON(): object {
    return {
      id: this._id,
      code: this._code.toJSON(),
      name: this._name,
      type: this._type,
      category: this._category,
      isActive: this._isActive,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString()
    };
  }

  equals(other: Account): boolean {
    return this._id === other._id;
  }
}
