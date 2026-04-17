import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Activity, Sparkles, RefreshCw, DollarSign, Users, AlertTriangle, Target, ShieldCheck, Landmark, Scale } from 'lucide-react';
import { analyzeFinancialData } from '@/services/aiService';
import { AccountantView } from '@/components/dashboard/AccountantView';
import { HRView } from '@/components/dashboard/HRView';
import { OfficerView } from '@/components/dashboard/OfficerView';
import { StatCard } from '@/components/dashboard/StatCard';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { OfficerLeaderboard } from '@/components/dashboard/OfficerLeaderboard';
import { RecentDocuments } from '@/components/dashboard/RecentDocuments';
import { PARAgingChart } from '@/components/dashboard/PARAgingChart';
import { ProfitabilityChart } from '@/components/dashboard/ProfitabilityChart';
import { formatCurrency } from '@/utils/finance';

export const Dashboard: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [stats, setStats] = useState({
    totalPortfolio: 0,
    totalPrincipalOutstanding: 0,
    totalInterestOutstanding: 0,
    activeLoans: 0,
    totalClients: 0,
    parCount: 0,
    interestEarned: 0,
    totalDisbursed: 0,
    recoveryRate: 0,
    completedLoans: 0,
    reassessCount: 0,
    totalLiquidity: 0,
    interestTarget: 0,
    totalEquity: 0 
  });
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [profitData, setProfitData] = useState<any[]>([]);
  const [officerStats, setOfficerStats] = useState<any[]>([]);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [parAgingData, setParAgingData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const isHR = effectiveRoles.includes('hr');
  const isAccountant = effectiveRoles.includes('accountant');
  const isExec = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo');
  const isOfficer = effectiveRoles.includes('loan_officer');

  useEffect(() => {
    fetchDashboardData();
    
    const channel = supabase.channel('dashboard-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repayments' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_accounts' }, () => fetchDashboardData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const [
          { data: rpcStats },
          { data: profitability },
          { data: offStats },
          { data: accounts },
          { data: budgetData }
      ] = await Promise.all([
           (supabase as any).rpc('get_dashboard_stats'),
           (supabase as any).rpc('get_unified_monthly_profitability', { p_months: 12 }),
           (supabase as any).rpc('get_officer_performance'),
           (supabase as any).from('internal_accounts').select('*'),
           (supabase as any).from('budgets')
             .select('*')
             .eq('month', new Date().toISOString().substring(0, 7))
             .ilike('category', '%Interest%')
             .maybeSingle()
      ]);

      const { data: loans } = await (supabase as any)
        .from('loans')
        .select('id, principal_outstanding, interest_outstanding, penalty_outstanding, monthly_installment, updated_at, status')
        .eq('status', 'active');
      
      setActiveLoans(loans || []);

      // Calculate PAR Aging
      if (loans) {
          const buckets = [
              { range: 'Current', min: 0, max: 30, value: 0, count: 0 },
              { range: '31-60 Days', min: 31, max: 60, value: 0, count: 0 },
              { range: '61-90 Days', min: 61, max: 90, value: 0, count: 0 },
              { range: '91+ Days', min: 91, max: 9999, value: 0, count: 0 }
          ];

          const now = new Date();
          loans.forEach(loan => {
              const lastUpdate = new Date(loan.updated_at);
              const diffDays = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 3600 * 24));
              const totalOutstanding = Number(loan.principal_outstanding) + Number(loan.interest_outstanding) + Number(loan.penalty_outstanding || 0);

              const bucket = buckets.find(b => diffDays >= b.min && diffDays <= b.max) || buckets[0];
              bucket.value += totalOutstanding;
              bucket.count += 1;
          });
          setParAgingData(buckets);
      }

      let reassessCount = 0;
      if (profile) {
          const { count } = await (supabase as any)
            .from('loans')
            .select('*', { count: 'exact', head: true })
            .eq('officer_id', profile.id)
            .in('status', ['reassess', 'rejected']);
          reassessCount = count || 0;
      }

      let liquidity = 0;
      let totalLiabilities = 0;
      
      if (accounts) {
          liquidity = accounts
            .filter(a => a.account_category === 'asset' && ['BANK', 'CASH', 'MOBILE'].includes(a.account_code))
            .reduce((sum, a) => sum + Number(a.balance), 0);

          totalLiabilities = accounts
            .filter(a => a.account_category === 'liability')
            .reduce((sum, a) => sum + Number(a.balance), 0);
      }

      if (rpcStats) {
        const active = rpcStats.active_count || 0;
        const completed = rpcStats.completed_count || 0;
        const totalLoans = active + completed + (rpcStats.defaulted_count || 0);
        const principalOutstanding = rpcStats.total_principal_outstanding || 0;
        const calculatedAssets = liquidity + principalOutstanding;
        
        setStats({
          totalPortfolio: principalOutstanding + (rpcStats.total_interest_outstanding || 0),
          totalPrincipalOutstanding: principalOutstanding,
          totalInterestOutstanding: rpcStats.total_interest_outstanding || 0,
          activeLoans: active,
          totalClients: rpcStats.total_clients || 0,
          parCount: rpcStats.par_count || 0,
          interestEarned: rpcStats.interest_earned || 0,
          totalDisbursed: rpcStats.total_disbursed || 0,
          recoveryRate: totalLoans > 0 ? (completed / totalLoans) * 100 : 0,
          completedLoans: completed,
          reassessCount,
          totalLiquidity: liquidity,
          interestTarget: budgetData?.amount || 0,
          totalEquity: calculatedAssets - totalLiabilities
        });
      }

      setRevenueData((profitability || []).map((d: any) => ({
          name: new Date(d.month + '-01').toLocaleDateString('en-US', { month: 'short' }),
          income: Number(d.income)
      })));

      setOfficerStats((offStats || []).map((o: any) => ({
          id: o.officer_id, name: o.officer_name, activeCount: o.active_count, portfolioValue: o.portfolio_value, atRisk: o.at_risk_count
      })));

      setProfitData((profitability || []).map((r: any) => ({
          month: r.month,
          income: Number(r.income),
          expense: Number(r.expense),
          profit: Number(r.profit)
      })));

    } finally { setLoading(false); }
  };

  const generateAIInsights = async () => {
    setIsAnalyzing(true);
    const insights = await analyzeFinancialData({ stats, revenue: revenueData, officers: officerStats });
    setAiInsights(insights);
    setIsAnalyzing(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
        <div>
          <h1 className="page-header-title">Dashboard Overview</h1>
          <p className="text-sm text-gray-400 mt-1">Welcome back, {profile?.full_name}. Data is live across all departments.</p>
        </div>
        <div className="mt-4 md:mt-0">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold" style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)',color:'#059669'}}>
            <span className="pulse-dot" style={{background:'#10b981'}} />
            Live Sync Active
          </span>
        </div>
      </div>

      {isAccountant && !isExec && <AccountantView stats={stats} revenueData={revenueData} profitData={profitData} loanData={activeLoans} />}
      {isHR && !isExec && <HRView stats={stats} officerStats={officerStats} />}
      {isOfficer && !isHR && !isAccountant && !isExec && <OfficerView stats={stats} />}
      
      {isExec && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <StatCard title="Portfolio At Risk" value={stats.parCount} icon={AlertTriangle} color="bg-red-500" subtitle="Overdue Accounts" />
              <StatCard title="Total Liquidity" value={formatCurrency(stats.totalLiquidity)} icon={Landmark} color="bg-green-600" subtitle="Cash & Bank" />
              <StatCard title="Institutional Equity" value={formatCurrency(stats.totalEquity)} icon={Scale} color="bg-purple-600" subtitle="Net Worth" />
              <StatCard title="Portfolio Value" value={formatCurrency(stats.totalPortfolio)} icon={DollarSign} color="bg-indigo-600" subtitle="Active Capital" />
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
              {isExec && <PARAgingChart data={parAgingData} />}

              <div className="glass-dark rounded-2xl p-6 md:p-8 text-white shadow-2xl relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 via-violet-600/5 to-transparent pointer-events-none" />
                <div className="relative z-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-indigo-500/20 rounded-xl mr-3 ring-1 ring-white/10">
                              <Sparkles className="h-5 w-5 text-indigo-300" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold font-display text-white">AI Financial Insights</h3>
                              <p className="text-xs animate-gradient-text font-semibold">Powered by Gemini 2.0 Flash</p>
                            </div>
                        </div>
                        <button onClick={generateAIInsights} disabled={isAnalyzing} className="inline-flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/15 disabled:bg-white/5 disabled:text-white/40 text-white rounded-xl text-sm font-bold transition-all shadow-sm">
                            {isAnalyzing ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Analyzing...</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate Insights</>}
                        </button>
                    </div>
                    {aiInsights.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {aiInsights.map((insight, idx) => (
                                <div key={idx} className="bg-white/6 hover:bg-white/10 border border-white/10 p-4 rounded-xl flex items-start transition-colors duration-200">
                                  <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-2 mr-3 shrink-0" />
                                  <p className="text-sm leading-relaxed text-indigo-50/90">{insight}</p>
                                </div>
                            ))}
                        </div>
                    ) : <div className="text-center py-10 border border-dashed border-white/15 rounded-xl bg-white/4">
                          <p className="text-indigo-200/50 text-sm">Click Generate Insights to analyse your portfolio with AI.</p>
                        </div>}
                </div>
              </div>
              
              {isExec && <HRView stats={stats} officerStats={officerStats} />}
          </div>

          <div className="space-y-6">
              {isExec && <OfficerLeaderboard officers={officerStats} />}
              {isExec && <ProfitabilityChart data={profitData} />}
          </div>
      </div>

      {/* Bottom Section for Logs and Documents */}
      {isExec && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-6 border-t border-gray-200">
              <RecentActivity />
              <RecentDocuments />
          </div>
      )}
    </div>
  );
};

