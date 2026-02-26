import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  Shield, 
  Calendar, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  FileText, 
  Download,
  Plus,
  Edit,
  Eye,
  Search,
  Filter,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ComplianceRequirement {
  id: string;
  requirement_name: string;
  regulatory_body: string;
  description: string;
  frequency: string;
  due_date?: string;
  status: string;
  assigned_to?: string;
  completed_by?: string;
  completion_date?: string;
  evidence_documents?: string[];
  created_at: string;
  updated_at: string;
  assigned_user?: {
    full_name: string;
    email: string;
  };
  completed_user?: {
    full_name: string;
  };
}

interface RegulatoryReport {
  id: string;
  report_name: string;
  report_type: string;
  regulatory_body: string;
  reporting_period_start: string;
  reporting_period_end: string;
  due_date: string;
  submission_date?: string;
  status: string;
  submission_reference?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator?: {
    full_name: string;
  };
}

interface PolicyDocument {
  id: string;
  title: string;
  category: string;
  version: string;
  effective_date: string;
  expiry_date?: string;
  status: string;
  content: string;
  attachments?: string[];
  reviewed_by?: string;
  approved_by?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  reviewer?: {
    full_name: string;
  };
  approver?: {
    full_name: string;
  };
  creator?: {
    full_name: string;
  };
}

