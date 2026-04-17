import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, TrendingUp, AlertCircle, CheckCircle, XCircle, FileText } from 'lucide-react';
import { 
  getPeriodFinancialSummary, 
  closeAccountingPeriod, 
  validatePeriodClose,
  formatCurrency,
  formatPeriod,
  type FinancialSummary 
} from '../../services/accountingPeriod';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { useToast } from '../ToastProvider';

interface PeriodEndClosingProps {
  defaultPeriod?: string; // ISO date string (YYYY-MM-DD)
}

export const PeriodEndClosing: React.FC<PeriodEndClosingProps> = ({ 
  defaultPeriod = new Date().toISOString().split('T')[0] 
}) => {
  const [periodDate, setPeriodDate] = useState(defaultPeriod);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [canClose, setCanClose] = useState(false);
  const { addToast } = useToast();

  // Load financial summary when period changes
  useEffect(() => {
    loadFinancialSummary();
  }, [periodDate]);

  const loadFinancialSummary = async () => {
    try {
      setValidating(true);
      const data = await getPeriodFinancialSummary(periodDate);
      setSummary(data);
      
      // Validate if can close
      const validation = await validatePeriodClose(periodDate);
      setValidationIssues(validation.issues);
      setCanClose(validation.canClose && !data.already_closed);
    } catch (error) {
      addToast({
        title: 'Error',
        description: `Failed to load financial summary: ${(error as Error).message}`,
        variant: 'destructive'
      });
    } finally {
      setValidating(false);
    }
  };

  const handleExecuteClosing = async () => {
    if (!canClose || !summary) return;

    const confirmed = window.confirm(
      `Are you sure you want to close the accounting period for ${formatPeriod(periodDate)}?\n\n` +
      `This will:\n` +
      `- Transfer net income of ${formatCurrency(summary.summary.net_income)} to Retained Earnings\n` +
      `- Create a permanent journal entry\n` +
      `- Prevent future modifications to this period's income/expense accounts\n\n` +
      `This action cannot be undone without reversing the closing entry.`
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      const result = await closeAccountingPeriod(periodDate);
      
      addToast({
        title: 'Success',
        description: result.message,
        variant: 'success'
      });

      // Reload summary to show updated state
      await loadFinancialSummary();
    } catch (error) {
      addToast({
        title: 'Closing Failed',
        description: (error as Error).message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-muted-foreground">Loading financial summary...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Period-End Closing
          </CardTitle>
          <CardDescription>
            Close accounting period and transfer net income to Retained Earnings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <input
              type="month"
              value={periodDate.substring(0, 7)}
              onChange={(e) => setPeriodDate(e.target.value + '-01')}
              className="px-3 py-2 border rounded-md"
              disabled={loading}
            />
            <Button
              variant="outline"
              onClick={loadFinancialSummary}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Validation Issues */}
      {validationIssues.length > 0 && (
        <div className={`p-4 rounded-md border ${canClose ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start gap-3">
            <AlertCircle className={`h-4 w-4 mt-0.5 ${canClose ? 'text-blue-600' : 'text-red-600'}`} />
            <div>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {validationIssues.map((issue, idx) => (
                  <li key={idx} className={canClose ? 'text-blue-800' : 'text-red-800'}>{issue}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Already Closed Warning */}
      {summary?.already_closed && (
        <div className="p-4 rounded-md border bg-green-50 border-green-200">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
            <p className="text-sm text-green-800">
              This period has already been closed. No further action is required.
            </p>
          </div>
        </div>
      )}

      {/* Financial Summary */}
      {summary && !summary.already_closed && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Income
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span className="text-2xl font-bold text-green-600">
                    {formatCurrency(summary.summary.total_income)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Expenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-red-600 rotate-180" />
                  <span className="text-2xl font-bold text-red-600">
                    {formatCurrency(summary.summary.total_expenses)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net Income
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <DollarSign className={`h-5 w-5 ${summary.summary.net_income >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
                  <span className={`text-2xl font-bold ${summary.summary.net_income >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {formatCurrency(summary.summary.net_income)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Profit Margin: {summary.summary.profit_margin_percent}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Income Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  Income Accounts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary.income_breakdown.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No income recorded for this period</p>
                ) : (
                  <div className="space-y-2">
                    {summary.income_breakdown.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                        <div>
                          <p className="font-medium text-sm">{item.account_name}</p>
                          <p className="text-xs text-muted-foreground">Code: {item.account_code}</p>
                        </div>
                        <Badge variant="secondary" className="text-green-700 bg-green-50">
                          {formatCurrency(item.amount)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Expense Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />
                  Expense Accounts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary.expense_breakdown.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No expenses recorded for this period</p>
                ) : (
                  <div className="space-y-2">
                    {summary.expense_breakdown.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                        <div>
                          <p className="font-medium text-sm">{item.account_name}</p>
                          <p className="text-xs text-muted-foreground">Code: {item.account_code}</p>
                        </div>
                        <Badge variant="secondary" className="text-red-700 bg-red-50">
                          {formatCurrency(item.amount)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Action Button */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Ready to Close Period</p>
                    <p className="text-sm text-muted-foreground">
                      This will create a journal entry transferring {formatCurrency(summary.summary.net_income)} to Retained Earnings
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleExecuteClosing}
                  disabled={!canClose || loading}
                  size="lg"
                  className={summary.summary.net_income >= 0 ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Execute Closing
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty State */}
      {!summary && !validating && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Select a period to view financial summary</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
