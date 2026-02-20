import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Loan } from '@/types';
import { formatCurrency } from '@/utils/finance';
import { Calendar, Phone, Mail, CheckCircle, AlertCircle, Clock, ChevronRight, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Collections: React.FC = () => {
  const { profile } = useAuth();
  const [upcomingLoans, setUpcomingLoans] = useState<Loan[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [mtdCollected, setMtdCollected] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCollectionData();
  }, [profile]);

  const fetchCollectionData = async () => {
    if (!profile) return;
    setLoading(true);
    
    try {
      // 1. Fetch active loans
      let query = supabase
        .from('loans')
        .select('*, borrowers(*)')
        .eq('status', 'active');

      if (profile.role === 'loan_officer') {
        query = query.eq('officer_id', profile.id);
      }

      const { data: loans, error } = await query;
      if (error) throw error;

      // 2. Identify Overdue (Simple logic: last update > 30 days ago)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const overdue = loans?.filter(l => new Date(l.updated_at) < thirtyDaysAgo) || [];
      setOverdueCount(overdue.length);
      setUpcomingLoans(loans || []);

      // 3. Fetch MTD Collections
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0,0,0,0);

      let repayQuery = supabase
        .from('repayments')
        .select('amount_paid')
        .gte('payment_date', startOfMonth.toISOString().split('T')[0]);
      
      if (profile.role === 'loan_officer') {
          repayQuery = repayQuery.eq('recorded_by', profile.id);
      }

      const { data: repayments } = await repayQuery;
      const total = repayments?.reduce((sum, r) => sum + Number(r.amount_paid), 0) || 0;
      setMtdCollected(total);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Collections Dashboard</h1>
        <p className="text-sm text-gray-500">Manage upcoming and overdue payments for your portfolio.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex items-center">
              <div className="p-2 bg-blue-50 rounded-lg mr-3">
                  <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Active Portfolio</p>
                  <p className="text-xl font-bold text-gray-900">{upcomingLoans.length}</p>
              </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex items-center">
              <div className="p-2 bg-red-50 rounded-lg mr-3">
                  <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Overdue (30d+)</p>
                  <p className="text-xl font-bold text-gray-900">{overdueCount}</p>
              </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex items-center">
              <div className="p-2 bg-green-50 rounded-lg mr-3">
                  <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Collected (MTD)</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(mtdCollected)}</p>
              </div>
          </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-gray-900">Active Repayment Tracking</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Borrower</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Installment</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Outstanding</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-4 text-center">Loading...</td></tr>
            ) : upcomingLoans.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">No active loans found.</td></tr>
            ) : (
              upcomingLoans.map(loan => (
                <tr key={loan.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{loan.borrowers?.full_name}</div>
                    <div className="text-xs text-gray-500 flex items-center mt-1">
                        <Phone className="h-3 w-3 mr-1" /> {loan.borrowers?.phone}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
                    {formatCurrency(loan.monthly_installment)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatCurrency(loan.principal_outstanding + loan.interest_outstanding)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link 
                        to={`/loans/${loan.id}`}
                        className="inline-flex items-center px-3 py-1 text-indigo-600 hover:text-indigo-900 font-medium"
                    >
                        View Details <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};