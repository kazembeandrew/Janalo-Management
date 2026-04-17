import { 
  BaseServiceClass, 
  ServiceResult, 
  PaginationParams, 
  SortParams, 
  FilterParams, 
  ListResponse 
} from './_shared/baseService';
import { 
  CustomerLifetimeValue, 
  DevicePushToken, 
  ExpenseReconciliation, 
  FundTransaction, 
  InvestmentPortfolio, 
  PayrollRecord, 
  PendingApproval, 
  PolicyDocument, 
  RevenueForecast 
} from '../types';
import { validateRequiredFields } from './_shared/utils';
import { auditService } from './audit';
import { supabase } from '@/lib/supabase';

// ============================================
// CUSTOMER LIFETIME VALUE SERVICE
// ============================================

interface CustomerLifetimeValueFilters extends FilterParams {
  customer_id?: string;
  tier?: 'platinum' | 'gold' | 'silver' | 'bronze';
  date_from?: string;
  date_to?: string;
}

export class CustomerLifetimeValueService extends BaseServiceClass {
  private static instance: CustomerLifetimeValueService;

  public static getInstance(): CustomerLifetimeValueService {
    if (!CustomerLifetimeValueService.instance) {
      CustomerLifetimeValueService.instance = new CustomerLifetimeValueService();
    }
    return CustomerLifetimeValueService.instance;
  }

  async createCustomerLifetimeValue(input: Omit<CustomerLifetimeValue, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<CustomerLifetimeValue>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['customer_id', 'calculation_date', 'total_revenue', 'total_cost', 'net_value', 'clv_score', 'tier', 'calculation_method'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('customer_lifetime_value')
        .insert([input])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'customer_lifetime_value', (data as any).id, input);
      return data as CustomerLifetimeValue;
    }, 'Failed to create customer lifetime value');
  }

  async getCustomerLifetimeValue(id: string): Promise<ServiceResult<CustomerLifetimeValue>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('customer_lifetime_value').select().eq('id', id).single();
      if (error) throw error;
      return data as CustomerLifetimeValue;
    }, 'Failed to get customer lifetime value');
  }

  async getCustomerLifetimeValues(filters?: CustomerLifetimeValueFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<CustomerLifetimeValue>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('customer_lifetime_value').select('*', { count: 'exact' });
      
      if (filters?.customer_id) query = query.eq('customer_id', filters.customer_id);
      if (filters?.tier) query = query.eq('tier', filters.tier);
      if (filters?.date_from) query = query.gte('calculation_date', filters.date_from);
      if (filters?.date_to) query = query.lte('calculation_date', filters.date_to);

      if (sort) {
        query = query.order(sort.sortBy || 'calculation_date', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('calculation_date', { ascending: false });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as CustomerLifetimeValue[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get customer lifetime values');
  }

  async getLatestCLVByCustomer(customerId: string): Promise<ServiceResult<CustomerLifetimeValue>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('customer_lifetime_value')
        .select('*')
        .eq('customer_id', customerId)
        .order('calculation_date', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return data as CustomerLifetimeValue;
    }, 'Failed to get latest CLV by customer');
  }

  async updateCustomerLifetimeValue(id: string, updates: Partial<CustomerLifetimeValue>): Promise<ServiceResult<CustomerLifetimeValue>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('customer_lifetime_value').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'customer_lifetime_value', id, updates);
      return data as CustomerLifetimeValue;
    }, 'Failed to update customer lifetime value');
  }

  async deleteCustomerLifetimeValue(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('customer_lifetime_value').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'customer_lifetime_value', id, {});
      return true;
    }, 'Failed to delete customer lifetime value');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// ============================================
// DEVICE PUSH TOKEN SERVICE
// ============================================

interface DevicePushTokenFilters extends FilterParams {
  user_id?: string;
  platform?: 'ios' | 'android' | 'web';
  is_active?: boolean;
}

export class DevicePushTokenService extends BaseServiceClass {
  private static instance: DevicePushTokenService;

