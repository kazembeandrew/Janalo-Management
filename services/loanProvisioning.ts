/**
 * Loan Provisioning Service
 * 
 * Implements loan loss provisioning based on portfolio aging.
 * Follows IFRS 9 / MFI industry standards for portfolio classification.
 * 
 * Aging Buckets and Provision Rates:
 * - Current (0-30 days): 0%
 * - Watch (31-90 days): 25%
 * - Substandard (91-180 days): 50%
 * - Doubtful (181-360 days): 75%
 * - Loss (>360 days): 100%
 */

import { 
  BaseServiceClass, 
  ServiceResult 
} from './_shared/baseService';
import { supabase } from '@/lib/supabase';

export interface LoanAgingBucket {
  agingBucket: string;
  daysOverdue: number;
  provisionRate: number;
  principalAmount: number;
  requiredProvision: number;
}

export interface ProvisionCalculationResult {
  buckets: LoanAgingBucket[];
  totalRequiredProvision: number;
  currentPortfolio: number;
  provisionPercentage: number;
}

export interface ProvisionJournalEntry {
  success: boolean;
  journalEntryId?: string;
  error?: string;
}

/**
 * Loan Provisioning Service
 */
export class LoanProvisioningService extends BaseServiceClass {
  private static instance: LoanProvisioningService;

  public static getInstance(): LoanProvisioningService {
    if (!LoanProvisioningService.instance) {
      LoanProvisioningService.instance = new LoanProvisioningService();
    }
    return LoanProvisioningService.instance;
  }

  /**
   * Calculate loan provisioning requirements based on portfolio aging
   * Uses the database function calculate_loan_provision()
   */
  async calculateProvisioning(): Promise<ServiceResult<ProvisionCalculationResult>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await supabase.rpc('calculate_loan_provision');

      if (error) throw error;

      const buckets: LoanAgingBucket[] = (data || []).map((row: any) => ({
        agingBucket: row.aging_bucket,
        daysOverdue: row.days_overdue,
        provisionRate: row.provision_rate,
        principalAmount: parseFloat(row.principal_amount),
        requiredProvision: parseFloat(row.required_provision)
      }));

      const totalRequiredProvision = buckets.reduce(
        (sum, bucket) => sum + bucket.requiredProvision, 
        0
      );

      const currentPortfolio = buckets.reduce(
        (sum, bucket) => sum + bucket.principalAmount, 
        0
      );

      const provisionPercentage = currentPortfolio > 0 
        ? (totalRequiredProvision / currentPortfolio) * 100 
        : 0;

