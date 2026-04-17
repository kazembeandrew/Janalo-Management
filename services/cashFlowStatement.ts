import { 
  BaseServiceClass, 
  ServiceResult, 
  PaginationParams 
} from './_shared/baseService';
import { supabase } from '@/lib/supabase';
import { auditService } from './audit';

// ============================================================================
// TYPES
// ============================================================================

export interface CashFlowClassification {
  id: string;
  account_id: string;
  classification: 'operating' | 'investing' | 'financing' | 'non_cash';
  treatment: 'source' | 'use';
  description: string;
  created_at: string;
  updated_at: string;
  account?: {
    id: string;
    code: string;
    name: string;
    account_category: string;
  };
}

export interface CashFlowStatementItem {
  activity_type: string;
  activity_name: string;
  account_code?: string;
  account_name?: string;
  amount?: number;
  subtotal?: number;
  activity_total?: number;
}

export interface CashFlowStatement {
  period_start: string;
  period_end: string;
  operating_activities: CashFlowStatementItem[];
  operating_subtotal: number;
  investing_activities: CashFlowStatementItem[];
  investing_subtotal: number;
  financing_activities: CashFlowStatementItem[];
  financing_subtotal: number;
  net_change_in_cash: number;
  cash_beginning_period: number;
  cash_end_period: number;
}

export interface CashFlowWorkingCapitalChange {
  account_name: string;
  beginning_balance: number;
  ending_balance: number;
  change: number;
  impact: 'source' | 'use';
}

export interface CashFlowAnalysis {
  statement: CashFlowStatement;
  operating_efficiency_ratio: number; // Operating CF / Operating expenses
  free_cash_flow: number; // Operating CF - Capital expenditures
  cash_conversion_cycle: number; // Days
  liquidity_ratio: number; // Cash / Current obligations
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class CashFlowStatementService extends BaseServiceClass {
  private static instance: CashFlowStatementService;

  public static getInstance(): CashFlowStatementService {
    if (!CashFlowStatementService.instance) {
      CashFlowStatementService.instance = new CashFlowStatementService();
    }
    return CashFlowStatementService.instance;
  }

  // =========================================================================
  // CORE METHODS
  // =========================================================================

  /**
   * Generate comprehensive cash flow statement for a period
   * Uses indirect method: Start with Net Income and adjust for non-cash items
   */
  async generateCashFlowStatement(
    dateFrom: string,
    dateTo: string
  ): Promise<ServiceResult<CashFlowStatement>> {
    return this.handleAsyncOperation(async () => {
      // Call RPC function for comprehensive calculation
      const { data, error } = await (supabase as any).rpc(
        'calculate_cash_flow_statement',
        {
          p_start_date: dateFrom,
          p_end_date: dateTo
        }
      );

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('No cash flow data found for period');
      }

      // Parse the results into structured statement
      const statement = this.parseRawCashFlowData(data, dateFrom, dateTo);

      // Log to audit trail
      await auditService.logAudit('generate_cash_flow_statement', 'financial_statement', 'statement', {
        period_start: dateFrom,
        period_end: dateTo,
        net_cash_flow: statement.net_change_in_cash
      });

      return statement;
    }, 'Failed to generate cash flow statement');
  }

