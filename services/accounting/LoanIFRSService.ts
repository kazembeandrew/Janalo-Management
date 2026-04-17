import { supabase } from '@/integrations/supabase/client';

export interface IFRS9Stage {
  stage: 1 | 2 | 3;
  daysPastDue: number;
  classification: string;
  description: string;
}

export interface LoanWithIFRS9 {
  id: string;
  loanNumber: string;
  principalOutstanding: number;
  interestOutstanding: number;
  penaltyOutstanding: number;
  ifrs9Stage: number;
  daysPastDue: number;
  impairmentProvision: number;
}

export interface WriteOffResult {
  success: boolean;
  journalEntryId?: string;
  referenceNumber?: string;
  amount?: number;
  error?: string;
}

export interface IFRS9UpdateResult {
  success: boolean;
  updatedCount?: number;
  stagingRules?: {
    stage1: string;
    stage2: string;
    stage3: string;
  };
  error?: string;
}

/**
 * LoanIFRSService - IFRS 9 Compliance and Loan Accounting
 * 
 * Handles:
 * - IFRS 9 staging (automated by Days Past Due)
 * - Manual staging override
 * - Loan write-offs (allowance method)
 * - Loan balance tracking
 */
export class LoanIFRSService {

  /**
   * Update IFRS 9 staging for loans
   * 
   * Staging Rules (automated by Days Past Due):
   * - Stage 1 (Performing): 0-30 days past due
   * - Stage 2 (Under-performing): 31-90 days past due
   * - Stage 3 (Non-performing): 91+ days past due
   * 
   * @param loanId - Specific loan (null = all loans)
   * @returns Update result
   */
  async updateIFRS9Staging(loanId?: string): Promise<IFRS9UpdateResult> {
    try {
      const { data, error } = await supabase.rpc('update_ifrs9_staging', {
        p_loan_id: loanId || null
      });
      
      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }
      
      if (!data || !data.success) {
        return {
          success: false,
          error: data?.error || 'Failed to update IFRS 9 staging'
        };
      }
      
      return {
        success: true,
        updatedCount: data.updated_count,
        stagingRules: data.staging_rules
      };
      
    } catch (err: any) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Manually set IFRS 9 stage (override automated staging)
   * 
   * @param loanId - Loan ID
   * @param stage - Stage (1, 2, or 3)
   * @param reason - Reason for manual override
   * @param setBy - User ID setting the stage
   */
  async manualSetIFRS9Stage(
    loanId: string,
    stage: 1 | 2 | 3,
    reason: string,
    setBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate stage
      if (![1, 2, 3].includes(stage)) {
        return {
          success: false,
          error: 'Invalid stage. Must be 1, 2, or 3'
        };
      }
      
      // Update loan with manual stage
      const { error } = await supabase
        .from('loans')
        .update({
          ifrs9_stage: stage,
          // Store manual override info in metadata if available
          // For now, just update the stage
          updated_at: new Date().toISOString()
        })
        .eq('id', loanId);
      
      if (error) {
        throw new Error(`Failed to update stage: ${error.message}`);
      }
      
      // Log the manual override (could be stored in audit table)
      console.log(`IFRS 9 Stage manually set for loan ${loanId}: Stage ${stage}. Reason: ${reason}. Set by: ${setBy}`);
      
      return { success: true };
      
    } catch (err: any) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Get loans by IFRS 9 stage
   * 
   * @param stage - Stage filter (1, 2, or 3)
   * @param options - Additional filters
   */
  async getLoansByStage(
    stage: 1 | 2 | 3,
    options?: {
      minDPD?: number;
      maxDPD?: number;
      limit?: number;
      offset?: number;
    }
  ): Promise<LoanWithIFRS9[]> {
    let query = supabase
      .from('loans')
      .select(`
        id,
        loan_number,
        principal_outstanding,
        interest_outstanding,
        penalty_outstanding,
        ifrs9_stage,
        days_past_due,
        impairment_provision,
        borrower:borrower_id(full_name)
      `)
      .eq('ifrs9_stage', stage)
      .eq('status', 'active')
      .order('days_past_due', { ascending: false });
    
    if (options?.minDPD !== undefined) {
      query = query.gte('days_past_due', options.minDPD);
    }
    
    if (options?.maxDPD !== undefined) {
      query = query.lte('days_past_due', options.maxDPD);
    }
    
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch loans: ${error.message}`);
    }
    
    return (data || []).map((loan: any) => ({
      id: loan.id,
      loanNumber: loan.loan_number,
      principalOutstanding: loan.principal_outstanding || 0,
      interestOutstanding: loan.interest_outstanding || 0,
      penaltyOutstanding: loan.penalty_outstanding || 0,
      ifrs9Stage: loan.ifrs9_stage || 1,
      daysPastDue: loan.days_past_due || 0,
      impairmentProvision: loan.impairment_provision || 0,
      borrowerName: loan.borrower?.full_name
    }));
  }

  /**
   * Get IFRS 9 portfolio summary
   * 
   * Returns breakdown of loans by stage with totals
   */
  async getPortfolioSummary(): Promise<{
    totalLoans: number;
    totalOutstanding: number;
    byStage: {
      stage: number;
      loanCount: number;
      principalOutstanding: number;
      avgDPD: number;
    }[];
  }> {
    const { data, error } = await supabase
      .from('loans')
      .select('ifrs9_stage, principal_outstanding, days_past_due')
      .eq('status', 'active');
    
    if (error) {
      throw new Error(`Failed to fetch portfolio: ${error.message}`);
    }
    
    const loans = data || [];
    
    // Group by stage
    const stageMap = new Map<number, {
      count: number;
      principal: number;
      totalDPD: number;
    }>();
    
    loans.forEach(loan => {
      const stage = loan.ifrs9_stage || 1;
      const current = stageMap.get(stage) || { count: 0, principal: 0, totalDPD: 0 };
      
      stageMap.set(stage, {
        count: current.count + 1,
        principal: current.principal + (loan.principal_outstanding || 0),
        totalDPD: current.totalDPD + (loan.days_past_due || 0)
      });
    });
    
    const byStage = Array.from(stageMap.entries()).map(([stage, data]) => ({
      stage,
      loanCount: data.count,
      principalOutstanding: data.principal,
      avgDPD: data.count > 0 ? Math.round(data.totalDPD / data.count) : 0
    }));
    
    return {
      totalLoans: loans.length,
      totalOutstanding: loans.reduce((sum, l) => sum + (l.principal_outstanding || 0), 0),
      byStage: byStage.sort((a, b) => a.stage - b.stage)
    };
  }

  /**
   * Calculate Days Past Due for a loan
   * 
   * @param loanId - Loan ID
   * @returns DPD calculation
   */
  async calculateDPD(loanId: string): Promise<{
    daysPastDue: number;
    nextPaymentDue?: string;
    lastPaymentDate?: string;
  } | null> {
    const { data, error } = await supabase
      .from('loans')
      .select('days_past_due, next_payment_due_date, last_payment_date')
      .eq('id', loanId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return {
      daysPastDue: data.days_past_due || 0,
      nextPaymentDue: data.next_payment_due_date,
      lastPaymentDate: data.last_payment_date
    };
  }

  /**
   * Get IFRS 9 stage classification info
   */
  getIFRS9StageInfo(stage: number): IFRS9Stage {
    const stages: Record<number, IFRS9Stage> = {
      1: {
        stage: 1,
        daysPastDue: 0,
        classification: 'Performing',
        description: 'Low credit risk, payments up to date (0-30 days past due)'
      },
      2: {
        stage: 2,
        daysPastDue: 31,
        classification: 'Under-performing',
        description: 'Significant increase in credit risk (31-90 days past due)'
      },
      3: {
        stage: 3,
        daysPastDue: 91,
        classification: 'Non-performing',
        description: 'Credit impaired, objective evidence of default (91+ days past due)'
      }
    };
    
    return stages[stage] || stages[1];
  }

  /**
   * Run automated IFRS 9 staging job
   * Should be called daily to update all loan classifications
   */
  async runDailyStagingJob(): Promise<{
    updated: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    try {
      const result = await this.updateIFRS9Staging();
      
      if (!result.success) {
        errors.push(result.error || 'Staging update failed');
        return { updated: 0, errors };
      }
      
      return {
        updated: result.updatedCount || 0,
        errors
      };
      
    } catch (err: any) {
      errors.push(err.message);
      return { updated: 0, errors };
    }
  }

  /**
   * Get aging analysis (bucketed by DPD)
   */
  async getAgingAnalysis(): Promise<{
    bucket: string;
    minDPD: number;
    maxDPD: number;
    loanCount: number;
    principalOutstanding: number;
    percentage: number;
  }[]> {
    const { data, error } = await supabase
      .from('loans')
      .select('days_past_due, principal_outstanding')
      .eq('status', 'active');
    
    if (error) {
      throw new Error(`Failed to fetch aging data: ${error.message}`);
    }
    
    const loans = data || [];
    const totalPrincipal = loans.reduce((sum, l) => sum + (l.principal_outstanding || 0), 0);
    
    // Define buckets
    const buckets = [
      { name: 'Current', min: 0, max: 0 },
      { name: '1-30 days', min: 1, max: 30 },
      { name: '31-60 days', min: 31, max: 60 },
      { name: '61-90 days', min: 61, max: 90 },
      { name: '91-120 days', min: 91, max: 120 },
      { name: '121+ days', min: 121, max: Infinity }
    ];
    
    return buckets.map(bucket => {
      const bucketLoans = loans.filter(l => {
        const dpd = l.days_past_due || 0;
        return dpd >= bucket.min && dpd <= bucket.max;
      });
      
      const principal = bucketLoans.reduce((sum, l) => sum + (l.principal_outstanding || 0), 0);
      
      return {
        bucket: bucket.name,
        minDPD: bucket.min,
        maxDPD: bucket.max === Infinity ? 999999 : bucket.max,
        loanCount: bucketLoans.length,
        principalOutstanding: principal,
        percentage: totalPrincipal > 0 ? (principal / totalPrincipal) * 100 : 0
      };
    });
  }
}

// Export singleton instance
export const loanIFRSService = new LoanIFRSService();