      return {
        buckets,
        totalRequiredProvision,
        currentPortfolio,
        provisionPercentage
      };
    }, 'Failed to calculate loan provisioning');
  }

  /**
   * Create a journal entry for loan loss provision
   * Debit: Provision Expense
   * Credit: Allowance for Loan Losses
   */
  async createProvisionEntry(
    provisionAmount: number,
    userId?: string
  ): Promise<ServiceResult<ProvisionJournalEntry>> {
    return this.handleAsyncOperation(async () => {
      if (provisionAmount <= 0) {
        throw new Error('Provision amount must be greater than zero');
      }

      const currentUser = userId || (await supabase.auth.getUser()).data.user?.id;
      
      if (!currentUser) {
        throw new Error('User ID is required to create provision entry');
      }

      const { data, error } = await supabase.rpc('create_provision_journal_entry', {
        p_provision_amount: provisionAmount,
        p_user_id: currentUser
      });

      if (error) throw error;

      if (!data || !data.success) {
        throw new Error(data?.error || 'Failed to create provision journal entry');
      }

      return {
        success: true,
        journalEntryId: data.journal_entry_id
      };
    }, 'Failed to create provision journal entry');
  }

  /**
   * Get current allowance for loan losses balance
   */
  async getAllowanceBalance(): Promise<ServiceResult<number>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await supabase
        .from('internal_accounts')
        .select('balance')
        .or('account_code.eq.ALLOWANCE_LOAN_LOSSES,code.eq.ALLOWANCE_LOAN_LOSSES')
        .single();

      if (error) throw error;

      return parseFloat(data?.balance || '0');
    }, 'Failed to get allowance balance');
  }

  /**
   * Get net portfolio value (gross portfolio minus allowance)
   */
  async getNetPortfolioValue(): Promise<ServiceResult<{
    grossPortfolio: number;
    allowance: number;
    netPortfolio: number;
  }>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await supabase
        .from('net_portfolio_value')
        .select('*')
        .single();

      if (error) throw error;

      return {
        grossPortfolio: parseFloat(data?.gross_portfolio || '0'),
        allowance: parseFloat(data?.allowance_for_losses || '0'),
        netPortfolio: parseFloat(data?.net_portfolio_value || '0')
      };
    }, 'Failed to get net portfolio value');
  }

  /**
   * Run full monthly provisioning process
   * 1. Calculate required provision
   * 2. Get current allowance balance
   * 3. Create adjusting entry for difference
   */
  async runMonthlyProvisioning(userId?: string): Promise<ServiceResult<{
    calculation: ProvisionCalculationResult;
    previousAllowance: number;
    adjustmentAmount: number;
    journalEntryId?: string;
    message: string;
  }>> {
    return this.handleAsyncOperation(async () => {
      const currentUser = userId || (await supabase.auth.getUser()).data.user?.id;
      
      if (!currentUser) {
        throw new Error('User ID is required');
      }

      // Step 1: Calculate required provision
      const calculationResult = await this.calculateProvisioning();
      if (!calculationResult.success) {
        throw new Error('Failed to calculate provisioning: ' + calculationResult.error?.message);
      }

      const requiredProvision = calculationResult.data!.totalRequiredProvision;

      // Step 2: Get current allowance
      const allowanceResult = await this.getAllowanceBalance();
      if (!allowanceResult.success) {
        throw new Error('Failed to get allowance balance: ' + allowanceResult.error?.message);
      }

      const currentAllowance = allowanceResult.data!;

      // Step 3: Calculate adjustment
      const adjustmentAmount = requiredProvision - currentAllowance;

      // Step 4: Create journal entry if adjustment needed
      let journalEntryId: string | undefined;
      let message: string;

      if (Math.abs(adjustmentAmount) > 0.01) {
        const entryResult = await this.createProvisionEntry(
          Math.abs(adjustmentAmount), 
          currentUser
        );
        
        if (!entryResult.success) {
          throw new Error('Failed to create provision entry: ' + entryResult.error?.message);
        }

        journalEntryId = entryResult.data?.journalEntryId;
        message = adjustmentAmount > 0 
          ? `Increased provision by ${adjustmentAmount.toLocaleString()}`
          : `Decreased provision by ${Math.abs(adjustmentAmount).toLocaleString()}`;
      } else {
        message = 'No adjustment needed - provision is already accurate';
      }

      return {
        calculation: calculationResult.data!,
        previousAllowance: currentAllowance,
        adjustmentAmount,
        journalEntryId,
        message
      };
    }, 'Failed to run monthly provisioning');
  }

  /**
   * Get aging summary for reporting
   */
  async getAgingSummary(): Promise<ServiceResult<{
    totalLoans: number;
    totalPrincipal: number;
    currentAmount: number;
    watchAmount: number;
    substandardAmount: number;
    doubtfulAmount: number;
    lossAmount: number;
  }>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await supabase.rpc('calculate_loan_provision');

      if (error) throw error;

      const buckets = data || [];
      
      const summary = {
        totalLoans: 0,
        totalPrincipal: 0,
        currentAmount: 0,
        watchAmount: 0,
        substandardAmount: 0,
        doubtfulAmount: 0,
        lossAmount: 0
      };

      // Count loans per bucket
      for (const bucket of buckets) {
        const principal = parseFloat(bucket.principal_amount);
        
        summary.totalPrincipal += principal;
        
        switch (bucket.aging_bucket) {
          case 'Current (0-30 days)':
            summary.currentAmount += principal;
            break;
          case 'Watch (31-90 days)':
            summary.watchAmount += principal;
            break;
          case 'Substandard (91-180 days)':
            summary.substandardAmount += principal;
            break;
          case 'Doubtful (181-360 days)':
            summary.doubtfulAmount += principal;
            break;
          case 'Loss (>360 days)':
            summary.lossAmount += principal;
            break;
        }
      }

      // Get loan count
      const { count, error: countError } = await supabase
        .from('loans')
        .select('*', { count: 'exact', head: true })
        .in('status', ['active', 'overdue']);

      if (!countError) {
        summary.totalLoans = count || 0;
      }

      return summary;
    }, 'Failed to get aging summary');
  }
}

// Export singleton instance
export const loanProvisioningService = LoanProvisioningService.getInstance();
