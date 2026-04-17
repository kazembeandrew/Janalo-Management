import { 
  BaseServiceClass, 
  ServiceResult, 
  PaginationParams, 
  SortParams, 
  FilterParams, 
  ListResponse 
} from './_shared/baseService';
import { InternalAccount } from '../types';
import { validateRequiredFields } from './_shared/utils';
import { auditService } from './audit';
import { supabase } from '@/lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface BankStatement {
  id: string;
  account_id: string;
  statement_date: string;
  statement_period_start: string;
  statement_period_end: string;
  opening_balance: number;
  closing_balance: number;
  total_debits: number;
  total_credits: number;
  transaction_count: number;
  file_name?: string;
  file_type: 'csv' | 'xlsx' | 'pdf' | 'manual';
  uploaded_by?: string;
  uploaded_at?: string;
  reconciliation_status: 'pending' | 'in_progress' | 'reconciled' | 'has_exceptions';
  reconciled_by?: string;
  reconciled_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  account?: InternalAccount;
}

export interface BankStatementLine {
  id: string;
  statement_id: string;
  line_number: number;
  transaction_date: string;
  value_date?: string;
  description: string;
  reference_number?: string;
  debit_amount: number;
  credit_amount: number;
  running_balance?: number;
  matched_transaction_type?: string;
  matched_transaction_id?: string;
  matched_journal_entry_id?: string;
  match_confidence?: 'exact' | 'high' | 'medium' | 'low' | 'unmatched';
  category?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ReconciliationSession {
  id: string;
  statement_id: string;
  session_name: string;
  started_by?: string;
  started_at: string;
  completed_at?: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  total_statement_lines: number;
  matched_lines: number;
  unmatched_lines: number;
  system_unmatched_count: number;
  statement_closing_balance: number;
  system_calculated_balance: number;
  difference: number;
  is_balanced: boolean;
  notes?: string;
}

export interface ReconciliationMatch {
  id: string;
  session_id: string;
  statement_line_id: string;
  journal_entry_id?: string;
  transaction_type: string;
  transaction_id?: string;
  match_type: 'auto_exact' | 'auto_high' | 'manual' | 'forced';
  matched_by?: string;
  matched_at: string;
  confidence_score: number;
  notes?: string;
}

export interface ReconciliationException {
  id: string;
  session_id: string;
  exception_type: 'unmatched_bank' | 'unmatched_system' | 'amount_mismatch' | 'timing_difference' | 'duplicate' | 'missing_in_system';
  statement_line_id?: string;
  journal_entry_id?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggested_action?: string;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  resolution_notes?: string;
  created_at: string;
}

export interface BankDepositSlip {
  id: string;
  deposit_date: string;
  bank_account_id: string;
  deposit_reference?: string;
  cash_amount: number;
  mobile_money_amount: number;
  cheque_amount: number;
  total_deposit: number;
  deposit_slip_number?: string;
  bank_teller_name?: string;
  verified_by?: string;
  verified_at?: string;
  journal_entry_id?: string;
  status: 'pending' | 'verified' | 'deposited' | 'rejected';
  deposited_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class BankReconciliationService extends BaseServiceClass {
  private static instance: BankReconciliationService;

  public static getInstance(): BankReconciliationService {
    if (!BankReconciliationService.instance) {
      BankReconciliationService.instance = new BankReconciliationService();
    }
    return BankReconciliationService.instance;
  }

  // ============================================================================
  // BANK STATEMENTS
  // ============================================================================

  /**
   * Create a new bank statement (manual entry or CSV import)
   */
  async createBankStatement(input: {
    account_id: string;
    statement_date: string;
    statement_period_start: string;
    statement_period_end: string;
    opening_balance: number;
    closing_balance: number;
    file_type: 'csv' | 'xlsx' | 'pdf' | 'manual';
    file_name?: string;
    notes?: string;
  }): Promise<ServiceResult<BankStatement>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = [
        'account_id', 'statement_date', 'statement_period_start',
        'statement_period_end', 'opening_balance', 'closing_balance', 'file_type'
      ];
      const missing = validateRequiredFields(input, requiredFields);
      
      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('bank_statements')
        .insert({
          ...input,
          uploaded_by: user.id,
          reconciliation_status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      return data as BankStatement;
    }, 'Failed to create bank statement');
  }

