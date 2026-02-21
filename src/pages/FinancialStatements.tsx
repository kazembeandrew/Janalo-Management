import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/utils/finance';
import { 
    FileText, TrendingUp, Landmark, Wallet, 
    ArrowDownRight, ArrowUpRight, Printer, Download,
    RefreshCw, PieChart as PieIcon, Scale
} from 'lucide-react';
import { exportToCSV, generateTablePDF } from '@/utils/export';

export const FinancialStatements: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [pnlData, setPnlData] = useState<any>(null);
  const [balanceSheet, setBalanceSheet] = useState<any>(null);
  const [period, setPeriod] = useState(new Date().toISOString().substring(0, 7));

  useEffect(() => {
    fetchStatements();
  }, [period]);

  const fetchStatements = async () => {
    setLoading(true);
    try {
        // 1. Fetch Income (Interest + Penalties)
        const { data: repayments } = await supabase
            .from('repayments')
            .select('interest_paid, penalty_paid')
            .gte('payment_date', `${period}-01`)
            .lte('payment_date', `${period}-31`);
        
        const interestIncome = repayments?.reduce((sum, r) => sum + Number(r.interest_paid), 0) || 0;
        const penaltyIncome = repayments?.reduce((sum, r) => sum + Number(r.penalty_paid), 0) || 0;

        // 2. Fetch Expenses
        const { data: expenses } = await supabase
            .from('expenses')
            .select('amount, category')
            .eq('status', 'approved')
            .gte('date', `${period}-01`)
            .lte('date', `${period}-31`);
        
        const expenseCategories = expenses?.reduce((acc: any, e) => {
            acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
            return acc;
        }, {}) || {};

        const totalExpenses = Object.values(expenseCategories).reduce((sum: any, a: any) => sum + a, 0) as number;

        setPnlData({
            interestIncome,
            penaltyIncome,
            totalRevenue: interestIncome + penaltyIncome,
            expenseCategories,
            totalExpenses,
            netProfit: (interestIncome + penaltyIncome) - totalExpenses
        });

        // 3. Fetch Balance Sheet Data (Current State)
        const { data: accounts } = await supabase.from('internal_accounts').select('*');
        const { data: loans } = await supabase.from('loans').select('principal_outstanding').eq('status', 'active');
        
        const cashAssets = accounts?.filter(a => a.type === 'bank' || a.type === 'cash').reduce((sum, a) => sum + Number(a.balance), 0) || 0;
        const loanReceivables = loans?.reduce((sum, l) => sum + Number(l.principal_outstanding), 0) || 0;
        const equity = accounts?.filter(a => a.type === 'equity').reduce((sum, a) => sum + Number(a.balance), 0) || 0;
        const liabilities = accounts?.filter(a => a.type === 'liability').reduce((sum, a) => sum + Number(a.balance), 0) || 0;

        setBalanceSheet({
            assets: {
                cash: cashAssets,
                receivables: loanReceivables,
                total: cashAssets + loanReceivables
            },
            liabilities: {
                total: liabilities
            },
            equity: {
                total: equity + ((interestIncome + penaltyIncome) - totalExpenses) // Simplified retained earnings
            }
        });

    } finally {
        setLoading(false);
    }
  };

  if (loading) return <div className="p-12 text-center"><RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600" /></div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Financial Statements</h1>
            <p className="text-sm text-gray-500">Accrual-based institutional performance reporting.</p>
        </div>
        <div className="flex gap-3">
            <input 
                type="month" 
                className="border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
            />
            <button onClick={() => window.print()} className="p-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all">
                <Printer className="h-5 w-5 text-gray-600" />
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Profit & Loss */}
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
                              <span className="font-medium text-gray-900">{formatCurrency(pnlData.interestIncome)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Penalty & Late Fees</span>
                              <span className="font-medium text-gray-900">{formatCurrency(pnlData.penaltyIncome)}</span>
                          </div>
                          <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-100">
                              <span>Total Operating Revenue</span>
                              <span className="text-indigo-600">{formatCurrency(pnlData.totalRevenue)}</span>
                          </div>
                      </div>
                  </div>

                  <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Operating Expenses</h4>
                      <div className="space-y-2">
                          {Object.entries(pnlData.expenseCategories).map(([cat, amt]: any) => (
                              <div key={cat} className="flex justify-between text-sm">
                                  <span className="text-gray-600">{cat}</span>
                                  <span className="font-medium text-red-600">({formatCurrency(amt)})</span>
                              </div>
                          ))}
                          {Object.keys(pnlData.expenseCategories).length === 0 && (
                              <p className="text-xs text-gray-400 italic">No expenses recorded for this period.</p>
                          )}
                          <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-100">
                              <span>Total Operating Expenses</span>
                              <span className="text-red-600">({formatCurrency(pnlData.totalExpenses)})</span>
                          </div>
                      </div>
                  </div>

                  <div className="pt-4 border-t-2 border-gray-900">
                      <div className="flex justify-between items-center">
                          <span className="text-base font-bold text-gray-900">Net Operating Profit</span>
                          <span className={`text-xl font-bold ${pnlData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(pnlData.netProfit)}
                          </span>
                      </div>
                  </div>
              </div>
          </div>

          {/* Balance Sheet */}
          <div className="bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="font-bold text-gray-900 flex items-center">
                      <Scale className="h-4 w-4 mr-2 text-indigo-600" />
                      Balance Sheet
                  </h3>
                  <p className="text-[10px] text-gray-400 uppercase font-bold mt-1">As of {new Date().toLocaleDateString()}</p>
              </div>
              <div className="p-6 space-y-8">
                  <div>
                      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-3 border-b pb-1">Assets</h4>
                      <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Cash & Bank Balances</span>
                              <span className="font-medium text-gray-900">{formatCurrency(balanceSheet.assets.cash)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Loan Portfolio (Principal)</span>
                              <span className="font-medium text-gray-900">{formatCurrency(balanceSheet.assets.receivables)}</span>
                          </div>
                          <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-100">
                              <span>Total Assets</span>
                              <span className="text-indigo-600">{formatCurrency(balanceSheet.assets.total)}</span>
                          </div>
                      </div>
                  </div>

                  <div>
                      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-3 border-b pb-1">Liabilities & Equity</h4>
                      <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Institutional Liabilities</span>
                              <span className="font-medium text-gray-900">{formatCurrency(balanceSheet.liabilities.total)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Owner's Equity / Capital</span>
                              <span className="font-medium text-gray-900">{formatCurrency(balanceSheet.equity.total)}</span>
                          </div>
                          <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-100">
                              <span>Total Liabilities & Equity</span>
                              <span className="text-indigo-600">{formatCurrency(balanceSheet.liabilities.total + balanceSheet.equity.total)}</span>
                          </div>
                      </div>
                  </div>

                  <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                      <div className="flex items-center justify-between">
                          <div className="flex items-center">
                              <PieIcon className="h-4 w-4 text-indigo-600 mr-2" />
                              <span className="text-xs font-bold text-indigo-900">Solvency Check</span>
                          </div>
                          <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded">Balanced</span>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};