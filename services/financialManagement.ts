import { 
  BaseServiceClass, 
  ServiceResult, 
  PaginationParams, 
  SortParams, 
  FilterParams, 
  ListResponse 
} from './_shared/baseService';
import { 
  AccountTree, 
  AccountingPeriod, 
  Account, 
  BudgetVariance, 
  CashFlowProjection,
  InvestmentPortfolio 
} from '../types';
import { validateRequiredFields } from './_shared/utils';
import { auditService } from './audit';
import { supabase } from '@/lib/supabase';

// ============================================
// ACCOUNT TREE SERVICE
// ============================================

interface AccountTreeFilters extends FilterParams {
  parent_id?: string;
  level?: number;
  is_active?: boolean;
}

export class AccountTreeService extends BaseServiceClass {
  private static instance: AccountTreeService;

  public static getInstance(): AccountTreeService {
    if (!AccountTreeService.instance) {
      AccountTreeService.instance = new AccountTreeService();
    }
    return AccountTreeService.instance;
  }

  async createAccountTree(input: Omit<AccountTree, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<AccountTree>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['account_id', 'name', 'level', 'path'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('account_tree')
        .insert([{ ...input, sort_order: input.sort_order || 0, is_active: input.is_active !== false }])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'account_tree', (data as any).id, input);
      return data as AccountTree;
    }, 'Failed to create account tree');
  }

  async getAccountTree(id: string): Promise<ServiceResult<AccountTree>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('account_tree').select().eq('id', id).single();
      if (error) throw error;
      return data as AccountTree;
    }, 'Failed to get account tree');
  }

  async getAccountTrees(filters?: AccountTreeFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<AccountTree>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('account_tree').select('*', { count: 'exact' });
      
      if (filters?.parent_id) query = query.eq('parent_id', filters.parent_id);
      if (filters?.level !== undefined) query = query.eq('level', filters.level);
      if (filters?.is_active !== undefined) query = query.eq('is_active', filters.is_active);

      if (sort) {
        query = query.order(sort.sortBy || 'sort_order', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('sort_order', { ascending: true });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 50;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as AccountTree[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get account trees');
  }

  async updateAccountTree(id: string, updates: Partial<AccountTree>): Promise<ServiceResult<AccountTree>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('account_tree').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'account_tree', id, updates);
      return data as AccountTree;
    }, 'Failed to update account tree');
  }

  async deleteAccountTree(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('account_tree').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'account_tree', id, {});
      return true;
    }, 'Failed to delete account tree');
  }

  async getTreeByAccount(accountId: string): Promise<ServiceResult<AccountTree>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('account_tree').select().eq('account_id', accountId).single();
      if (error) throw error;
      return data as AccountTree;
    }, 'Failed to get account tree by account');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// ============================================
// ACCOUNTING PERIOD SERVICE
// ============================================

interface AccountingPeriodFilters extends FilterParams {
  fiscal_year?: string;
  is_active?: boolean;
  is_closed?: boolean;
}

export class AccountingPeriodService extends BaseServiceClass {
  private static instance: AccountingPeriodService;

  public static getInstance(): AccountingPeriodService {
    if (!AccountingPeriodService.instance) {
      AccountingPeriodService.instance = new AccountingPeriodService();
    }
    return AccountingPeriodService.instance;
  }

