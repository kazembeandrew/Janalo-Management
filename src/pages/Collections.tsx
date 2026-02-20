import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Loan } from '@/types';
import { formatCurrency } from '@/utils/finance';
import { Calendar, Phone, Mail, CheckCircle, AlertCircle, Clock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Collections: React.FC = () => {
  const { profile } = useAuth();
  const [upcomingLoans, setUpcomingLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUpcomingPayments();
  }, [profile]);

  const fetchUpcomingPayments = async () => {
    if (!profile) return;
    setLoading(true);
    
    try {
      // Fetch active loans assigned to this officer
      let query = supabase
        .from('loans')
        .select('*, borrowers(*)')
        .eq('status', 'active');

      if (profile.role === 'loan_officer') {
        query = query.eq('officer_id', profile.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      setUpcomingLoans(data || []);
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
                  <p className="text-xs text-gray-500 uppercase font-bold">Due This Week</p>
                  <p className="text-xl font-bold text-gray-900">{upcomingLoans.length}</p>
              </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex items-center">
              <div className="p-2 bg-red-50 rounded-lg mr-3">
                  <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Overdue</p>
                  <p className="text-xl font-bold text-gray-900">0</p>
              </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex items-center">
              <div className="p-2 bg-green-50 rounded-lg mr-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Collected (MTD)</p>
                  <p className="text-xl font-bold text-gray-900">MK 0.00</p>
              </div>
          </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
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
              <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">No upcoming payments found.</td></tr>
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