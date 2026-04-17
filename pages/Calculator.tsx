import React, { useState } from 'react';
import { Calculator, DollarSign, Percent, Calendar, TrendingUp } from 'lucide-react';

const CalculatorPage: React.FC = () => {
  const [calcType, setCalcType] = useState<'loan' | 'interest' | 'repayment'>('loan');
  const [loanAmount, setLoanAmount] = useState<string>('');
  const [interestRate, setInterestRate] = useState<string>('');
  const [loanTerm, setLoanTerm] = useState<string>('');
  const [monthlyPayment, setMonthlyPayment] = useState<number>(0);
  const [totalInterest, setTotalInterest] = useState<number>(0);

  const calculateLoan = () => {
    if (!loanAmount || !interestRate || !loanTerm) return;
    
    const principal = parseFloat(loanAmount);
    const rate = parseFloat(interestRate) / 100 / 12;
    const term = parseInt(loanTerm);
    
    const monthly = (principal * rate * Math.pow(1 + rate, term)) / (Math.pow(1 + rate, term) - 1);
    const total = monthly * term;
    const interest = total - principal;
    
    setMonthlyPayment(monthly);
    setTotalInterest(interest);
  };

  const calculators = [
    {
      id: 'loan',
      name: 'Loan Calculator',
      description: 'Calculate monthly payments and total interest'
    },
    {
      id: 'interest',
      name: 'Interest Calculator',
      description: 'Calculate interest earned on savings'
    },
    {
      id: 'repayment',
      name: 'Repayment Calculator',
      description: 'Calculate loan repayment schedules'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header-title">Financial Calculator</h1>
        <p className="text-sm text-gray-500 mt-1">Calculate loans, interest, and repayments</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {calculators.map((calc) => (
          <div
            key={calc.id}
            onClick={() => setCalcType(calc.id as any)}
            className={`p-6 bg-white rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg ${
              calcType === calc.id
                ? 'border-indigo-500 shadow-lg'
                : 'border-gray-200 hover:border-indigo-300'
            }`}
          >
            <div className="flex items-center mb-4">
              <div className={`p-3 rounded-lg ${
                calcType === calc.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'
              }`}>
                <Calculator className="h-5 w-5" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{calc.name}</h3>
            <p className="text-sm text-gray-500">{calc.description}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          {calculators.find(c => c.id === calcType)?.name}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <DollarSign className="inline h-4 w-4 mr-2" />
              Loan Amount
            </label>
            <input
              type="number"
              value={loanAmount}
              onChange={(e) => setLoanAmount(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter loan amount"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Percent className="inline h-4 w-4 mr-2" />
              Interest Rate (%)
            </label>
            <input
              type="number"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter interest rate"
              step="0.1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-2" />
              Loan Term (months)
            </label>
            <input
              type="number"
              value={loanTerm}
              onChange={(e) => setLoanTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter loan term"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={calculateLoan}
              className="w-full px-6 py-3 bg-indigo-600 border border-transparent rounded-xl text-base font-bold text-white hover:bg-indigo-700 transition-all"
            >
              Calculate
            </button>
          </div>
        </div>

        {(monthlyPayment > 0 || totalInterest > 0) && (
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
              Results
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-indigo-50 rounded-lg p-4">
                <p className="text-sm text-indigo-600 font-medium mb-1">Monthly Payment</p>
                <p className="text-2xl font-bold text-indigo-900">
                  ${monthlyPayment.toFixed(2)}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600 font-medium mb-1">Total Interest</p>
                <p className="text-2xl font-bold text-green-900">
                  ${totalInterest.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalculatorPage;