export const ComplianceManagement: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [activeTab, setActiveTab] = useState<'requirements' | 'reports' | 'policies'>('requirements');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([]);
  const [reports, setReports] = useState<RegulatoryReport[]>([]);
  const [policies, setPolicies] = useState<PolicyDocument[]>([]);
  
  const [showRequirementModal, setShowRequirementModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const isAuthorized = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo') || effectiveRoles.includes('accountant');

  useEffect(() => {
    if (!isAuthorized) {
      toast.error('You are not authorized to access this page');
      return;
    }
    fetchComplianceData();
  }, [isAuthorized]);

  const fetchComplianceData = async () => {
    setLoading(true);
    try {
      const [reqRes, reportRes, policyRes] = await Promise.all([
        supabase
          .from('compliance_requirements')
          .select('*, assigned_user:profiles!compliance_requirements_assigned_to_fkey(full_name, email), completed_user:profiles!compliance_requirements_completed_by_fkey(full_name)')
          .order('due_date', { ascending: true }),
        supabase
          .from('regulatory_reports')
          .select('*, creator:profiles!regulatory_reports_created_by_fkey(full_name)')
          .order('due_date', { ascending: true }),
        supabase
          .from('policy_documents')
          .select('*, reviewer:profiles!policy_documents_reviewed_by_fkey(full_name), approver:profiles!policy_documents_approved_by_fkey(full_name), creator:profiles!policy_documents_created_by_fkey(full_name)')
          .order('created_at', { ascending: false })
      ]);

      if (reqRes.data) setRequirements(reqRes.data);
      if (reportRes.data) setReports(reportRes.data);
      if (policyRes.data) setPolicies(policyRes.data);
    } catch (error) {
      console.error('Error fetching compliance data:', error);
      toast.error('Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'in_progress': return 'text-blue-600 bg-blue-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'overdue': return 'text-red-600 bg-red-100';
      case 'cancelled': return 'text-gray-600 bg-gray-100';
      case 'generated': return 'text-purple-600 bg-purple-100';
      case 'submitted': return 'text-indigo-600 bg-indigo-100';
      case 'approved': return 'text-green-600 bg-green-100';
      case 'rejected': return 'text-red-600 bg-red-100';
      case 'published': return 'text-green-600 bg-green-100';
      case 'review': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getFrequencyColor = (frequency: string) => {
    switch (frequency) {
      case 'daily': return 'text-red-600';
      case 'weekly': return 'text-orange-600';
      case 'monthly': return 'text-yellow-600';
      case 'quarterly': return 'text-blue-600';
      case 'yearly': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const isOverdue = (dueDate?: string, status?: string) => {
    if (!dueDate || status === 'completed') return false;
    return new Date(dueDate) < new Date();
  };

  const generateReport = async (reportId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('generate_regulatory_report', { report_id: reportId });
      if (error) throw error;
      toast.success('Report generated successfully');
      fetchComplianceData();
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const submitReport = async (reportId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('regulatory_reports')
        .update({ 
          status: 'submitted', 
          submission_date: new Date().toISOString(),
          submission_reference: `SUB-${Date.now()}`
        })
        .eq('id', reportId);
      
      if (error) throw error;
      toast.success('Report submitted successfully');
      fetchComplianceData();
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error('Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  const completeRequirement = async (requirementId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('compliance_requirements')
        .update({ 
          status: 'completed',
          completed_by: profile?.id,
          completion_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', requirementId);
      
      if (error) throw error;
      toast.success('Requirement marked as completed');
      fetchComplianceData();
    } catch (error) {
      console.error('Error completing requirement:', error);
      toast.error('Failed to complete requirement');
    } finally {
      setLoading(false);
    }
  };

  const filteredRequirements = requirements.filter(req => {
    const matchesSearch = req.requirement_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         req.regulatory_body.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || req.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.report_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.regulatory_body.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || report.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const filteredPolicies = policies.filter(policy => {
    const matchesSearch = policy.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         policy.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || policy.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Management</h1>
          <p className="text-gray-600">Regulatory requirements and policy management</p>
        </div>
        <button
          onClick={fetchComplianceData}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Requirements</p>
              <p className="text-2xl font-bold text-gray-900">
                {requirements.filter(r => r.status === 'pending').length}
              </p>
            </div>
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Overdue Items</p>
              <p className="text-2xl font-bold text-gray-900">
                {requirements.filter(r => isOverdue(r.due_date, r.status)).length}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed This Month</p>
              <p className="text-2xl font-bold text-gray-900">
                {requirements.filter(r => 
                  r.status === 'completed' && 
                  r.completion_date && 
                  new Date(r.completion_date).getMonth() === new Date().getMonth()
                ).length}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Policies</p>
              <p className="text-2xl font-bold text-gray-900">
                {policies.filter(p => p.status === 'published').length}
              </p>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { id: 'requirements', name: 'Requirements', icon: Shield },
              { id: 'reports', name: 'Regulatory Reports', icon: FileText },
              { id: 'policies', name: 'Policy Documents', icon: FileText }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center px-6 py-3 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Requirements Tab */}
          {activeTab === 'requirements' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Compliance Requirements</h3>
                <button
                  onClick={() => setShowRequirementModal(true)}
                  className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Requirement
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Requirement
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Regulatory Body
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Frequency
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Assigned To
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRequirements.map((requirement) => (
                      <tr key={requirement.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{requirement.requirement_name}</p>
                            <p className="text-xs text-gray-500 truncate max-w-xs">{requirement.description}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {requirement.regulatory_body}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${getFrequencyColor(requirement.frequency)}`}>
                            {requirement.frequency}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {requirement.due_date ? new Date(requirement.due_date).toLocaleDateString() : 'N/A'}
                          {isOverdue(requirement.due_date, requirement.status) && (
                            <span className="ml-2 text-xs text-red-600 font-medium">OVERDUE</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(requirement.status)}`}>
                            {requirement.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {requirement.assigned_user?.full_name || 'Unassigned'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          {requirement.status !== 'completed' && (
                            <button
                              onClick={() => completeRequirement(requirement.id)}
                              className="text-green-600 hover:text-green-900"
                              title="Mark as completed"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedItem(requirement)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Regulatory Reports</h3>
                <button
                  onClick={() => setShowReportModal(true)}
                  className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Report
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Report Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Period
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredReports.map((report) => (
                      <tr key={report.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{report.report_name}</p>
                            <p className="text-xs text-gray-500">{report.regulatory_body}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.report_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(report.reporting_period_start).toLocaleDateString()} - {new Date(report.reporting_period_end).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(report.due_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(report.status)}`}>
                            {report.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          {report.status === 'pending' && (
                            <button
                              onClick={() => generateReport(report.id)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Generate report"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          )}
                          {report.status === 'generated' && (
                            <button
                              onClick={() => submitReport(report.id)}
                              className="text-green-600 hover:text-green-900"
                              title="Submit report"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedItem(report)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Policies Tab */}
          {activeTab === 'policies' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Policy Documents</h3>
                <button
                  onClick={() => setShowPolicyModal(true)}
                  className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Policy
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Version
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Effective Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPolicies.map((policy) => (
                      <tr key={policy.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{policy.title}</p>
                            <p className="text-xs text-gray-500">Created by {policy.creator?.full_name}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {policy.category}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {policy.version}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(policy.effective_date).toLocaleDateString()}
                          {policy.expiry_date && (
                            <p className="text-xs text-gray-500">Expires: {new Date(policy.expiry_date).toLocaleDateString()}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(policy.status)}`}>
                            {policy.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => setSelectedItem(policy)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            className="text-blue-600 hover:text-blue-900"
                            title="Download"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
