import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/utils/finance';
import { 
  Users, 
  MessageSquare, 
  Star, 
  Heart, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Search,
  Filter,
  Send,
  Mail,
  Phone,
  Award,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CommunicationTemplate {
  id: string;
  template_name: string;
  template_type: string;
  subject?: string;
  content: string;
  variables: string[];
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator?: {
    full_name: string;
  };
}

interface SatisfactionSurvey {
  id: string;
  borrower_id: string;
  loan_id: string;
  survey_type: string;
  rating: number;
  feedback?: string;
  survey_date: string;
  created_at: string;
  borrower?: {
    full_name: string;
  };
  loan?: {
    reference_no: string;
  };
}

interface ReferralProgram {
  id: string;
  referrer_id: string;
  referred_id: string;
  referral_date: string;
  status: string;
  reward_amount?: number;
  reward_paid: boolean;
  notes?: string;
  created_at: string;
  referrer?: {
    full_name: string;
  };
  referred?: {
    full_name: string;
  };
}

interface CustomerSegment {
  id: string;
  segment_name: string;
  segment_criteria: any;
  description?: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator?: {
    full_name: string;
  };
}

export const CustomerRelationshipManagement: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [activeTab, setActiveTab] = useState<'templates' | 'surveys' | 'referrals' | 'segments'>('templates');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [surveys, setSurveys] = useState<SatisfactionSurvey[]>([]);
  const [referrals, setReferrals] = useState<ReferralProgram[]>([]);
  const [segments, setSegments] = useState<CustomerSegment[]>([]);
  
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  const [newTemplate, setNewTemplate] = useState({
    template_name: '',
    template_type: 'sms',
    subject: '',
    content: '',
    variables: [] as string[],
    is_active: true
  });
  
  const [newSegment, setNewSegment] = useState({
    segment_name: '',
    segment_criteria: {},
    description: '',
    is_active: true
  });

  const isAuthorized = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo') || effectiveRoles.includes('loan_officer');

  useEffect(() => {
    if (!isAuthorized) {
      toast.error('You are not authorized to access this page');
      return;
    }
    fetchCRMData();
  }, [isAuthorized]);

  const fetchCRMData = async () => {
    setLoading(true);
    try {
      const [templatesRes, surveysRes, referralsRes, segmentsRes] = await Promise.all([
        supabase
          .from('communication_templates')
          .select('*, creator:profiles!communication_templates_created_by_fkey(full_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('satisfaction_surveys')
          .select('*, borrower:borrowers!satisfaction_surveys_borrower_id_fkey(full_name), loan:loans!satisfaction_surveys_loan_id_fkey(reference_no)')
          .order('survey_date', { ascending: false })
          .limit(50),
        supabase
          .from('referral_program')
          .select('*, referrer:borrowers!referral_program_referrer_id_fkey(full_name), referred:borrowers!referral_program_referred_id_fkey(full_name)')
          .order('referral_date', { ascending: false }),
        supabase
          .from('customer_segments')
          .select('*, creator:profiles!customer_segments_created_by_fkey(full_name)')
          .order('created_at', { ascending: false })
      ]);

      if (templatesRes.data) setTemplates(templatesRes.data);
      if (surveysRes.data) setSurveys(surveysRes.data);
      if (referralsRes.data) setReferrals(referralsRes.data);
      if (segmentsRes.data) setSegments(segmentsRes.data);
    } catch (error) {
      console.error('Error fetching CRM data:', error);
      toast.error('Failed to load CRM data');
    } finally {
      setLoading(false);
    }
  };

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
      />
    ));
  };

  const getTemplateTypeColor = (type: string) => {
    switch (type) {
      case 'sms': return 'text-blue-600 bg-blue-100';
      case 'email': return 'text-purple-600 bg-purple-100';
      case 'whatsapp': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSurveyTypeColor = (type: string) => {
    switch (type) {
      case 'service_quality': return 'text-blue-600 bg-blue-100';
      case 'loan_process': return 'text-green-600 bg-green-100';
      case 'customer_support': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getReferralStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'approved': return 'text-blue-600 bg-blue-100';
      case 'rejected': return 'text-red-600 bg-red-100';
      case 'completed': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const createTemplate = async () => {
    try {
      const { error } = await supabase
        .from('communication_templates')
        .insert({
          ...newTemplate,
          created_by: profile?.id
        });

      if (error) throw error;
      
      toast.success('Communication template created successfully');
      setNewTemplate({
        template_name: '',
        template_type: 'sms',
        subject: '',
        content: '',
        variables: [],
        is_active: true
      });
      setShowTemplateModal(false);
      fetchCRMData();
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error('Failed to create template');
    }
  };

  const createSegment = async () => {
    try {
      const { error } = await supabase
        .from('customer_segments')
        .insert({
          ...newSegment,
          created_by: profile?.id
        });

      if (error) throw error;
      
      toast.success('Customer segment created successfully');
      setNewSegment({
        segment_name: '',
        segment_criteria: {},
        description: '',
        is_active: true
      });
      setShowSegmentModal(false);
      fetchCRMData();
    } catch (error) {
      console.error('Error creating segment:', error);
      toast.error('Failed to create segment');
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('communication_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      
      toast.success('Template deleted successfully');
      fetchCRMData();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const payReferralReward = async (referralId: string) => {
    try {
      const { error } = await supabase
        .from('referral_program')
        .update({ reward_paid: true })
        .eq('id', referralId);

      if (error) throw error;
      
      toast.success('Referral reward marked as paid');
      fetchCRMData();
    } catch (error) {
      console.error('Error paying referral reward:', error);
      toast.error('Failed to pay referral reward');
    }
  };

  const calculateAverageRating = () => {
    if (surveys.length === 0) return 0;
    return surveys.reduce((sum, survey) => sum + survey.rating, 0) / surveys.length;
  };

  const calculateTotalReferralRewards = () => {
    return referrals.reduce((sum, referral) => sum + (referral.reward_amount || 0), 0);
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.template_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'active' && template.is_active) ||
                         (filterStatus === 'inactive' && !template.is_active);
    return matchesSearch && matchesFilter;
  });

  const filteredSurveys = surveys.filter(survey => {
    const matchesSearch = survey.borrower?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         survey.loan?.reference_no?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'high' && survey.rating >= 4) ||
                         (filterStatus === 'medium' && survey.rating === 3) ||
                         (filterStatus === 'low' && survey.rating <= 2);
    return matchesSearch && matchesFilter;
  });

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
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
          <h1 className="text-2xl font-bold text-gray-900">Customer Relationship Management</h1>
          <p className="text-gray-600">Customer communication, satisfaction, and loyalty programs</p>
        </div>
        <button
          onClick={fetchCRMData}
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
              <p className="text-sm text-gray-600">Communication Templates</p>
              <p className="text-2xl font-bold text-gray-900">{templates.length}</p>
              <p className="text-xs text-gray-500 mt-1">
                {templates.filter(t => t.is_active).length} active
              </p>
            </div>
            <MessageSquare className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Average Satisfaction</p>
              <div className="flex items-center">
                <p className="text-2xl font-bold text-gray-900 mr-2">
                  {calculateAverageRating().toFixed(1)}
                </p>
                <div className="flex">
                  {getRatingStars(Math.round(calculateAverageRating()))}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {surveys.length} reviews
              </p>
            </div>
            <Star className="h-8 w-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Referral Program</p>
              <p className="text-2xl font-bold text-gray-900">{referrals.length}</p>
              <p className="text-xs text-gray-500 mt-1">
                {referrals.filter(r => r.status === 'completed').length} completed
              </p>
            </div>
            <Heart className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Rewards Paid</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(calculateTotalReferralRewards())}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Referral program
              </p>
            </div>
            <Award className="h-8 w-8 text-purple-600" />
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
              <option value="all">All</option>
              {activeTab === 'templates' && (
                <>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </>
              )}
              {activeTab === 'surveys' && (
                <>
                  <option value="high">High Rating (4-5)</option>
                  <option value="medium">Medium Rating (3)</option>
                  <option value="low">Low Rating (1-2)</option>
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { id: 'templates', name: 'Communication Templates', icon: MessageSquare },
              { id: 'surveys', name: 'Satisfaction Surveys', icon: Star },
              { id: 'referrals', name: 'Referral Program', icon: Heart },
              { id: 'segments', name: 'Customer Segments', icon: Users }
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
          {/* Communication Templates Tab */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Communication Templates</h3>
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Template
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTemplates.map((template) => (
                  <div key={template.id} className="bg-gray-50 rounded-lg p-6 border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">{template.template_name}</h4>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTemplateTypeColor(template.template_type)}`}>
                            {template.template_type.toUpperCase()}
                          </span>
                          {template.is_active ? (
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          ) : (
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {template.subject && (
                      <p className="text-sm text-gray-600 mb-2">
                        <strong>Subject:</strong> {template.subject}
                      </p>
                    )}
                    
                    <p className="text-gray-700 text-sm mb-3 line-clamp-3">
                      {template.content}
                    </p>
                    
                    {template.variables.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">Variables:</p>
                        <div className="flex flex-wrap gap-1">
                          {template.variables.map((variable, index) => (
                            <span key={index} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                              {variable}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>By {template.creator?.full_name}</span>
                      <div className="flex items-center space-x-2">
                        <button className="text-blue-600 hover:text-blue-800">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteTemplate(template.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Satisfaction Surveys Tab */}
          {activeTab === 'surveys' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Customer Satisfaction Surveys</h3>
              
              <div className="space-y-4">
                {filteredSurveys.map((survey) => (
                  <div key={survey.id} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="flex">
                            {getRatingStars(survey.rating)}
                          </div>
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getSurveyTypeColor(survey.survey_type)}`}>
                            {survey.survey_type.replace('_', ' ')}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                          <div>
                            <p className="text-sm text-gray-600">Customer</p>
                            <p className="text-sm font-medium text-gray-900">{survey.borrower?.full_name || 'Unknown'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Loan Reference</p>
                            <p className="text-sm font-medium text-gray-900">{survey.loan?.reference_no || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Survey Date</p>
                            <p className="text-sm font-medium text-gray-900">
                              {new Date(survey.survey_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        
                        {survey.feedback && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-sm text-gray-600 mb-1">Feedback:</p>
                            <p className="text-sm text-gray-900">{survey.feedback}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Referral Program Tab */}
          {activeTab === 'referrals' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Referral Program</h3>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Referrer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Referred
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Referral Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reward Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {referrals.map((referral) => (
                      <tr key={referral.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {referral.referrer?.full_name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {referral.referred?.full_name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(referral.referral_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getReferralStatusColor(referral.status)}`}>
                            {referral.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {referral.reward_amount ? formatCurrency(referral.reward_amount) : 'N/A'}
                          {referral.reward_paid && (
                            <span className="ml-2 text-xs text-green-600 font-medium">PAID</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {referral.status === 'completed' && referral.reward_amount && !referral.reward_paid && (
                            <button
                              onClick={() => payReferralReward(referral.id)}
                              className="text-green-600 hover:text-green-900"
                              title="Mark as paid"
                            >
                              <Award className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Customer Segments Tab */}
          {activeTab === 'segments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Customer Segments</h3>
                <button
                  onClick={() => setShowSegmentModal(true)}
                  className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Segment
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {segments.map((segment) => (
                  <div key={segment.id} className="bg-gray-50 rounded-lg p-6 border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">{segment.segment_name}</h4>
                        <div className="flex items-center space-x-2">
                          {segment.is_active ? (
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          ) : (
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          )}
                          <span className="text-xs text-gray-500">
                            {segment.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {segment.description && (
                      <p className="text-gray-700 text-sm mb-3">{segment.description}</p>
                    )}
                    
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1">Criteria:</p>
                      <pre className="text-xs bg-gray-100 p-2 rounded text-gray-700 overflow-x-auto">
                        {JSON.stringify(segment.segment_criteria, null, 2)}
                      </pre>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>By {segment.creator?.full_name}</span>
                      <div className="flex items-center space-x-2">
                        <button className="text-blue-600 hover:text-blue-800">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button className="text-red-600 hover:text-red-800">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-xl bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">New Communication Template</h3>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Trash2 className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={newTemplate.template_name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, template_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter template name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Type
                  </label>
                  <select
                    value={newTemplate.template_type}
                    onChange={(e) => setNewTemplate({ ...newTemplate, template_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject (for email)
                  </label>
                  <input
                    type="text"
                    value={newTemplate.subject}
                    onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Email subject"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content
                </label>
                <textarea
                  value={newTemplate.content}
                  onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  rows={6}
                  placeholder="Enter template content. Use variables like {borrower_name}, {loan_amount}, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Variables (comma-separated)
                </label>
                <input
                  type="text"
                  value={newTemplate.variables.join(', ')}
                  onChange={(e) => setNewTemplate({ 
                    ...newTemplate, 
                    variables: e.target.value.split(',').map(v => v.trim()).filter(v => v)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="borrower_name, loan_amount, due_date"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  checked={newTemplate.is_active}
                  onChange={(e) => setNewTemplate({ ...newTemplate, is_active: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="active" className="ml-2 text-sm text-gray-700">
                  Active
                </label>
              </div>

              <div className="flex items-center justify-end space-x-4 pt-4 border-t">
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createTemplate}
                  disabled={!newTemplate.template_name || !newTemplate.content}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Create Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
