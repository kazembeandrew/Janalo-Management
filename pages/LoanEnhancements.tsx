import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Search, Plus, Eye, Edit2, Trash2, Shield, Users, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { collateralService, guarantorService, loanRestructureService, loanWriteOffService } from '@/services/loanEnhancements';
import { formatCurrency } from '@/utils/finance';

interface EnhancementItem {
  id: string;
  loan_id: string;
  type: 'collateral' | 'guarantor' | 'restructure' | 'write_off';
  status: string;
  amount?: number;
  description?: string;
  created_at: string;
}

const LoanEnhancements: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<EnhancementItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'collateral' | 'guarantor' | 'restructure' | 'write_off'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const enhancements: EnhancementItem[] = [];

      // Load collaterals
      const collateralResult = await collateralService.getCollaterals();
      if (collateralResult.data) {
        enhancements.push(...collateralResult.data.data.map(c => ({
          id: c.id,
          loan_id: c.loan_id,
          type: 'collateral' as const,
          status: c.status,
          amount: c.estimated_value,
          description: c.description,
          created_at: c.created_at
        })));
      }

      // Load guarantors
      const guarantorResult = await guarantorService.getGuarantors();
      if (guarantorResult.data) {
        enhancements.push(...guarantorResult.data.data.map(g => ({
          id: g.id,
          loan_id: g.loan_id,
          type: 'guarantor' as const,
          status: g.status,
          amount: g.guaranteed_amount,
          description: g.guarantor_name,
          created_at: g.created_at
        })));
      }

      // Load restructures
      const restructureResult = await loanRestructureService.getLoanRestructures();
      if (restructureResult.data) {
        enhancements.push(...restructureResult.data.data.map(r => ({
          id: r.id,
          loan_id: r.loan_id,
          type: 'restructure' as const,
          status: 'completed',
          amount: r.total_restructured_amount,
          description: r.reason,
          created_at: r.created_at
        })));
      }

      // Load write-offs
      const writeOffResult = await loanWriteOffService.getLoanWriteOffs();
      if (writeOffResult.data) {
        enhancements.push(...writeOffResult.data.data.map(w => ({
          id: w.id,
          loan_id: w.loan_id,
          type: 'write_off' as const,
          status: w.approval_status,
          amount: w.write_off_amount,
          description: w.reason,
          created_at: w.created_at
        })));
      }

      setItems(enhancements);
    } catch (error) {
      console.error('Error loading loan enhancements:', error);
      toast.error('Failed to load loan enhancements data');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => 
    item.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-12 text-center">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loan Enhancements</h1>
          <p className="text-sm text-gray-500 mt-1">Manage collateral, guarantors, restructures, write-offs, and recoveries</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add New
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search loan enhancements..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Loan ID</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full capitalize">
                      {item.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.loan_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.amount ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.amount) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      item.status === 'verified' ? 'bg-green-100 text-green-700' :
                      item.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-1 text-gray-400 hover:text-indigo-600 transition-colors">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-indigo-600 transition-colors">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredItems.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            No loan enhancements found
          </div>
        )}
      </div>
    </div>
  );
};

export default LoanEnhancements;