import { 
  BaseServiceClass, 
  ServiceResult, 
  PaginationParams, 
  SortParams, 
  FilterParams, 
  ListResponse 
} from './_shared/baseService';
import { 
  Collateral, 
  Guarantor, 
  LoanRestructure, 
  LoanWriteOff, 
  LoanRecoveryPayment 
} from '../types';
import { validateRequiredFields } from './_shared/utils';
import { auditService } from './audit';
import { supabase } from '@/lib/supabase';

// ============================================
// COLLATERAL SERVICE
// ============================================

interface CollateralFilters extends FilterParams {
  loan_id?: string;
  collateral_type?: 'real_estate' | 'vehicle' | 'equipment' | 'inventory' | 'guarantee' | 'savings' | 'other';
  status?: 'pending' | 'verified' | 'rejected' | 'released';
}

export class CollateralService extends BaseServiceClass {
  private static instance: CollateralService;

  public static getInstance(): CollateralService {
    if (!CollateralService.instance) {
      CollateralService.instance = new CollateralService();
    }
    return CollateralService.instance;
  }

  async createCollateral(input: Omit<Collateral, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<Collateral>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['loan_id', 'collateral_type', 'description', 'estimated_value'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('collateral')
        .insert([{ ...input, status: input.status || 'pending' }])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'collateral', (data as any).id, input);
      return data as Collateral;
    }, 'Failed to create collateral');
  }

  async getCollateral(id: string): Promise<ServiceResult<Collateral>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('collateral').select().eq('id', id).single();
      if (error) throw error;
      return data as Collateral;
    }, 'Failed to get collateral');
  }

  async getCollaterals(filters?: CollateralFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<Collateral>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('collateral').select('*', { count: 'exact' });
      
      if (filters?.loan_id) query = query.eq('loan_id', filters.loan_id);
      if (filters?.collateral_type) query = query.eq('collateral_type', filters.collateral_type);
      if (filters?.status) query = query.eq('status', filters.status);

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
      return { data: data as Collateral[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get collaterals');
  }

  async getCollateralByLoan(loanId: string): Promise<ServiceResult<Collateral[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('collateral')
        .select('*')
        .eq('loan_id', loanId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Collateral[];
    }, 'Failed to get collateral by loan');
  }

  async updateCollateral(id: string, updates: Partial<Collateral>): Promise<ServiceResult<Collateral>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('collateral').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'collateral', id, updates);
      return data as Collateral;
    }, 'Failed to update collateral');
  }

  async verifyCollateral(id: string, userId: string, notes?: string): Promise<ServiceResult<Collateral>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('collateral')
        .update({ status: 'verified', verified_by: userId, verified_at: new Date().toISOString(), notes })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('verify_collateral', 'collateral', id, { verified_by: userId });
      return data as Collateral;
    }, 'Failed to verify collateral');
  }

  async rejectCollateral(id: string, reason: string): Promise<ServiceResult<Collateral>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('collateral')
        .update({ status: 'rejected', notes: reason })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('reject_collateral', 'collateral', id, { reason });
      return data as Collateral;
    }, 'Failed to reject collateral');
  }

  async releaseCollateral(id: string): Promise<ServiceResult<Collateral>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('collateral')
        .update({ status: 'released' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('release_collateral', 'collateral', id, {});
      return data as Collateral;
    }, 'Failed to release collateral');
  }

  async deleteCollateral(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('collateral').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'collateral', id, {});
      return true;
    }, 'Failed to delete collateral');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// ============================================
// GUARANTOR SERVICE
// ============================================

interface GuarantorFilters extends FilterParams {
  loan_id?: string;
  guarantor_type?: 'individual' | 'corporate';
  status?: 'active' | 'released' | 'called';
}

export class GuarantorService extends BaseServiceClass {
  private static instance: GuarantorService;

  public static getInstance(): GuarantorService {
    if (!GuarantorService.instance) {
      GuarantorService.instance = new GuarantorService();
    }
    return GuarantorService.instance;
  }

