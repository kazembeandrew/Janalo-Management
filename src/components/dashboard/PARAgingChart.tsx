import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/utils/finance';

interface PARAgingChartProps {
    data: any[];
}

const COLORS = ['#10B981', '#F59E0B', '#F97316', '#EF4444'];

export const PARAgingChart: React.FC<PARAgingChartProps> = ({ data }) => {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
                    Portfolio At Risk (PAR) Aging
                </h3>
            </div>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-[10px]">
                    <thead>
                        <tr className="text-gray-400 border-b border-gray-50">
                            <th className="text-left py-2 font-bold uppercase tracking-wider">Aging Bucket</th>
                            <th className="text-center py-2 font-bold uppercase tracking-wider">Count</th>
                            <th className="text-right py-2 font-bold uppercase tracking-wider">Value</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {data.map((bucket, idx) => (
                            <tr key={idx}>
                                <td className="py-2 font-bold text-gray-700 flex items-center">
                                    <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: COLORS[idx] }} />
                                    {bucket.range}
                                </td>
                                <td className="text-center py-2 text-gray-500">{bucket.count}</td>
                                <td className="text-right py-2 font-bold text-gray-900">{formatCurrency(bucket.value)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};