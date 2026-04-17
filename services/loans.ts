import { 
  BaseServiceClass, 
  ServiceResult, 
  PaginationParams, 
  SortParams, 
  FilterParams, 
  ListResponse 
} from './_shared/baseService';
import { 
  Loan, 
  LoanStatus, 
  InterestType, 
  Repayment, 
  LoanNote, 
  LoanDocument, 
  Visitation, 
  AmortizationScheduleItem 
} from '../types';
import { 
  validateRequiredFields 
} from './_shared/utils';
import { calculateLoanDetails, generateAutoReference } from '@/utils/finance';
import { auditService } from './audit';
import { searchService } from './search';
import { accountsService } from './accounts';
import { journalEntriesService } from './journalEntries';
import { supabase } from '@/lib/supabase';

interface CreateLoanInput {
  borrower_id: string;
  principal_amount: number;
  interest_rate: number;
  interest_type: InterestType;
  term_months: number;
  disbursement_date: string;
  officer_id?: string;
  reference_no?: string;
  risk_level?: string;
}

interface UpdateLoanInput {
  id: string;
  principal_amount?: number;
  interest_rate?: number;
  interest_type?: InterestType;
  term_months?: number;
  disbursement_date?: string;
  status?: LoanStatus;
  monthly_installment?: number;
  total_payable?: number;
  principal_outstanding?: number;
  interest_outstanding?: number;
  penalty_outstanding?: number;
  updated_at?: string;
}

interface LoanFilters extends FilterParams {
  status?: LoanStatus;
  officer_id?: string;
  borrower_id?: string;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
}

/**
 * Loan Service for managing loan operations
 */
export class LoanService extends BaseServiceClass {
  private static instance: LoanService;

  /**
   * Get singleton instance
   */
  public static getInstance(): LoanService {
    if (!LoanService.instance) {
      LoanService.instance = new LoanService();
    }
    return LoanService.instance;
  }