  async createGuarantor(input: Omit<Guarantor, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<Guarantor>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['loan_id', 'guarantor_name', 'guarantor_type', 'phone', 'address', 'relationship', 'guaranteed_amount', 'guarantee_percentage'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('guarantors')
        .insert([{ ...input, status: input.status || 'active', guarantee_type: input.guarantee_type || 'limited' }])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'guarantor', (data as any).id, input);
      return data as Guarantor;
    }, 'Failed to create guarantor');
  }

  async getGuarantor(id: string): Promise<ServiceResult<Guarantor>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('guarantors').select().eq('id', id).single();
      if (error) throw error;
      return data as Guarantor;
    }, 'Failed to get guarantor');
  }

  async getGuarantors(filters?: GuarantorFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<Guarantor>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('guarantors').select('*', { count: 'exact' });
      
      if (filters?.loan_id) query = query.eq('loan_id', filters.loan_id);
      if (filters?.guarantor_type) query = query.eq('guarantor_type', filters.guarantor_type);
      if (filters?.status) query = query.eq('status', filters.status);

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
      return { data: data as Guarantor[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get guarantors');
  }

  async getGuarantorsByLoan(loanId: string): Promise<ServiceResult<Guarantor[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('guarantors')
        .select('*')
        .eq('loan_id', loanId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Guarantor[];
    }, 'Failed to get guarantors by loan');
  }

  async updateGuarantor(id: string, updates: Partial<Guarantor>): Promise<ServiceResult<Guarantor>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('guarantors').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'guarantor', id, updates);
      return data as Guarantor;
    }, 'Failed to update guarantor');
  }

  async releaseGuarantor(id: string): Promise<ServiceResult<Guarantor>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('guarantors')
        .update({ status: 'released' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('release_guarantor', 'guarantor', id, {});
      return data as Guarantor;
    }, 'Failed to release guarantor');
  }

  async callGuarantee(id: string): Promise<ServiceResult<Guarantor>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('guarantors')
        .update({ status: 'called' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('call_guarantee', 'guarantor', id, {});
      return data as Guarantor;
    }, 'Failed to call guarantee');
  }

  async deleteGuarantor(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('guarantors').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'guarantor', id, {});
      return true;
    }, 'Failed to delete guarantor');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// ============================================
// LOAN RESTRUCTURE SERVICE
// ============================================

interface LoanRestructureFilters extends FilterParams {
  loan_id?: string;
  date_from?: string;
  date_to?: string;
}

export class LoanRestructureService extends BaseServiceClass {
  private static instance: LoanRestructureService;

  public static getInstance(): LoanRestructureService {
    if (!LoanRestructureService.instance) {
      LoanRestructureService.instance = new LoanRestructureService();
    }
    return LoanRestructureService.instance;
  }

  async createLoanRestructure(input: Omit<LoanRestructure, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<LoanRestructure>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['loan_id', 'restructure_date', 'reason', 'new_term_months', 'new_interest_rate', 'new_monthly_payment', 'outstanding_principal', 'total_restructured_amount', 'approved_by', 'approved_at', 'effective_date'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('loan_restructures')
        .insert([input])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'loan_restructure', (data as any).id, input);
      return data as LoanRestructure;
    }, 'Failed to create loan restructure');
  }

  async getLoanRestructure(id: string): Promise<ServiceResult<LoanRestructure>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('loan_restructures').select().eq('id', id).single();
      if (error) throw error;
      return data as LoanRestructure;
    }, 'Failed to get loan restructure');
  }

  async getLoanRestructures(filters?: LoanRestructureFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<LoanRestructure>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('loan_restructures').select('*', { count: 'exact' });
      
      if (filters?.loan_id) query = query.eq('loan_id', filters.loan_id);
      if (filters?.date_from) query = query.gte('restructure_date', filters.date_from);
      if (filters?.date_to) query = query.lte('restructure_date', filters.date_to);

      if (sort) {
        query = query.order(sort.sortBy || 'restructure_date', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('restructure_date', { ascending: false });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as LoanRestructure[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get loan restructures');
  }

  async getRestructuresByLoan(loanId: string): Promise<ServiceResult<LoanRestructure[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('loan_restructures')
        .select('*')
        .eq('loan_id', loanId)
        .order('restructure_date', { ascending: false });

      if (error) throw error;
      return data as LoanRestructure[];
    }, 'Failed to get restructures by loan');
  }

  async updateLoanRestructure(id: string, updates: Partial<LoanRestructure>): Promise<ServiceResult<LoanRestructure>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('loan_restructures').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'loan_restructure', id, updates);
      return data as LoanRestructure;
    }, 'Failed to update loan restructure');
  }

  async deleteLoanRestructure(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('loan_restructures').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'loan_restructure', id, {});
      return true;
    }, 'Failed to delete loan restructure');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// ============================================
