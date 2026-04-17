import { supabase } from '@/integrations/supabase/client';
import type { PayrollRecord } from '@/types';
import { journalEntriesService } from './journalEntries';
import { accountsService } from './accounts';
import { payslipService } from './payslips';

/**
 * Payroll Service - Handles payroll accounting integration
 * Creates journal entries when payroll is approved
 */
class PayrollService {
  
  /**
   * Approve payroll and create accounting journal entry
   * This is the main integration point between payroll and accounting
   */
  async approvePayrollWithAccounting(
    payPeriod: string,
    paymentAccountId?: string,
    userId?: string
  ): Promise<{ success: boolean; data?: any; error?: { message: string; code?: string } }> {
    try {
      // 1. Get all payroll records for the period
      const { data: payrollRecords, error: fetchError } = await (supabase as any)
        .from('payroll_records')
        .select(`
          *,
          employees (
            full_name,
            employee_id,
            position,
            department
          )
        `)
        .eq('pay_period', payPeriod)
        .eq('status', 'approved');
      
      if (fetchError) {
        throw new Error(`Failed to fetch payroll records: ${fetchError.message}`);
      }
      
      if (!payrollRecords || payrollRecords.length === 0) {
        throw new Error(`No approved payroll records found for period ${payPeriod}`);
      }

      // Check if already posted to prevent duplicates
      const alreadyPosted = payrollRecords.some((r: any) => r.accounting_status === 'posted' && r.journal_entry_id);
      if (alreadyPosted) {
        throw new Error(`Payroll for period ${payPeriod} has already been posted to the ledger.`);
      }
      
      // 2. Calculate totals
      const totalGross = payrollRecords.reduce((sum, r) => sum + Number(r.gross_salary || 0), 0);
      const totalPAYE = payrollRecords.reduce((sum, r) => sum + Number(r.paye_tax || 0), 0);
      const totalNet = payrollRecords.reduce((sum, r) => sum + Number(r.net_salary || 0), 0);
      
      
      // 3. Validate accounting equation
      const difference = Math.abs(totalGross - (totalPAYE + totalNet));
      if (difference > 0.01) {
        throw new Error(
          `Accounting imbalance detected! Gross (${totalGross}) ≠ PAYE (${totalPAYE}) + Net (${totalNet}). Difference: ${difference}`
        );
      }
      
      // 4. Get GL accounts
      const salariesAccount = await accountsService.getAccountByCode('EXP_SALARIES');
      if (!salariesAccount.data) {
        throw new Error('EXP_SALARIES account not found. Please ensure expense accounts are configured.');
      }
      
      const payeLiabilityAccount = await accountsService.getAccountByCode('LIAB_PAYE');
      if (!payeLiabilityAccount.data) {
        throw new Error('LIAB_PAYE account not found. Please run the migration to create PAYE liability account.');
      }

      const wagesPayableAccount = await accountsService.getAccountByCode('LIAB_WAGES_PAYABLE');
      if (!wagesPayableAccount.data) {
        throw new Error('LIAB_WAGES_PAYABLE account not found. Please ensure the Wages Payable liability account is configured.');
      }
      
      // Note: paymentAccountId is no longer used for the Journal Entry credit directly, 
      // as we are accruing the liability. The actual payment will be recorded separately 
      // against this liability account in the Banking module.
      
      // 5. Create journal entry
      const journalEntryDescription = `Payroll Accrual for ${payPeriod} - ${payrollRecords.length} employees`;
      
      const journalResult = await journalEntriesService.createJournalEntry({
        reference_type: 'adjustment',
        reference_id: null,
        date: new Date().toISOString().split('T')[0],
        description: journalEntryDescription,
        journal_lines: [
          // Debit expense account (total gross salaries)
          { 
            account_id: salariesAccount.data.id, 
            debit: totalGross, 
            credit: 0 
          },
          
          // Credit PAYE liability (tax owed to MRA)
          { 
            account_id: payeLiabilityAccount.data.id, 
            debit: 0, 
            credit: totalPAYE 
          },
          
          // Credit Wages Payable liability (net salaries owed to employees)
          { 
            account_id: wagesPayableAccount.data.id, 
            debit: 0, 
            credit: totalNet 
          }
        ]
      });
      
      if (!journalResult.success || !journalResult.data) {
        throw new Error(`Failed to create journal entry: ${journalResult.error?.message}`);
      }
      
      const journalEntryId = journalResult.data.id;
      
      // 5.5 ALSO record in the Expenses tracker for standard UI visibility
      try {
        const { error: expenseInsertError } = await (supabase as any)
          .from('expenses')
          .insert({
            description: journalEntryDescription,
            amount: totalGross,
            date: new Date().toISOString().split('T')[0],
            category: 'Salaries/Wages',
            status: 'approved',
            recorded_by: userId,
            reference_number: `PR-${payPeriod}`,
            notes: 'Auto-generated from Payroll Approval (Accrual)'
          });
          
        if (expenseInsertError) {
        } else {
        }
      } catch (err) {
      }
      
      // 6. Update all payroll records with accounting info
      const { error: updateError } = await (supabase as any)
        .from('payroll_records')
        .update({
          journal_entry_id: journalEntryId,
          payment_account_id: paymentAccountId || null,
          accounting_status: 'posted',
          accounting_posted_at: new Date().toISOString(),
          accounting_error_message: null,
          updated_at: new Date().toISOString()
        })
        .eq('pay_period', payPeriod)
        .eq('status', 'approved');
      
      if (updateError) {
        // Rollback: reverse the journal entry
        await journalEntriesService.reverseJournalEntry(journalEntryId, 'Payroll accounting update failed');
        throw new Error(`Failed to update payroll records: ${updateError.message}`);
      }
      
      
      return {
        success: true,
        data: { journalEntryId }
      };
      
    } catch (error: any) {
      
      // Try to update status to 'error' for all approved records in this period
      try {
        await (supabase as any)
          .from('payroll_records')
          .update({
            accounting_status: 'error',
            accounting_error_message: error.message || 'Unknown error during posting',
            updated_at: new Date().toISOString()
          })
          .eq('pay_period', payPeriod)
          .eq('status', 'approved');
      } catch (updateError) {
      }
      
      return {
        success: false,
        error: {
          message: error.message || 'Failed to process payroll accounting',
          code: 'PAYROLL_ACCOUNTING_ERROR'
        }
      };
    }
  }
  
