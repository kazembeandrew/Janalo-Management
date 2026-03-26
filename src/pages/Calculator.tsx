import React, { useState, useEffect } from 'react';
import { calculateLoanDetails, formatCurrency, formatNumberWithCommas, parseFormattedNumber } from '@/utils/finance';
import { InterestType } from '@/types';
import { Calculator as CalcIcon, ArrowRight, Info, RefreshCw, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  const downloadAmortizationPDF = () => {
    if (!results?.schedule) return;

    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text('Loan Amortization Schedule', 20, 20);
    
    // Add loan details
    doc.setFontSize(12);
    doc.text(`Principal Amount: ${formatCurrency(principal)}`, 20, 35);
    doc.text(`Interest Rate: ${rate}% per month`, 20, 45);
    doc.text(`Term: ${months} months`, 20, 55);
    doc.text(`Interest Type: ${type === 'flat' ? 'Flat Rate' : 'Reducing Balance'}`, 20, 65);
    doc.text(`Monthly Installment: ${formatCurrency(results.monthlyInstallment)}`, 20, 75);
    doc.text(`Total Interest: ${formatCurrency(results.totalInterest)}`, 20, 85);
    doc.text(`Total Payable: ${formatCurrency(results.totalPayable)}`, 20, 95);

    // Prepare table data
    const tableData = results.schedule.map((item: any) => [
      item.month.toString(),
      formatCurrency(item.principal),
      formatCurrency(item.interest),
      formatCurrency(item.balance)
    ]);

    // Add table
    autoTable(doc, {
      head: [['Month', 'Principal', 'Interest', 'Balance']],
      body: tableData,
      startY: 105,
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [63, 81, 181], // Indigo color
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
    });

    // Save the PDF
    doc.save(`amortization-schedule-${Date.now()}.pdf`);
  };

  const handlePrincipalChange = (val: string) => {
      const numeric = parseFormattedNumber(val);
      setDisplayPrincipal(formatNumberWithCommas(val));
      setPrincipal(numeric);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <CalcIcon className="h-6 w-6 mr-2 text-indigo-600" />
          Loan Calculator
        </h1>
        <p className="text-sm text-gray-500">Quickly estimate loan repayments and interest for potential clients.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Inputs */}
        <div className="lg:col-span-1 bg-white p-3 rounded-lg shadow-sm border border-gray-200 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Principal Amount</label>
            <input 
              type="text" 
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={displayPrincipal}
              onChange={(e) => handlePrincipalChange(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Interest Rate (%)</label>
            <input 
              type="number" 
              step="0.1"
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Term (Months)</label>
            <input 
              type="number" 
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Interest Type</label>
            <div className="flex flex-col space-y-1 mt-1">
              <label className="flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50 transition-colors">
                <input 
                  type="radio" 
                  className="h-3 w-3 text-indigo-600" 
                  checked={type === 'flat'} 
                  onChange={() => setType('flat')} 
                />
                <div className="ml-2">
                  <span className="block text-xs font-bold text-gray-900">Flat Rate</span>
                  <span className="block text-[10px] text-gray-500">Interest on full principal</span>
                </div>
              </label>
              <label className="flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50 transition-colors">
                <input 
                  type="radio" 
                  className="h-3 w-3 text-indigo-600" 
                  checked={type === 'reducing'} 
                  onChange={() => setType('reducing')} 
                />
                <div className="ml-2">
                  <span className="block text-xs font-bold text-gray-900">Reducing Balance</span>
                  <span className="block text-[10px] text-gray-500">Interest on remaining balance</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-3 min-w-0">
          <div className="bg-indigo-900 rounded-lg p-3 text-white shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10">
                <CalcIcon className="h-12 w-12" />
            </div>
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="min-w-0">
                    <p className="text-indigo-300 text-[9px] font-medium uppercase tracking-wider">Monthly</p>
                    <h2 className="text-sm sm:text-base font-bold mt-0.5 truncate">{formatCurrency(results?.monthlyInstallment || 0)}</h2>
                </div>
                <div className="min-w-0">
                    <p className="text-indigo-300 text-[9px] font-medium uppercase tracking-wider">Interest</p>
                    <h2 className="text-sm sm:text-base font-bold mt-0.5 truncate">{formatCurrency(results?.totalInterest || 0)}</h2>
                </div>
                <div className="min-w-0">
                    <p className="text-indigo-300 text-[9px] font-medium uppercase tracking-wider">Total</p>
                    <h2 className="text-base sm:text-lg font-extrabold mt-0.5 truncate">{formatCurrency(results?.totalPayable || 0)}</h2>
                </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-900 text-sm">Amortization Schedule</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={downloadAmortizationPDF}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-indigo-500 transition-colors"
                    disabled={!results?.schedule}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    PDF
                  </button>
                  <span className="text-xs text-gray-500 italic">Estimated breakdown</span>
                </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Month</th>
                            <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase">Principal</th>
                            <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase">Interest</th>
                            <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase">Balance</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {results?.schedule.map((item: any) => (
                            <tr key={item.month} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-xs text-gray-900 font-medium">{item.month}</td>
                                <td className="px-3 py-2 text-xs text-right text-gray-500">{formatCurrency(item.principal)}</td>
                                <td className="px-3 py-2 text-xs text-right text-gray-500">{formatCurrency(item.interest)}</td>
                                <td className="px-3 py-2 text-xs text-right text-indigo-600 font-bold">{formatCurrency(item.balance)}</td>
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