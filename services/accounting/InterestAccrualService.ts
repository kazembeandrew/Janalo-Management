import { supabase } from '@/integrations/supabase/client';
import Decimal from 'decimal.js';

export interface AccrualCalculation {
  loanId: string;
  principalBalance: number;
  annualRate: number;
  daysInPeriod: number;
  accruedAmount: number;
}

export interface AccrualResult {
  success: boolean;
  accrualDate: string;
  calculatedCount: number;
  totalAccrued: number;
  error?: string;
}

export interface MonthlyAccrualResult {
  success: boolean;
  journalEntryId?: string;
  referenceNumber?: string;
  totalAccrual: number;
  loanCount: number;
  period: string;
  error?: string;
}

/**
 * InterestAccrualService - Daily interest calculation and monthly posting
 * 
 * Handles accrual-based accounting for interest income:
 * - Daily calculation of interest on active loans
 * - Monthly aggregation and posting to journal
 * - Tracks interest receivable (asset) and interest income (revenue)
 */
export class InterestAccrualService {

  /**
   * Calculate daily interest accruals for all active loans
   * 
   * Formula: Principal × Annual Rate / 365
   * 
   * @param accrualDate - Date to calculate for (default: today)
   * @returns Result with calculated count and total
   */
  async calculateDailyAccruals(accrualDate?: string): Promise<AccrualResult> {
    const date = accrualDate || new Date().toISOString().split('T')[0];
    
    try {
      // Call database function to calculate daily accruals
      const { data, error } = await supabase.rpc('calculate_daily_interest_accrual', {
        p_accrual_date: date
      });
      
      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }
      
      const calculations = (data || []) as AccrualCalculation[];
      
      if (calculations.length === 0) {
        return {
          success: true,
          accrualDate: date,
          calculatedCount: 0,
          totalAccrued: 0
        };
      }
      
      // Insert accrual records
      const accrualRecords = calculations.map(calc => ({
        loan_id: calc.loanId,
        accrual_date: date,
        period: this.getPeriodStart(date),
        principal_balance: calc.principalBalance,
        annual_rate: calc.annualRate,
        days_in_period: calc.daysInPeriod,
        accrued_amount: calc.accruedAmount,
        is_posted: false
      }));
      
      const { error: insertError } = await supabase
        .from('interest_accruals')
        .insert(accrualRecords);
      
      if (insertError) {
        // Check if it's a duplicate error (some already exist)
        if (insertError.message.includes('duplicate')) {
          console.log('Some accruals already exist for this date, skipping duplicates');
        } else {
          throw new Error(`Failed to insert accruals: ${insertError.message}`);
        }
      }
      
      const totalAccrued = calculations.reduce(
        (sum, c) => sum + c.accruedAmount, 
        0
      );
      
      return {
        success: true,
        accrualDate: date,
        calculatedCount: calculations.length,
        totalAccrued
      };
      
    } catch (err: any) {
      return {
        success: false,
        accrualDate: date,
        calculatedCount: 0,
        totalAccrued: 0,
        error: err.message
      };
    }
  }

  /**
   * Post monthly interest accruals to journal entries
   * 
   * Aggregates all unposted daily accruals for the period and creates:
   * - Debit: Interest Receivable (Asset)
   * - Credit: Interest Income (Revenue)
   * 
   * @param period - Period to post (first day of month)
   * @param postedBy - User ID posting the accruals
   * @returns Result with journal entry details
   */
  async postMonthlyAccruals(
    period: Date,
    postedBy: string
  ): Promise<MonthlyAccrualResult> {
    const periodStart = new Date(period.getFullYear(), period.getMonth(), 1);
    
    try {
      // Check if already posted
      const { data: existing, error: checkError } = await supabase
        .from('interest_accruals')
        .select('id')
        .eq('period', periodStart.toISOString().split('T')[0])
        .eq('is_posted', true)
        .limit(1);
      
      if (checkError) {
        throw new Error(`Failed to check existing accruals: ${checkError.message}`);
      }
      
      if (existing && existing.length > 0) {
        return {
          success: false,
          error: `Interest accruals already posted for period ${periodStart.toISOString().split('T')[0].substring(0, 7)}`
        };
      }
      
      // Call database function to post monthly accruals
      const { data, error } = await supabase.rpc('post_monthly_interest_accruals', {
        p_period: periodStart.toISOString().split('T')[0],
        p_posted_by: postedBy
      });
      
      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }
      
      if (!data || !data.success) {
        return {
          success: false,
          error: data?.error || 'Failed to post monthly accruals'
        };
      }
      
      return {
        success: true,
        journalEntryId: data.journal_entry_id,
        referenceNumber: data.reference_number,
        totalAccrual: data.total_accrual,
        loanCount: data.loan_count,
        period: data.period
      };
      
    } catch (err: any) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Reverse monthly accruals (for corrections)
   * 
   * @param period - Period to reverse
   * @param reversedBy - User ID reversing
   * @param reason - Reason for reversal
   */
  async reverseAccruals(
    period: Date,
    reversedBy: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    const periodStart = new Date(period.getFullYear(), period.getMonth(), 1);
    
    try {
      // Get the journal entry for this period
      const { data: accruals, error: fetchError } = await supabase
        .from('interest_accruals')
        .select('journal_entry_id')
        .eq('period', periodStart.toISOString().split('T')[0])
        .eq('is_posted', true)
        .limit(1);
      
      if (fetchError) {
        throw new Error(`Failed to fetch accruals: ${fetchError.message}`);
      }
      
      if (!accruals || accruals.length === 0) {
        return {
          success: false,
          error: 'No posted accruals found for this period'
        };
      }
      
      const journalEntryId = accruals[0].journal_entry_id;
      
      if (!journalEntryId) {
        return {
          success: false,
          error: 'No journal entry found for this period'
        };
      }
      
      // Reverse the journal entry
      const { error: reverseError } = await supabase.rpc('reverse_journal_entry', {
        p_entry_id: journalEntryId,
        p_reason: reason,
        p_reversed_by: reversedBy
      });
      
      if (reverseError) {
        throw new Error(`Failed to reverse journal entry: ${reverseError.message}`);
      }
      
      // Mark accruals as unposted
      const { error: updateError } = await supabase
        .from('interest_accruals')
        .update({
          is_posted: false,
          journal_entry_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('period', periodStart.toISOString().split('T')[0]);
      
      if (updateError) {
        throw new Error(`Failed to update accruals: ${updateError.message}`);
      }
      
      return { success: true };
      
    } catch (err: any) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Get accrual details for a specific loan
   * 
   * @param loanId - Loan ID
   * @param startDate - Start date filter
   * @param endDate - End date filter
   */
  async getLoanAccruals(
    loanId: string,
    startDate?: string,
    endDate?: string
  ): Promise<any[]> {
    let query = supabase
      .from('interest_accruals')
      .select('*')
      .eq('loan_id', loanId)
      .order('accrual_date', { ascending: false });
    
    if (startDate) {
      query = query.gte('accrual_date', startDate);
    }
    
    if (endDate) {
      query = query.lte('accrual_date', endDate);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch loan accruals: ${error.message}`);
    }
    
    return data || [];
  }

  /**
   * Get accrual summary for a period
   * 
   * @param period - Period (first day of month)
   */
  async getPeriodSummary(period: Date): Promise<{
    totalAccrued: number;
    postedAmount: number;
    unpostedAmount: number;
    loanCount: number;
  }> {
    const periodStart = new Date(period.getFullYear(), period.getMonth(), 1);
    
    const { data, error } = await supabase
      .from('interest_accruals')
      .select('accrued_amount, is_posted')
      .eq('period', periodStart.toISOString().split('T')[0]);
    
    if (error) {
      throw new Error(`Failed to fetch period summary: ${error.message}`);
    }
    
    const accruals = data || [];
    const uniqueLoans = new Set(accruals.map(a => a.loan_id));
    
    return {
      totalAccrued: accruals.reduce((sum, a) => sum + (a.accrued_amount || 0), 0),
      postedAmount: accruals
        .filter(a => a.is_posted)
        .reduce((sum, a) => sum + (a.accrued_amount || 0), 0),
      unpostedAmount: accruals
        .filter(a => !a.is_posted)
        .reduce((sum, a) => sum + (a.accrued_amount || 0), 0),
      loanCount: uniqueLoans.size
    };
  }

  /**
   * Run daily accrual job (typically called by scheduled job)
   * 
   * @param date - Date to run for
   * @returns Result summary
   */
  async runDailyJob(date?: string): Promise<{
    date: string;
    calculated: AccrualResult;
    errors: string[];
  }> {
    const accrualDate = date || new Date().toISOString().split('T')[0];
    const errors: string[] = [];
    
    // Calculate daily accruals
    const calculated = await this.calculateDailyAccruals(accrualDate);
    
    if (!calculated.success) {
      errors.push(`Calculation failed: ${calculated.error}`);
    }
    
    return {
      date: accrualDate,
      calculated,
      errors
    };
  }

  /**
   * Run monthly posting job (typically called on last day of month)
   * 
   * @param period - Period to post
   * @param postedBy - User ID
   * @returns Result summary
   */
  async runMonthlyJob(
    period: Date,
    postedBy: string
  ): Promise<{
    period: string;
    posted: MonthlyAccrualResult;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    // Post monthly accruals
    const posted = await this.postMonthlyAccruals(period, postedBy);
    
    if (!posted.success) {
      errors.push(`Posting failed: ${posted.error}`);
    }
    
    return {
      period: period.toISOString().split('T')[0].substring(0, 7),
      posted,
      errors
    };
  }

  /**
   * Get period start date (first day of month)
   */
  private getPeriodStart(dateString: string): string {
    const date = new Date(dateString);
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  }

  /**
   * Check if date is last day of month
   */
  isLastDayOfMonth(date: Date = new Date()): boolean {
    const tomorrow = new Date(date);
    tomorrow.setDate(date.getDate() + 1);
    return tomorrow.getMonth() !== date.getMonth();
  }

  /**
   * Get next posting date (last day of current month)
   */
  getNextPostingDate(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }
}

// Export singleton instance
export const interestAccrualService = new InterestAccrualService();
