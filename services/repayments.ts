import { 
  BaseServiceClass, 
  ServiceResult, 
  PaginationParams, 
  SortParams, 
  FilterParams, 
  ListResponse 
} from './_shared/baseService';
import { Repayment, Loan, LoanNote, LoanDocument, Visitation } from '../types';
import { 
  validateRequiredFields, 
  formatCurrency 
} from './_shared/utils';
import { auditService } from './audit';
import { searchService } from './search';
import { loanService } from './loans';
import { accountsService } from './accounts';
import { journalEntriesService } from './journalEntries';
import { supabase } from '@/lib/supabase';
import Decimal from 'decimal.js';

interface CreateRepaymentInput {
  loan_id: string;
  amount_paid: number;
  payment_date: string;
  recorded_by?: string;
  payment_method?: string;
  reference_number?: string;
  notes?: string;
  transaction_fee?: number;
}

// NEW: Input for atomic repayment processing
interface AtomicRepaymentInput {
  loan_id: string;
  amount: number;
  account_id: string;
  payment_date: string;
  notes?: string;
  reference?: string;
  payment_method?: string;
}

interface RepaymentFilters extends FilterParams {
  loan_id?: string;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  payment_method?: string;
}

/**
 * Repayment Service for managing loan repayment operations
 * 
 * ============================================================================
 * REPAYMENT ALLOCATION ORDER (Authoritative)
 * ============================================================================
 * 
 * The system uses Principal-first allocation order via database function:
 * 1. PRINCIPAL - Reduces loan asset first (conservative accounting)
 * 2. INTEREST  - Recognizes revenue second
 * 3. PENALTY   - Clears penalties third
 * 4. OVERPAYMENT - Tracks excess as liability
 * 
 * IMPORTANT: Always use recordAtomicRepayment() which calls the database
 * function process_repayment_atomic(). This ensures:
 * - Correct allocation order
 * - Atomic transaction (all-or-nothing)
 * - Automatic journal entry creation
 * - Proper balance updates
 * 
 * @see process_repayment_atomic SQL function
 */
export class RepaymentService extends BaseServiceClass {
  private static instance: RepaymentService;

  /**
   * Get singleton instance
   */
  public static getInstance(): RepaymentService {
    if (!RepaymentService.instance) {
      RepaymentService.instance = new RepaymentService();
    }
    return RepaymentService.instance;
  }