  async createAccountingPeriod(input: Omit<AccountingPeriod, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<AccountingPeriod>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['name', 'start_date', 'end_date', 'fiscal_year'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('accounting_periods')
        .insert([{ ...input, is_active: input.is_active !== false, is_closed: input.is_closed || false }])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'accounting_period', (data as any).id, input);
      return data as AccountingPeriod;
    }, 'Failed to create accounting period');
  }

  async getAccountingPeriod(id: string): Promise<ServiceResult<AccountingPeriod>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('accounting_periods').select().eq('id', id).single();
      if (error) throw error;
      return data as AccountingPeriod;
    }, 'Failed to get accounting period');
  }

  async getAccountingPeriods(filters?: AccountingPeriodFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<AccountingPeriod>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('accounting_periods').select('*', { count: 'exact' });
      
      if (filters?.fiscal_year) query = query.eq('fiscal_year', filters.fiscal_year);
      if (filters?.is_active !== undefined) query = query.eq('is_active', filters.is_active);
      if (filters?.is_closed !== undefined) query = query.eq('is_closed', filters.is_closed);

      if (sort) {
        query = query.order(sort.sortBy || 'start_date', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('start_date', { ascending: false });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as AccountingPeriod[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get accounting periods');
  }

  async updateAccountingPeriod(id: string, updates: Partial<AccountingPeriod>): Promise<ServiceResult<AccountingPeriod>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('accounting_periods').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'accounting_period', id, updates);
      return data as AccountingPeriod;
    }, 'Failed to update accounting period');
  }

  async closeAccountingPeriod(id: string, userId: string): Promise<ServiceResult<AccountingPeriod>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('accounting_periods')
        .update({ is_closed: true, closed_at: new Date().toISOString(), closed_by: userId })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('close_period', 'accounting_period', id, { closed_by: userId });
      return data as AccountingPeriod;
    }, 'Failed to close accounting period');
  }

  async deleteAccountingPeriod(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('accounting_periods').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'accounting_period', id, {});
      return true;
    }, 'Failed to delete accounting period');
  }

  async getCurrentPeriod(): Promise<ServiceResult<AccountingPeriod>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('accounting_periods')
        .select()
        .eq('is_active', true)
        .eq('is_closed', false)
        .order('start_date', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as AccountingPeriod;
    }, 'Failed to get current accounting period');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// ============================================
// ACCOUNT SERVICE
// ============================================

interface AccountFilters extends FilterParams {
  account_type?: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  is_active?: boolean;
  is_system_account?: boolean;
  parent_id?: string;
}

export class AccountServiceExtended extends BaseServiceClass {
  private static instance: AccountServiceExtended;

  public static getInstance(): AccountServiceExtended {
    if (!AccountServiceExtended.instance) {
      AccountServiceExtended.instance = new AccountServiceExtended();
    }
    return AccountServiceExtended.instance;
  }

  async createAccount(input: Omit<Account, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<Account>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['account_code', 'name', 'account_type'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('accounts')
        .insert([{ ...input, is_active: input.is_active !== false, is_system_account: input.is_system_account || false, balance: input.balance || 0, currency: input.currency || 'MWK' }])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'account', data.id, input);
      return data as Account;
    }, 'Failed to create account');
  }

  async getAccount(id: string): Promise<ServiceResult<Account>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('accounts').select().eq('id', id).single();
      if (error) throw error;
      return data as Account;
    }, 'Failed to get account');
  }

  async getAccounts(filters?: AccountFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<Account>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('accounts').select('*', { count: 'exact' });
      
      if (filters?.account_type) query = query.eq('account_type', filters.account_type);
      if (filters?.is_active !== undefined) query = query.eq('is_active', filters.is_active);
      if (filters?.is_system_account !== undefined) query = query.eq('is_system_account', filters.is_system_account);
      if (filters?.parent_id) query = query.eq('parent_id', filters.parent_id);

      if (sort) {
        query = query.order(sort.sortBy || 'account_code', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('account_code', { ascending: true });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 50;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as Account[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get accounts');
  }

  async updateAccount(id: string, updates: Partial<Account>): Promise<ServiceResult<Account>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('accounts').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'account', id, updates);
      return data as Account;
    }, 'Failed to update account');
  }

  async deleteAccount(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('accounts').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'account', id, {});
      return true;
    }, 'Failed to delete account');
  }

  async getAccountByCode(code: string): Promise<ServiceResult<Account>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('accounts').select().eq('account_code', code).single();
      if (error) throw error;
      return data as Account;
    }, 'Failed to get account by code');
  }

  async updateAccountBalance(id: string, newBalance: number): Promise<ServiceResult<Account>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('accounts')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('update_balance', 'account', id, { old_balance: 0, new_balance: newBalance });
      return data as Account;
    }, 'Failed to update account balance');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// ============================================