  public static getInstance(): DevicePushTokenService {
    if (!DevicePushTokenService.instance) {
      DevicePushTokenService.instance = new DevicePushTokenService();
    }
    return DevicePushTokenService.instance;
  }

  async registerDevice(input: Omit<DevicePushToken, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<DevicePushToken>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['user_id', 'device_id', 'token', 'platform'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('device_push_tokens')
        .insert([{ ...input, is_active: input.is_active !== false }])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('register_device', 'device_push_token', (data as any).id, input);
      return data as DevicePushToken;
    }, 'Failed to register device');
  }

  async getDeviceToken(id: string): Promise<ServiceResult<DevicePushToken>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('device_push_tokens').select().eq('id', id).single();
      if (error) throw error;
      return data as DevicePushToken;
    }, 'Failed to get device token');
  }

  async getDeviceTokens(filters?: DevicePushTokenFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<DevicePushToken>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('device_push_tokens').select('*', { count: 'exact' });
      
      if (filters?.user_id) query = query.eq('user_id', filters.user_id);
      if (filters?.platform) query = query.eq('platform', filters.platform);
      if (filters?.is_active !== undefined) query = query.eq('is_active', filters.is_active);

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
      return { data: data as DevicePushToken[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get device tokens');
  }

  async getActiveTokensByUser(userId: string): Promise<ServiceResult<DevicePushToken[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('device_push_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DevicePushToken[];
    }, 'Failed to get active tokens by user');
  }

  async updateDeviceToken(id: string, updates: Partial<DevicePushToken>): Promise<ServiceResult<DevicePushToken>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('device_push_tokens').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'device_push_token', id, updates);
      return data as DevicePushToken;
    }, 'Failed to update device token');
  }

  async deactivateDevice(id: string): Promise<ServiceResult<DevicePushToken>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('device_push_tokens')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('deactivate_device', 'device_push_token', id, {});
      return data as DevicePushToken;
    }, 'Failed to deactivate device');
  }

  async deleteDeviceToken(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('device_push_tokens').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'device_push_token', id, {});
      return true;
    }, 'Failed to delete device token');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// ============================================
// EXPENSE RECONCILIATION SERVICE
// ============================================

interface ExpenseReconciliationFilters extends FilterParams {
  expense_id?: string;
  status?: 'matched' | 'discrepancy' | 'pending';
  reconciled_by?: string;
  date_from?: string;
  date_to?: string;
}

export class ExpenseReconciliationService extends BaseServiceClass {
  private static instance: ExpenseReconciliationService;

  public static getInstance(): ExpenseReconciliationService {
    if (!ExpenseReconciliationService.instance) {
      ExpenseReconciliationService.instance = new ExpenseReconciliationService();
    }
    return ExpenseReconciliationService.instance;
  }

  async createExpenseReconciliation(input: Omit<ExpenseReconciliation, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<ExpenseReconciliation>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['expense_id', 'reconciliation_date', 'expected_amount', 'actual_amount', 'reconciled_by'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const difference = input.actual_amount - input.expected_amount;
      const status = difference === 0 ? 'matched' : 'discrepancy';

      const { data, error } = await (supabase as any)
        .from('expense_reconciliation')
        .insert([{ ...input, difference, status }])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'expense_reconciliation', (data as any).id, input);
      return data as ExpenseReconciliation;
    }, 'Failed to create expense reconciliation');
  }

  async getExpenseReconciliation(id: string): Promise<ServiceResult<ExpenseReconciliation>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('expense_reconciliation').select().eq('id', id).single();
      if (error) throw error;
      return data as ExpenseReconciliation;
    }, 'Failed to get expense reconciliation');
  }

  async getExpenseReconciliations(filters?: ExpenseReconciliationFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<ExpenseReconciliation>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('expense_reconciliation').select('*', { count: 'exact' });
      
      if (filters?.expense_id) query = query.eq('expense_id', filters.expense_id);
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.reconciled_by) query = query.eq('reconciled_by', filters.reconciled_by);
      if (filters?.date_from) query = query.gte('reconciliation_date', filters.date_from);
      if (filters?.date_to) query = query.lte('reconciliation_date', filters.date_to);

      if (sort) {
        query = query.order(sort.sortBy || 'reconciliation_date', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('reconciliation_date', { ascending: false });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as ExpenseReconciliation[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get expense reconciliations');
  }

  async updateExpenseReconciliation(id: string, updates: Partial<ExpenseReconciliation>): Promise<ServiceResult<ExpenseReconciliation>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('expense_reconciliation').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'expense_reconciliation', id, updates);
      return data as ExpenseReconciliation;
    }, 'Failed to update expense reconciliation');
  }

  async deleteExpenseReconciliation(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('expense_reconciliation').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'expense_reconciliation', id, {});
      return true;
    }, 'Failed to delete expense reconciliation');
  }

  async getDiscrepancies(): Promise<ServiceResult<ExpenseReconciliation[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('expense_reconciliation')
        .select('*')
        .eq('status', 'discrepancy')
        .order('reconciliation_date', { ascending: false });

      if (error) throw error;
      return data as ExpenseReconciliation[];
    }, 'Failed to get discrepancies');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// ============================================
