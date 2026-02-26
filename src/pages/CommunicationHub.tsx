import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  Megaphone, 
  BookOpen, 
  Calendar, 
  Users, 
  MessageSquare, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Search,
  Filter,
  Bell,
  Send,
  Clock,
  CheckCircle,
  AlertTriangle,
  Star,
  ThumbsUp,
  ThumbsDown,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  target_roles: string[];
  is_active: boolean;
  expires_at?: string;
  read_by: string[];
  created_by: string;
  created_at: string;
  creator?: {
    full_name: string;
  };
}

interface KnowledgeBase {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  is_published: boolean;
  view_count: number;
  helpful_count: number;
  created_by: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  creator?: {
    full_name: string;
  };
  updater?: {
    full_name: string;
  };
}

export const CommunicationHub: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [activeTab, setActiveTab] = useState<'announcements' | 'knowledge' | 'meetings'>('announcements');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase[]>([]);
  
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    priority: 'normal',
    target_roles: [] as string[],
    is_active: true,
    expires_at: ''
  });
  
  const [newKnowledge, setNewKnowledge] = useState({
    title: '',
    content: '',
    category: 'general',
    tags: [] as string[],
    is_published: false
  });

  const isAuthorized = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo') || effectiveRoles.includes('hr');

  useEffect(() => {
    if (!isAuthorized) {
      toast.error('You are not authorized to access this page');
      return;
    }
    fetchCommunicationData();
  }, [isAuthorized]);

  const fetchCommunicationData = async () => {
    setLoading(true);
    try {
      const [announcementsRes, knowledgeRes] = await Promise.all([
        supabase
          .from('announcements')
          .select('*, creator:profiles!announcements_created_by_fkey(full_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('knowledge_base')
          .select('*, creator:profiles!knowledge_base_created_by_fkey(full_name), updater:profiles!knowledge_base_updated_by_fkey(full_name)')
          .order('created_at', { ascending: false })
      ]);

      if (announcementsRes.data) setAnnouncements(announcementsRes.data);
      if (knowledgeRes.data) setKnowledgeBase(knowledgeRes.data);
    } catch (error) {
      console.error('Error fetching communication data:', error);
      toast.error('Failed to load communication data');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'normal': return 'text-blue-600 bg-blue-100';
      case 'low': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'policy': return 'text-purple-600 bg-purple-100';
      case 'training': return 'text-green-600 bg-green-100';
      case 'technical': return 'text-blue-600 bg-blue-100';
      case 'general': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const createAnnouncement = async () => {
    try {
      const { error } = await supabase
        .from('announcements')
        .insert({
          ...newAnnouncement,
          created_by: profile?.id,
          expires_at: newAnnouncement.expires_at ? new Date(newAnnouncement.expires_at).toISOString() : null
        });

      if (error) throw error;
      
      toast.success('Announcement created successfully');
      setNewAnnouncement({
        title: '',
        content: '',
        priority: 'normal',
        target_roles: [],
        is_active: true,
        expires_at: ''
      });
      setShowAnnouncementModal(false);
      fetchCommunicationData();
    } catch (error) {
      console.error('Error creating announcement:', error);
      toast.error('Failed to create announcement');
    }
  };

  const createKnowledgeArticle = async () => {
    try {
      const { error } = await supabase
        .from('knowledge_base')
        .insert({
          ...newKnowledge,
          created_by: profile?.id,
          updated_by: profile?.id
        });

      if (error) throw error;
      
      toast.success('Knowledge article created successfully');
      setNewKnowledge({
        title: '',
        content: '',
        category: 'general',
        tags: [],
        is_published: false
      });
      setShowKnowledgeModal(false);
      fetchCommunicationData();
    } catch (error) {
      console.error('Error creating knowledge article:', error);
      toast.error('Failed to create knowledge article');
    }
  };

  const markAnnouncementAsRead = async (announcementId: string) => {
    try {
      const announcement = announcements.find(a => a.id === announcementId);
      if (!announcement || announcement.read_by.includes(profile?.id || '')) return;

      const { error } = await supabase
        .from('announcements')
        .update({
          read_by: [...announcement.read_by, profile?.id]
        })
        .eq('id', announcementId);

      if (error) throw error;
      
      fetchCommunicationData();
    } catch (error) {
      console.error('Error marking announcement as read:', error);
    }
  };

  const rateKnowledgeArticle = async (articleId: string, helpful: boolean) => {
    try {
      const { error } = await supabase.rpc('rate_knowledge_article', { 
        article_id: articleId, 
        helpful 
      });

      if (error) throw error;
      
      toast.success('Thank you for your feedback!');
      fetchCommunicationData();
    } catch (error) {
      console.error('Error rating article:', error);
      toast.error('Failed to submit feedback');
    }
  };

  const deleteAnnouncement = async (announcementId: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', announcementId);

      if (error) throw error;
      
      toast.success('Announcement deleted successfully');
      fetchCommunicationData();
    } catch (error) {
      console.error('Error deleting announcement:', error);
      toast.error('Failed to delete announcement');
    }
  };

  const deleteKnowledgeArticle = async (articleId: string) => {
    if (!confirm('Are you sure you want to delete this knowledge article?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('knowledge_base')
        .delete()
        .eq('id', articleId);

      if (error) throw error;
      
      toast.success('Knowledge article deleted successfully');
      fetchCommunicationData();
    } catch (error) {
      console.error('Error deleting knowledge article:', error);
      toast.error('Failed to delete knowledge article');
    }
  };

  const isAnnouncementExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const filteredAnnouncements = announcements.filter(announcement => {
    const matchesSearch = announcement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         announcement.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterCategory === 'all' || announcement.priority === filterCategory;
    return matchesSearch && matchesFilter;
  });

  const filteredKnowledge = knowledgeBase.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterCategory === 'all' || article.category === filterCategory;
    return matchesSearch && matchesFilter;
  });

  const unreadCount = announcements.filter(a => 
    a.is_active && 
    !isAnnouncementExpired(a.expires_at) && 
    !a.read_by.includes(profile?.id || '')
  ).length;

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
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
          <h1 className="text-2xl font-bold text-gray-900">Communication Hub</h1>
          <p className="text-gray-600">Company announcements and knowledge base</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Bell className="h-5 w-5 text-gray-500" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"></span>
            )}
          </div>
          <button
            onClick={fetchCommunicationData}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Unread Announcements</p>
              <p className="text-2xl font-bold text-gray-900">{unreadCount}</p>
            </div>
            <Megaphone className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Knowledge Articles</p>
              <p className="text-2xl font-bold text-gray-900">{knowledgeBase.length}</p>
            </div>
            <BookOpen className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Published Articles</p>
              <p className="text-2xl font-bold text-gray-900">
                {knowledgeBase.filter(k => k.is_published).length}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Views</p>
              <p className="text-2xl font-bold text-gray-900">
                {knowledgeBase.reduce((sum, k) => sum + k.view_count, 0)}
              </p>
            </div>
            <Eye className="h-8 w-8 text-orange-600" />
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
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Categories</option>
              {activeTab === 'announcements' && (
                <>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </>
              )}
              {activeTab === 'knowledge' && (
                <>
                  <option value="policy">Policy</option>
                  <option value="training">Training</option>
                  <option value="technical">Technical</option>
                  <option value="general">General</option>
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
              { id: 'announcements', name: 'Announcements', icon: Megaphone },
              { id: 'knowledge', name: 'Knowledge Base', icon: BookOpen },
              { id: 'meetings', name: 'Meeting Scheduler', icon: Calendar }
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
                {tab.id === 'announcements' && unreadCount > 0 && (
                  <span className="ml-2 px-2 py-1 text-xs bg-red-500 text-white rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Announcements Tab */}
          {activeTab === 'announcements' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Company Announcements</h3>
                <button
                  onClick={() => setShowAnnouncementModal(true)}
                  className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Announcement
                </button>
              </div>

              <div className="space-y-4">
                {filteredAnnouncements.map((announcement) => {
                  const isRead = announcement.read_by.includes(profile?.id || '');
                  const isExpired = isAnnouncementExpired(announcement.expires_at);
                  
                  return (
                    <div 
                      key={announcement.id} 
                      className={`bg-gray-50 rounded-lg p-6 border border-gray-200 ${
                        !isRead && !isExpired ? 'border-l-4 border-l-indigo-500' : ''
                      } ${isExpired ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="text-lg font-semibold text-gray-900">{announcement.title}</h4>
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityColor(announcement.priority)}`}>
                              {announcement.priority.toUpperCase()}
                            </span>
                            {!isRead && !isExpired && (
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                                NEW
                              </span>
                            )}
                            {isExpired && (
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                EXPIRED
                              </span>
                            )}
                          </div>
                          
                          <div className="text-gray-700 mb-3 whitespace-pre-wrap">
                            {announcement.content}
                          </div>
                          
                          <div className="flex items-center justify-between text-sm text-gray-500">
                            <div className="flex items-center space-x-4">
                              <span>By {announcement.creator?.full_name}</span>
                              <span>{new Date(announcement.created_at).toLocaleDateString()}</span>
                              {announcement.expires_at && (
                                <span>Expires: {new Date(announcement.expires_at).toLocaleDateString()}</span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {announcement.target_roles.length > 0 && (
                                <span className="text-xs">
                                  Target: {announcement.target_roles.join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          {!isRead && !isExpired && (
                            <button
                              onClick={() => markAnnouncementAsRead(announcement.id)}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Mark as read"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )}
                          {(effectiveRoles.includes('admin') || effectiveRoles.includes('ceo')) && (
                            <>
                              <button
                                className="text-blue-600 hover:text-blue-900"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => deleteAnnouncement(announcement.id)}
                                className="text-red-600 hover:text-red-900"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Knowledge Base Tab */}
          {activeTab === 'knowledge' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Knowledge Base</h3>
                <button
                  onClick={() => setShowKnowledgeModal(true)}
                  className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Article
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredKnowledge.map((article) => (
                  <div key={article.id} className="bg-gray-50 rounded-lg p-6 border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">{article.title}</h4>
                        <div className="flex items-center space-x-2 mb-3">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getCategoryColor(article.category)}`}>
                            {article.category}
                          </span>
                          {article.is_published ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-gray-700 text-sm mb-4 line-clamp-3">
                      {article.content.substring(0, 150)}...
                    </p>
                    
                    {article.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {article.tags.map((tag, index) => (
                          <span key={index} className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="flex items-center">
                          <Eye className="h-3 w-3 mr-1" />
                          {article.view_count}
                        </span>
                        <span className="flex items-center">
                          <ThumbsUp className="h-3 w-3 mr-1" />
                          {article.helpful_count}
                        </span>
                      </div>
                      <span>By {article.creator?.full_name}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setSelectedItem(article)}
                        className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                      >
                        Read More
                      </button>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => rateKnowledgeArticle(article.id, true)}
                          className="text-green-600 hover:text-green-800"
                          title="Helpful"
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => rateKnowledgeArticle(article.id, false)}
                          className="text-red-600 hover:text-red-800"
                          title="Not helpful"
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </button>
                        {(effectiveRoles.includes('admin') || effectiveRoles.includes('ceo')) && (
                          <button
                            onClick={() => deleteKnowledgeArticle(article.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meeting Scheduler Tab */}
          {activeTab === 'meetings' && (
            <div className="text-center py-12">
              <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Meeting Scheduler</h3>
              <p className="text-gray-600 mb-6">
                Integrated calendar and meeting scheduling coming soon.
              </p>
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 max-w-md mx-auto">
                <h4 className="text-md font-semibold text-gray-900 mb-3">Upcoming Features:</h4>
                <ul className="text-left text-sm text-gray-600 space-y-2">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Calendar integration
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Meeting room booking
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Video conferencing links
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Automatic reminders
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Announcement Modal */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-xl bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">New Announcement</h3>
              <button
                onClick={() => setShowAnnouncementModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Trash2 className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter announcement title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content
                </label>
                <textarea
                  value={newAnnouncement.content}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  rows={6}
                  placeholder="Enter announcement content"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={newAnnouncement.priority}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expires On
                  </label>
                  <input
                    type="date"
                    value={newAnnouncement.expires_at}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, expires_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-4 pt-4 border-t">
                <button
                  onClick={() => setShowAnnouncementModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createAnnouncement}
                  disabled={!newAnnouncement.title || !newAnnouncement.content}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Publish Announcement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Knowledge Base Modal */}
      {showKnowledgeModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-xl bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">New Knowledge Article</h3>
              <button
                onClick={() => setShowKnowledgeModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Trash2 className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={newKnowledge.title}
                  onChange={(e) => setNewKnowledge({ ...newKnowledge, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter article title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content
                </label>
                <textarea
                  value={newKnowledge.content}
                  onChange={(e) => setNewKnowledge({ ...newKnowledge, content: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  rows={8}
                  placeholder="Enter article content"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={newKnowledge.category}
                    onChange={(e) => setNewKnowledge({ ...newKnowledge, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="general">General</option>
                    <option value="policy">Policy</option>
                    <option value="training">Training</option>
                    <option value="technical">Technical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newKnowledge.tags.join(', ')}
                    onChange={(e) => setNewKnowledge({ 
                      ...newKnowledge, 
                      tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="tag1, tag2, tag3"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="publish"
                  checked={newKnowledge.is_published}
                  onChange={(e) => setNewKnowledge({ ...newKnowledge, is_published: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="publish" className="ml-2 text-sm text-gray-700">
                  Publish immediately
                </label>
              </div>

              <div className="flex items-center justify-end space-x-4 pt-4 border-t">
                <button
                  onClick={() => setShowKnowledgeModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createKnowledgeArticle}
                  disabled={!newKnowledge.title || !newKnowledge.content}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Create Article
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