// BUDGET VARIANCE SERVICE
// ============================================

interface BudgetVarianceFilters extends FilterParams {
  budget_id?: string;
  account_id?: string;
  period_id?: string;
  variance_type?: 'favorable' | 'unfavorable' | 'neutral';
}

export class BudgetVarianceService extends BaseServiceClass {
  private static instance: BudgetVarianceService;

  public static getInstance(): BudgetVarianceService {
    if (!BudgetVarianceService.instance) {
      BudgetVarianceService.instance = new BudgetVarianceService();
    }
    return BudgetVarianceService.instance;
  }

  async createBudgetVariance(input: Omit<BudgetVariance, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<BudgetVariance>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['budget_id', 'account_id', 'period_id', 'budgeted_amount', 'actual_amount'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const varianceAmount = input.actual_amount - input.budgeted_amount;
      const variancePercentage = input.budgeted_amount !== 0 ? ((varianceAmount / input.budgeted_amount) * 100) : 0;
      const varianceType = varianceAmount === 0 ? 'neutral' : varianceAmount > 0 ? 'unfavorable' : 'favorable';

      const { data, error } = await (supabase as any)
        .from('budget_variance')
        .insert([{ ...input, variance_amount: varianceAmount, variance_percentage: variancePercentage, variance_type: varianceType }])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'budget_variance', (data as any).id, input);
      return data as BudgetVariance;
    }, 'Failed to create budget variance');
  }

  async getBudgetVariance(id: string): Promise<ServiceResult<BudgetVariance>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('budget_variance').select().eq('id', id).single();
      if (error) throw error;
      return data as BudgetVariance;
    }, 'Failed to get budget variance');
  }

  async getBudgetVariances(filters?: BudgetVarianceFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<BudgetVariance>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('budget_variance').select('*', { count: 'exact' });
      
      if (filters?.budget_id) query = query.eq('budget_id', filters.budget_id);
      if (filters?.account_id) query = query.eq('account_id', filters.account_id);
      if (filters?.period_id) query = query.eq('period_id', filters.period_id);
      if (filters?.variance_type) query = query.eq('variance_type', filters.variance_type);

      if (sort) {
        query = query.order(sort.sortBy || 'created_at', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as BudgetVariance[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get budget variances');
  }

  async updateBudgetVariance(id: string, updates: Partial<BudgetVariance>): Promise<ServiceResult<BudgetVariance>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('budget_variance').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'budget_variance', id, updates);
      return data as BudgetVariance;
    }, 'Failed to update budget variance');
  }

  async deleteBudgetVariance(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('budget_variance').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'budget_variance', id, {});
      return true;
    }, 'Failed to delete budget variance');
  }

  async getVarianceByAccountAndPeriod(accountId: string, periodId: string): Promise<ServiceResult<BudgetVariance>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('budget_variance')
        .select()
        .eq('account_id', accountId)
        .eq('period_id', periodId)
        .single();

      if (error) throw error;
      return data as BudgetVariance;
    }, 'Failed to get variance by account and period');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// ============================================
// CASH FLOW PROJECTION SERVICE
// ============================================

interface CashFlowProjectionFilters extends FilterParams {
  category?: 'operating' | 'investing' | 'financing';
  confidence_level?: 'high' | 'medium' | 'low';
  date_from?: string;
  date_to?: string;
}

export class CashFlowProjectionService extends BaseServiceClass {
  private static instance: CashFlowProjectionService;

