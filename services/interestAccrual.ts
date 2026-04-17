import { 
  BaseServiceClass, 
  ServiceResult, 
  PaginationParams, 
  ListResponse 
} from './_shared/baseService';
import { validateRequiredFields } from './_shared/utils';
import { supabase } from '@/lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface InterestAccrualBatch {
  id: string;
  batch_name: string;
  accrual_period: string;
  accrual_date: string;
  total_loans_processed: number;
  total_loans_with_accrual: number;
  total_accrued_interest: number;
  total_accrued_penalty: number;
  status: 'draft' | 'processing' | 'completed' | 'failed' | 'reversed';
  processed_by?: string;
  processed_at?: string;
  journal_entry_id?: string;
  notes?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface LoanAccrual {
  id: string;
  batch_id: string;
  loan_id: string;
  accrual_date: string;
  days_in_period: number;
  principal_balance: number;
  interest_rate: number;
  interest_type: 'flat' | 'reducing';
  accrued_interest: number;
  accrued_penalty: number;
  total_accrued: number;
  cumulative_accrued_interest: number;
  cumulative_accrued_penalty: number;
  collected_from_accrual: number;
  outstanding_accrual: number;
  status: 'posted' | 'collected' | 'reversed' | 'written_off';
  journal_line_id?: string;
  calculation_notes?: string;
  created_at: string;
  updated_at: string;
  loan?: {
    reference_no: string;
    borrower_id: string;
    status: string;
  };
}

export interface AccrualSettings {
  id: string;
  accrual_method: 'daily_reducing' | 'monthly_flat' | 'none';
  accrual_day_of_month: number;
  auto_post_accruals: boolean;
  day_count_convention: 'actual_365' | 'actual_360' | 'thirty_360';
  compound_frequency: 'none' | 'monthly' | 'quarterly';
  penalty_calculation_method: 'simple' | 'compound';
  penalty_grace_period_days: number;
  minimum_accrual_amount: number;
  maximum_accrual_days: number;
  is_active: boolean;
  last_accrual_run?: string;
  next_scheduled_run?: string;
  created_at: string;
  updated_at: string;
}

export interface AccrualAgingReport {
  loan_id: string;
  reference_no: string;
  borrower_name: string;
  principal_outstanding: number;
  total_accrued_interest: number;
  total_accrued_penalty: number;
  total_outstanding_accrual: number;
  days_overdue: number;
  aging_category: 'current' | 'watch' | 'substandard' | 'doubtful' | 'loss';
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class InterestAccrualService extends BaseServiceClass {
  private static instance: InterestAccrualService;

  public static getInstance(): InterestAccrualService {
    if (!InterestAccrualService.instance) {
      InterestAccrualService.instance = new InterestAccrualService();
    }
    return InterestAccrualService.instance;
  }

  // ============================================================================
  // ACCRUAL BATCH OPERATIONS
  // ============================================================================

  /**
   * Run monthly interest accrual batch
   */
  async runMonthlyAccrual(params?: {
    accrual_period?: string; // YYYY-MM-DD format (first of month)
  }): Promise<ServiceResult<any>> {
    return this.handleAsyncOperation(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('run_monthly_accrual_batch', {
        p_accrual_period: params?.accrual_period || null,
        p_user_id: user.id
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to run accrual batch');
      }

      return data;
    }, 'Failed to run monthly accrual batch');
  }

  /**
   * Reverse an accrual batch
   */
  async reverseAccrualBatch(params: {
    batch_id: string;
    reason: string;
  }): Promise<ServiceResult<any>> {
    return this.handleAsyncOperation(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('reverse_accrual_batch', {
        p_batch_id: params.batch_id,
        p_user_id: user.id,
        p_reason: params.reason
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to reverse accrual batch');
      }

      return data;
    }, 'Failed to reverse accrual batch');
  }

  /**
   * Get accrual batches with filtering
   */
  async getAccrualBatches(
    filters?: {
      status?: string;
      accrual_period_from?: string;
      accrual_period_to?: string;
    },
    pagination?: PaginationParams
  ): Promise<ServiceResult<ListResponse<InterestAccrualBatch>>> {
    return this.handleAsyncOperation(async () => {
      let query = supabase
        .from('interest_accrual_batches')
        .select('*', { count: 'exact' });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.accrual_period_from) {
        query = query.gte('accrual_period', filters.accrual_period_from);
      }
      if (filters?.accrual_period_to) {
        query = query.lte('accrual_period', filters.accrual_period_to);
      }

      query = query.order('accrual_period', { ascending: false });

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const start = (page - 1) * limit;

      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;

      return {
        data: (data || []) as InterestAccrualBatch[],
        total: count || 0,
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : 0
      };
    }, 'Failed to fetch accrual batches');
  }

  /**
   * Get single accrual batch with details
   */
  async getAccrualBatchById(batchId: string): Promise<ServiceResult<InterestAccrualBatch & { accruals?: LoanAccrual[] }>> {
    return this.handleAsyncOperation(async () => {
      const { data: batch, error: batchError } = await supabase
        .from('interest_accrual_batches')
        .select('*')
        .eq('id', batchId)
        .single();

      if (batchError) throw batchError;
      if (!batch) throw new Error('Accrual batch not found');

      const { data: accruals, error: accrualsError } = await supabase
        .from('loan_accruals')
        .select(`
          *,
          loan:loans(reference_no, borrower_id, status)
        `)
        .eq('batch_id', batchId)
        .order('loan_id', { ascending: true });

      if (accrualsError) throw accrualsError;

      return {
        ...batch,
        accruals: accruals || []
      } as InterestAccrualBatch & { accruals: LoanAccrual[] };
    }, 'Failed to fetch accrual batch');
  }