// FUND TRANSACTION SERVICE
// ============================================

interface FundTransactionFilters extends FilterParams {
  from_account_id?: string;
  to_account_id?: string;
  transaction_type?: 'transfer' | 'allocation' | 'reversal';
  status?: 'pending' | 'completed' | 'cancelled' | 'failed';
  date_from?: string;
  date_to?: string;
}

export class FundTransactionService extends BaseServiceClass {
  private static instance: FundTransactionService;

  public static getInstance(): FundTransactionService {
    if (!FundTransactionService.instance) {
      FundTransactionService.instance = new FundTransactionService();
    }
    return FundTransactionService.instance;
  }

  async createFundTransaction(input: Omit<FundTransaction, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<FundTransaction>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['from_account_id', 'to_account_id', 'amount', 'transaction_date', 'reference_number', 'description', 'transaction_type', 'created_by'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('fund_transactions')
        .insert([{ ...input, status: input.status || 'pending' }])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'fund_transaction', (data as any).id, input);
      return data as FundTransaction;
    }, 'Failed to create fund transaction');
  }

  async getFundTransaction(id: string): Promise<ServiceResult<FundTransaction>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('fund_transactions').select().eq('id', id).single();
      if (error) throw error;
      return data as FundTransaction;
    }, 'Failed to get fund transaction');
  }

  async getFundTransactions(filters?: FundTransactionFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<FundTransaction>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('fund_transactions').select('*', { count: 'exact' });
      
      if (filters?.from_account_id) query = query.eq('from_account_id', filters.from_account_id);
      if (filters?.to_account_id) query = query.eq('to_account_id', filters.to_account_id);
      if (filters?.transaction_type) query = query.eq('transaction_type', filters.transaction_type);
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.date_from) query = query.gte('transaction_date', filters.date_from);
      if (filters?.date_to) query = query.lte('transaction_date', filters.date_to);

      if (sort) {
        query = query.order(sort.sortBy || 'transaction_date', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('transaction_date', { ascending: false });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as FundTransaction[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get fund transactions');
  }

  async approveFundTransaction(id: string, approvedBy: string): Promise<ServiceResult<FundTransaction>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('fund_transactions')
        .update({ status: 'completed', approved_by: approvedBy, approved_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('approve', 'fund_transaction', id, { approved_by: approvedBy });
      return data as FundTransaction;
    }, 'Failed to approve fund transaction');
  }

  async cancelFundTransaction(id: string, reason: string): Promise<ServiceResult<FundTransaction>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('fund_transactions')
        .update({ status: 'cancelled', notes: reason })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('cancel', 'fund_transaction', id, { reason });
      return data as FundTransaction;
    }, 'Failed to cancel fund transaction');
  }

  async updateFundTransaction(id: string, updates: Partial<FundTransaction>): Promise<ServiceResult<FundTransaction>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('fund_transactions').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'fund_transaction', id, updates);
      return data as FundTransaction;
    }, 'Failed to update fund transaction');
  }

  async deleteFundTransaction(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('fund_transactions').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'fund_transaction', id, {});
      return true;
    }, 'Failed to delete fund transaction');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// ============================================