  public static getInstance(): CashFlowProjectionService {
    if (!CashFlowProjectionService.instance) {
      CashFlowProjectionService.instance = new CashFlowProjectionService();
    }
    return CashFlowProjectionService.instance;
  }

  async createCashFlowProjection(input: Omit<CashFlowProjection, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<CashFlowProjection>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['projection_date', 'category', 'description', 'projected_inflow', 'projected_outflow'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const netCashFlow = input.projected_inflow - input.projected_outflow;

      const { data, error } = await (supabase as any)
        .from('cash_flow_projections')
        .insert([{ ...input, net_cash_flow: netCashFlow, closing_balance: ((input as any).opening_balance || 0) + netCashFlow }])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'cash_flow_projection', (data as any).id, input);
      return data as CashFlowProjection;
    }, 'Failed to create cash flow projection');
  }

  async getCashFlowProjection(id: string): Promise<ServiceResult<CashFlowProjection>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('cash_flow_projections').select().eq('id', id).single();
      if (error) throw error;
      return data as CashFlowProjection;
    }, 'Failed to get cash flow projection');
  }

  async getCashFlowProjections(filters?: CashFlowProjectionFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<CashFlowProjection>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('cash_flow_projections').select('*', { count: 'exact' });
      
      if (filters?.category) query = query.eq('category', filters.category);
      if (filters?.confidence_level) query = query.eq('confidence_level', filters.confidence_level);
      if (filters?.date_from) query = query.gte('projection_date', filters.date_from);
      if (filters?.date_to) query = query.lte('projection_date', filters.date_to);

      if (sort) {
        query = query.order(sort.sortBy || 'projection_date', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('projection_date', { ascending: false });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as CashFlowProjection[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get cash flow projections');
  }

  async updateCashFlowProjection(id: string, updates: Partial<CashFlowProjection>): Promise<ServiceResult<CashFlowProjection>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('cash_flow_projections').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'cash_flow_projection', id, updates);
      return data as CashFlowProjection;
    }, 'Failed to update cash flow projection');
  }

  async deleteCashFlowProjection(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('cash_flow_projections').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'cash_flow_projection', id, {});
      return true;
    }, 'Failed to delete cash flow projection');
  }

  async getProjectionsByDateRange(startDate: string, endDate: string): Promise<ServiceResult<CashFlowProjection[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('cash_flow_projections')
        .select('*')
        .gte('projection_date', startDate)
        .lte('projection_date', endDate)
        .order('projection_date', { ascending: true });

      if (error) throw error;
      return data as CashFlowProjection[];
    }, 'Failed to get projections by date range');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// ============================================
// INVESTMENT PORTFOLIO SERVICE
// ============================================

export class InvestmentPortfolioService extends BaseServiceClass {
  private static instance: InvestmentPortfolioService;

  public static getInstance(): InvestmentPortfolioService {
    if (!InvestmentPortfolioService.instance) {
      InvestmentPortfolioService.instance = new InvestmentPortfolioService();
    }
    return InvestmentPortfolioService.instance;
  }

  async getPortfolios(): Promise<ServiceResult<ListResponse<InvestmentPortfolio>>> {
    return this.handleAsyncOperation(async () => {
      const { data, count, error } = await (supabase as any)
        .from('investment_portfolio')
        .select('*', { count: 'exact' });

      if (error) throw error;
      return { data: data as InvestmentPortfolio[], total: count || 0, page: 1, limit: 100, totalPages: 1 };
    }, 'Failed to get investment portfolios');
  }
}

// Export singleton instances
export const accountTreeService = AccountTreeService.getInstance();
export const accountingPeriodService = AccountingPeriodService.getInstance();
export const accountServiceExtended = AccountServiceExtended.getInstance();
export const budgetVarianceService = BudgetVarianceService.getInstance();
export const cashFlowProjectionService = CashFlowProjectionService.getInstance();
export const investmentPortfolioService = InvestmentPortfolioService.getInstance();

