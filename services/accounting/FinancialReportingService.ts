import { supabase } from '@/integrations/supabase/client';

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountCategory: string;
  debitBalance: number;
  creditBalance: number;
  netBalance: number;
}

export interface ProfitLossRow {
  category: string;
  accountCode: string;
  accountName: string;
  amount: number;
  categoryTotal: number;
}

export interface BalanceSheetRow {
  section: string;
  category: string;
  accountCode: string;
  accountName: string;
  balance: number;
  sectionTotal: number;
}

export interface CashFlowRow {
  section: string;
  description: string;
  amount: number;
  sectionTotal: number;
}

/**
 * FinancialReportingService - Generate IFRS-Compliant Financial Reports
 * 
 * All reports derived from journal entries ONLY (single source of truth)
 * 
 * Reports:
 * - Trial Balance: Debits = Credits validation
 * - Profit & Loss: Income - Expenses = Net Profit
 * - Balance Sheet: Assets = Liabilities + Equity
 * - Cash Flow: Operating, Investing, Financing activities
 */
export class FinancialReportingService {

  /**
   * Generate Trial Balance
   * 
   * Validates that total debits equal total credits
   * Shows balance for each account in the chart of accounts
   * 
   * @param asOfDate - Date for balance calculation
   * @returns Trial balance rows
   */
  async generateTrialBalance(asOfDate?: string): Promise<TrialBalanceRow[]> {
    const date = asOfDate || new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase.rpc('get_trial_balance', {
      p_as_of_date: date
    });
    
    if (error) {
      throw new Error(`Failed to generate trial balance: ${error.message}`);
    }
    
    return (data || []).map((row: any) => ({
      accountCode: row.account_code,
      accountName: row.account_name,
      accountCategory: row.account_category,
      debitBalance: row.debit_balance || 0,
      creditBalance: row.credit_balance || 0,
      netBalance: row.net_balance || 0
    }));
  }

  /**
   * Validate Trial Balance
   * 
   * Checks that Debits = Credits (within 0.01 tolerance)
   * 
   * @param asOfDate - Date to validate
   * @returns Validation result
   */
  async validateTrialBalance(asOfDate?: string): Promise<{
    reconciles: boolean;
    totalDebits: number;
    totalCredits: number;
    difference: number;
    lineCount: number;
  }> {
    const trialBalance = await this.generateTrialBalance(asOfDate);
    
    const totalDebits = trialBalance.reduce((sum, row) => sum + row.debitBalance, 0);
    const totalCredits = trialBalance.reduce((sum, row) => sum + row.creditBalance, 0);
    const difference = Math.abs(totalDebits - totalCredits);
    
    return {
      reconciles: difference < 0.01,
      totalDebits,
      totalCredits,
      difference,
      lineCount: trialBalance.length
    };
  }

  /**
   * Generate Profit & Loss Statement
   * 
   * Income - Expenses = Net Profit/Loss
   * 
   * @param startDate - Period start date
   * @param endDate - Period end date
   * @returns P&L rows
   */
  async generateProfitLoss(
    startDate: string,
    endDate: string
  ): Promise<ProfitLossRow[]> {
    const { data, error } = await supabase.rpc('get_profit_loss_statement', {
      p_start_date: startDate,
      p_end_date: endDate
    });
    
    if (error) {
      throw new Error(`Failed to generate P&L: ${error.message}`);
    }
    
    return (data || []).map((row: any) => ({
      category: row.category,
      accountCode: row.account_code,
      accountName: row.account_name,
      amount: row.amount || 0,
      categoryTotal: row.category_total || 0
    }));
  }

  /**
   * Calculate Net Profit
   * 
   * @param startDate - Period start
   * @param endDate - Period end
   * @returns Net profit (positive) or loss (negative)
   */
  async calculateNetProfit(
    startDate: string,
    endDate: string
  ): Promise<number> {
    const pl = await this.generateProfitLoss(startDate, endDate);
    
    const totalIncome = pl
      .filter(row => row.category === 'income')
      .reduce((sum, row) => sum + row.amount, 0);
    
    const totalExpenses = pl
      .filter(row => row.category === 'expense')
      .reduce((sum, row) => sum + row.amount, 0);
    
    return totalIncome - totalExpenses;
  }