// INVESTMENT PORTFOLIO SERVICE
// ============================================

interface InvestmentPortfolioFilters extends FilterParams {
  portfolio_type?: 'conservative' | 'balanced' | 'aggressive';
  risk_level?: 'low' | 'medium' | 'high';
  is_active?: boolean;
  manager_id?: string;
}

export class InvestmentPortfolioService extends BaseServiceClass {
  private static instance: InvestmentPortfolioService;

  public static getInstance(): InvestmentPortfolioService {
    if (!InvestmentPortfolioService.instance) {
      InvestmentPortfolioService.instance = new InvestmentPortfolioService();
    }
    return InvestmentPortfolioService.instance;
  }

  async createInvestmentPortfolio(input: Omit<InvestmentPortfolio, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<InvestmentPortfolio>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['name', 'portfolio_type', 'currency', 'risk_level', 'inception_date'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('investment_portfolios')
        .insert([{ ...input, is_active: input.is_active !== false, total_value: input.total_value || 0, target_return: input.target_return || 0, actual_return: input.actual_return || 0 }])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'investment_portfolio', (data as any).id, input);
      return data as InvestmentPortfolio;
    }, 'Failed to create investment portfolio');
  }

  async getInvestmentPortfolio(id: string): Promise<ServiceResult<InvestmentPortfolio>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('investment_portfolios').select().eq('id', id).single();
      if (error) throw error;
      return data as InvestmentPortfolio;
    }, 'Failed to get investment portfolio');
  }

  async getInvestmentPortfolios(filters?: InvestmentPortfolioFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<InvestmentPortfolio>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('investment_portfolios').select('*', { count: 'exact' });
      
      if (filters?.portfolio_type) query = query.eq('portfolio_type', filters.portfolio_type);
      if (filters?.risk_level) query = query.eq('risk_level', filters.risk_level);
      if (filters?.is_active !== undefined) query = query.eq('is_active', filters.is_active);
      if (filters?.manager_id) query = query.eq('manager_id', filters.manager_id);

      if (sort) {
        query = query.order(sort.sortBy || 'name', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('name', { ascending: true });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as InvestmentPortfolio[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get investment portfolios');
  }

  async updateInvestmentPortfolio(id: string, updates: Partial<InvestmentPortfolio>): Promise<ServiceResult<InvestmentPortfolio>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('investment_portfolios').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'investment_portfolio', id, updates);
      return data as InvestmentPortfolio;
    }, 'Failed to update investment portfolio');
  }

  async updatePortfolioValue(id: string, newValue: number): Promise<ServiceResult<InvestmentPortfolio>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('investment_portfolios')
        .update({ total_value: newValue, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('update_value', 'investment_portfolio', id, { new_value: newValue });
      return data as InvestmentPortfolio;
    }, 'Failed to update portfolio value');
  }

  async deleteInvestmentPortfolio(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('investment_portfolios').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'investment_portfolio', id, {});
      return true;
    }, 'Failed to delete investment portfolio');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// ============================================
// PAYROLL RECORD SERVICE
// ============================================

interface PayrollRecordFilters extends FilterParams {
  employee_id?: string;
  status?: 'draft' | 'approved' | 'paid' | 'cancelled';
  payment_method?: 'bank_transfer' | 'check' | 'cash';
  date_from?: string;
  date_to?: string;
}

export class PayrollRecordService extends BaseServiceClass {
  private static instance: PayrollRecordService;

  public static getInstance(): PayrollRecordService {
    if (!PayrollRecordService.instance) {
      PayrollRecordService.instance = new PayrollRecordService();
    }
    return PayrollRecordService.instance;
  }