  /**
   * Reverse payroll accounting (for corrections)
   */
  async reversePayrollAccounting(payPeriod: string, reason: string): Promise<{ success: boolean; data?: any; error?: { message: string; code?: string } }> {
    try {
      // 1. Get payroll records with journal entries
      const { data: payrollRecords, error: fetchError } = await (supabase as any)
        .from('payroll_records')
        .select('id, journal_entry_id')
        .eq('pay_period', payPeriod)
        .not('journal_entry_id', 'is', null)
        .limit(1);
      
      if (fetchError) {
        throw new Error(`Failed to fetch payroll records: ${fetchError.message}`);
      }
      
      if (!payrollRecords || (payrollRecords as any[]).length === 0) {
        throw new Error(`No payroll records with journal entries found for period ${payPeriod}`);
      }
      
      const journalEntryId = (payrollRecords as any[])[0].journal_entry_id;
      
      // 2. Reverse the journal entry
      await journalEntriesService.reverseJournalEntry(journalEntryId, reason);
      
      // 3. Update payroll records
      const { error: updateError } = await (supabase as any)
        .from('payroll_records')
        .update({
          journal_entry_id: null,
          payment_account_id: null,
          accounting_status: 'pending',
          accounting_posted_at: null,
          accounting_error_message: reason
        })
        .eq('pay_period', payPeriod);
      
      if (updateError) {
        throw new Error(`Failed to update payroll records: ${updateError.message}`);
      }
      
      return {
        success: true,
        data: undefined
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: {
          message: error.message || 'Failed to reverse payroll accounting',
          code: 'PAYROLL_REVERSAL_ERROR'
        }
      };
    }
  }
  
