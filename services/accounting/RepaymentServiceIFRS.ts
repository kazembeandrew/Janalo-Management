import { supabase } from '@/integrations/supabase/client';
import Decimal from 'decimal.js';

export interface RepaymentAllocation {
  penaltyPaid: number;
  interestPaid: number;
  principalPaid: number;
  overpayment: number;
}

export interface RepaymentResult {
  success: boolean;
  repaymentId?: string;
  journalEntryId?: string;
  repaymentNumber?: string;
  allocation?: RepaymentAllocation;
  loanBalance?: {
    principalOutstanding: number;
    interestOutstanding: number;
    penaltyOutstanding: number;
    overpaymentBalance: number;
  };
  error?: string;
}

export interface SettlementResult {
  success: boolean;
  settlementId?: string;
  journalEntryId?: string;
  referenceNumber?: string;
  amount?: number;
  fee?: number;
  netAmount?: number;
  error?: string;
}

/**
 * RepaymentServiceIFRS - IFRS-Compliant Repayment Processing
 * 
 * Implements the correct IFRS allocation order:
 * 1. PENALTY (highest priority - clear penalties first)
 * 2. INTEREST (recognize revenue)
 * 3. PRINCIPAL (reduce loan asset)
 * 4. OVERPAYMENT (track excess as liability)
 * 
 * Also handles mobile money clearing accounts with T+1 settlement
 */
export class RepaymentServiceIFRS {

  /**
   * Record a loan repayment with IFRS-compliant allocation
   * 
   * IFRS Allocation Order:
   * 1. Penalty (clear first - highest risk receivable)
   * 2. Interest (recognize revenue)
   * 3. Principal (reduce loan asset)
   * 4. Overpayment (liability to borrower)
   * 
   * @param input - Repayment data
   * @returns Result with allocation details
   */
  async recordRepayment(input: {
    loanId: string;
    amount: number;
    paymentDate: string;
    paymentMethod: 'cash' | 'bank_transfer' | 'airtel_money' | 'mpamba' | 'check';
    referenceNumber?: string;
    bankAccountId: string; // Bank account for settlement
    recordedBy: string;
  }): Promise<RepaymentResult> {
    
    try {
      // Validate loan exists and is active
      const { data: loan, error: loanError } = await supabase
        .from('loans')
        .select('id, loan_number, status, principal_outstanding, principal_amount')
        .eq('id', input.loanId)
        .single();
      
      if (loanError || !loan) {
        return {
          success: false,
          error: `Loan not found: ${input.loanId}`
        };
      }
      
      if (loan.status !== 'active' && loan.status !== 'disbursed') {
        return {
          success: false,
          error: `Loan must be active to receive payments. Current status: ${loan.status}`
        };
      }
      
      // Determine clearing account based on payment method
      const clearingAccountId = this.getClearingAccountId(input.paymentMethod);
      
      // Use database function for atomic processing
      const { data, error } = await supabase.rpc('process_repayment_ifrs_compliant', {
        p_loan_id: input.loanId,
        p_amount: input.amount,
        p_payment_date: input.paymentDate,
        p_payment_method: input.paymentMethod,
        p_reference_number: input.referenceNumber,
        p_recorded_by: input.recordedBy,
        p_clearing_account_id: clearingAccountId,
        p_bank_account_id: input.bankAccountId
      });
      
      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }
      
      if (!data || !data.success) {
        return {
          success: false,
          error: data?.error || 'Failed to process repayment'
        };
      }
      
      return {
        success: true,
        repaymentId: data.repayment_id,
        journalEntryId: data.journal_entry_id,
        repaymentNumber: data.repayment_number,
        allocation: data.allocation,
        loanBalance: data.loan_balance
      };
      
    } catch (err: any) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Process T+1 clearing settlement
   * Called when mobile money provider settles to bank (next day)
   * 
   * Journal Entry:
   * - Debit: Bank Account (net amount after fee)
   * - Debit: Bank Charges (fee)
   * - Credit: Clearing Account (full amount)
   * 
   * @param input - Settlement data
   * @returns Settlement result
   */
  async processClearingSettlement(input: {
    settlementId: string;
    settledToAccountId: string; // Bank account receiving settlement
    settlementDate: string;
    settlementFee?: number;
    processedBy: string;
  }): Promise<SettlementResult> {
    
    try {
      const { data, error } = await supabase.rpc('process_clearing_settlement', {
        p_settlement_id: input.settlementId,
        p_settled_to_account_id: input.settledToAccountId,
        p_settlement_date: input.settlementDate,
        p_settlement_fee: input.settlementFee || 0,
        p_processed_by: input.processedBy
      });
      
      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }
      
      if (!data || !data.success) {
        return {
          success: false,
          error: data?.error || 'Failed to process settlement'
        };
      }
      
      return {
        success: true,
        settlementId: data.settlement_id,
        journalEntryId: data.journal_entry_id,
        referenceNumber: data.reference_number,
        amount: data.amount,
        fee: data.fee,
        netAmount: data.net_amount
      };
      
    } catch (err: any) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Get pending clearing settlements (for T+1 processing)
   * 
   * @param clearingAccountId - Optional filter by clearing account
   * @returns Pending settlements
   */
  async getPendingSettlements(clearingAccountId?: string): Promise<any[]> {
    let query = supabase
      .from('clearing_settlements')
      .select(`
        *,
        repayment:repayment_id(
          loan_id,
          amount_paid,
          payment_date
        ),
        clearing_account:clearing_account_id(
          account_code,
          name
        )
      `)
      .eq('status', 'pending');
    
    if (clearingAccountId) {
      query = query.eq('clearing_account_id', clearingAccountId);
    }
    
    const { data, error } = await query.order('transaction_date');
    
    if (error) {
      throw new Error(`Failed to fetch settlements: ${error.message}`);
    }
    
    return data || [];
  }