  async createPayrollRecord(input: Omit<PayrollRecord, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<PayrollRecord>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['employee_id', 'pay_period_start', 'pay_period_end', 'pay_date', 'gross_salary', 'net_salary', 'payment_method', 'status', 'created_by'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('payroll_records')
        .insert([input])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'payroll_record', (data as any).id, input);
      return data as PayrollRecord;
    }, 'Failed to create payroll record');
  }

  async getPayrollRecord(id: string): Promise<ServiceResult<PayrollRecord>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('payroll_records').select().eq('id', id).single();
      if (error) throw error;
      return data as PayrollRecord;
    }, 'Failed to get payroll record');
  }

  async getPayrollRecords(filters?: PayrollRecordFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<PayrollRecord>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('payroll_records').select('*', { count: 'exact' });
      
      if (filters?.employee_id) query = query.eq('employee_id', filters.employee_id);
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.payment_method) query = query.eq('payment_method', filters.payment_method);
      if (filters?.date_from) query = query.gte('pay_date', filters.date_from);
      if (filters?.date_to) query = query.lte('pay_date', filters.date_to);

      if (sort) {
        query = query.order(sort.sortBy || 'pay_date', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('pay_date', { ascending: false });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as PayrollRecord[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get payroll records');
  }

  async approvePayrollRecord(id: string): Promise<ServiceResult<PayrollRecord>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('payroll_records')
        .update({ status: 'approved' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('approve', 'payroll_record', id, {});
      return data as PayrollRecord;
    }, 'Failed to approve payroll record');
  }

  async markAsPaid(id: string): Promise<ServiceResult<PayrollRecord>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('payroll_records')
        .update({ status: 'paid' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('mark_paid', 'payroll_record', id, {});
      return data as PayrollRecord;
    }, 'Failed to mark payroll as paid');
  }

  async updatePayrollRecord(id: string, updates: Partial<PayrollRecord>): Promise<ServiceResult<PayrollRecord>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('payroll_records').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'payroll_record', id, updates);
      return data as PayrollRecord;
    }, 'Failed to update payroll record');
  }

  async deletePayrollRecord(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('payroll_records').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'payroll_record', id, {});
      return true;
    }, 'Failed to delete payroll record');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// ============================================
// PENDING APPROVAL SERVICE
// ============================================

interface PendingApprovalFilters extends FilterParams {
  entity_type?: string;
  entity_id?: string;
  approval_type?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'escalated' | 'cancelled';
  requested_by?: string;
  current_approver_id?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export class PendingApprovalService extends BaseServiceClass {
  private static instance: PendingApprovalService;

  public static getInstance(): PendingApprovalService {
    if (!PendingApprovalService.instance) {
      PendingApprovalService.instance = new PendingApprovalService();
    }
    return PendingApprovalService.instance;
  }

  async createPendingApproval(input: Omit<PendingApproval, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<PendingApproval>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['entity_type', 'entity_id', 'approval_type', 'requested_by', 'current_step', 'total_steps'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('pending_approvals')
        .insert([{ ...input, status: input.status || 'pending', priority: input.priority || 'normal' }])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'pending_approval', (data as any).id, input);
      return data as PendingApproval;
    }, 'Failed to create pending approval');
  }

  async getPendingApproval(id: string): Promise<ServiceResult<PendingApproval>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('pending_approvals').select().eq('id', id).single();
      if (error) throw error;
      return data as PendingApproval;
    }, 'Failed to get pending approval');
  }

  async getPendingApprovals(filters?: PendingApprovalFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<PendingApproval>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('pending_approvals').select('*', { count: 'exact' });
      
      if (filters?.entity_type) query = query.eq('entity_type', filters.entity_type);
      if (filters?.entity_id) query = query.eq('entity_id', filters.entity_id);
      if (filters?.approval_type) query = query.eq('approval_type', filters.approval_type);
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.requested_by) query = query.eq('requested_by', filters.requested_by);
      if (filters?.current_approver_id) query = query.eq('current_approver_id', filters.current_approver_id);
      if (filters?.priority) query = query.eq('priority', filters.priority);

      if (sort) {
        query = query.order(sort.sortBy || 'requested_at', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('requested_at', { ascending: false });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as PendingApproval[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get pending approvals');
  }

  async getPendingApprovalsByApprover(approverId: string): Promise<ServiceResult<PendingApproval[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('pending_approvals')
        .select('*')
        .eq('current_approver_id', approverId)
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('requested_at', { ascending: true });

      if (error) throw error;
      return data as PendingApproval[];
    }, 'Failed to get pending approvals by approver');
  }

  async approvePendingApproval(id: string, approverId: string, notes?: string): Promise<ServiceResult<PendingApproval>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('pending_approvals')
        .update({ status: 'approved', completed_at: new Date().toISOString(), notes })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('approve', 'pending_approval', id, { approver_id: approverId });
      return data as PendingApproval;
    }, 'Failed to approve pending approval');
  }

  async rejectPendingApproval(id: string, approverId: string, reason: string): Promise<ServiceResult<PendingApproval>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('pending_approvals')
        .update({ status: 'rejected', completed_at: new Date().toISOString(), notes: reason })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('reject', 'pending_approval', id, { approver_id: approverId, reason });
      return data as PendingApproval;
    }, 'Failed to reject pending approval');
  }

  async escalatePendingApproval(id: string): Promise<ServiceResult<PendingApproval>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('pending_approvals')
        .update({ status: 'escalated', escalated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('escalate', 'pending_approval', id, {});
      return data as PendingApproval;
    }, 'Failed to escalate pending approval');
  }

  async updatePendingApproval(id: string, updates: Partial<PendingApproval>): Promise<ServiceResult<PendingApproval>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('pending_approvals').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'pending_approval', id, updates);
      return data as PendingApproval;
    }, 'Failed to update pending approval');
  }

  async deletePendingApproval(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('pending_approvals').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'pending_approval', id, {});
      return true;
    }, 'Failed to delete pending approval');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// ============================================
