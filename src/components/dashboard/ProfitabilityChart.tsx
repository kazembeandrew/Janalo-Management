import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/utils/finance';

interface ProfitabilityChartProps {
    data: any[];
}

export const ProfitabilityChart: React.FC<ProfitabilityChartProps> = ({ data }) => {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-indigo-600" />
                Profitability (Income vs Expense)
            </h3>
            <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                        <Tooltip formatter={(val: number) => formatCurrency(val)} />
                        <Legend />
                        <Bar dataKey="income" fill="#10B981" name="Income" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expense" fill="#EF4444" name="Expense" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="profit" stroke="#4F46E5" strokeWidth={3} name="Net Profit" dot={{ r: 4, fill: '#4F46E5' }} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};