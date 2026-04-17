import { supabase } from '@/integrations/supabase/client';
import { accountingEngineService } from './AccountingEngineService';

export interface Payslip {
  employeeId: string;
  grossSalary: number;
  payeTax: number;
  netSalary: number;
}

export interface PayrollAccrualResult {
  success: boolean;
  journalEntryId?: string;
  totalGross?: number;
  totalPAYE?: number;
  totalNet?: number;
  employeeCount?: number;
  error?: string;
}

export interface PayrollSettlementResult {
  success: boolean;
  journalEntryId?: string;
  amount?: number;
  error?: string;
}

/**
 * PayrollAccountingService - Simplified Payroll with PAYE Only
 * 
 * Simplified payroll accounting (NO PENSION per requirements):
 * 
 * Salary Accrual (Month-End):
 *   Dr  Salary Expense (Gross)
 *       Cr  Salaries Payable (Net)
 *       Cr  PAYE Payable (Tax)
 * 
 * Salary Payment (Payday):
 *   Dr  Salaries Payable (Net)
 *       Cr  Bank Account
 * 
 * PAYE Remittance:
 *   Dr  PAYE Payable
 *       Cr  Bank Account
 */
export class PayrollAccountingService {

  /**
   * Accrue payroll for a period
   * Creates journal entry for salary accrual
   * 
   * @param periodId - Payroll period ID
   * @param payslips - Array of payslip data
   * @param userId - User creating the accrual
   * @returns Result with journal entry details
   */
  async accruePayroll(
    periodId: string,
    payslips: Payslip[],
    userId: string
  ): Promise<PayrollAccrualResult> {
    try {
      // Validate payslips
      if (!payslips || payslips.length === 0) {
        return {
          success: false,
          error: 'No payslips provided'
        };
      }
      
      // Calculate totals
      const totals = payslips.reduce((acc, payslip) => ({
        gross: acc.gross + (payslip.grossSalary || 0),
        paye: acc.paye + (payslip.payeTax || 0),
        net: acc.net + (payslip.netSalary || 0)
      }), { gross: 0, paye: 0, net: 0 });
      
      // Validate accounting equation: Gross = Net + PAYE
      const difference = Math.abs(totals.gross - (totals.net + totals.paye));
      if (difference > 0.01) {
        return {
          success: false,
          error: `Accounting imbalance: Gross (${totals.gross}) ≠ Net (${totals.net}) + PAYE (${totals.paye})`
        };
      }
      
      // Get GL accounts
      const salaryExpenseAccount = await this.getAccountByCode('EXP_SALARIES');
      if (!salaryExpenseAccount) {
        return {
          success: false,
          error: 'EXP_SALARIES account not found'
        };
      }
      
      const salariesPayableAccount = await this.getAccountByCode('LIAB_SALARIES_PAYABLE');
      if (!salariesPayableAccount) {
        return {
          success: false,
          error: 'LIAB_SALARIES_PAYABLE account not found'
        };
      }
      
      const payePayableAccount = await this.getAccountByCode('LIAB_PAYE');
      if (!payePayableAccount) {
        return {
          success: false,
          error: 'LIAB_PAYE account not found'
        };
      }
      
      // Get period details
      const { data: period, error: periodError } = await supabase
        .from('payroll_periods')
        .select('period_name, end_date')
        .eq('id', periodId)
        .single();
      
      if (periodError || !period) {
        return {
          success: false,
          error: 'Payroll period not found'
        };
      }
      
      // Build journal lines
      const journalLines = [
        {
          accountId: salaryExpenseAccount.id,
          debit: totals.gross,
          credit: 0,
          description: `Salary expense for ${period.period_name}`
        },
        {
          accountId: salariesPayableAccount.id,
          debit: 0,
          credit: totals.net,
          description: `Net salaries payable for ${period.period_name}`
        },
        {
          accountId: payePayableAccount.id,
          debit: 0,
          credit: totals.paye,
          description: `PAYE payable for ${period.period_name}`
        }
      ];
      
      // Post journal entry
      const journalEntry = await accountingEngineService.postJournalEntry({
        referenceType: 'salary_accrual',
        referenceId: periodId,
        date: period.end_date,
        description: `Payroll accrual for ${period.period_name} - ${payslips.length} employees`,
        lines: journalLines,
        createdBy: userId
      });
      
      // Update payroll period
      const { error: updateError } = await supabase
        .from('payroll_periods')
        .update({
          status: 'accrued',
          journal_entry_accrual_id: journalEntry.id,
          accrued_by: userId,
          accrued_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', periodId);
      
      if (updateError) {
        // Try to reverse the journal entry
        try {
          await accountingEngineService.reverseEntry(
            journalEntry.id,
            'Payroll period update failed',
            userId
          );
        } catch (revError) {
          console.error('Failed to reverse journal entry:', revError);
        }
        
        return {
          success: false,
          error: `Failed to update payroll period: ${updateError.message}`
        };
      }
      
      return {
        success: true,
        journalEntryId: journalEntry.id,
        totalGross: totals.gross,
        totalPAYE: totals.paye,
        totalNet: totals.net,
        employeeCount: payslips.length
      };
      
    } catch (err: any) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Record salary payment to employees
   * 
   * @param periodId - Payroll period ID
   * @param bankAccountId - Bank account paying from
   * @param userId - User recording the payment
   * @returns Result with journal entry details
   */
  async recordSalaryPayment(
    periodId: string,
    bankAccountId: string,
    userId: string
  ): Promise<PayrollSettlementResult> {
    try {
      // Get period details
      const { data: period, error: periodError } = await supabase
        .from('payroll_periods')
        .select('period_name, payment_date, journal_entry_accrual_id')
        .eq('id', periodId)
        .single();
      
      if (periodError || !period) {
        return {
          success: false,
          error: 'Payroll period not found'
        };
      }
      
      if (!period.journal_entry_accrual_id) {
        return {
          success: false,
          error: 'Payroll not accrued yet. Please accrue first.'
        };
      }
      
      // Get payslips for the period
      const { data: payslips, error: payslipError } = await supabase
        .from('payslips')
        .select('net_pay, paid_at')
        .eq('payroll_period_id', periodId);
      
      if (payslipError) {
        return {
          success: false,
          error: `Failed to fetch payslips: ${payslipError.message}`
        };
      }
      
      // Filter unpaid payslips
      const unpaidPayslips = (payslips || []).filter(p => !p.paid_at);
      
      if (unpaidPayslips.length === 0) {
        return {
          success: false,
          error: 'No unpaid payslips found for this period'
        };
      }
      
      const totalNet = unpaidPayslips.reduce((sum, p) => sum + (p.net_pay || 0), 0);
      
      // Get GL accounts
      const salariesPayableAccount = await this.getAccountByCode('LIAB_SALARIES_PAYABLE');
      if (!salariesPayableAccount) {
        return {
          success: false,
          error: 'LIAB_SALARIES_PAYABLE account not found'
        };
      }
      
      // Build journal lines
      const journalLines = [
        {
          accountId: salariesPayableAccount.id,
          debit: totalNet,
          credit: 0,
          description: `Salary payment for ${period.period_name}`
        },
        {
          accountId: bankAccountId,
          debit: 0,
          credit: totalNet,
          description: `Bank payment for ${period.period_name}`
        }
      ];
      
      // Post journal entry
      const journalEntry = await accountingEngineService.postJournalEntry({
        referenceType: 'salary_payment',
        referenceId: periodId,
        date: period.payment_date || new Date().toISOString().split('T')[0],
        description: `Salary payment for ${period.period_name} - ${unpaidPayslips.length} employees`,
        lines: journalLines,
        createdBy: userId
      });
      
      // Update payslips as paid
      const { error: payslipUpdateError } = await supabase
        .from('payslips')
        .update({
          paid_at: new Date().toISOString(),
          status: 'paid'
        })
        .eq('payroll_period_id', periodId)
        .is('paid_at', null);
      
      if (payslipUpdateError) {
        console.error('Failed to update payslips:', payslipUpdateError);
        // Continue - journal entry is posted
      }
      
      // Update payroll period
      const { error: periodUpdateError } = await supabase
        .from('payroll_periods')
        .update({
          status: 'paid',
          journal_entry_payment_id: journalEntry.id,
          paid_by: userId,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', periodId);
      
      if (periodUpdateError) {
        console.error('Failed to update payroll period:', periodUpdateError);
        // Continue - journal entry is posted
      }
      
      return {
        success: true,
        journalEntryId: journalEntry.id,
        amount: totalNet
      };
      
    } catch (err: any) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Record PAYE remittance to tax authority
   * 
   * @param periodId - Payroll period ID
   * @param bankAccountId - Bank account paying from
   * @param userId - User recording the remittance
   * @returns Result with journal entry details
   */
  async remitPAYE(
    periodId: string,
    bankAccountId: string,
    userId: string
  ): Promise<PayrollSettlementResult> {
    try {
      // Get period details
      const { data: period, error: periodError } = await supabase
        .from('payroll_periods')
        .select('period_name, remittance_date')
        .eq('id', periodId)
        .single();
      
      if (periodError || !period) {
        return {
          success: false,
          error: 'Payroll period not found'
        };
      }
      
      // Get PAYE total from payslips
      const { data: payslips, error: payslipError } = await supabase
        .from('payslips')
        .select('paye_deduction')
        .eq('payroll_period_id', periodId);
      
      if (payslipError) {
        return {
          success: false,
          error: `Failed to fetch payslips: ${payslipError.message}`
        };
      }
      
      const totalPAYE = (payslips || []).reduce((sum, p) => sum + (p.paye_deduction || 0), 0);
      
      if (totalPAYE <= 0) {
        return {
          success: false,
          error: 'No PAYE to remit'
        };
      }
      
      // Get GL accounts
      const payePayableAccount = await this.getAccountByCode('LIAB_PAYE');
      if (!payePayableAccount) {
        return {
          success: false,
          error: 'LIAB_PAYE account not found'
        };
      }
      
      // Build journal lines
      const journalLines = [
        {
          accountId: payePayableAccount.id,
          debit: totalPAYE,
          credit: 0,
          description: `PAYE remittance for ${period.period_name}`
        },
        {
          accountId: bankAccountId,
          debit: 0,
          credit: totalPAYE,
          description: `PAYE payment to MRA for ${period.period_name}`
        }
      ];
      
      // Post journal entry
      const journalEntry = await accountingEngineService.postJournalEntry({
        referenceType: 'tax_remittance',
        referenceId: periodId,
        date: period.remittance_date || new Date().toISOString().split('T')[0],
        description: `PAYE remittance to MRA for ${period.period_name}`,
        lines: journalLines,
        createdBy: userId
      });
      
      // Update payroll period
      const { error: updateError } = await supabase
        .from('payroll_periods')
        .update({
          status: 'remitted',
          journal_entry_remittance_id: journalEntry.id,
          remitted_by: userId,
          remitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', periodId);
      
      if (updateError) {
        console.error('Failed to update payroll period:', updateError);
      }
      
      return {
        success: true,
        journalEntryId: journalEntry.id,
        amount: totalPAYE
      };
      
    } catch (err: any) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Get account by code helper
   */
  private async getAccountByCode(code: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('internal_accounts')
      .select('*')
      .eq('account_code', code)
      .single();
    
    if (error) {
      return null;
    }
    
    return data;
  }

  /**
   * Get payroll accounting summary
   */
  async getPayrollAccountingSummary(periodId: string): Promise<{
    periodName: string;
    totalGross: number;
    totalNet: number;
    totalPAYE: number;
    status: string;
    journalEntryIds: {
      accrual?: string;
      payment?: string;
      remittance?: string;
    };
  } | null> {
    const { data: period, error } = await supabase
      .from('payroll_periods')
      .select(`
        period_name,
        status,
        journal_entry_accrual_id,
        journal_entry_payment_id,
        journal_entry_remittance_id,
        payslips:payroll_period_id(gross_salary, net_salary, paye_deduction)
      `)
      .eq('id', periodId)
      .single();
    
    if (error || !period) {
      return null;
    }
    
    const payslips = period.payslips || [];
    
    return {
      periodName: period.period_name,
      totalGross: payslips.reduce((sum: number, p: any) => sum + (p.gross_salary || 0), 0),
      totalNet: payslips.reduce((sum: number, p: any) => sum + (p.net_salary || 0), 0),
      totalPAYE: payslips.reduce((sum: number, p: any) => sum + (p.paye_deduction || 0), 0),
      status: period.status,
      journalEntryIds: {
        accrual: period.journal_entry_accrual_id,
        payment: period.journal_entry_payment_id,
        remittance: period.journal_entry_remittance_id
      }
    };
  }
}

// Export singleton instance
export const payrollAccountingService = new PayrollAccountingService();
