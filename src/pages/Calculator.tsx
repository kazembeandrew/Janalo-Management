import React, { useState, useEffect } from 'react';
import { calculateLoanDetails, formatCurrency, formatNumberWithCommas, parseFormattedNumber } from '@/utils/finance';
import { InterestType } from '@/types';
import { Calculator as CalcIcon, ArrowRight, Info, RefreshCw } from 'lucide-react';

export const Calculator: React.FC = () => {
  const [principal, setPrincipal] = useState<number>(100000);
  const [displayPrincipal, setDisplayPrincipal] = useState('100,000');
  const [rate, setRate] = useState<number>(5);
  const [months, setMonths] = useState<number>(6);
  const [type, setType] = useState<InterestType>('flat');
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    const details = calculateLoanDetails(principal, rate, months, type);
    setResults(details);
  }, [principal, rate, months, type]);

  const handlePrincipalChange = (val: string) => {
      const numeric = parseFormattedNumber(val);
      setDisplayPrincipal(formatNumberWithCommas(val));
      setPrincipal(numeric);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <CalcIcon className="h-6 w-6 mr-2 text-indigo-600" />
          Loan Calculator
        </h1>
        <p className="text-sm text-gray-500">Quickly estimate loan repayments and interest for potential clients.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inputs */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Principal Amount (MK)</label>
            <input 
              type="text" 
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={displayPrincipal}
              onChange={(e) => handlePrincipalChange(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Interest Rate (%)</label>
            <input 
              type="number" 
              step="0.1"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Term (Months)</label>
            <input 
              type="number" 
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Interest Type</label>
            <div className="flex flex-col space-y-2 mt-2">
              <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input 
                  type="radio" 
                  className="h-4 w-4 text-indigo-600" 
                  checked={type === 'flat'} 
                  onChange={() => setType('flat')} 
                />
                <div className="ml-3">
                  <span className="block text-sm font-bold text-gray-900">Flat Rate</span>
                  <span className="block text-xs text-gray-500">Interest on full principal</span>
                </div>
              </label>
              <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input 
                  type="radio" 
                  className="h-4 w-4 text-indigo-600" 
                  checked={type === 'reducing'} 
                  onChange={() => setType('reducing')} 
                />
                <div className="ml-3">
                  <span className="block text-sm font-bold text-gray-900">Reducing Balance</span>
                  <span className="block text-xs text-gray-500">Interest on remaining balance</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-indigo-900 rounded-xl p-8 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <CalcIcon className="h-32 w-32" />
            </div>
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="min-w-0">
                    <p className="text-indigo-300 text-xs font-medium uppercase tracking-wider">Monthly Installment</p>
                    <h2 className="text-2xl sm:text-3xl font-bold mt-1 truncate">{formatCurrency(results?.monthlyInstallment || 0)}</h2>
                </div>
                <div className="min-w-0">
                    <p className="text-indigo-300 text-xs font-medium uppercase tracking-wider">Total Interest</p>
                    <h2 className="text-2xl sm:text-3xl font-bold mt-1 truncate">{formatCurrency(results?.totalInterest || 0)}</h2>
                </div>
                <div className="md:col-span-2 pt-4 border-t border-indigo-800 min-w-0">
                    <p className="text-indigo-300 text-xs font-medium uppercase tracking-wider">Total Payable</p>
                    <h2 className="text-3xl sm:text-4xl font-extrabold mt-1 truncate">{formatCurrency(results?.totalPayable || 0)}</h2>
                </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-900">Amortization Schedule</h3>
                <span className="text-xs text-gray-500 italic">Estimated breakdown</span>
            </div>
            <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Principal</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Interest</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {results?.schedule.map((item: any) => (
                            <tr key={item.month} className="hover:bg-gray-50">
                                <td className="px-6 py-3 text-sm text-gray-900 font-medium">{item.month}</td>
                                <td className="px-6 py-3 text-sm text-right text-gray-500">{formatCurrency(item.principal)}</td>
                                <td className="px-6 py-3 text-sm text-right text-gray-500">{formatCurrency(item.interest)}</td>
                                <td className="px-6 py-3 text-sm text-right text-indigo-600 font-bold">{formatCurrency(item.balance)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};