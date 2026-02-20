import React from 'react';
import { StatCard } from './StatCard';
import { DollarSign, TrendingUp, Receipt, Wallet, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency } from '@/utils/finance';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Bar, Legend, Line
} from 'recharts';

interface AccountantViewProps {
  stats: any;
  revenueData: any[];
  profitData: any[];
}

export const AccountantView: React.FC<AccountantViewProps> = ({ stats, revenueData, profitData }) => {
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
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

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Revenue Trend</h3>
              <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueData}>
                          <defs>
                              <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                              </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                          <Tooltip formatter={(val: number) => formatCurrency(val)} />
                          <Area type="monotone" dataKey="income" stroke="#10B981" fillOpacity={1} fill="url(#colorIncome)" />
                      </AreaChart>
                  </ResponsiveContainer>
              </div>
          </div>
      </div>
    </div>
  );
};