  /**
   * Import bank statement lines from CSV/manual entry
   */
  async importStatementLines(
    statementId: string,
    lines: Array<{
      line_number: number;
      transaction_date: string;
      description: string;
      reference_number?: string;
      debit_amount: number;
      credit_amount: number;
      running_balance?: number;
    }>
  ): Promise<ServiceResult<{ imported_count: number }>> {
    return this.handleAsyncOperation(async () => {
      if (!lines || lines.length === 0) {
        throw new Error('No lines to import');
      }

      const { data, error } = await supabase
        .from('bank_statement_lines')
        .insert(
          lines.map(line => ({
            statement_id: statementId,
            ...line
          }))
        )
        .select();

      if (error) throw error;

      // Update statement transaction count
      await supabase
        .from('bank_statements')
        .update({ transaction_count: lines.length })
        .eq('id', statementId);

      return { imported_count: lines.length };
    }, 'Failed to import statement lines');
  }

  /**
   * Get bank statements with filtering
   */
  async getBankStatements(
    filters?: {
      account_id?: string;
      reconciliation_status?: string;
      date_from?: string;
      date_to?: string;
    },
    pagination?: PaginationParams
  ): Promise<ServiceResult<ListResponse<BankStatement>>> {
    return this.handleAsyncOperation(async () => {
      let query = supabase
        .from('bank_statements')
        .select('*, internal_accounts!account_id(name, account_code)', { count: 'exact' });

      if (filters?.account_id) {
        query = query.eq('account_id', filters.account_id);
      }
      if (filters?.reconciliation_status) {
        query = query.eq('reconciliation_status', filters.reconciliation_status);
      }
      if (filters?.date_from) {
        query = query.gte('statement_period_start', filters.date_from);
      }
      if (filters?.date_to) {
        query = query.lte('statement_period_end', filters.date_to);
      }

      query = query.order('statement_date', { ascending: false });

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const start = (page - 1) * limit;

      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;

      return {
        data: (data || []) as BankStatement[],
        total: count || 0,
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : 0
      };
    }, 'Failed to fetch bank statements');
  }

  /**
   * Get single bank statement with lines
   */
  async getBankStatementById(id: string): Promise<ServiceResult<BankStatement & { lines?: BankStatementLine[] }>> {
    return this.handleAsyncOperation(async () => {
      const { data: statement, error: stmtError } = await supabase
        .from('bank_statements')
        .select('*')
        .eq('id', id)
        .single();

      if (stmtError) throw stmtError;
      if (!statement) throw new Error('Statement not found');

      const { data: lines, error: linesError } = await supabase
        .from('bank_statement_lines')
        .select('*')
        .eq('statement_id', id)
        .order('line_number', { ascending: true });

      if (linesError) throw linesError;

      return {
        ...statement,
        lines: lines || []
      } as BankStatement & { lines: BankStatementLine[] };
    }, 'Failed to fetch bank statement');
  }

  // ============================================================================
  // RECONCILIATION SESSIONS
  // ============================================================================

  /**
   * Start a new reconciliation session
   */
  async startReconciliation(params: {
    statement_id: string;
    session_name: string;
  }): Promise<ServiceResult<ReconciliationSession>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['statement_id', 'session_name'];
      const missing = validateRequiredFields(params, requiredFields);
      
      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get statement summary
      const { data: statement, error: stmtError } = await supabase
        .from('bank_statements')
        .select('closing_balance')
        .eq('id', params.statement_id)
        .single();

      if (stmtError) throw stmtError;

      const { data, error } = await supabase
        .from('reconciliation_sessions')
        .insert({
          statement_id: params.statement_id,
          session_name: params.session_name,
          started_by: user.id,
          status: 'in_progress',
          statement_closing_balance: statement.closing_balance
        })
        .select()
        .single();