  /**
   * Generate Balance Sheet
   * 
   * Assets = Liabilities + Equity
   * 
   * @param asOfDate - Date for balance sheet
   * @returns Balance sheet rows
   */
  async generateBalanceSheet(asOfDate?: string): Promise<BalanceSheetRow[]> {
    const date = asOfDate || new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase.rpc('get_balance_sheet', {
      p_as_of_date: date
    });
    
    if (error) {
      throw new Error(`Failed to generate balance sheet: ${error.message}`);
    }
    
    return (data || []).map((row: any) => ({
      section: row.section,
      category: row.category,
      accountCode: row.account_code,
      accountName: row.account_name,
      balance: row.balance || 0,
      sectionTotal: row.section_total || 0
    }));
  }

  /**
   * Validate Balance Sheet
   * 
   * Checks that Assets = Liabilities + Equity (within 0.01 tolerance)
   * 
   * @param asOfDate - Date to validate
   * @returns Validation result
   */
  async validateBalanceSheet(asOfDate?: string): Promise<{
    balances: boolean;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    difference: number;
    accountingEquation: string;
  }> {
    const date = asOfDate || new Date().toISOString().split('T')[0];
    const balanceSheet = await this.generateBalanceSheet(date);
    
    const totalAssets = balanceSheet
      .filter(row => row.section === 'ASSETS')
      .reduce((sum, row) => sum + row.balance, 0);
    
    const totalLiabilities = balanceSheet
      .filter(row => row.section === 'LIABILITIES')
      .reduce((sum, row) => sum + row.balance, 0);
    
    const totalEquity = balanceSheet
      .filter(row => row.section === 'EQUITY')
      .reduce((sum, row) => sum + row.balance, 0);
    
    // Get current year earnings from P&L
    const yearStart = date.substring(0, 4) + '-01-01';
    const currentYearEarnings = await this.calculateNetProfit(yearStart, date);
    
    const difference = Math.abs(
      totalAssets - (totalLiabilities + totalEquity + currentYearEarnings)
    );
    
    return {
      balances: difference < 0.01,
      totalAssets,
      totalLiabilities,
      totalEquity,
      difference,
      accountingEquation: `Assets (${totalAssets.toFixed(2)}) = Liabilities (${totalLiabilities.toFixed(2)}) + Equity (${totalEquity.toFixed(2)}) + Current Year Earnings (${currentYearEarnings.toFixed(2)})`
    };
  }

  /**
   * Generate summary report
   * 
   * Quick overview of financial position
   * 
   * @param asOfDate - Date for summary
   */
  async generateSummary(asOfDate?: string): Promise<{
    date: string;
    trialBalance: {
      reconciles: boolean;
      totalDebits: number;
      totalCredits: number;
    };
    profitLoss: {
      totalIncome: number;
      totalExpenses: number;
      netProfit: number;
    };
    balanceSheet: {
      balances: boolean;
      totalAssets: number;
      totalLiabilities: number;
      totalEquity: number;
    };
  }> {
    const date = asOfDate || new Date().toISOString().split('T')[0];
    const yearStart = date.substring(0, 4) + '-01-01';
    
    // Trial Balance
    const tbValidation = await this.validateTrialBalance(date);
    
    // Profit & Loss
    const pl = await this.generateProfitLoss(yearStart, date);
    const totalIncome = pl
      .filter(row => row.category === 'income')
      .reduce((sum, row) => sum + row.amount, 0);
    const totalExpenses = pl
      .filter(row => row.category === 'expense')
      .reduce((sum, row) => sum + row.amount, 0);
    
    // Balance Sheet
    const bsValidation = await this.validateBalanceSheet(date);
    
    return {
      date,
      trialBalance: {
        reconciles: tbValidation.reconciles,
        totalDebits: tbValidation.totalDebits,
        totalCredits: tbValidation.totalCredits
      },
      profitLoss: {
        totalIncome,
        totalExpenses,
        netProfit: totalIncome - totalExpenses
      },
      balanceSheet: {
        balances: bsValidation.balances,
        totalAssets: bsValidation.totalAssets,
        totalLiabilities: bsValidation.totalLiabilities,
        totalEquity: bsValidation.totalEquity
      }
    };
  }

