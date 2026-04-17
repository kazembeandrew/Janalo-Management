import { BaseServiceClass, ServiceResult } from './_shared/baseService';
import { supabase } from '@/lib/supabase';

export interface BalanceAuditEntry {
  id: string;
  entityType: 'loan' | 'account';
  entityId: string;
  fieldName: string;
  oldValue: number | null;
  newValue: number | null;
  changeAmount: number | null;
  changedBy: string | null;
  changeReason: string | null;
  transactionId: string | null;
  createdAt: string;
}

export interface LoanBalanceHistoryEntry extends BalanceAuditEntry {
  loanId: string;
  referenceNo?: string;
  borrowerName?: string;
  changedByEmail?: string;
}

/**
 * Balance Audit Service
 * 
 * Provides access to the balance_audit_log table for forensic analysis
 * of all balance changes across loans and accounts.
 * 
 * Automatically populated by database triggers - no manual intervention needed.
 */
export class BalanceAuditService extends BaseServiceClass {
  private static instance: BalanceAuditService;

  public static getInstance(): BalanceAuditService {
    if (!BalanceAuditService.instance) {
      BalanceAuditService.instance = new BalanceAuditService();
    }
    return BalanceAuditService.instance;
  }

  /**
   * Get complete balance history for a specific loan
   * Returns chronological list of all balance changes
   */
  async getLoanBalanceHistory(loanId: string): Promise<ServiceResult<LoanBalanceHistoryEntry[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await supabase
        .from('vw_loan_balance_history' as any)
        .select('*')
        .eq('loan_id', loanId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Map view columns to interface
      return (data || []).map((entry: any) => ({
        id: entry.id,
        entityType: 'loan' as const,
        entityId: entry.loan_id,
        fieldName: entry.field_name,
        oldValue: entry.old_value,
        newValue: entry.new_value,
        changeAmount: entry.change_amount,
        changedBy: entry.changed_by_email,
        changeReason: entry.change_reason,
        transactionId: entry.transaction_id,
        createdAt: entry.created_at,
        loanId: entry.loan_id,
        referenceNo: entry.reference_no,
        borrowerName: entry.borrower_name,
        changedByEmail: entry.changed_by_email
      })) as LoanBalanceHistoryEntry[];
    }, 'Failed to fetch loan balance history');
  }

  /**
   * Get recent balance changes across all loans
   * Useful for monitoring dashboards and anomaly detection
   */
  async getRecentChanges(limit: number = 50): Promise<ServiceResult<LoanBalanceHistoryEntry[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await supabase
        .from('vw_loan_balance_history' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      return (data || []).map((entry: any) => ({
        id: entry.id,
        entityType: 'loan' as const,
        entityId: entry.loan_id,
        fieldName: entry.field_name,
        oldValue: entry.old_value,
        newValue: entry.new_value,
        changeAmount: entry.change_amount,
        changedBy: entry.changed_by_email,
        changeReason: entry.change_reason,
        transactionId: entry.transaction_id,
        createdAt: entry.created_at,
        loanId: entry.loan_id,
        referenceNo: entry.reference_no,
        borrowerName: entry.borrower_name,
        changedByEmail: entry.changed_by_email
      })) as LoanBalanceHistoryEntry[];
    }, 'Failed to fetch recent balance changes');
  }

  /**
   * Get balance changes for a specific field across all loans
   * Example: Track all principal_outstanding changes
   */
  async getChangesByField(fieldName: string, limit: number = 100): Promise<ServiceResult<LoanBalanceHistoryEntry[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await supabase
        .from('balance_audit_log' as any)
        .select(`
          *,
          loans!inner(reference_no, borrowers(first_name, last_name)),
          auth.users!changed_by(email)
        `)
        .eq('field_name', fieldName)
        .eq('entity_type', 'loan')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      return (data || []).map((entry: any) => ({
        id: entry.id,
        entityType: entry.entity_type,
        entityId: entry.entity_id,
        fieldName: entry.field_name,
        oldValue: entry.old_value,
        newValue: entry.new_value,
        changeAmount: entry.change_amount,
        changedBy: entry.users?.email,
        changeReason: entry.change_reason,
        transactionId: entry.transaction_id,
        createdAt: entry.created_at,
        loanId: entry.entity_id,
        referenceNo: entry.loans?.reference_no,
        borrowerName: entry.loans?.borrowers ? 
          `${entry.loans.borrowers.first_name} ${entry.loans.borrowers.last_name}` : undefined,
        changedByEmail: entry.users?.email
      })) as LoanBalanceHistoryEntry[];
    }, `Failed to fetch changes for field: ${fieldName}`);
  }

  /**
   * Get balance changes within a date range
   * Useful for period-end reconciliation and audits
   */
  async getChangesByDateRange(
    startDate: string,
    endDate: string,
    limit: number = 200
  ): Promise<ServiceResult<LoanBalanceHistoryEntry[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await supabase
        .from('vw_loan_balance_history' as any)
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      return (data || []).map((entry: any) => ({
        id: entry.id,
        entityType: 'loan' as const,
        entityId: entry.loan_id,
        fieldName: entry.field_name,
        oldValue: entry.old_value,
        newValue: entry.new_value,
        changeAmount: entry.change_amount,
        changedBy: entry.changed_by_email,
        changeReason: entry.change_reason,
        transactionId: entry.transaction_id,
        createdAt: entry.created_at,
        loanId: entry.loan_id,
        referenceNo: entry.reference_no,
        borrowerName: entry.borrower_name,
        changedByEmail: entry.changed_by_email
      })) as LoanBalanceHistoryEntry[];
    }, 'Failed to fetch balance changes by date range');
  }

  /**
   * Get summary statistics for balance changes
   * Returns counts and totals by field type
   */
  async getBalanceChangeSummary(startDate?: string, endDate?: string): Promise<ServiceResult<{
    totalChanges: number;
    byField: Record<string, { count: number; totalChange: number }>;
    byUser: Record<string, { count: number }>;
  }>> {
    return this.handleAsyncOperation(async () => {
      let query = supabase
        .from('balance_audit_log' as any)
        .select('field_name, change_amount, changed_by, created_at')
        .eq('entity_type', 'loan');

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Aggregate statistics
      const byField: Record<string, { count: number; totalChange: number }> = {};
      const byUser: Record<string, { count: number }> = {};
      let totalChanges = 0;

      data?.forEach((entry: any) => {
        totalChanges++;

        // By field
        if (!byField[entry.field_name]) {
          byField[entry.field_name] = { count: 0, totalChange: 0 };
        }
        byField[entry.field_name].count++;
        byField[entry.field_name].totalChange += Number(entry.change_amount) || 0;

        // By user
        const userId = entry.changed_by || 'unknown';
        if (!byUser[userId]) {
          byUser[userId] = { count: 0 };
        }
        byUser[userId].count++;
      });

      return {
        totalChanges,
        byField,
        byUser
      };
    }, 'Failed to fetch balance change summary');
  }

  /**
   * Detect anomalies in balance changes
   * Flags unusually large changes or suspicious patterns
   */
  async detectAnomalies(thresholdMultiplier: number = 3): Promise<ServiceResult<LoanBalanceHistoryEntry[]>> {
    return this.handleAsyncOperation(async () => {
      // For now, return recent large changes (> MK 1,000,000)
      const { data: largeChanges, error } = await supabase
        .from('vw_loan_balance_history' as any)
        .select('*')
        .or(`change_amount.gt.1000000,change_amount.lt.-1000000`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return (largeChanges || []).map((entry: any) => ({
        id: entry.id,
        entityType: 'loan' as const,
        entityId: entry.loan_id,
        fieldName: entry.field_name,
        oldValue: entry.old_value,
        newValue: entry.new_value,
        changeAmount: entry.change_amount,
        changedBy: entry.changed_by_email,
        changeReason: entry.change_reason,
        transactionId: entry.transaction_id,
        createdAt: entry.created_at,
        loanId: entry.loan_id,
        referenceNo: entry.reference_no,
        borrowerName: entry.borrower_name,
        changedByEmail: entry.changed_by_email
      })) as LoanBalanceHistoryEntry[];
    }, 'Failed to detect balance anomalies');
  }
}

export const balanceAuditService = BalanceAuditService.getInstance();