// POLICY DOCUMENT SERVICE
// ============================================

interface PolicyDocumentFilters extends FilterParams {
  category?: 'hr' | 'finance' | 'operations' | 'compliance' | 'it' | 'general';
  status?: 'draft' | 'active' | 'archived' | 'superseded';
  document_number?: string;
}

export class PolicyDocumentService extends BaseServiceClass {
  private static instance: PolicyDocumentService;

  public static getInstance(): PolicyDocumentService {
    if (!PolicyDocumentService.instance) {
      PolicyDocumentService.instance = new PolicyDocumentService();
    }
    return PolicyDocumentService.instance;
  }

  async createPolicyDocument(input: Omit<PolicyDocument, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<PolicyDocument>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['title', 'document_number', 'version', 'category', 'effective_date', 'created_by'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('policy_documents')
        .insert([{ ...input, status: input.status || 'draft' }])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'policy_document', (data as any).id, input);
      return data as PolicyDocument;
    }, 'Failed to create policy document');
  }

  async getPolicyDocument(id: string): Promise<ServiceResult<PolicyDocument>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('policy_documents').select().eq('id', id).single();
      if (error) throw error;
      return data as PolicyDocument;
    }, 'Failed to get policy document');
  }

  async getPolicyDocuments(filters?: PolicyDocumentFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<PolicyDocument>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('policy_documents').select('*', { count: 'exact' });
      
      if (filters?.category) query = query.eq('category', filters.category);
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.document_number) query = query.eq('document_number', filters.document_number);

      if (sort) {
        query = query.order(sort.sortBy || 'effective_date', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('effective_date', { ascending: false });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as PolicyDocument[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get policy documents');
  }

  async getActivePolicies(category?: string): Promise<ServiceResult<PolicyDocument[]>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any)
        .from('policy_documents')
        .select('*')
        .eq('status', 'active');

      if (category) query = query.eq('category', category);

      const { data, error } = await query.order('effective_date', { ascending: false });

      if (error) throw error;
      return data as PolicyDocument[];
    }, 'Failed to get active policies');
  }

  async activatePolicy(id: string, approvedBy: string): Promise<ServiceResult<PolicyDocument>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('policy_documents')
        .update({ status: 'active', approved_by: approvedBy, approved_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('activate', 'policy_document', id, { approved_by: approvedBy });
      return data as PolicyDocument;
    }, 'Failed to activate policy document');
  }

  async archivePolicy(id: string): Promise<ServiceResult<PolicyDocument>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('policy_documents')
        .update({ status: 'archived' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('archive', 'policy_document', id, {});
      return data as PolicyDocument;
    }, 'Failed to archive policy document');
  }

  async updatePolicyDocument(id: string, updates: Partial<PolicyDocument>): Promise<ServiceResult<PolicyDocument>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('policy_documents').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'policy_document', id, updates);
      return data as PolicyDocument;
    }, 'Failed to update policy document');
  }

  async deletePolicyDocument(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('policy_documents').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'policy_document', id, {});
      return true;
    }, 'Failed to delete policy document');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// ============================================