      if (error) throw error;
      return data as ReconciliationSession;
    }, 'Failed to start reconciliation session');
  }

  /**
   * Auto-match bank statement lines to system transactions
   */
  async autoMatchTransactions(statementId: string): Promise<ServiceResult<any>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await supabase.rpc('auto_match_bank_statement', {
        p_statement_id: statementId
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Auto-match failed');
      }

      return data;
    }, 'Failed to auto-match transactions');
  }

  /**
   * Manually match a bank line to a journal entry
   */
  async manualMatch(params: {
    session_id: string;
    statement_line_id: string;
    journal_entry_id?: string;
    transaction_type: string;
    transaction_id?: string;
    match_type: 'manual' | 'forced';
    notes?: string;
  }): Promise<ServiceResult<ReconciliationMatch>> {
    return this.handleAsyncOperation(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('reconciliation_matches')
        .insert({
          ...params,
          matched_by: user.id,
          matched_at: new Date().toISOString(),
          confidence_score: params.match_type === 'manual' ? 0.8 : 0.5
        })
        .select()
        .single();

      if (error) throw error;

      // Update statement line
      await supabase
        .from('bank_statement_lines')
        .update({
          matched_transaction_type: params.transaction_type,
          matched_transaction_id: params.transaction_id,
          matched_journal_entry_id: params.journal_entry_id,
          match_confidence: params.match_type === 'manual' ? 'medium' : 'low',
          matched_by: user.id,
          matched_at: new Date().toISOString()
        })
        .eq('id', params.statement_line_id);

      return data as ReconciliationMatch;
    }, 'Failed to create manual match');
  }

  /**
   * Create reconciliation exception
   */
  async createException(params: {
    session_id: string;
    exception_type: ReconciliationException['exception_type'];
    statement_line_id?: string;
    journal_entry_id?: string;
    severity: ReconciliationException['severity'];
    description: string;
    suggested_action?: string;
  }): Promise<ServiceResult<ReconciliationException>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await supabase
        .from('reconciliation_exceptions')
        .insert(params)
        .select()
        .single();

      if (error) throw error;
      return data as ReconciliationException;
    }, 'Failed to create exception');
  }

  /**
   * Resolve exception
   */
  async resolveException(params: {
    exception_id: string;
    resolution_notes: string;
  }): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('reconciliation_exceptions')
        .update({
          resolved: true,
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
          resolution_notes: params.resolution_notes
        })
        .eq('id', params.exception_id);

      if (error) throw error;
      return true;
    }, 'Failed to resolve exception');
  }

  /**
   * Complete reconciliation session
   */
  async completeReconciliation(sessionId: string): Promise<ServiceResult<any>> {
    return this.handleAsyncOperation(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('complete_reconciliation', {
        p_session_id: sessionId,
        p_user_id: user.id
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to complete reconciliation');
      }

      return data;
    }, 'Failed to complete reconciliation');
  }

  /**
   * Get reconciliation summary
   */
  async getReconciliationSummary(statementId: string): Promise<ServiceResult<any>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await supabase.rpc('get_reconciliation_summary', {
        p_statement_id: statementId
      });

      if (error) throw error;
      return data;
    }, 'Failed to get reconciliation summary');
  }

  // ============================================================================
  // DEPOSIT SLIPS
  // ============================================================================

  /**
   * Create bank deposit slip
   */
  async createDepositSlip(input: {
    deposit_date: string;
    bank_account_id: string;
    cash_amount: number;
    mobile_money_amount: number;
    cheque_amount: number;
    deposit_slip_number?: string;
    notes?: string;
  }): Promise<ServiceResult<BankDepositSlip>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['deposit_date', 'bank_account_id'];
      const missing = validateRequiredFields(input, requiredFields);
      
      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('bank_deposit_slips')
        .insert({
          ...input,
          deposited_by: user.id,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      return data as BankDepositSlip;
    }, 'Failed to create deposit slip');
  }

  /**
   * Verify deposit slip
   */
  async verifyDepositSlip(depositSlipId: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('bank_deposit_slips')
        .update({
          status: 'verified',
          verified_by: user.id,
          verified_at: new Date().toISOString()
        })
        .eq('id', depositSlipId);

      if (error) throw error;
      return true;
    }, 'Failed to verify deposit slip');
  }
}

// Export singleton instance
export const bankReconciliationService = BankReconciliationService.getInstance();