  /**
   * Get cash flow by category for a period
   */
  async getCashFlowByCategory(
    dateFrom: string,
    dateTo: string
  ): Promise<ServiceResult<{
    operating: number;
    investing: number;
    financing: number;
    net: number;
  }>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).rpc(
        'calculate_cash_flow_statement',
        {
          p_start_date: dateFrom,
          p_end_date: dateTo
        }
      );

      if (error) throw error;

      const result = {
        operating: 0,
        investing: 0,
        financing: 0,
        net: 0
      };

      for (const row of data || []) {
        if (row.activity_total !== null && row.activity_total !== undefined) {
          if (row.activity_type === 'OPERATING') {
            result.operating = row.activity_total;
          } else if (row.activity_type === 'INVESTING') {
            result.investing = row.activity_total;
          } else if (row.activity_type === 'FINANCING') {
            result.financing = row.activity_total;
          }
        }
      }

      result.net = result.operating + result.investing + result.financing;

      return result;
    }, 'Failed to calculate cash flow by category');
  }

  /**
   * Get trend analysis: Compare cash flow across multiple periods
   */
  async getCashFlowTrend(
    periods: Array<{ label: string; dateFrom: string; dateTo: string }>
  ): Promise<
    ServiceResult<
      Array<{
        period: string;
        operating: number;
        investing: number;
        financing: number;
        net: number;
      }>
    >
  > {
    return this.handleAsyncOperation(async () => {
      const results = [];

      for (const period of periods) {
        const cfResult = await this.getCashFlowByCategory(
          period.dateFrom,
          period.dateTo
        );

        if (cfResult.data) {
          results.push({
            period: period.label,
            ...cfResult.data
          });
        }
      }

      return results;
    }, 'Failed to calculate cash flow trend');
  }

  /**
   * Analyze operating cash flow drivers
   */
  async analyzeOperatingCashFlow(
    dateFrom: string,
    dateTo: string
  ): Promise<
    ServiceResult<{
      interest_collected: number;
      penalties_collected: number;
      operating_expenses_paid: number;
      salaries_paid: number;
      other_operating: number;
      net_operating: number;
    }>
  > {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).rpc(
        'calculate_cash_flow_statement',
        {
          p_start_date: dateFrom,
          p_end_date: dateTo
        }
      );

      if (error) throw error;

      const analysis = {
        interest_collected: 0,
        penalties_collected: 0,
        operating_expenses_paid: 0,
        salaries_paid: 0,
        other_operating: 0,
        net_operating: 0
      };

      // Parse operating activities
      for (const row of data || []) {
        if (row.activity_type !== 'OPERATING') continue;

        if (row.activity_name?.includes('interest')) {
          analysis.interest_collected += row.amount || 0;
        } else if (row.activity_name?.includes('penalty')) {
          analysis.penalties_collected += row.amount || 0;
        } else if (row.activity_name?.includes('expense')) {
          analysis.operating_expenses_paid += Math.abs(row.amount || 0);
        } else if (row.activity_name?.includes('salaries')) {
          analysis.salaries_paid += Math.abs(row.amount || 0);
        } else {
          analysis.other_operating += row.amount || 0;
        }
      }

      analysis.net_operating =
        analysis.interest_collected +
        analysis.penalties_collected -
        analysis.operating_expenses_paid -
        analysis.salaries_paid +
        analysis.other_operating;

      return analysis;
    }, 'Failed to analyze operating cash flow');
  }

  /**
   * Get free cash flow (Operating CF - Capital Expenditures)
   */
  async getFreeCashFlow(
    dateFrom: string,
    dateTo: string
  ): Promise<ServiceResult<number>> {
    return this.handleAsyncOperation(async () => {
      const cfResult = await this.getCashFlowByCategory(dateFrom, dateTo);
      if (!cfResult.data) throw new Error('Could not calculate cash flows');

      // Free Cash Flow = Operating CF - Capital Expenses
      // In microfinance context: Operating CF - Loan Disbursements
      const operatingCF = cfResult.data.operating;
      const capitalExpenses = Math.abs(cfResult.data.investing); // Investing activities are typically negative

      return operatingCF - capitalExpenses;
    }, 'Failed to calculate free cash flow');
  }

  /**
   * Calculate cash flow ratios for financial analysis
   */
  async calculateCashFlowRatios(
    dateFrom: string,
    dateTo: string
  ): Promise<
    ServiceResult<{
      operating_cash_flow_ratio: number;
      free_cash_flow_ratio: number;
      cash_conversion_efficiency: number;
      working_capital_utilization: number;
    }>
  > {
    return this.handleAsyncOperation(async () => {
      const cfResult = await this.getCashFlowByCategory(dateFrom, dateTo);
      if (!cfResult.data) throw new Error('Could not calculate cash flows');

      const { operating, investing, financing } = cfResult.data;

      const ratios = {
        // Operating Cash Flow Ratio: Operating CF / Total obligations (estimated)
        operating_cash_flow_ratio: operating > 0 ? 1 : operating < 0 ? -1 : 0,

        // Free Cash Flow Ratio: (Operating CF - Investing CF) / Operating CF
        free_cash_flow_ratio:
          operating !== 0 ? ((operating - Math.abs(investing)) / operating) * 100 : 0,

        // Cash Conversion Efficiency: How much operating activity generated cash
        cash_conversion_efficiency:
          operating > 0
            ? (operating / (operating + Math.abs(investing))) * 100
            : 0,

        // Working Capital Utilization: (Operating + Financing) / Total CF
        working_capital_utilization:
          operating + financing !== 0
            ? ((operating + financing) / Math.abs(operating + financing + investing)) * 100
            : 0
      };

      return ratios;
    }, 'Failed to calculate cash flow ratios');
  }

  /**
   * Identify major cash outlays and inflows
   */
  async getCashFlowDrivers(
    dateFrom: string,
    dateTo: string,
    minAmount: number = 0
  ): Promise<
    ServiceResult<{
      top_inflows: Array<{ description: string; amount: number }>;
      top_outflows: Array<{ description: string; amount: number }>;
    }>
  > {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any).rpc(
        'calculate_cash_flow_statement',
        {
          p_start_date: dateFrom,
          p_end_date: dateTo
        }
      );

      if (error) throw error;

      const inflows: Array<{ description: string; amount: number }> = [];
      const outflows: Array<{ description: string; amount: number }> = [];

      for (const row of data || []) {
        if (!row.amount || row.amount === 0) continue;

        const item = {
          description: row.activity_name || row.account_name || 'Other',
          amount: Math.abs(row.amount)
        };

        if (row.amount > minAmount) {
          inflows.push(item);
        } else if (row.amount < -minAmount) {
          outflows.push(item);
        }
      }

      // Sort by amount descending
      inflows.sort((a, b) => b.amount - a.amount);
      outflows.sort((a, b) => b.amount - a.amount);

      return {
        top_inflows: inflows.slice(0, 10),
        top_outflows: outflows.slice(0, 10)
      };
    }, 'Failed to identify cash flow drivers');
  }

  /**
   * Forecast next period cash flow based on historical trend
   */
  async forecastCashFlow(
    historicalPeriods: number = 3,
    forecastPeriods: number = 1
  ): Promise<
    ServiceResult<
      Array<{
        period: number;
        operating: number;
        investing: number;
        financing: number;
        net: number;
        is_forecast: boolean;
      }>
    >
  > {
    return this.handleAsyncOperation(async () => {
      // Generate periods for analysis
      const now = new Date();
      const periods = [];

      // Historical periods
      for (let i = historicalPeriods; i > 0; i--) {
        const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

        const start = startDate.toISOString().split('T')[0];
        const end = endDate.toISOString().split('T')[0];

        const cfResult = await this.getCashFlowByCategory(start, end);
        if (cfResult.data) {
          periods.push({
            period: -i,
            ...cfResult.data,
            is_forecast: false
          });
        }
      }

      // Calculate average for forecasting
      let avgOperating = 0,
        avgInvesting = 0,
        avgFinancing = 0;

      if (periods.length > 0) {
        avgOperating =
          periods.reduce((sum, p) => sum + p.operating, 0) / periods.length;
        avgInvesting =
          periods.reduce((sum, p) => sum + p.investing, 0) / periods.length;
        avgFinancing =
          periods.reduce((sum, p) => sum + p.financing, 0) / periods.length;
      }

      // Add forecasted periods
      for (let i = 1; i <= forecastPeriods; i++) {
        periods.push({
          period: i,
          operating: avgOperating,
          investing: avgInvesting,
          financing: avgFinancing,
          net: avgOperating + avgInvesting + avgFinancing,
          is_forecast: true
        });
      }

      return periods;
    }, 'Failed to forecast cash flow');
  }

  /**
   * Get cash flow classifications for setup/configuration
   */
  async getCashFlowClassifications(): Promise<ServiceResult<CashFlowClassification[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await (supabase as any)
        .from('cash_flow_classifications')
        .select(`
          *,
          account:internal_accounts(
            id,
            code,
            name,
            account_category
          )
        `)
        .order('classification')
        .order('account.code');

      if (error) throw error;

      return data || [];
    }, 'Failed to get cash flow classifications');
  }

  /**
   * Update cash flow classification for an account
   */
  async updateCashFlowClassification(
    accountId: string,
    classification: 'operating' | 'investing' | 'financing' | 'non_cash',
    treatment: 'source' | 'use',
    description?: string
  ): Promise<ServiceResult<CashFlowClassification>> {
    return this.handleAsyncOperation(async () => {
      const user = await this.getCurrentUser();

      const { data, error } = await (supabase as any)
        .from('cash_flow_classifications')
        .upsert(
          {
            account_id: accountId,
            classification,
            treatment,
            description: description || '',
            updated_at: new Date().toISOString()
          },
          { onConflict: 'account_id' }
        )
        .select()
        .single();

      if (error) throw error;

      // Audit log
      await auditService.logAudit(
        'update_cash_flow_classification',
        'account',
        accountId,
        { classification, treatment }
      );

      return data;
    }, 'Failed to update cash flow classification');
  }

  // =========================================================================
  // PRIVATE HELPER METHODS
  // =========================================================================

  /**
   * Parse raw RPC response into structured CashFlowStatement
   */
  private parseRawCashFlowData(
    rawData: any[],
    dateFrom: string,
    dateTo: string
  ): CashFlowStatement {
    const statement: CashFlowStatement = {
      period_start: dateFrom,
      period_end: dateTo,
      operating_activities: [],
      operating_subtotal: 0,
      investing_activities: [],
      investing_subtotal: 0,
      financing_activities: [],
      financing_subtotal: 0,
      net_change_in_cash: 0,
      cash_beginning_period: 0,
      cash_end_period: 0
    };

    let currentActivity = '';

    for (const row of rawData) {
      if (!row.activity_type) continue;

      // Track category changes and capture subtotals
      if (row.activity_type !== currentActivity) {
        currentActivity = row.activity_type;
      }

      const item: CashFlowStatementItem = {
        activity_type: row.activity_type,
        activity_name: row.activity_name,
        account_code: row.account_code,
        account_name: row.account_name,
        amount: row.amount,
        subtotal: row.subtotal,
        activity_total: row.activity_total
      };

      if (row.activity_type === 'OPERATING') {
        statement.operating_activities.push(item);
        if (row.activity_total !== null && row.activity_total !== undefined) {
          statement.operating_subtotal = row.activity_total;
        }
      } else if (row.activity_type === 'INVESTING') {
        statement.investing_activities.push(item);
        if (row.activity_total !== null && row.activity_total !== undefined) {
          statement.investing_subtotal = row.activity_total;
        }
      } else if (row.activity_type === 'FINANCING') {
        statement.financing_activities.push(item);
        if (row.activity_total !== null && row.activity_total !== undefined) {
          statement.financing_subtotal = row.activity_total;
        }
      }
    }

    statement.net_change_in_cash =
      statement.operating_subtotal +
      statement.investing_subtotal +
      statement.financing_subtotal;

    return statement;
  }

  /**
   * Get current authenticated user
   */
  private async getCurrentUser() {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Not authenticated');
    return user;
  }
}

// Export singleton instance
export const cashFlowStatementService = CashFlowStatementService.getInstance();