  /**
   * NEW: Record atomic repayment using database function (RECOMMENDED APPROACH)
   * This ensures all-or-nothing transaction safety and correct accounting
   */
  async recordAtomicRepayment(input: AtomicRepaymentInput): Promise<ServiceResult<any>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['loan_id', 'amount', 'account_id', 'payment_date'];
      const missing = validateRequiredFields(input, requiredFields);
      
      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
      }

      if (input.amount <= 0) {
        throw new Error('Repayment amount must be greater than zero');
      }

      // Call the atomic database function
      const { data, error } = await supabase.rpc('process_repayment_atomic', {
        p_loan_id: input.loan_id,
        p_amount: input.amount,
        p_account_id: input.account_id,
        p_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_payment_date: input.payment_date,
        p_notes: input.notes || null,
        p_reference: input.reference || null,
        p_payment_method: input.payment_method || 'cash'
      });

      if (error) throw error;
      if (!data || !(data as any).success) {
        throw new Error((data as any)?.error || 'Repayment processing failed');
      }
      
      return data as any;
    }, 'Failed to process atomic repayment');
  }

  /**
   * NEW: Record idempotent repayment (prevents duplicates from double-clicks)
   * Use this in frontend forms with generated UUID
   */
  async recordIdempotentRepayment(
    input: AtomicRepaymentInput & { idempotency_key?: string }
  ): Promise<ServiceResult<any>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['loan_id', 'amount', 'account_id', 'payment_date'];
      const missing = validateRequiredFields(input, requiredFields);
      
      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
      }

      if (input.amount <= 0) {
        throw new Error('Repayment amount must be greater than zero');
      }

      // Generate idempotency key if not provided (using crypto.randomUUID for browser/Node)
      const idempotencyKey = input.idempotency_key || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36));

      // Call the idempotent database function
      // NOTE: Parameter order must match database function signature exactly
      const { data, error } = await supabase.rpc('process_repayment_with_idempotency', {
        p_loan_id: input.loan_id,
        p_amount: input.amount,
        p_account_id: input.account_id,
        p_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_idempotency_key: idempotencyKey,  // Position 5 - MUST come before payment_date
        p_payment_date: input.payment_date,  // Position 6
        p_notes: input.notes || null,
        p_reference: input.reference || null,
        p_payment_method: input.payment_method || 'cash'
      });

      if (error) throw error;
      if (!data || !(data as any).success) {
        throw new Error((data as any)?.error || 'Repayment processing failed');
      }
      
      // Return idempotency info
      return {
        ...(data as any),
        idempotency_key: idempotencyKey,
        is_duplicate: (data as any).duplicate || false
      };
    }, 'Failed to process idempotent repayment');
  }

  /**
   * Record a new repayment with accounting integration
   * 
   * @deprecated Use recordAtomicRepayment() instead. This legacy method uses application-layer
   * calculation which can diverge from the database function. The atomic version ensures
   * transactional safety and consistent accounting treatment.
   * 
   * Migration path: Replace calls to recordRepayment() with recordAtomicRepayment()
   */
  async recordRepayment(input: CreateRepaymentInput & { target_account_id: string }): Promise<ServiceResult<Repayment>> {
    console.warn('⚠️ DEPRECATED: recordRepayment() is deprecated. Use recordAtomicRepayment() instead.');
    
    return this.handleAsyncOperation(async () => {
      // Validate target account is Main Bank, Cash, or Mobile Money
      const targetAccount = await accountsService.getAccountById(input.target_account_id);
      if (!targetAccount.data) {
        throw new Error('Target account not found');
      }
      
      // Use account code for validation instead of fragile name matching
      const validCodes = ['BANK', 'CASH', 'MOBILE'];
      const isValidType = validCodes.includes(targetAccount.data.account_code?.toUpperCase());
      
      if (!isValidType) {
        throw new Error(`Account "${targetAccount.data.name}" does not accept repayments. Only BANK, CASH, and MOBILE MONEY accounts can receive loan payments.`);
      }

      throw new Error('recordRepayment is deprecated. Please use recordAtomicRepayment() for transactional safety and correct accounting.');
    }, 'Failed to process repayment (deprecated method)');
  }

  /**
   * Reverse a repayment using atomic database function (RECOMMENDED)
   * Marks repayment as 'reversed' instead of deleting - maintains audit trail
   */
  async reverseRepaymentAtomic(params: {
    repaymentId: string;
    reason: string;
    userId: string;
  }): Promise<ServiceResult<{
    success: boolean;
    message: string;
    loanId: string;
    restoredPrincipal: number;
    restoredInterest: number;
    restoredPenalty: number;
  }>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['repaymentId', 'reason', 'userId'];
      const missing = validateRequiredFields(params, requiredFields);
      
      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
      }

      const { data, error } = await supabase.rpc('reverse_repayment', {
        p_repayment_id: params.repaymentId,
        p_user_id: params.userId,
        p_reason: params.reason
      });

      if (error) throw error;
      if (!data || !(data as any).success) {
        throw new Error((data as any)?.error || 'Repayment reversal failed');
      }
      
      return data as any;
    }, 'Failed to reverse repayment');
  }

  /**
   * Reverse a repayment (full accounting reversal) - LEGACY METHOD
   * 
   * @deprecated Use reverseRepaymentAtomic() instead. This legacy method deletes
   * the repayment record which breaks audit trails. The atomic version marks
   * repayments as 'reversed' and maintains complete history.
   * 
   * Migration path: Replace calls to reverseRepayment() with reverseRepaymentAtomic()
   */
  async reverseRepayment(input: {
    loan_id: string;
    repayment_id: string;
    user_id: string;
    reason: string;
  }): Promise<ServiceResult<Repayment>> {
    console.warn('⚠️ DEPRECATED: reverseRepayment() is deprecated. Use reverseRepaymentAtomic() instead.');
    
    return this.handleAsyncOperation(async () => {
      if (!input.repayment_id) throw new Error('Repayment ID is required');

      // 1) Get the repayment record
      const repayment = await this.fetchRepaymentFromDatabase(input.repayment_id);
      if (!repayment) throw new Error('Repayment not found');

      // 2) Find and reverse the associated journal entry
      const { data: journalEntries, error: journalError } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('reference_id', input.repayment_id)
        .eq('reference_type', 'repayment')
        .limit(1);

      if (journalError) throw journalError;
      if (journalEntries && journalEntries.length > 0) {
          const journalResult = await journalEntriesService.reverseJournalEntry(journalEntries[0].id, input.reason);
          if (!journalResult.success) {
              throw new Error('Failed to reverse journal entry: ' + journalResult.error?.message);
          }
      }

      // 3) Update loan outstanding amounts (add back the paid amounts)
      const loanResult = await loanService.getLoanById(input.loan_id);
      if (loanResult.data) {
        await this.reverseRepaymentFromLoan(loanResult.data, repayment);
      }

      // 4) Delete the repayment record
      const { error: deleteError } = await supabase
        .from('repayments')
        .delete()
        .eq('id', input.repayment_id);

      if (deleteError) throw deleteError;

      // 5) Log audit
      await this.logAudit('reverse_repayment', 'repayment', input.repayment_id, {
        action: 'reverse',
        repayment_id: input.repayment_id,
        loan_id: input.loan_id,
        amount_paid: repayment.amount_paid,
        reason: input.reason,
        reversed_by: input.user_id
      });

      return repayment;
    }, 'Failed to reverse repayment');
  }

  /**
   * Get repayment by ID
   */
  async getRepaymentById(id: string): Promise<ServiceResult<Repayment>> {
    return this.handleAsyncOperation(async () => {
      if (!id) throw new Error('Repayment ID is required');
      const repayment = await this.fetchRepaymentFromDatabase(id);
      if (!repayment) throw new Error('Repayment not found');
      return repayment;
    }, 'Failed to get repayment');
  }

  /**
   * Get all repayments with pagination and filtering
   */
  async getRepayments(
    filters?: RepaymentFilters, 
    pagination?: PaginationParams, 
    sort?: SortParams
  ): Promise<ServiceResult<ListResponse<Repayment>>> {
    return this.handleAsyncOperation(async () => {
      const result = await this.fetchRepaymentsFromDatabase(filters, pagination, sort);
      return result;
    }, 'Failed to get repayments');
  }

  /**
   * Get repayments for a specific loan
   */
  async getLoanRepayments(loanId: string): Promise<ServiceResult<Repayment[]>> {
    return this.handleAsyncOperation(async () => {
      if (!loanId) throw new Error('Loan ID is required');
      const repayments = await this.fetchLoanRepaymentsFromDatabase(loanId);
      return repayments;
    }, 'Failed to get loan repayments');
  }

  /**
   * Get repayment history for a borrower
   */
  async getBorrowerRepaymentHistory(borrowerId: string): Promise<ServiceResult<Repayment[]>> {
    return this.handleAsyncOperation(async () => {
      if (!borrowerId) throw new Error('Borrower ID is required');
      const repayments = await this.fetchBorrowerRepaymentsFromDatabase(borrowerId);
      return repayments;
    }, 'Failed to get borrower repayment history');
  }

  /**
   * Update repayment
   */
  async updateRepayment(id: string, updates: Partial<Repayment>): Promise<ServiceResult<Repayment>> {
    return this.handleAsyncOperation(async () => {
      if (!id) throw new Error('Repayment ID is required');

      const { data, error } = await supabase
        .from('repayments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      const updatedRepayment = data as Repayment;

      // Log audit
      await this.logAudit('update_repayment', 'repayment', id, {
        action: 'update',
        repayment_id: id,
        changes: updates
      });

      // Update search index
      await searchService.indexRepayment(updatedRepayment);

      return updatedRepayment;
    }, 'Failed to update repayment');
  }

  /**
   * Delete repayment (alias for reverseRepayment)
   */
  async deleteRepayment(id: string): Promise<ServiceResult<boolean>> {
      return this.handleAsyncOperation(async () => {
          const repayment = await this.fetchRepaymentFromDatabase(id);
          if (!repayment) throw new Error('Repayment not found');

          const { data: user } = await supabase.auth.getUser();
          
          await this.reverseRepayment({
              loan_id: repayment.loan_id,
              repayment_id: id,
              user_id: user.user?.id || 'system',
              reason: 'Administrative deletion'
          });

          return true;
      }, 'Failed to delete repayment');
  }

  /**
   * Calculate repayment breakdown (Principal vs Interest vs Penalty vs Overpayment)
   * 
   * @deprecated This method uses INCORRECT allocation order (Penalty → Interest → Principal)
   * The authoritative database function uses: Principal → Interest → Penalty
   * 
   * Use recordAtomicRepayment() instead for correct accounting treatment.
   * This method is kept only for backward compatibility and will be removed in future versions.
   */
  private calculateRepaymentBreakdown(loan: Loan, amountPaid: number): {
    principal: number;
    interest: number;
    penalty: number;
    overpayment: number;
  } {
    // DEPRECATION WARNING
    console.warn(
      '⚠️  DEPRECATED: calculateRepaymentBreakdown uses incorrect allocation order. ' +
      'Use recordAtomicRepayment() instead which follows the correct order: ' +
      'Principal → Interest → Penalty → Overpayment'
    );
    
    const dAmountPaid = new Decimal(amountPaid);
    let dRemaining = dAmountPaid;
    
    // OLD ORDER (INCORRECT): Penalties first
    const dPenaltyO = new Decimal(loan.penalty_outstanding || 0);
    const dPenaltyPaid = Decimal.min(dRemaining, dPenaltyO);
    dRemaining = dRemaining.sub(dPenaltyPaid);
    
    // OLD ORDER (INCORRECT): Interest second
    const dInterestO = new Decimal(loan.interest_outstanding || 0);
    const dInterestPaid = Decimal.min(dRemaining, dInterestO);
    dRemaining = dRemaining.sub(dInterestPaid);
    
    // OLD ORDER (INCORRECT): Principal third
    const dPrincipalO = new Decimal(loan.principal_outstanding || 0);
    const dPrincipalPaid = Decimal.min(dRemaining, dPrincipalO);
    dRemaining = dRemaining.sub(dPrincipalPaid);

    // Overpayment last
    const dOverpayment = dRemaining;
    
    return {
      principal: dPrincipalPaid.toNumber(),
      interest: dInterestPaid.toNumber(),
      penalty: dPenaltyPaid.toNumber(),
      overpayment: dOverpayment.toNumber()
    };
  }

  /**
   * Update loan outstanding amounts and overpayments
   */
  private async updateLoanOutstanding(loan: Loan, breakdown: { principal: number, interest: number, penalty: number, overpayment: number }): Promise<Loan> {
    const updatedLoanData = {
      principal_outstanding: Math.max(0, loan.principal_outstanding - breakdown.principal),
      interest_outstanding: Math.max(0, loan.interest_outstanding - breakdown.interest),
      penalty_outstanding: Math.max(0, loan.penalty_outstanding - breakdown.penalty),
      overpayment_amount: (loan.overpayment_amount || 0) + breakdown.overpayment,
      updated_at: new Date().toISOString()
    };

    const result = await loanService.updateLoan({
      id: loan.id,
      ...updatedLoanData
    });

    if (!result.data) throw new Error('Failed to update loan balances');
    return result.data;
  }

  /**
   * Reverse repayment effects on loan balance
   */
  private async reverseRepaymentFromLoan(loan: Loan, repayment: Repayment): Promise<Loan> {
    const updatedLoanData = {
      principal_outstanding: loan.principal_outstanding + (repayment.principal_paid || 0),
      interest_outstanding: loan.interest_outstanding + (repayment.interest_paid || 0),
      penalty_outstanding: loan.penalty_outstanding + (repayment.penalty_paid || 0),
      overpayment_amount: Math.max(0, (loan.overpayment_amount || 0) - (repayment.overpayment_paid || 0)),
      updated_at: new Date().toISOString()
    };

    // If loan was completed, it might become active again
    const updates: any = { 
        id: loan.id, 
        ...updatedLoanData 
    };
    
    if (loan.status === 'completed') {
        updates.status = 'active';
    }

    const result = await loanService.updateLoan(updates);
    if (!result.data) throw new Error('Failed to reverse loan balances');
    return result.data;
  }

  // Database helper methods

  private async fetchRepaymentFromDatabase(id: string): Promise<Repayment | null> {
    const { data, error } = await supabase
      .from('repayments')
      .select('*, loans(reference_no, borrowers(full_name))')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching repayment:', error);
      return null;
    }
    return data as Repayment;
  }

  private async fetchRepaymentsFromDatabase(
    filters?: RepaymentFilters, 
    pagination?: PaginationParams, 
    sort?: SortParams
  ): Promise<ListResponse<Repayment>> {
    let query = supabase.from('repayments').select('*, loans(reference_no, borrowers(full_name))', { count: 'exact' });

    if (filters?.loan_id) query = query.eq('loan_id', filters.loan_id);
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

    return {
      data: (data || []) as Repayment[],
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0
    };
  }

  private async fetchLoanRepaymentsFromDatabase(loanId: string): Promise<Repayment[]> {
    const { data, error } = await supabase
      .from('repayments')
      .select('*, users!recorded_by(full_name)')
      .eq('loan_id', loanId)
      .order('payment_date', { ascending: false });

    if (error) {
      console.error('Error fetching loan repayments:', error);
      return [];
    }
    return data as Repayment[];
  }

  private async fetchBorrowerRepaymentsFromDatabase(borrowerId: string): Promise<Repayment[]> {
    const { data, error } = await supabase
      .from('repayments')
      .select('*, loans!inner(borrower_id)')
      .eq('loans.borrower_id', borrowerId)
      .order('payment_date', { ascending: false });

    if (error) {
      console.error('Error fetching borrower repayments:', error);
      return [];
    }
    return data as Repayment[];
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// Export singleton instance
export const repaymentService = RepaymentService.getInstance();