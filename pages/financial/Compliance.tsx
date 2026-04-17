import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLoans } from '@/hooks/useLoans';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { formatCurrency } from '@/utils/finance';
import toast from 'react-hot-toast';
import {
  Shield,
  Search,
  Calendar,
  Users,
  Eye,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  BarChart3,
  FileText,
  Download,
  Filter,
  Target,
  TrendingDown,
  Activity,
  FileCheck,
  AlertCircle
} from 'lucide-react';

interface ComplianceCheck {
  id: string;
  loan_reference: string;
  borrower_name: string;
  check_type: string;
  status: 'pass' | 'fail' | 'warning';
  details: string;
  risk_level: string;
  created_at: string;
}

interface ComplianceMetrics {
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warningChecks: number;
  complianceRate: number;
  highRiskLoans: number;
  overdueLoans: number;
  auditTrail: ComplianceCheck[];
}

export const Compliance: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const { loans, filteredLoans, fetchLoans } = useLoans();
  const { performSearch, searchQuery, updateSearchQuery } = useGlobalSearch();

  const [complianceData, setComplianceData] = useState<ComplianceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCheckType, setSelectedCheckType] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const isAuthorized = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo') || effectiveRoles.includes('accountant');

  useEffect(() => {
    if (isAuthorized) {
      fetchData();
    }
  }, [isAuthorized]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      await fetchLoans();
      calculateComplianceMetrics();
    } catch (error) {
      console.error('Error fetching compliance data:', error);
      toast.error('Failed to load compliance data');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateComplianceMetrics = () => {
    const auditTrail: ComplianceCheck[] = [];
    
    // Generate compliance checks for each loan
    loans.forEach(loan => {
      // Interest rate compliance check
      if (loan.interest_rate > 25) {
        auditTrail.push({
          id: `${loan.id}-interest`,
          loan_reference: loan.reference_no,
          borrower_name: loan.borrowers?.full_name || 'Unknown',
          check_type: 'Interest Rate',
          status: 'fail',
          details: `Interest rate ${loan.interest_rate}% exceeds regulatory limit of 25%`,
          risk_level: 'high',
          created_at: loan.created_at
        });
      }

      // Loan-to-value ratio check
      const ltv = (loan.principal_amount / loan.collateral_value) * 100;
      if (ltv > 80) {
        auditTrail.push({
          id: `${loan.id}-ltv`,
          loan_reference: loan.reference_no,
          borrower_name: loan.borrowers?.full_name || 'Unknown',
          check_type: 'Loan-to-Value',
          status: 'warning',
          details: `LTV ratio ${ltv.toFixed(1)}% exceeds recommended 80%`,
          risk_level: 'medium',
          created_at: loan.created_at
        });
      }

      // Documentation completeness check
      if (!loan.collateral_document || !loan.identity_document) {
        auditTrail.push({
          id: `${loan.id}-docs`,
          loan_reference: loan.reference_no,
          borrower_name: loan.borrowers?.full_name || 'Unknown',
          check_type: 'Documentation',
          status: 'fail',
          details: 'Missing required documentation',
          risk_level: 'high',
          created_at: loan.created_at
        });
      }

      // Repayment schedule compliance
      const loanAge = Math.floor((new Date().getTime() - new Date(loan.created_at).getTime()) / (1000 * 60 * 60 * 24));
      if (loan.status === 'active' && loanAge > loan.term_months * 30) {
        auditTrail.push({
          id: `${loan.id}-schedule`,
          loan_reference: loan.reference_no,
          borrower_name: loan.borrowers?.full_name || 'Unknown',
          check_type: 'Repayment Schedule',
          status: 'fail',
          details: 'Loan term exceeded without full repayment',
          risk_level: 'high',
          created_at: loan.created_at
        });
      }

      // AML/KYC check - check for high risk indicators in loan
      if (loan.risk_level === 'high') {
        auditTrail.push({
          id: `${loan.id}-aml`,
          loan_reference: loan.reference_no,
          borrower_name: loan.borrowers?.full_name || 'Unknown',
          check_type: 'AML/KYC',
          status: 'warning',
          details: 'High risk score detected',
          risk_level: 'medium',
          created_at: loan.created_at
        });
      }
    });

    // Calculate metrics
    const totalChecks = auditTrail.length;
    const passedChecks = loans.length * 5 - totalChecks; // Assuming 5 checks per loan
    const failedChecks = auditTrail.filter(c => c.status === 'fail').length;
    const warningChecks = auditTrail.filter(c => c.status === 'warning').length;
    const complianceRate = totalChecks > 0 ? ((passedChecks / (passedChecks + failedChecks + warningChecks)) * 100) : 100;
    
    const highRiskLoans = loans.filter(loan => loan.risk_level === 'high').length;
    const overdueLoans = loans.filter(loan => {
      const dueDate = new Date(loan.disbursement_date);
      dueDate.setMonth(dueDate.getMonth() + loan.term_months);
      return new Date() > dueDate && loan.status === 'active';
    }).length;

    setComplianceData({
      totalChecks,
      passedChecks,
      failedChecks,
      warningChecks,
      complianceRate,
      highRiskLoans,
      overdueLoans,
      auditTrail
    });
  };

  const getCheckStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'bg-green-100 text-green-800';
      case 'fail': return 'bg-red-100 text-red-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCheckTypeIcon = (type: string) => {
    switch (type) {
      case 'Interest Rate': return <FileCheck className="h-4 w-4" />;
      case 'Loan-to-Value': return <Target className="h-4 w-4" />;
      case 'Documentation': return <FileText className="h-4 w-4" />;
      case 'Repayment Schedule': return <Calendar className="h-4 w-4" />;
      case 'AML/KYC': return <Shield className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getRiskLevelColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-orange-100 text-orange-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Apply filters
  const filteredAuditTrail = complianceData?.auditTrail.filter(item => {
    const matchesType = selectedCheckType === 'all' || item.check_type === selectedCheckType;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesDate = (!dateFrom || item.created_at >= dateFrom) && (!dateTo || item.created_at <= dateTo);
    return matchesType && matchesStatus && matchesDate;
  }) || [];

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">You are not authorized to access this page</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="h-12 w-12 text-indigo-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading compliance data...</p>
        </div>
      </div>
    );
  }

  if (!complianceData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No compliance data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Management</h1>
          <p className="text-gray-600">Monitor regulatory compliance and risk management</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={fetchData}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Clock className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            <Download className="h-4 w-4 mr-2" />
            Export Compliance Report
          </button>
        </div>
      </div>

      {/* Compliance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Compliance Rate</p>
              <p className="text-2xl font-bold text-gray-900">{complianceData.complianceRate.toFixed(1)}%</p>
              <p className="text-xs text-gray-500 mt-1">Overall compliance score</p>
            </div>
            <Activity className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Failed Checks</p>
              <p className="text-2xl font-bold text-gray-900">{complianceData.failedChecks}</p>
              <p className="text-xs text-gray-500 mt-1">Require immediate attention</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">High Risk Loans</p>
              <p className="text-2xl font-bold text-gray-900">{complianceData.highRiskLoans}</p>
              <p className="text-xs text-gray-500 mt-1">Enhanced monitoring required</p>
            </div>
            <Target className="h-8 w-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Overdue Loans</p>
              <p className="text-2xl font-bold text-gray-900">{complianceData.overdueLoans}</p>
              <p className="text-xs text-gray-500 mt-1">Collections action needed</p>
            </div>
            <TrendingDown className="h-8 w-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by reference or borrower..."
                value={searchQuery}
                onChange={(e) => updateSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Check Type</label>
            <select
              value={selectedCheckType}
              onChange={(e) => setSelectedCheckType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Check Types</option>
              <option value="Interest Rate">Interest Rate</option>
              <option value="Loan-to-Value">Loan-to-Value</option>
              <option value="Documentation">Documentation</option>
              <option value="Repayment Schedule">Repayment Schedule</option>
              <option value="AML/KYC">AML/KYC</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="pass">Passed</option>
              <option value="fail">Failed</option>
              <option value="warning">Warning</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Compliance Audit Trail */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Compliance Audit Trail</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Loan Reference
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Borrower
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Check Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Risk Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAuditTrail.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.loan_reference}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.borrower_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getCheckTypeIcon(item.check_type)}
                      <span className="text-sm text-gray-900">{item.check_type}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCheckStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRiskLevelColor(item.risk_level)}`}>
                      {item.risk_level}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.details}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => window.location.href = `/loans/${item.loan_reference}`}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View Loan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAuditTrail.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p>No compliance issues found.</p>
          </div>
        )}
      </div>

      {/* Compliance Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Risk Distribution</h3>
            <Target className="h-5 w-5 text-orange-600" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-900">High Risk</span>
              </div>
              <span className="text-sm text-gray-600">{complianceData.highRiskLoans}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-900">Medium Risk</span>
              </div>
              <span className="text-sm text-gray-600">{loans.filter(l => l.risk_level === 'medium').length}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-900">Low Risk</span>
              </div>
              <span className="text-sm text-gray-600">{loans.filter(l => l.risk_level === 'low').length}</span>
            </div>
          </div>
        </div>

        {/* Compliance Status Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Compliance Status</h3>
            <Shield className="h-5 w-5 text-blue-600" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-900">Passed</span>
              </div>
              <span className="text-sm text-gray-600">{complianceData.passedChecks}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-900">Failed</span>
              </div>
              <span className="text-sm text-gray-600">{complianceData.failedChecks}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-900">Warning</span>
              </div>
              <span className="text-sm text-gray-600">{complianceData.warningChecks}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};