// LOAN WRITE-OFF SERVICE
// ============================================

interface LoanWriteOffFilters extends FilterParams {
  loan_id?: string;
  approval_status?: 'pending' | 'approved' | 'rejected';
  date_from?: string;
  date_to?: string;
}

export class LoanWriteOffService extends BaseServiceClass {
  private static instance: LoanWriteOffService;

  public static getInstance(): LoanWriteOffService {
    if (!LoanWriteOffService.instance) {
      LoanWriteOffService.instance = new LoanWriteOffService();
    }
    return LoanWriteOffService.instance;
  }

  async createLoanWriteOff(input: Omit<LoanWriteOff, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<LoanWriteOff>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['loan_id', 'write_off_date', 'write_off_amount', 'principal_written_off', 'reason', 'created_by'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('loan_write_offs')
        .insert([{ ...input, approval_status: input.approval_status || 'pending', recovery_expected: input.recovery_expected || false }])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'loan_write_off', (data as any).id, input);
      return data as LoanWriteOff;
    }, 'Failed to create loan write-off');
  }

  async getLoanWriteOff(id: string): Promise<ServiceResult<LoanWriteOff>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('loan_write_offs').select().eq('id', id).single();
      if (error) throw error;
      return data as LoanWriteOff;
    }, 'Failed to get loan write-off');
  }

  async getLoanWriteOffs(filters?: LoanWriteOffFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<LoanWriteOff>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('loan_write_offs').select('*', { count: 'exact' });
      
      if (filters?.loan_id) query = query.eq('loan_id', filters.loan_id);
      if (filters?.approval_status) query = query.eq('approval_status', filters.approval_status);
      if (filters?.date_from) query = query.gte('write_off_date', filters.date_from);
      if (filters?.date_to) query = query.lte('write_off_date', filters.date_to);

      if (sort) {
        query = query.order(sort.sortBy || 'write_off_date', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('write_off_date', { ascending: false });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as LoanWriteOff[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get loan write-offs');
  }

  async getWriteOffsByLoan(loanId: string): Promise<ServiceResult<LoanWriteOff[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('loan_write_offs')
        .select('*')
        .eq('loan_id', loanId)
        .order('write_off_date', { ascending: false });

      if (error) throw error;
      return data as LoanWriteOff[];
    }, 'Failed to get write-offs by loan');
  }

  async approveLoanWriteOff(id: string, approvedBy: string): Promise<ServiceResult<LoanWriteOff>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('loan_write_offs')
        .update({ approval_status: 'approved', approved_by: approvedBy, approved_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('approve_write_off', 'loan_write_off', id, { approved_by: approvedBy });
      return data as LoanWriteOff;
    }, 'Failed to approve loan write-off');
  }

  async rejectLoanWriteOff(id: string, reason: string): Promise<ServiceResult<LoanWriteOff>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('loan_write_offs')
        .update({ approval_status: 'rejected', notes: reason })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('reject_write_off', 'loan_write_off', id, { reason });
      return data as LoanWriteOff;
    }, 'Failed to reject loan write-off');
  }

  async updateLoanWriteOff(id: string, updates: Partial<LoanWriteOff>): Promise<ServiceResult<LoanWriteOff>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('loan_write_offs').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'loan_write_off', id, updates);
      return data as LoanWriteOff;
    }, 'Failed to update loan write-off');
  }

  async deleteLoanWriteOff(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('loan_write_offs').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'loan_write_off', id, {});
      return true;
    }, 'Failed to delete loan write-off');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// ============================================
// LOAN RECOVERY PAYMENT SERVICE
// ============================================

interface LoanRecoveryPaymentFilters extends FilterParams {
  loan_id?: string;
  write_off_id?: string;
  date_from?: string;
  date_to?: string;
}

export class LoanRecoveryPaymentService extends BaseServiceClass {
  private static instance: LoanRecoveryPaymentService;

