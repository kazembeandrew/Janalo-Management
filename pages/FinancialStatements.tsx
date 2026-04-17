import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/utils/finance';
import { 
    FileText, TrendingUp, Landmark, Wallet, 
    ArrowDownRight, ArrowUpRight, Printer, Download,
    RefreshCw, PieChart as PieIcon, Scale, Lock, CheckCircle2, AlertCircle, X,
    Calculator, List, Clock
} from 'lucide-react';
import { exportToCSV, generateTablePDF } from '@/utils/export';
import { accountsService } from '@/services/accounts';
import { journalEntriesService } from '@/services/journalEntries';
import toast from 'react-hot-toast';

export const FinancialStatements: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pnlData, setPnlData] = useState<any>(null);
  const [balanceSheet, setBalanceSheet] = useState<any>(null);
  const [period, setPeriod] = useState(new Date().toISOString().substring(0, 7));
  const [isClosed, setIsClosed] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [equityAccounts, setEquityAccounts] = useState<any[]>([]);
  const [targetEquityId, setTargetEquityId] = useState('');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidationLoading, setIsValidationLoading] = useState(false);

  // Trial Balance state
  const [showTrialBalance, setShowTrialBalance] = useState(false);
  const [trialBalanceData, setTrialBalanceData] = useState<any[]>([]);
  const [isTrialBalanceLoading, setIsTrialBalanceLoading] = useState(false);

  // Portfolio Aging state
  const [showPortfolioAging, setShowPortfolioAging] = useState(false);
  const [portfolioAgingData, setPortfolioAgingData] = useState<any[]>([]);
  const [isPortfolioAgingLoading, setIsPortfolioAgingLoading] = useState(false);

  const isCEO = effectiveRoles.includes('ceo') || effectiveRoles.includes('admin');

  useEffect(() => {
    fetchStatements();
    if (isCEO) fetchEquityAccounts();
  }, [period]);

  const fetchEquityAccounts = async () => {
      const result = await accountsService.getAccounts({ type: 'equity' });
      if (result.data) {
          const data = result.data.data;
          const retainedOnly = data.filter((a: any) => a.account_code === 'EQUITY' || a.code === 'EQUITY' || /retained\s*earnings/i.test(a.name || ''));
          setEquityAccounts(retainedOnly.length > 0 ? retainedOnly : data);
          if (!targetEquityId) {
              const retained = data.find((a: any) => a.account_code === 'EQUITY' || a.code === 'EQUITY') || data.find((a: any) => /retained\s*earnings/i.test(a.name || ''));
              if (retained?.id) setTargetEquityId(retained.id);
          }
      }
  };

  const handleValidatePeriod = async () => {
      setIsValidationLoading(true);
      try {
          const result = await accountsService.validatePeriodClosing(period);
          if (result.error) {
              toast.error("Validation Error: " + result.error.message);
              setValidationResult({ is_valid: false, error_message: result.error.message, details: {} });
          } else if (result.data) {
              setValidationResult(result.data);
              if (!result.data.is_valid) {
                  toast.error(result.data.error_message);
              } else {
                  toast.success("Period is valid for closing");
              }
          }
      } catch (e: any) {
          toast.error("Validation failed: " + e.message);
          setValidationResult({ is_valid: false, error_message: e.message, details: {} });
      } finally {
          setIsValidationLoading(false);
      }
  };

  const fetchStatements = async () => {
    setLoading(true);
    try {
        const { data: closedData } = await (supabase as any)
            .from('closed_periods')
            .select('*')
            .eq('month', period)
            .maybeSingle();
        
        setIsClosed(!!closedData);

        // FIX #2: Calculate period end date for balance sheet
        const [year, monthNum] = period.split('-').map(Number);
        const periodEndDate = new Date(year, monthNum, 0).toISOString().split('T')[0]; // Last day of month

        const [pnlResult, bsResult] = await Promise.all([
          accountsService.getProfitLoss(period),
          // FIX #2: Pass period end date for historical balance sheet
          accountsService.getBalanceSheet(isClosed ? periodEndDate : undefined)
        ]);
        
        if (pnlResult.error) {
            toast.error("Profit & Loss Error: " + pnlResult.error.message);
            setPnlData(null);
        } else if (pnlResult.data) {
            const data = pnlResult.data;
            setPnlData({
                ...data,
                interestIncome: data.revenueByType['interest'] || data.revenueByType['Interest Income'] || 0,
                penaltyIncome: data.revenueByType['penalty'] || data.revenueByType['Penalty Income'] || data.revenueByType['fees'] || data.revenueByType['Fees'] || 0,
                expenseCategories: data.expenseByType || {}
            });
        }

        if (bsResult.error) {
            toast.error("Balance Sheet Error: " + bsResult.error.message);
            setBalanceSheet(null);
        } else if (bsResult.data) {
            const data = bsResult.data;
            setBalanceSheet({
                ...data,
                equity: {
                    ...data.equity,
                    currentEarnings: isClosed ? 0 : (pnlResult.data?.netProfit || 0),
                    total: data.equity.baseEquity + (isClosed ? 0 : (pnlResult.data?.netProfit || 0))
                }
            });
        }
    } catch (e: any) {
        toast.error("Failed to fetch statements: " + e.message);
    } finally {
        setLoading(false);
    }
  };

  const loadTrialBalance = async () => {
    setIsTrialBalanceLoading(true);
    try {
      const [year, monthNum] = period.split('-').map(Number);
      const periodEndDate = new Date(year, monthNum, 0).toISOString().split('T')[0];
      
      const { data, error } = await (supabase as any).rpc('get_trial_balance', { 
        p_as_of_date: periodEndDate 
      });
      
      if (error) throw error;
      setTrialBalanceData(data || []);
    } catch (e: any) {
      toast.error("Failed to load trial balance: " + e.message);
    } finally {
      setIsTrialBalanceLoading(false);
    }
  };

  const toggleTrialBalance = () => {
    if (!showTrialBalance && trialBalanceData.length === 0) {
      loadTrialBalance();
    }
    setShowTrialBalance(!showTrialBalance);
  };

  const loadPortfolioAging = async () => {
    setIsPortfolioAgingLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('get_portfolio_aging');
      
      if (error) throw error;
      setPortfolioAgingData(data || []);
    } catch (e: any) {
      toast.error("Failed to load portfolio aging: " + e.message);
    } finally {
      setIsPortfolioAgingLoading(false);
    }
  };

  const togglePortfolioAging = () => {
    if (!showPortfolioAging && portfolioAgingData.length === 0) {
      loadPortfolioAging();
    }
    setShowPortfolioAging(!showPortfolioAging);
  };

  const handleDownload = () => {
      if (!pnlData || !balanceSheet) return;

      const headers = ['Category', 'Amount'];
      const rows = [
          ['--- INCOME STATEMENT ---', ''],
          ['Interest Income', (Number(pnlData.interestIncome) || 0).toFixed(2)],
          ['Penalty Income', (Number(pnlData.penaltyIncome) || 0).toFixed(2)],
          ['Total Revenue', (Number(pnlData.totalRevenue) || 0).toFixed(2)],
          ['Total Expenses', (Number(pnlData.totalExpenses) || 0).toFixed(2)],
          ['Net Profit', (Number(pnlData.netProfit) || 0).toFixed(2)],
          ['', ''],
          ['--- BALANCE SHEET ---', ''],
          ['Cash & Bank', (Number(balanceSheet.assets.cash_and_equivalents || balanceSheet.assets.cash || 0)).toFixed(2)],
          ['Loan Receivables', (Number(balanceSheet.assets.receivables) || 0).toFixed(2)],
          ['Other Assets', (Number(balanceSheet.assets.other_assets) || 0).toFixed(2)],
          ['Total Assets', (Number(balanceSheet.assets.total) || 0).toFixed(2)],
          ['Total Liabilities', (Number(balanceSheet.liabilities.total) || 0).toFixed(2)],
          ['Owner Equity', (Number(balanceSheet.equity.baseEquity) || 0).toFixed(2)],
          ['Current Period Earnings', (Number(balanceSheet.equity.currentEarnings) || 0).toFixed(2)],
          ['Total Liabilities & Equity', (Number(balanceSheet.liabilities.total || 0) + Number(balanceSheet.equity.total || 0)).toFixed(2)]
      ];

      generateTablePDF(`Financial Statement - ${period}`, headers, rows, `Financial_Statement_${period}`);
  };

   const handleCloseBooks = async () => {
    if (!profile) return;
    
    // FIX #3: Validate before closing
    if (!validationResult || !validationResult.is_valid) {
        toast.error("Please validate the period before closing");
        return;
    }
    
    setIsProcessing(true);
    try {
        // FIX #1 & #4: Use new validated period closing function
        const result = await accountsService.closePeriod(period, profile.id);
        
        if (result.error || !result.data?.success) {
            throw new Error(result.data?.error || result.error?.message || 'Period closing failed');
        }
        
        const closingData = result.data;
        
        // Update local state with results
        setIsClosed(true);
        
        toast.success(`Books closed for ${period}. Net Profit: ${formatCurrency(closingData.net_profit)}`);
        setShowCloseModal(false);
        setValidationResult(null);
        fetchStatements();
    } catch (e: any) {
        toast.error(`Failed to close books: ${e.message}`);
    } finally {
        setIsProcessing(false);
    }
  };

  if (loading) return <div className="p-12 text-center"><RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></div>;

  if (!pnlData || !balanceSheet) {
      return (
          <div className="p-12 text-center max-w-lg mx-auto">
              <div className="bg-red-50 border border-red-100 rounded-3xl p-10 shadow-sm">
                  <AlertCircle className="h-14 w-14 text-red-600 mx-auto mb-6" />
                  <h3 className="text-xl font-bold text-red-900 mb-2">Statement Load Failure</h3>
                  <p className="text-sm text-red-700 mb-8 leading-relaxed">Financial records for <strong>{period}</strong> could not be retrieved. This may be due to a connection issue or missing accounting records for this period.</p>
                  <button 
                    onClick={fetchStatements}
                    className="inline-flex items-center px-8 py-3.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-95"
                  >
                      <RefreshCw className="h-4 w-4 mr-2" /> Retry Fetching
                  </button>
              </div>
          </div>
      );
  }

  // Real Solvency Check: Assets = Liabilities + Equity
  const totalAssets = balanceSheet.assets.total;
  const totalLiabilitiesAndEquity = balanceSheet.liabilities.total + balanceSheet.equity.total;
  const isSolvent = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Financial Statements</h1>
            <p className="text-sm text-gray-500">Accrual-based institutional performance reporting.</p>
        </div>
        <div className="flex gap-3">
            <div className="relative">
                <input 
                    type="month" 
                    className={`border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 ${isClosed ? 'border-green-300 bg-green-50' : 'border-gray-300'}`}
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                />
                {isClosed && (
                    <div className="absolute -top-2 -right-2 bg-green-600 text-white p-1 rounded-full shadow-sm">
                        <Lock className="h-3 w-3" />
                    </div>
                )}
            </div>
            
            {isCEO && !isClosed && (
                <button 
                    onClick={() => setShowCloseModal(true)}
                    className="inline-flex items-center px-4 py-2 bg-indigo-900 text-white rounded-xl text-sm font-bold hover:bg-indigo-800 transition-all shadow-lg shadow-indigo-200"
                >
                    <Lock className="h-4 w-4 mr-2" /> Close Books
                </button>
            )}

            <button 
                onClick={handleDownload}
                className="p-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all"
                title="Download PDF"
            >
                <Download className="h-5 w-5 text-gray-600" />
            </button>

            <button 
                onClick={toggleTrialBalance}
                className={`p-2 border rounded-xl transition-all ${showTrialBalance ? 'bg-indigo-100 border-indigo-300' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                title="Trial Balance"
            >
                <Calculator className="h-5 w-5 text-gray-600" />
            </button>

            <button 
                onClick={togglePortfolioAging}
                className={`p-2 border rounded-xl transition-all ${showPortfolioAging ? 'bg-amber-100 border-amber-300' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                title="Portfolio Aging"
            >
                <Clock className="h-5 w-5 text-gray-600" />
            </button>

            <button onClick={() => window.print()} className="p-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all">
                <Printer className="h-5 w-5 text-gray-600" />
            </button>
        </div>
      </div>

      {isClosed && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center shadow-sm print:hidden">
              <CheckCircle2 className="h-5 w-5 text-green-600 mr-3" />
              <p className="text-sm text-green-800 font-medium">
                  This period is <strong>Closed & Verified</strong>. Financial records for {period} are locked for audit integrity.
              </p>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="font-bold text-gray-900 flex items-center">
                      <TrendingUp className="h-4 w-4 mr-2 text-green-600" />
                      Income Statement (P&L)
                  </h3>
                  <p className="text-[10px] text-gray-400 uppercase font-bold mt-1">For the period: {period}</p>
              </div>
              <div className="p-6 space-y-6">
                  <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Revenue</h4>
                      <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Interest Income</span>
                              <span className="font-medium text-gray-900 truncate ml-4">{formatCurrency(pnlData.interestIncome)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Penalty & Late Fees</span>
                              <span className="font-medium text-gray-900 truncate ml-4">{formatCurrency(pnlData.penaltyIncome)}</span>
                          </div>
                          <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-100">
                              <span>Total Operating Revenue</span>
                              <span className="text-indigo-600 truncate ml-4">{formatCurrency(pnlData.totalRevenue)}</span>
                          </div>
                      </div>
                  </div>

                  <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Operating Expenses</h4>
                      <div className="space-y-2">
                          {Object.entries(pnlData.expenseCategories).map(([cat, amt]: any) => (
                              <div key={cat} className="flex justify-between text-sm">
                                  <span className="text-gray-600">{cat}</span>
                                  <span className="font-medium text-red-600 truncate ml-4">({formatCurrency(amt)})</span>
                              </div>
                          ))}
                          {Object.keys(pnlData.expenseCategories).length === 0 && (
                              <p className="text-xs text-gray-400 italic">No expenses recorded for this period.</p>
                          )}
                          <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-100">
                              <span>Total Operating Expenses</span>
                              <span className="text-red-600 truncate ml-4">({formatCurrency(pnlData.totalExpenses)})</span>
                          </div>
                      </div>
                  </div>

                  <div className="pt-4 border-t-2 border-gray-900">
                      <div className="flex justify-between items-center">
                          <span className="text-base font-bold text-gray-900">Net Operating Profit</span>
                          <span className={`text-lg sm:text-xl font-bold truncate ml-4 ${pnlData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(pnlData.netProfit)}
                          </span>
                      </div>
                  </div>
              </div>
          </div>

          <div className="bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="font-bold text-gray-900 flex items-center">
                      <Scale className="h-4 w-4 mr-2 text-indigo-600" />
                      Balance Sheet
                  </h3>
                  <p className="text-[10px] text-gray-400 uppercase font-bold mt-1">
                      As of {isClosed ? new Date(period + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString()}
                  </p>
              </div>
              <div className="p-6 space-y-8">
                  <div>
                      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-3 border-b pb-1">Assets</h4>
                      <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Cash & Bank Balances</span>
                              <span className="font-medium text-gray-900 truncate ml-4">{formatCurrency(balanceSheet.assets.cash_and_equivalents || balanceSheet.assets.cash || 0)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Loan Portfolio (Principal)</span>
                              <span className="font-medium text-gray-900 truncate ml-4">{formatCurrency(balanceSheet.assets.receivables)}</span>
                          </div>
                          {balanceSheet.assets.other_assets > 0 && (
                              <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Other Assets</span>
                                  <span className="font-medium text-gray-900 truncate ml-4">{formatCurrency(balanceSheet.assets.other_assets)}</span>
                              </div>
                          )}
                          <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-100">
                              <span>Total Assets</span>
                              <span className="text-indigo-600 truncate ml-4">{formatCurrency(balanceSheet.assets.total)}</span>
                          </div>
                      </div>
                  </div>

                  <div>
                      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-3 border-b pb-1">Liabilities & Equity</h4>
                      <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Institutional Liabilities</span>
                              <span className="font-medium text-gray-900 truncate ml-4">{formatCurrency(balanceSheet.liabilities.total)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Owner's Equity / Capital</span>
                              <span className="font-medium text-gray-900 truncate ml-4">{formatCurrency(balanceSheet.equity.baseEquity)}</span>
                          </div>
                          {!isClosed && (
                              <div className="flex justify-between text-sm italic">
                                  <span className="text-gray-500">Current Period Earnings</span>
                                  <span className={`font-medium truncate ml-4 ${balanceSheet.equity.currentEarnings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {formatCurrency(balanceSheet.equity.currentEarnings)}
                                  </span>
                              </div>
                          )}
                          <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-100">
                              <span>Total Liabilities & Equity</span>
                              <span className="text-indigo-600 truncate ml-4">{formatCurrency(balanceSheet.liabilities.total + balanceSheet.equity.total)}</span>
                          </div>
                      </div>
                  </div>

                  <div className={`p-4 rounded-xl border ${isSolvent ? 'bg-indigo-50 border-indigo-100' : 'bg-red-50 border-red-100'}`}>
                      <div className="flex items-center justify-between">
                          <div className="flex items-center">
                              <PieIcon className={`h-4 w-4 mr-2 ${isSolvent ? 'text-indigo-600' : 'text-red-600'}`} />
                              <span className={`text-xs font-bold ${isSolvent ? 'text-indigo-900' : 'text-red-900'}`}>Solvency Check</span>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${isSolvent ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                              {isSolvent ? 'Balanced' : 'Imbalance Detected'}
                          </span>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* Trial Balance Section */}
      {showTrialBalance && (
        <div className="bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center">
              <Calculator className="h-4 w-4 mr-2 text-indigo-600" />
              Trial Balance
            </h3>
            <button 
              onClick={loadTrialBalance}
              disabled={isTrialBalanceLoading}
              className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
            >
              {isTrialBalanceLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          
          {isTrialBalanceLoading ? (
            <div className="p-8 text-center">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600" />
              <p className="text-sm text-gray-500 mt-2">Loading trial balance...</p>
            </div>
          ) : trialBalanceData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Account Code</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Account Name</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Debit</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {trialBalanceData.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-xs text-gray-600">{row.account_code}</td>
                      <td className="px-4 py-2 text-gray-900">{row.account_name}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-900">
                        {row.debit > 0 ? formatCurrency(row.debit) : ''}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-gray-900">
                        {row.credit > 0 ? formatCurrency(row.credit) : ''}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                    <td className="px-4 py-3" colSpan={2}>TOTAL</td>
                    <td className="px-4 py-3 text-right text-indigo-600">
                      {formatCurrency(trialBalanceData.reduce((s: number, r: any) => s + (r.debit || 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-indigo-600">
                      {formatCurrency(trialBalanceData.reduce((s: number, r: any) => s + (r.credit || 0), 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              No trial balance data available for this period.
            </div>
          )}
        </div>
      )}

      {/* Portfolio Aging Section */}
      {showPortfolioAging && (
        <div className="bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center">
              <Clock className="h-4 w-4 mr-2 text-amber-600" />
              Loan Portfolio Aging
            </h3>
            <button 
              onClick={loadPortfolioAging}
              disabled={isPortfolioAgingLoading}
              className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
            >
              {isPortfolioAgingLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          
          {isPortfolioAgingLoading ? (
            <div className="p-8 text-center">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-amber-600" />
              <p className="text-sm text-gray-500 mt-2">Loading portfolio aging...</p>
            </div>
          ) : portfolioAgingData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Aging Bucket</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Loans</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Principal</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Interest</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Total Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {portfolioAgingData.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{row.aging_bucket}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{row.loan_count}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900">{formatCurrency(row.total_principal)}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900">{formatCurrency(row.total_interest)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">{formatCurrency(row.total_outstanding)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                    <td className="px-4 py-3">TOTAL</td>
                    <td className="px-4 py-3 text-right">{portfolioAgingData.reduce((s: number, r: any) => s + (r.loan_count || 0), 0)}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{formatCurrency(portfolioAgingData.reduce((s: number, r: any) => s + (r.total_principal || 0), 0))}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{formatCurrency(portfolioAgingData.reduce((s: number, r: any) => s + (r.total_interest || 0), 0))}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{formatCurrency(portfolioAgingData.reduce((s: number, r: any) => s + (r.total_outstanding || 0), 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              No loan portfolio data available.
            </div>
          )}
        </div>
      )}

      {showCloseModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="px-8 py-6 border-b border-gray-100 bg-gray-50 rounded-t-3xl flex items-center justify-between">
                      <div>
                          <h2 className="text-xl font-bold text-gray-900 flex items-center">
                              <Lock className="h-5 w-5 mr-2 text-indigo-600" />
                              Close Books for {period}
                          </h2>
                          <p className="text-xs text-gray-500 mt-1">Period end closing with validation</p>
                      </div>
                      <button onClick={() => { setShowCloseModal(false); setValidationResult(null); }} className="p-2 hover:bg-gray-200 rounded-xl transition-all">
                          <X className="h-5 w-5 text-gray-600" />
                      </button>
                  </div>
                  <div className="p-8 space-y-6">
                      {/* Validation Section */}
                      <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                          <div className="flex items-center justify-between mb-3">
                              <h3 className="text-sm font-bold text-blue-900 flex items-center">
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Period Validation
                              </h3>
                              <button 
                                onClick={handleValidatePeriod}
                                disabled={isValidationLoading}
                                className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-all"
                              >
                                  {isValidationLoading ? 'Validating...' : 'Validate'}
                              </button>
                          </div>
                          
                          {validationResult && (
                              <div className={`p-3 rounded-xl ${validationResult.is_valid ? 'bg-green-100 border border-green-200' : 'bg-red-100 border border-red-200'}`}>
                                  <p className={`text-xs font-medium ${validationResult.is_valid ? 'text-green-800' : 'text-red-800'}`}>
                                      {validationResult.is_valid ? '✓ Period is valid for closing' : `✗ ${validationResult.error_message}`}
                                  </p>
                                  {validationResult.details && !validationResult.is_valid && (
                                      <div className="mt-2 text-xs text-red-700 space-y-1">
                                          {validationResult.details.unposted_count > 0 && (
                                              <p>Unposted entries: {validationResult.details.unposted_count}</p>
                                          )}
                                          {validationResult.details.difference !== undefined && (
                                              <p>Accounting difference: {formatCurrency(validationResult.details.difference)}</p>
                                          )}
                                      </div>
                                  )}
                              </div>
                          )}
                      </div>

                      <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start">
                          <AlertCircle className="h-5 w-5 text-amber-600 mr-3 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700 leading-relaxed">
                              Closing the books for <strong>{period}</strong> will lock all transactions for this month. This action is permanent and ensures audit integrity.
                          </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 min-w-0">
                              <p className="text-[10px] text-gray-400 uppercase font-bold truncate">Net Profit</p>
                              <p className={`text-sm font-bold truncate ${pnlData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatCurrency(pnlData.netProfit)}
                              </p>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 min-w-0">
                              <p className="text-[10px] text-gray-400 uppercase font-bold truncate">Total Assets</p>
                              <p className="text-sm font-bold text-indigo-600 truncate">{formatCurrency(balanceSheet.assets.total)}</p>
                          </div>
                       </div>

                       <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Retained Earnings Account</label>
                          <select 
                            required 
                            className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                            value={targetEquityId}
                            onChange={e => setTargetEquityId(e.target.value)}
                          >
                              <option value="">-- Select Retained Earnings --</option>
                              {equityAccounts.map(acc => (
                                  <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</option>
                              ))}
                          </select>
                       </div>

                      <div className="pt-4">
                          <button 
                            onClick={handleCloseBooks} 
                            disabled={isProcessing || !targetEquityId || !validationResult?.is_valid} 
                            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-400 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]"
                          >
                              {isProcessing ? 'Closing Period...' : 'Confirm & Close Books'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