  /**
   * Settle payroll - Record actual payment of net salaries to employees
   * Creates journal entry: Debit LIAB_WAGES_PAYABLE, Credit BANK/CASH
   */
  async settlePayrollPayment(
    payPeriod: string,
    sourceAccountId: string,
    userId?: string
  ): Promise<{ success: boolean; data?: any; error?: { message: string; code?: string } }> {
    try {
      // 1. Check if payroll payment has already been processed for this period
      const { data: existingPayments, error: checkError } = await (supabase as any)
        .from('payroll_records')
        .select('id, paid_at, payment_journal_id')
        .eq('pay_period', payPeriod)
        .eq('status', 'approved')
        .not('paid_at', 'is', null)
        .limit(1);

      if (checkError) throw new Error(`Failed to check payment status: ${checkError.message}`);
      if (existingPayments && existingPayments.length > 0) {
        throw new Error(`Payroll payment for ${payPeriod} has already been processed. Cannot process payment again.`);
      }

      // 2. Get approved payroll records for this period that haven't been paid yet (for ACTIVE employees only)
      const { data: payrollRecords, error: fetchError } = await (supabase as any)
        .from('payroll_records')
        .select(`
          *,
          employees!inner(status)
        `)
        .eq('pay_period', payPeriod)
        .eq('status', 'approved')
        .eq('employees.status', 'active')
        .is('paid_at', null);

      if (fetchError) throw new Error(`Failed to fetch payroll records: ${fetchError.message}`);
      if (!payrollRecords || payrollRecords.length === 0) {
        throw new Error(`No unpaid approved payroll records found for ${payPeriod}`);
      }

      const totalNet = payrollRecords.reduce((sum, r) => sum + Number(r.net_salary || 0), 0);
      
      // 2. Get the liability and source accounts
      const wagesPayableAccount = await accountsService.getAccountByCode('LIAB_WAGES_PAYABLE');
      if (!wagesPayableAccount.data) {
        throw new Error('LIAB_WAGES_PAYABLE account not found.');
      }
      
      const sourceAccount = await accountsService.getAccountById(sourceAccountId);
      if (!sourceAccount.data) {
        throw new Error('Source account not found. Please select a valid bank/cash account.');
      }

      // 3. Create journal entry for salary payment
      const journalResult = await journalEntriesService.createJournalEntry({
        reference_type: 'adjustment',
        reference_id: null,
        date: new Date().toISOString().split('T')[0],
        description: `Payroll Payment for ${payPeriod} - ${payrollRecords.length} employees paid`,
        journal_lines: [
          {
            account_id: wagesPayableAccount.data.id,
            debit: totalNet,
            credit: 0,
          },
          {
            account_id: sourceAccountId,
            debit: 0,
            credit: totalNet,
          }
        ]
      });
      
      if (!journalResult.success || !journalResult.data) {
        throw new Error(`Failed to create journal entry: ${journalResult.error?.message}`);
      }

      // 4. Update payroll records as paid
      const { error: updateError } = await (supabase as any)
        .from('payroll_records')
        .update({
          paid_at: new Date().toISOString(),
          payment_account_id: sourceAccountId,
          payment_status: 'paid',
          payment_journal_id: journalResult.data.id,
          updated_at: new Date().toISOString()
        })
        .eq('pay_period', payPeriod)
        .eq('status', 'approved')
        .is('paid_at', null);
      
      if (updateError) throw new Error(`Failed to update payroll records: ${updateError.message}`);
      
      // 5. Trigger automated payslip generation and delivery for each settled record
      // We don't await this to keep the main settlement flow fast, but we fire off the process
      payrollRecords.forEach(record => {
        payslipService.generateAndDeliver(record.id).catch(err => {
          });
      });

      return {
        success: true,
        data: { journalEntryId: journalResult.data.id, amount: totalNet, employeeCount: payrollRecords.length }
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: { message: error.message || 'Failed to settle payroll payment', code: 'SETTLE_ERROR' }
      };
    }
  }
  
