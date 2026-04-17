import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { AlertTriangle, BarChart2 } from 'lucide-react';
import { formatCurrency } from '@/utils/finance';

interface PARAgingChartProps {
    data: any[];
}

const COLORS = ['#10B981', '#F59E0B', '#F97316', '#EF4444'];
const BUCKET_LABELS: Record<string, { label: string; color: string }> = {
  'Current':    { label: 'Current',     color: '#10B981' },
  '31-60 Days': { label: '31–60 Days',  color: '#F59E0B' },
  '61-90 Days': { label: '61–90 Days',  color: '#F97316' },
  '91+ Days':   { label: '91+ Days',    color: '#EF4444' },
};

export const PARAgingChart: React.FC<PARAgingChartProps> = ({ data }) => {
    const hasData = data.some(b => b.value > 0);

    return (
        <div className="section-card p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-gray-900 font-display leading-tight">
                            Portfolio at Risk (PAR) Aging
                        </h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">Loan delinquency breakdown by aging bucket</p>
                    </div>
                </div>
            </div>

            {!hasData ? (
                /* Empty state */
                <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                        <BarChart2 className="h-7 w-7 text-emerald-500" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700">Portfolio is performing well</p>
                    <p className="text-xs text-gray-400 mt-1">No outstanding delinquent loans detected</p>
                </div>
            ) : (
                <>
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={75}
                                    paddingAngle={4}
                                    dataKey="value"
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number) => formatCurrency(value)}
                                    contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', fontSize: '12px' }}
                                />
                                <Legend
                                    iconType="circle"
                                    iconSize={8}
                                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full text-xs">
                            <thead>
                                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <th className="text-left py-2 text-[10px] font-black text-gray-400 uppercase tracking-wider">Aging Bucket</th>
                                    <th className="text-center py-2 text-[10px] font-black text-gray-400 uppercase tracking-wider">Count</th>
                                    <th className="text-right py-2 text-[10px] font-black text-gray-400 uppercase tracking-wider">Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((bucket, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                                        <td className="py-2.5 font-semibold text-gray-700 flex items-center gap-2">
                                            <div
                                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                                style={{ backgroundColor: COLORS[idx] }}
                                            />
                                            {BUCKET_LABELS[bucket.range]?.label ?? bucket.range}
                                        </td>
                                        <td className="text-center py-2.5 text-gray-500 font-medium">{bucket.count}</td>
                                        <td className="text-right py-2.5 font-bold text-gray-900">{formatCurrency(bucket.value)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
};