  /**
   * Create a new loan
   */
  async createLoan(input: CreateLoanInput): Promise<ServiceResult<Loan>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['borrower_id', 'principal_amount', 'interest_rate', 'interest_type', 'term_months', 'disbursement_date'];
      const missing = validateRequiredFields(input, requiredFields);
      
      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
      }

      // Calculate derived fields using centralized finance utility
      const { 
        monthlyInstallment, 
        totalPayable,
        totalInterest
      } = calculateLoanDetails(
        input.principal_amount, 
        input.interest_rate, 
        input.term_months, 
        input.interest_type
      );
      const referenceNo = input.reference_no || await generateAutoReference();

      // FIX: Initialize interest_outstanding based on loan type
      // Flat-rate: All interest due upfront (contractual obligation)
      // Reducing balance: Starts at zero, recognized when received (cash-basis)
      const initialInterestOutstanding = input.interest_type === 'flat' 
        ? totalInterest 
        : 0;

      // Create loan record in Supabase
      const { data, error } = await (supabase as any)
        .from('loans')
        .insert([{
          reference_no: referenceNo,
          borrower_id: input.borrower_id,
          officer_id: input.officer_id || (await (supabase as any).auth.getUser()).data.user?.id,
          principal_amount: input.principal_amount,
          interest_rate: input.interest_rate,
          interest_type: input.interest_type,
          term_months: input.term_months,
          disbursement_date: input.disbursement_date,
          monthly_installment: monthlyInstallment,
          total_payable: totalPayable,
          principal_outstanding: input.principal_amount,
          interest_outstanding: initialInterestOutstanding,
          penalty_outstanding: 0,
          risk_level: input.risk_level || 'low',
          status: 'pending' as LoanStatus
        }])
        .select()
        .single();

      if (error) throw error;
      const loan = data as Loan;

      // Log audit
      await this.logAudit('create_loan', 'loan', loan.id, {
        action: 'create',
        loan_id: loan.id,
        reference_no: loan.reference_no,
        borrower_id: loan.borrower_id,
        principal_amount: loan.principal_amount
      });

      // Update search index
      await searchService.indexLoan(loan);

      return loan;
    }, 'Failed to create loan');
  }

  /**
   * Bulk disburse loans
   */
  async bulkDisburseLoans(params: {
    loan_ids: string[];
    account_id: string;
    user_id: string;
  }): Promise<ServiceResult<{
    success: boolean;
    disbursed_count: number;
    failed_count: number;
    error?: string;
  }>> {
    return this.handleAsyncOperation(async () => {
      const { loan_ids, account_id, user_id } = params;

      const { data, error } = await (supabase as any).rpc('bulk_disburse_loans', {
        p_loan_ids: loan_ids,
        p_source_account_id: account_id,
        p_user_id: user_id
      });

      if (error) throw error;
      return data as any;
    }, 'Failed to bulk disburse loans');
  }

  /**
   * NEW: Secure bulk disbursement with concurrency control (RECOMMENDED)
   * Uses pessimistic locking to prevent race conditions
   */
  async bulkDisburseLoansSecure(params: {
    loan_ids: string[];
    account_id: string;
    user_id?: string;
    disbursement_date?: string;
    note?: string;
  }): Promise<ServiceResult<{
    success: boolean;
    disbursed_count: number;
    failed_count: number;
    errors?: string[];
  }>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['loan_ids', 'account_id'];
      const missing = validateRequiredFields(params, requiredFields);
      
      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
      }

      if (!params.loan_ids || params.loan_ids.length === 0) {
        throw new Error('No loan IDs provided for disbursement');
      }

      // Use authenticated user ID if not provided
      const userId = params.user_id || (await (supabase as any).auth.getUser()).data.user?.id;
      if (!userId) {
        throw new Error('User ID is required for disbursement');
      }

      const disbursementDate = params.disbursement_date || new Date().toISOString().split('T')[0];

      // Call the SECURE atomic database function with locking
      const { data, error } = await (supabase as any).rpc('bulk_disburse_loans_secure', {
        p_loan_ids: params.loan_ids,
        p_account_id: params.account_id,
        p_user_id: userId,
        p_disbursement_date: disbursementDate,
        p_note: params.note || null
      });

      if (error) throw error;
      if (!data) {
        throw new Error('Bulk disbursement returned no data');
      }
      
      return data as any;
    }, 'Failed to securely bulk disburse loans');
  }

  /**
   * Check rate limit
   */
  async checkRateLimit(action: string, maxRequests: number = 10, windowMinutes: number = 1): Promise<ServiceResult<{ allowed: boolean; reason?: string }>> {
      return this.handleAsyncOperation(async () => {
          const { data, error } = await (supabase as any).rpc('check_rate_limit', {
              p_identifier: 'user_' + (await (supabase as any).auth.getUser()).data.user?.id,
              p_action: action,
              p_max_requests: maxRequests,
              p_window_minutes: windowMinutes
          });

          if (error) throw error;
          return data;
      }, 'Rate limit check failed');
  }

  /**
   * Check financial permission
   */
  async checkFinancialPermission(operation: string, amount: number): Promise<ServiceResult<{ allowed: boolean; requiresApproval?: boolean; reason?: string }>> {
      return this.handleAsyncOperation(async () => {
          const { data: { user } } = await (supabase as any).auth.getUser();
          if (!user) throw new Error('Not authenticated');

          const { data, error } = await (supabase as any).rpc('check_financial_operation_permission', {
              p_user_id: user.id,
              p_operation: operation,
              p_amount: amount
          });

          if (error) throw error;
          return data;
      }, 'Permission check failed');
  }

  /**
   * Disburse a loan (includes accounting integration)
   */
  async disburseLoan(params: {
    loan_id: string;
    account_id: string;
    disbursement_date: string;
    user_id?: string;
    note?: string;
  }): Promise<ServiceResult<Loan>> {
    return this.handleAsyncOperation(async () => {
      const { loan_id, account_id, disbursement_date, user_id, note } = params;

      // 1) Get the loan
      const loanResult = await this.getLoanById(loan_id);
      if (!loanResult.data) throw new Error('Loan not found');
      const loan = loanResult.data;

      if (loan.status !== 'pending' && loan.status !== 'approved') {
        throw new Error(`Loan cannot be disbursed because it is in ${loan.status} status (must be pending/approved)`);
      }

      // 2) Validate account is Main Bank or Cash only
      const sourceAccount = await accountsService.getAccountById(account_id);
      if (!sourceAccount.data) {
        throw new Error('Source account not found');
      }
      const accountName = sourceAccount.data.name.toLowerCase();
      if (!accountName.includes('main bank') && !accountName.includes('cash')) {
        throw new Error('Disbursement is only allowed from Main Bank Account or Cash accounts');
      }

      // 3) Get system account (PORTFOLIO)
      const portfolioAcctResult = await accountsService.getAccountByCode('PORTFOLIO');
      if (!portfolioAcctResult.data) {
          throw new Error('Required system account (PORTFOLIO) not found');
      }

      // 3) Post accounting entry
      // Debit: Portfolio (Asset)
      // Credit: Source Account (Cash/Bank)
      const journalResult = await journalEntriesService.createJournalEntry({
        reference_type: 'loan_disbursement',
        reference_id: loan.id,
        date: disbursement_date,
        description: `Loan Disbursement: ${loan.reference_no} (${loan.borrowers?.full_name || 'Client'}) ${note || ''}`,
        journal_lines: [
          { account_id: portfolioAcctResult.data.id, debit: loan.principal_amount, credit: 0 },
          { account_id: account_id, debit: 0, credit: loan.principal_amount }
        ]
      });

      if (!journalResult.success) {
          throw new Error('Failed to post disbursement journal entry: ' + journalResult.error?.message);
      }

      // 4) Update loan status and disbursement date
      const updatedLoanResult = await this.updateLoan({
        id: loan_id,
        status: 'active',
        disbursement_date,
        updated_at: new Date().toISOString()
      });

      if (!updatedLoanResult.data) throw new Error('Failed to update loan status');

      // Log audit
      await this.logAudit('disburse_loan', 'loan', loan_id, {
        action: 'disburse',
        loan_id,
        account_id,
        journal_entry_id: journalResult.data?.id
      });

      return updatedLoanResult.data;
    }, 'Failed to disburse loan');
  }

  /**
   * Write off a loan as a loss (IMPROVED VERSION - RECOMMENDED)
   * Uses the database function write_off_loan_improved() which:
   * - Properly handles penalty receivable accounts
   * - Applies existing loan loss provisions
   * - Creates proper audit trail
   * - Maintains accounting integrity
   */
  async writeOffLoan(params: {
    loan_id: string;
    reason: string;
    user_id: string;
  }): Promise<ServiceResult<Loan & {
    principal_loss: number;
    interest_loss: number;
    penalty_loss: number;
    total_loss: number;
    provision_applied: number;
  }>> {
    return this.handleAsyncOperation(async () => {
      const { loan_id, reason, user_id } = params;

      // Use the improved database function for write-off
      const { data, error } = await (supabase as any).rpc('write_off_loan_improved', {
        p_loan_id: loan_id,
        p_reason: reason,
        p_user_id: user_id
      });

      if (error) throw error;

      if (!data || !data.success) {
        throw new Error(data?.error || 'Loan write-off failed');
      }

      // Fetch the updated loan
      const loanResult = await this.getLoanById(loan_id);
      if (!loanResult.data) {
        throw new Error('Loan write-off completed but loan could not be retrieved');
      }

      return {
        ...loanResult.data,
        principal_loss: data.principal_loss,
        interest_loss: data.interest_loss,
        penalty_loss: data.penalty_loss,
        total_loss: data.total_loss,
        provision_applied: data.provision_applied
      };
    }, 'Failed to write off loan');
  }

  /**
   * LEGACY: Write off a loan (manual journal entry method)
   * @deprecated Use writeOffLoan() instead which uses the improved database function
   */
  async writeOffLoanLegacy(params: {
    loan_id: string;
    reason: string;
    user_id: string;
  }): Promise<ServiceResult<Loan>> {
    console.warn('⚠️ DEPRECATED: writeOffLoanLegacy() is deprecated. Use writeOffLoan() instead.');
    return this.writeOffLoan(params);
  }

  /**
   * Log a field visit
   */
  async logVisit(params: {
    loan_id: string;
    officer_id: string;
    notes: string;
    location_lat?: number | null;
    location_long?: number | null;
    image_path?: string | null;
    visit_date: string;
  }): Promise<ServiceResult<Visitation>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('visitations')
        .insert([{
          loan_id: params.loan_id,
          officer_id: params.officer_id,
          notes: params.notes,
          location_lat: params.location_lat,
          location_long: params.location_long,
          image_path: params.image_path,
          visit_date: params.visit_date
        }])
        .select()
        .single();

      if (error) throw error;
      const visit = data as Visitation;

      await this.addLoanNote(params.loan_id, `Field Visit Logged: ${params.notes}`, true);

      // Log audit
      await this.logAudit('log_visit', 'visitation', visit.id, {
        action: 'create',
        loan_id: params.loan_id,
        visit_id: visit.id
      });

      return visit;
    }, 'Failed to log visit');
  }

  /**
   * Get loan by ID
   */
  async getLoanById(id: string): Promise<ServiceResult<Loan>> {
    return this.handleAsyncOperation(async () => {
      if (!id) throw new Error('Loan ID is required');
      const loan = await this.fetchLoanFromDatabase(id);
      if (!loan) throw new Error('Loan not found');
      return loan;
    }, 'Failed to get loan');
  }

  /**
   * Get all loans with pagination and filtering
   */
  async getLoans(
    filters?: LoanFilters, 
    pagination?: PaginationParams, 
    sort?: SortParams
  ): Promise<ServiceResult<ListResponse<Loan>>> {
    return this.handleAsyncOperation(async () => {
      const result = await this.fetchLoansFromDatabase(filters, pagination, sort);
      return result;
    }, 'Failed to get loans');
  }

  /**
   * Update loan
   */
  async updateLoan(input: UpdateLoanInput): Promise<ServiceResult<Loan>> {
    return this.handleAsyncOperation(async () => {
      if (!input.id) throw new Error('Loan ID is required');

      const updateData: any = { ...input };
      delete updateData.id;
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await (supabase as any)
        .from('loans')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;
      const updatedLoan = data as Loan;

      // Log audit
      await this.logAudit('update_loan', 'loan', input.id, {
        action: 'update',
        loan_id: input.id,
        changes: input
      });

      // Update search index
      await searchService.indexLoan(updatedLoan);

      return updatedLoan;
    }, 'Failed to update loan');
  }



  /**
   * Delete loan (includes journal entry reversal)
   */
  async deleteLoan(id: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      if (!id) throw new Error('Loan ID is required');

      // 1) Get the loan
      const loanResult = await this.getLoanById(id);
      if (!loanResult.data) throw new Error('Loan not found');
      const loan = loanResult.data;

      // 2) Reverse all associated journal entries (Disbursements, Repayments)
      const { data: user } = await (supabase as any).auth.getUser();
      const userId = user.user?.id || 'system';

      await this.reverseAllLoanJournalEntries(id, userId);

      // 3) Delete related records
      await Promise.all([
          (supabase as any).from('loan_notes').delete().eq('loan_id', id),
          (supabase as any).from('loan_documents').delete().eq('loan_id', id),
          (supabase as any).from('visitations').delete().eq('loan_id', id),
          (supabase as any).from('repayments').delete().eq('loan_id', id)
      ]);

      // 4) Delete the loan
      const { error } = await (supabase as any).from('loans').delete().eq('id', id);
      if (error) throw error;

      // Log audit
      await this.logAudit('delete_loan', 'loan', id, {
        action: 'delete',
        loan_id: id,
        reference_no: loan.reference_no
      });

      // Remove from search index
      await searchService.removeFromIndex('loan', id);

      return true;
    }, 'Failed to delete loan');
  }

  /**
   * Private helper to reverse all journal entries for a loan
   */
  private async reverseAllLoanJournalEntries(loanId: string, userId: string): Promise<void> {
    // 1) Find disbursement entries
    const { data: disbEntries } = await (supabase as any)
        .from('journal_entries')
        .select('id')
        .eq('reference_type', 'loan_disbursement')
        .eq('reference_id', loanId);
    
    // 2) Find repayment entries
    const { data: repayments } = await (supabase as any)
        .from('repayments')
        .select('id')
        .eq('loan_id', loanId);
    
    const repaymentIds = (repayments || []).map(r => r.id);
    let repayEntries: { id: string }[] = [];
    if (repaymentIds.length > 0) {
        const { data: entries } = await (supabase as any)
            .from('journal_entries')
            .select('id')
            .eq('reference_type', 'repayment')
            .in('reference_id', repaymentIds);
        repayEntries = entries || [];
    }

    // 3) Reverse all found entries
    const entriesToReverse = [...(disbEntries || []), ...repayEntries];
    for (const entry of entriesToReverse) {
        await journalEntriesService.reverseJournalEntry(entry.id, `Loan Deletion Reversal (${loanId})`);
    }
  }

  /**
   * Update loan status
   */
  async updateLoanStatus(id: string, status: LoanStatus, reason?: string): Promise<ServiceResult<Loan>> {
    return this.handleAsyncOperation(async () => {
      if (!id) throw new Error('Loan ID is required');

      const existingLoan = await this.getLoanById(id);
      if (!existingLoan.data) throw new Error('Loan not found');

      const updatedLoanResult = await this.updateLoan({
        id,
        status
      });

      if (reason) {
          await this.addLoanNote(id, `Status changed to ${status}: ${reason}`, true);
      }

      // Log audit
      await this.logAudit('update_loan_status', 'loan', id, {
        action: 'status_change',
        loan_id: id,
        old_status: existingLoan.data.status,
        new_status: status,
        reason
      });

      return updatedLoanResult.data!;
    }, 'Failed to update loan status');
  }

  /**
   * Get loan amortization schedule
   */
  async getAmortizationSchedule(id: string): Promise<ServiceResult<AmortizationScheduleItem[]>> {
    return this.handleAsyncOperation(async () => {
      const loanResult = await this.getLoanById(id);
      if (!loanResult.data) throw new Error('Loan not found');
      const loan = loanResult.data;
      
      const { schedule } = calculateLoanDetails(
        loan.principal_amount,
        loan.interest_rate,
        loan.term_months,
        loan.interest_type
      );

      return schedule.map(item => ({
        ...item,
        paymentNumber: item.month
      }));
    }, 'Failed to get amortization schedule');
  }

  /**
   * Get loan repayments
   */
  async getLoanRepayments(loanId: string): Promise<ServiceResult<Repayment[]>> {
    return this.handleAsyncOperation(async () => {
      if (!loanId) throw new Error('Loan ID is required');
      const repayments = await this.fetchRepaymentsFromDatabase(loanId);
      return repayments;
    }, 'Failed to get loan repayments');
  }

  /**
   * Get loan notes
   */
  async getLoanNotes(loanId: string): Promise<ServiceResult<LoanNote[]>> {
    return this.handleAsyncOperation(async () => {
      if (!loanId) throw new Error('Loan ID is required');
      const notes = await this.fetchLoanNotesFromDatabase(loanId);
      return notes;
    }, 'Failed to get loan notes');
  }

  /**
   * Add loan note
   */
  async addLoanNote(loanId: string, content: string, isSystem: boolean = false): Promise<ServiceResult<LoanNote>> {
    return this.handleAsyncOperation(async () => {
      if (!loanId) throw new Error('Loan ID is required');
      if (!content || content.trim() === '') throw new Error('Note content is required');

      const { data: user } = await (supabase as any).auth.getUser();

      const { data, error } = await (supabase as any)
        .from('loan_notes')
        .insert([{
          loan_id: loanId,
          user_id: isSystem ? null : user.user?.id,
          content: content.trim(),
          is_system: isSystem
        }])
        .select()
        .single();

      if (error) throw error;
      const note = data as LoanNote;

      // Log audit
      await this.logAudit('add_loan_note', 'loan_note', note.id, {
        action: 'create',
        loan_id: loanId,
        note_id: note.id,
        content: content
      });

      return note;
    }, 'Failed to add loan note');
  }

  /**
   * Get loan documents
   */
  async getLoanDocuments(loanId: string): Promise<ServiceResult<LoanDocument[]>> {
    return this.handleAsyncOperation(async () => {
      if (!loanId) throw new Error('Loan ID is required');
      const documents = await this.fetchLoanDocumentsFromDatabase(loanId);
      return documents;
    }, 'Failed to get loan documents');
  }

  /**
   * Get loan visitations
   */
  async getLoanVisitations(loanId: string): Promise<ServiceResult<Visitation[]>> {
    return this.handleAsyncOperation(async () => {
      if (!loanId) throw new Error('Loan ID is required');
      const visitations = await this.fetchLoanVisitationsFromDatabase(loanId);
      return visitations;
    }, 'Failed to get loan visitations');
  }

  // Database helper methods

  private async fetchLoanFromDatabase(id: string): Promise<Loan | null> {
    const { data, error } = await (supabase as any)
      .from('loans')
      .select('*, borrowers(full_name, phone, address, employment), users!officer_id(full_name)')
      .eq('id', id)
      .single();
      
    if (error) {
      console.error('Error fetching loan:', error);
      return null;
    }
    return data as Loan;
  }

  private async fetchLoansFromDatabase(
    filters?: LoanFilters, 
    pagination?: PaginationParams, 
    sort?: SortParams
  ): Promise<ListResponse<Loan>> {
    let query = (supabase as any).from('loans').select('*, borrowers(full_name), users!officer_id(full_name)', { count: 'exact' });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.officer_id) query = query.eq('officer_id', filters.officer_id);
    if (filters?.borrower_id) query = query.eq('borrower_id', filters.borrower_id);
    if (filters?.date_from) query = query.gte('disbursement_date', filters.date_from);
    if (filters?.date_to) query = query.lte('disbursement_date', filters.date_to);

    if (sort) {
      query = query.order(sort.sortBy || 'created_at', { ascending: sort.sortOrder === 'asc' });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const start = (page - 1) * limit;

    const { data, count, error } = await query.range(start, start + limit - 1);
    if (error) throw error;

    return {
      data: (data || []) as Loan[],
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0
    };
  }

  private async fetchRepaymentsFromDatabase(loanId: string): Promise<Repayment[]> {
    const { data, error } = await (supabase as any)
      .from('repayments')
      .select('*, users!recorded_by(full_name)')
      .eq('loan_id', loanId)
      .order('payment_date', { ascending: false });

    if (error) {
      console.error('Error fetching repayments:', error);
      return [];
    }
    return data as Repayment[];
  }

  private async fetchLoanNotesFromDatabase(loanId: string): Promise<LoanNote[]> {
    const { data, error } = await (supabase as any)
      .from('loan_notes')
      .select('*, users(full_name)')
      .eq('loan_id', loanId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching loan notes:', error);
      return [];
    }
    return data as LoanNote[];
  }

  private async fetchLoanDocumentsFromDatabase(loanId: string): Promise<LoanDocument[]> {
    const { data, error } = await (supabase as any)
      .from('loan_documents')
      .select('*')
      .eq('loan_id', loanId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching loan documents:', error);
      return [];
    }
    return data as LoanDocument[];
  }

  private async fetchLoanVisitationsFromDatabase(loanId: string): Promise<Visitation[]> {
    const { data, error } = await (supabase as any)
        .from('visitations')
        .select('*, users!officer_id(full_name)')
        .eq('loan_id', loanId)
        .order('visit_date', { ascending: false });

    if (error) {
        console.error('Error fetching visitations:', error);
        return [];
    }
    return data as Visitation[];
  }

  private async logAudit(action: string, entityType: string, entityId: string, details: any): Promise<void> {
    await auditService.logAudit(action, entityType, entityId, details);
  }
}

// Export singleton instance
export const loanService = LoanService.getInstance();