  /**
   * Remit PAYE tax to MRA
   * Creates journal entry: Debit LIAB_PAYE, Credit BANK/CASH
   */
  async remitPAYETax(
    payPeriod: string,
    sourceAccountId: string,
    userId?: string
  ): Promise<{ success: boolean; data?: any; error?: { message: string; code?: string } }> {
    try {
      // 1. Check if PAYE tax has already been remitted for this period
      const { data: existingRemittances, error: checkError } = await (supabase as any)
        .from('payroll_records')
        .select('id, paye_remittance_date, paye_remittance_journal_id')
        .eq('pay_period', payPeriod)
        .not('paye_remittance_date', 'is', null)
        .limit(1);

      if (checkError) throw new Error(`Failed to check PAYE remittance status: ${checkError.message}`);
      if (existingRemittances && existingRemittances.length > 0) {
        throw new Error(`PAYE tax for ${payPeriod} has already been remitted. Cannot remit again.`);
      }

      // 2. Get payroll records for this period
      const { data: payrollRecords, error: fetchError } = await (supabase as any)
        .from('payroll_records')
        .select('*')
        .eq('pay_period', payPeriod);

      if (fetchError) throw new Error(`Failed to fetch payroll records: ${fetchError.message}`);
      if (!payrollRecords || payrollRecords.length === 0) {
        throw new Error(`No payroll records found for ${payPeriod}`);
      }

      const totalPAYE = payrollRecords.reduce((sum, r) => sum + Number(r.paye_tax || 0), 0);
      if (totalPAYE <= 0) {
        throw new Error(`No PAYE tax to remit for ${payPeriod}`);
      }

      // 2. Get the PAYE liability and source accounts
      const payeLiabilityAccount = await accountsService.getAccountByCode('LIAB_PAYE');
      if (!payeLiabilityAccount.data) {
        throw new Error('LIAB_PAYE account not found.');
      }
      
      const sourceAccount = await accountsService.getAccountById(sourceAccountId);
      if (!sourceAccount.data) {
        throw new Error('Source account not found.');
      }

      // 3. Create journal entry for PAYE remittance
      const journalResult = await journalEntriesService.createJournalEntry({
        reference_type: 'adjustment',
        reference_id: null,
        date: new Date().toISOString().split('T')[0],
        description: `PAYE Tax Remittance to MRA for ${payPeriod}`,
        journal_lines: [
          {
            account_id: payeLiabilityAccount.data.id,
            debit: totalPAYE,
            credit: 0,
          },
          {
            account_id: sourceAccountId,
            debit: 0,
            credit: totalPAYE,
          }
        ]
      });
      
      if (!journalResult.success || !journalResult.data) {
        throw new Error(`Failed to create journal entry: ${journalResult.error?.message}`);
      }

      // 4. Update payroll records with PAYE remittance info
      const { error: updateError } = await (supabase as any)
        .from('payroll_records')
        .update({
          paye_remittance_date: new Date().toISOString().split('T')[0],
          paye_remittance_journal_id: journalResult.data.id,
          paye_remittance_status: 'remitted',
          updated_at: new Date().toISOString()
        })
        .eq('pay_period', payPeriod);
      
      if (updateError) throw new Error(`Failed to update payroll records: ${updateError.message}`);

      return {
        success: true,
        data: { journalEntryId: journalResult.data.id, amount: totalPAYE }
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: { message: error.message || 'Failed to remit PAYE tax', code: 'REMITE_ERROR' }
      };
    }
  }
  
  /**
   * Get payroll accounting status
   */
  async getPayrollAccountingStatus(payPeriod: string): Promise<{ success: boolean; data?: any; error?: { message: string; code?: string } }> {
    try {
      const { data, error } = await (supabase as any)
        .from('payroll_records')
        .select('accounting_status, journal_entry_id')
        .eq('pay_period', payPeriod);
      
      if (error) {
        throw new Error(`Failed to fetch accounting status: ${error.message}`);
      }
      
      const records = data as any[] || [];
      const totalRecords = records.length;
      const postedCount = records.filter(r => r.accounting_status === 'posted').length || 0;
      const pendingCount = records.filter(r => r.accounting_status === 'pending').length || 0;
      const errorCount = records.filter(r => r.accounting_status === 'error').length || 0;
      const journalEntryId = records.find(r => r.journal_entry_id)?.journal_entry_id;
      
      return {
        success: true,
        data: {
          totalRecords,
          postedCount,
          pendingCount,
          errorCount,
          journalEntryId
        }
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: {
          message: error.message || 'Failed to get accounting status',
          code: 'STATUS_FETCH_ERROR'
        }
      };
    }
  }
}

export const payrollService = new PayrollService();
