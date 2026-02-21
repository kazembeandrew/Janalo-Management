import React, { useState } from 'react';
import { StatCard } from './StatCard';
import { DollarSign, TrendingUp, Receipt, Wallet, Activity, Sparkles, RefreshCw, Calendar } from 'lucide-react';
import { formatCurrency } from '@/utils/finance';
import { predictCashFlow } from '@/services/aiService';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Bar, Legend, Line
} from 'recharts';

interface AccountantViewProps {
  stats: any;
  revenueData: any[];
  profitData: any[];
  loanData?: any[];
}

export const AccountantView: React.FC<AccountantViewProps> = ({ stats, revenueData, profitData, loanData = [] }) => {
  const [forecast, setForecast] = useState<any>(null);
  const [isForecasting, setIsForecasting] = useState(false);

  const generateForecast = async () => {
      setIsForecasting(true);
      const result = await predictCashFlow(loanData);
      setForecast(result);
      setIsForecasting(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Portfolio" 
          value={formatCurrency(stats.totalPortfolio)} 
          subtitle="Principal + Interest"
          icon={DollarSign}
          color="bg-indigo-600"
        />
        <StatCard 
          title="Interest Earned"
          value={formatCurrency(stats.interestEarned)} 
          subtitle="Realized Income"
          icon={TrendingUp}
          color="bg-emerald-500"
        />
        <StatCard 
          title="Active Principal" 
          value={formatCurrency(stats.totalPrincipalOutstanding)} 
          subtitle="Capital in Field"
          icon={Wallet}
          color="bg-blue-500"
        />
        <StatCard 
          title="Recovery Rate" 
          value={`${stats.recoveryRate.toFixed(1)}%`} 
          subtitle="Collection Efficiency"
          icon={Activity}
          color="bg-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Profitability (Income vs Expense)</h3>
              <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={profitData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                          <Tooltip formatter={(val: number) => formatCurrency(val)} />
                          <Legend />
                          <Bar dataKey="income" fill="#10B981" name="Income" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="expense" fill="#EF4444" name="Expense" radius={[4, 4, 0, 0]} />
                          <Line type="monotone" dataKey="profit" stroke="#4F46E5" strokeWidth={3} name="Net Profit" />
                      </ComposedChart>
                  </ResponsiveContainer>
              </div>
          </div>

          <div className="bg-indigo-900 rounded-xl p-6 text-white shadow-lg flex flex-col">
              <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                      <Sparkles className="h-5 w-5 text-indigo-300 mr-2" />
                      <h3 className="font-bold">Cash Flow Forecast</h3>
                  </div>
                  <button 
                    onClick={generateForecast}
                    disabled={isForecasting}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                      {isForecasting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                  </button>
              </div>

              {forecast ? (
                  <div className="flex-1 space-y-4">
                      <div className="grid grid-cols-3 gap-2">
                          <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                              <p className="text-[10px] text-indigo-300 uppercase font-bold">Month 1</p>
                              <p className="text-sm font-bold">{formatCurrency(forecast.month1)}</p>
                          </div>
                          <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                              <p className="text-[10px] text-indigo-300 uppercase font-bold">Month 2</p>
                              <p className="text-sm font-bold">{formatCurrency(forecast.month2)}</p>
                          </div>
                          <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                              <p className="text-[10px] text-indigo-300 uppercase font-bold">Month 3</p>
                              <p className="text-sm font-bold">{formatCurrency(forecast.month3)}</p>
                          </div>
                      </div>
                      <div className="bg-indigo-800/50 p-4 rounded-lg border border-indigo-700/50">
                          <p className="text-xs leading-relaxed text-indigo-100 italic">"{forecast.summary}"</p>
                      </div>
                  </div>
              ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-white/20 rounded-xl">
                      <p className="text-sm text-indigo-200/70">Generate an AI prediction of expected collections for the next 90 days.</p>
                      <button 
                        onClick={generateForecast}
                        className="mt-4 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-lg transition-all"
                      >
                          Run Prediction
                      </button>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};