  // ============================================================================
  // LOAN ACCRUALS
  // ============================================================================

  /**
   * Calculate accrual for a specific loan
   */
  async calculateLoanAccrual(params: {
    loan_id: string;
    accrual_date?: string;
  }): Promise<ServiceResult<any>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await supabase.rpc('calculate_loan_accrual', {
        p_loan_id: params.loan_id,
        p_accrual_date: params.accrual_date || new Date().toISOString().split('T')[0]
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to calculate accrual');
      }

      return data;
    }, 'Failed to calculate loan accrual');
  }

  /**
   * Get loan accrual history
   */
  async getLoanAccrualHistory(
    loanId: string,
    pagination?: PaginationParams
  ): Promise<ServiceResult<ListResponse<LoanAccrual>>> {
    return this.handleAsyncOperation(async () => {
      let query = supabase
        .from('loan_accruals')
        .select(`
          *,
          loan:loans(reference_no, borrower_id, status)
        `, { count: 'exact' })
        .eq('loan_id', loanId)
        .order('accrual_date', { ascending: false });

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 50;
      const start = (page - 1) * limit;

      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;

      return {
        data: (data || []) as LoanAccrual[],
        total: count || 0,
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : 0
      };
    }, 'Failed to fetch loan accrual history');
  }

  // ============================================================================
  // REPORTING
  // ============================================================================

  /**
   * Get accrual aging report
   */
  async getAccrualAgingReport(asOfDate?: string): Promise<ServiceResult<AccrualAgingReport[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await supabase.rpc('get_accrual_aging_report', {
        p_as_of_date: asOfDate || new Date().toISOString().split('T')[0]
      });

      if (error) throw error;
      return (data || []) as AccrualAgingReport[];
    }, 'Failed to fetch accrual aging report');
  }

  /**
   * Get accrual summary dashboard
   */
  async getAccrualDashboard(): Promise<ServiceResult<{
    current_month_accrual: number;
    ytd_accrual: number;
    outstanding_accruals: number;
    loans_with_accruals: number;
    average_accrual_per_loan: number;
    recent_batches: InterestAccrualBatch[];
  }>> {
    return this.handleAsyncOperation(async () => {
      const currentDate = new Date();
      const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        .toISOString()
        .split('T')[0];
      const firstDayOfYear = new Date(currentDate.getFullYear(), 0, 1)
        .toISOString()
        .split('T')[0];

      // Current month accrual
      const { data: monthData, error: monthError } = await supabase
        .from('interest_accrual_batches')
        .select('total_accrued_interest, total_accrued_penalty')
        .gte('accrual_period', firstDayOfMonth)
        .eq('status', 'completed');

      if (monthError) throw monthError;

      const currentMonthAccrual = (monthData || []).reduce(
        (sum, batch) => sum + batch.total_accrued_interest + batch.total_accrued_penalty,
        0
      );

      // YTD accrual
      const { data: ytdData, error: ytdError } = await supabase
        .from('interest_accrual_batches')
        .select('total_accrued_interest, total_accrued_penalty')
        .gte('accrual_period', firstDayOfYear)
        .eq('status', 'completed');

      if (ytdError) throw ytdError;

      const ytdAccrual = (ytdData || []).reduce(
        (sum, batch) => sum + batch.total_accrued_interest + batch.total_accrued_penalty,
        0
      );

      // Outstanding accruals
      const { data: outstandingData, error: outstandingError } = await supabase
        .from('loan_accruals')
        .select('outstanding_accrual')
        .eq('status', 'posted');

      if (outstandingError) throw outstandingError;

      const outstandingAccruals = (outstandingData || []).reduce(
        (sum, acc) => sum + (acc.outstanding_accrual || 0),
        0
      );

      // Loans with accruals
      const { count: loansWithAccruals, error: countError } = await supabase
        .from('loan_accruals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'posted');

      if (countError) throw countError;

      // Recent batches
      const { data: recentBatches, error: recentError } = await supabase
        .from('interest_accrual_batches')
        .select('*')
        .eq('status', 'completed')
        .order('accrual_period', { ascending: false })
        .limit(5);

      if (recentError) throw recentError;

      const avgAccrual = loansWithAccruals && loansWithAccruals > 0
        ? outstandingAccruals / loansWithAccruals
        : 0;

      return {
        current_month_accrual: currentMonthAccrual,
        ytd_accrual: ytdAccrual,
        outstanding_accruals: outstandingAccruals,
        loans_with_accruals: loansWithAccruals || 0,
        average_accrual_per_loan: avgAccrual,
        recent_batches: (recentBatches || []) as InterestAccrualBatch[]
      };
    }, 'Failed to fetch accrual dashboard');
  }

  // ============================================================================
  // SETTINGS
  // ============================================================================

  /**
   * Get accrual settings
   */
  async getAccrualSettings(): Promise<ServiceResult<AccrualSettings>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await supabase
        .from('accrual_settings')
        .select('*')
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data as AccrualSettings;
    }, 'Failed to fetch accrual settings');
  }

  /**
   * Update accrual settings (admin only)
   */
  async updateAccrualSettings(updates: Partial<AccrualSettings>): Promise<ServiceResult<AccrualSettings>> {
    return this.handleAsyncOperation(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Verify admin or accountant role
      const { data: userProfile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!['admin', 'accountant'].includes(userProfile?.role)) {
        throw new Error('Only administrators or accountants can update accrual settings');
      }

      const { data, error } = await supabase
        .from('accrual_settings')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('is_active', true)
        .select()
        .single();

      if (error) throw error;
      return data as AccrualSettings;
    }, 'Failed to update accrual settings');
  }
}

// Export singleton instance
export const interestAccrualService = InterestAccrualService.getInstance();