  public static getInstance(): LoanRecoveryPaymentService {
    if (!LoanRecoveryPaymentService.instance) {
      LoanRecoveryPaymentService.instance = new LoanRecoveryPaymentService();
    }
    return LoanRecoveryPaymentService.instance;
  }

  async createLoanRecoveryPayment(input: Omit<LoanRecoveryPayment, 'id' | 'created_at' | 'updated_at'>): Promise<ServiceResult<LoanRecoveryPayment>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['loan_id', 'payment_date', 'amount', 'payment_method', 'recovered_by', 'account_id'];
      const missing = validateRequiredFields(input, requiredFields);
      if (missing.length > 0) throw new Error(`Missing required fields: ${missing.join(', ')}`);

      const { data, error } = await (supabase as any)
        .from('loan_recovery_payments')
        .insert([input])
        .select()
        .single();

      if (error) throw error;
      await this.logAudit('create', 'loan_recovery_payment', (data as any).id, input);
      return data as LoanRecoveryPayment;
    }, 'Failed to create loan recovery payment');
  }

  async getLoanRecoveryPayment(id: string): Promise<ServiceResult<LoanRecoveryPayment>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('loan_recovery_payments').select().eq('id', id).single();
      if (error) throw error;
      return data as LoanRecoveryPayment;
    }, 'Failed to get loan recovery payment');
  }

  async getLoanRecoveryPayments(filters?: LoanRecoveryPaymentFilters, pagination?: PaginationParams, sort?: SortParams): Promise<ServiceResult<ListResponse<LoanRecoveryPayment>>> {
    return this.handleAsyncOperation(async () => {
      let query = (supabase as any).from('loan_recovery_payments').select('*', { count: 'exact' });
      
      if (filters?.loan_id) query = query.eq('loan_id', filters.loan_id);
      if (filters?.write_off_id) query = query.eq('write_off_id', filters.write_off_id);
      if (filters?.date_from) query = query.gte('payment_date', filters.date_from);
      if (filters?.date_to) query = query.lte('payment_date', filters.date_to);

      if (sort) {
        query = query.order(sort.sortBy || 'payment_date', { ascending: sort.sortOrder === 'asc' });
      } else {
        query = query.order('payment_date', { ascending: false });
      }

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const start = (page - 1) * limit;
      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;
      return { data: data as LoanRecoveryPayment[], total: count || 0, page, limit, totalPages: count ? Math.ceil(count / limit) : 0 };
    }, 'Failed to get loan recovery payments');
  }

  async getRecoveryPaymentsByLoan(loanId: string): Promise<ServiceResult<LoanRecoveryPayment[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('loan_recovery_payments')
        .select('*')
        .eq('loan_id', loanId)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data as LoanRecoveryPayment[];
    }, 'Failed to get recovery payments by loan');
  }

  async updateLoanRecoveryPayment(id: string, updates: Partial<LoanRecoveryPayment>): Promise<ServiceResult<LoanRecoveryPayment>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).from('loan_recovery_payments').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await this.logAudit('update', 'loan_recovery_payment', id, updates);
      return data as LoanRecoveryPayment;
    }, 'Failed to update loan recovery payment');
  }

  async deleteLoanRecoveryPayment(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { error } = await (supabase as any).from('loan_recovery_payments').delete().eq('id', id);
      if (error) throw error;
      await this.logAudit('delete', 'loan_recovery_payment', id, {});
      return true;
    }, 'Failed to delete loan recovery payment');
  }

  async getTotalRecoveredByLoan(loanId: string): Promise<ServiceResult<number>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('loan_recovery_payments')
        .select('amount')
        .eq('loan_id', loanId);

      if (error) throw error;
      const total = (data as LoanRecoveryPayment[]).reduce((sum, p) => sum + p.amount, 0);
      return total;
    }, 'Failed to get total recovered by loan');
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// Export singleton instances
export const collateralService = CollateralService.getInstance();
export const guarantorService = GuarantorService.getInstance();
export const loanRestructureService = LoanRestructureService.getInstance();
export const loanWriteOffService = LoanWriteOffService.getInstance();
export const loanRecoveryPaymentService = LoanRecoveryPaymentService.getInstance();