  /**
   * Generate Cash Flow Statement (Indirect Method)
   * 
   * Shows cash movements from:
   * - Operating activities
   * - Investing activities
   * - Financing activities
   * 
   * @param startDate - Period start
   * @param endDate - Period end
   */
  async generateCashFlow(
    startDate: string,
    endDate: string
  ): Promise<{
    operating: { description: string; amount: number }[];
    investing: { description: string; amount: number }[];
    financing: { description: string; amount: number }[];
    netCashFlow: number;
    beginningCash: number;
    endingCash: number;
  }> {
    // Get cash and bank account IDs
    const { data: cashAccounts, error: cashError } = await supabase
      .from('internal_accounts')
      .select('id, account_code, name, is_cash_equivalent')
      .in('account_code', ['CASH_ON_HAND', 'BANK_MAIN', 'BANK_SAVINGS', 'CLEARING_AIRTEL', 'CLEARING_MPAMBA']);
    
    if (cashError) {
      throw new Error(`Failed to fetch cash accounts: ${cashError.message}`);
    }
    
    const cashAccountIds = (cashAccounts || []).map(a => a.id);
    
    // Get journal lines for cash accounts in period
    const { data: journalLines, error: linesError } = await supabase
      .from('journal_lines')
      .select(`
        debit,
        credit,
        description,
        journal_entry:journal_entry_id(
          reference_type,
          transaction_date
        )
      `)
      .in('account_id', cashAccountIds)
      .gte('journal_entry.transaction_date', startDate)
      .lte('journal_entry.transaction_date', endDate);
    
    if (linesError) {
      throw new Error(`Failed to fetch journal lines: ${linesError.message}`);
    }
    
    // Categorize cash flows
    const operating: { description: string; amount: number }[] = [];
    const investing: { description: string; amount: number }[] = [];
    const financing: { description: string; amount: number }[] = [];
    
    // Process each line
    (journalLines || []).forEach((line: any) => {
      const refType = line.journal_entry?.reference_type;
      const netAmount = (line.debit || 0) - (line.credit || 0);
      const description = line.description || refType || 'Unknown';
      
      // Categorize by reference type
      switch (refType) {
        case 'repayment':
        case 'interest_accrual':
        case 'salary_accrual':
        case 'expense':
        case 'salary_payment':
        case 'tax_remittance':
        case 'clearing_settlement':
          operating.push({ description, amount: netAmount });
          break;
        case 'loan_disbursement':
          // Loan disbursements are financing activities
          financing.push({ description: 'Loan disbursements', amount: -netAmount });
          break;
        case 'capital_injection':
          financing.push({ description: 'Capital injection', amount: netAmount });
          break;
        case 'write_off':
          operating.push({ description: 'Loan write-offs', amount: netAmount });
          break;
        default:
          operating.push({ description, amount: netAmount });
      }
    });
    
    // Calculate totals
    const operatingTotal = operating.reduce((sum, item) => sum + item.amount, 0);
    const investingTotal = investing.reduce((sum, item) => sum + item.amount, 0);
    const financingTotal = financing.reduce((sum, item) => sum + item.amount, 0);
    const netCashFlow = operatingTotal + investingTotal + financingTotal;
    
    // Get beginning and ending cash balances
    const { data: beginningBalances } = await supabase.rpc('get_cash_balance', {
      p_as_of_date: startDate
    });
    
    const { data: endingBalances } = await supabase.rpc('get_cash_balance', {
      p_as_of_date: endDate
    });
    
    const beginningCash = (beginningBalances || []).reduce(
      (sum: number, row: any) => sum + (row.balance || 0), 0
    );
    
    const endingCash = (endingBalances || []).reduce(
      (sum: number, row: any) => sum + (row.balance || 0), 0
    );
    
    return {
      operating: operating.slice(0, 50), // Limit items
      investing: investing.slice(0, 50),
      financing: financing.slice(0, 50),
      netCashFlow,
      beginningCash,
      endingCash
    };
  }
}

// Export singleton instance
export const financialReportingService = new FinancialReportingService();