// REVENUE FORECAST SERVICE
// ============================================

interface RevenueForecastFilters extends FilterParams {
  category?: string;
  date_from?: string;
  date_to?: string;
  created_by?: string;
}

export class RevenueForecastService extends BaseServiceClass {
  private static instance: RevenueForecastService;

  public static getInstance(): RevenueForecastService {
    if (!RevenueForecastService.instance) {
      RevenueForecastService.instance = new RevenueForecastService();
    }
    return RevenueForecastService.instance;
  }

  async createRevenueForecast(input: Omit<RevenueForecast, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<RevenueForecast>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['forecast_date', 'period_start', 'period_end', 'category', 'forecasted_revenue', 'methodology', 'created_by'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('revenue_forecasts')
        .insert([input])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'revenue_forecast', (data as any).id, input);
      return data as RevenueForecast;
    }, 'Failed to create revenue forecast');
  }

  async getRevenueForecast(id: string): Promise<ServiceResult<RevenueForecast>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('revenue_forecasts').select().eq('id', id).single();
      if (error) throw error;
      return data as RevenueForecast;
    }, 'Failed to get revenue forecast');
  }

  async getRevenueForecasts(filters?: RevenueForecastFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<RevenueForecast>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('revenue_forecasts').select('*', { count: 'exact' });
      
      if (filters?.category) query = query.eq('category', filters.category);
      if (filters?.date_from) query = query.gte('forecast_date', filters.date_from);
      if (filters?.date_to) query = query.lte('forecast_date', filters.date_to);
      if (filters?.created_by) query = query.eq('created_by', filters.created_by);

      if (sort) {
        query = query.order(sort.sortBy || 'forecast_date', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('forecast_date', { ascending: false });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as RevenueForecast[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get revenue forecasts');
  }

  async updateRevenueForecast(id: string, updates: Partial<RevenueForecast>): Promise<ServiceResult<RevenueForecast>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('revenue_forecasts').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'revenue_forecast', id, updates);
      return data as RevenueForecast;
    }, 'Failed to update revenue forecast');
  }

  async deleteRevenueForecast(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('revenue_forecasts').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'revenue_forecast', id, {});
      return true;
    }, 'Failed to delete revenue forecast');
  }

  async getForecastsByPeriod(startDate: string, endDate: string): Promise<ServiceResult<RevenueForecast[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('revenue_forecasts')
        .select('*')
        .gte('period_start', startDate)
        .lte('period_end', endDate)
        .order('forecast_date', { ascending: false });

      if (error) throw error;
      return data as RevenueForecast[];
    }, 'Failed to get forecasts by period');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// Export singleton instances
export const customerLifetimeValueService = CustomerLifetimeValueService.getInstance();
export const devicePushTokenService = DevicePushTokenService.getInstance();
export const expenseReconciliationService = ExpenseReconciliationService.getInstance();
export const fundTransactionService = FundTransactionService.getInstance();
export const investmentPortfolioService = InvestmentPortfolioService.getInstance();
export const payrollRecordService = PayrollRecordService.getInstance();
export const pendingApprovalService = PendingApprovalService.getInstance();
export const policyDocumentService = PolicyDocumentService.getInstance();
export const revenueForecastService = RevenueForecastService.getInstance();