  /**
   * Get settlement by ID
   */
  async getSettlement(settlementId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('clearing_settlements')
      .select(`
        *,
        repayment:repayment_id(*),
        clearing_account:clearing_account_id(*)
      `)
      .eq('id', settlementId)
      .single();
    
    if (error) {
      return null;
    }
    
    return data;
  }

  /**
   * Get repayment with full allocation details
   */
  async getRepayment(repaymentId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('repayments')
      .select(`
        *,
        loan:loan_id(*),
        journal_entry:journal_entry_id(*)
      `)
      .eq('id', repaymentId)
      .single();
    
    if (error) {
      return null;
    }
    
    return data;
  }

  /**
   * Get loan repayments
   */
  async getLoanRepayments(loanId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('repayments')
      .select(`
        *,
        journal_entry:journal_entry_id(*)
      `)
      .eq('loan_id', loanId)
      .order('payment_date', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch repayments: ${error.message}`);
    }
    
    return data || [];
  }

  /**
   * Reverse a repayment
   * Reverses the journal entry and restores loan balances
   */
  async reverseRepayment(
    repaymentId: string,
    reason: string,
    reversedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get repayment details
      const repayment = await this.getRepayment(repaymentId);
      
      if (!repayment) {
        return {
          success: false,
          error: 'Repayment not found'
        };
      }
      
      if (!repayment.journal_entry_id) {
        return {
          success: false,
          error: 'No journal entry associated with this repayment'
        };
      }
      
      // Reverse the journal entry
      const { error: reverseError } = await supabase.rpc('reverse_journal_entry', {
        p_entry_id: repayment.journal_entry_id,
        p_reason: reason,
        p_reversed_by: reversedBy
      });
      
      if (reverseError) {
        throw new Error(`Failed to reverse journal entry: ${reverseError.message}`);
      }
      
      // Update repayment status
      const { error: updateError } = await supabase
        .from('repayments')
        .update({
          settlement_status: 'refunded',
          updated_at: new Date().toISOString()
        })
        .eq('id', repaymentId);
      
      if (updateError) {
        throw new Error(`Failed to update repayment: ${updateError.message}`);
      }
      
      // Reverse IFRS 9 staging calculation for the loan
      await supabase.rpc('update_ifrs9_staging', {
        p_loan_id: repayment.loan_id
      });
      
      return { success: true };
      
    } catch (err: any) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Run daily settlement job (process T+1 settlements)
   * Should be called daily to process mobile money settlements
   */
  async runDailySettlementJob(
    bankAccountId: string,
    processedBy: string
  ): Promise<{
    processed: number;
    failed: number;
    totalAmount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let processed = 0;
    let failed = 0;
    let totalAmount = 0;
    
    try {
      // Get pending settlements that are ready for T+1
      const pendingSettlements = await this.getPendingSettlements();
      
      // Filter for T+1 (settlement date <= today)
      const today = new Date().toISOString().split('T')[0];
      const readySettlements = pendingSettlements.filter(
        s => s.settlement_date && s.settlement_date <= today
      );
      
      for (const settlement of readySettlements) {
        const result = await this.processClearingSettlement({
          settlementId: settlement.id,
          settledToAccountId: bankAccountId,
          settlementDate: today,
          settlementFee: 0, // Can be customized
          processedBy
        });
        
        if (result.success) {
          processed++;
          totalAmount += result.amount || 0;
        } else {
          failed++;
          errors.push(`Settlement ${settlement.id}: ${result.error}`);
        }
      }
      
      return {
        processed,
        failed,
        totalAmount,
        errors
      };
      
    } catch (err: any) {
      errors.push(`Job error: ${err.message}`);
      return {
        processed,
        failed,
        totalAmount,
        errors
      };
    }
  }

  /**
   * Get clearing account ID based on payment method
   */
  private getClearingAccountId(method: string): string | null {
    const clearingAccounts: Record<string, string> = {
      'airtel_money': 'CLEARING_AIRTEL',
      'mpamba': 'CLEARING_MPAMBA'
    };
    
    const accountCode = clearingAccounts[method];
    if (!accountCode) return null;
    
    // Return the code - the database function will look up the ID
    return accountCode;
  }

  /**
   * Validate IFRS allocation calculation
   * For testing/verification purposes
   */
  validateIFRSAllocation(
    amount: number,
    penaltyDue: number,
    interestDue: number,
    principalDue: number
  ): RepaymentAllocation {
    let remaining = amount;
    
    // Step 1: Penalty
    const penaltyPaid = Math.min(remaining, penaltyDue);
    remaining -= penaltyPaid;
    
    // Step 2: Interest
    const interestPaid = Math.min(remaining, interestDue);
    remaining -= interestPaid;
    
    // Step 3: Principal
    const principalPaid = Math.min(remaining, principalDue);
    remaining -= principalPaid;
    
    // Step 4: Overpayment
    const overpayment = remaining;
    
    return {
      penaltyPaid,
      interestPaid,
      principalPaid,
      overpayment
    };
  }
}

// Export singleton instance
export const repaymentServiceIFRS = new RepaymentServiceIFRS();
