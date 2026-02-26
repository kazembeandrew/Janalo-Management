import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  Shield, 
  Users, 
  Globe, 
  Key, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Ban,
  Wifi,
  Smartphone,
  Lock,
  Activity,
  Search,
  Filter,
  Plus
} from 'lucide-react';
import toast from 'react-hot-toast';

interface UserSession {
  id: string;
  user_id: string;
  session_token: string;
  ip_address: string;
  user_agent?: string;
  is_active: boolean;
  last_activity: string;
  created_at: string;
  expires_at: string;
  user?: {
    full_name: string;
    email: string;
    role: string;
  };
}

interface IPWhitelist {
  id: string;
  ip_address: string;
  description?: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  creator?: {
    full_name: string;
  };
}

interface User2FA {
  id: string;
  user_id: string;
  secret_key?: string;
  backup_codes?: string[];
  is_enabled: boolean;
  last_used?: string;
  created_at: string;
  updated_at: string;
  user?: {
    full_name: string;
    email: string;
  };
}

interface SecurityEvent {
  id: string;
  event_type: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
  details?: any;
  created_at: string;
  user?: {
    full_name: string;
    email: string;
  };
}

export const SecurityManagement: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [activeTab, setActiveTab] = useState<'sessions' | 'whitelist' | '2fa' | 'events'>('sessions');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [ipWhitelist, setIpWhitelist] = useState<IPWhitelist[]>([]);
  const [user2FA, setUser2FA] = useState<User2FA[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  
  const [showIPModal, setShowIPModal] = useState(false);
  const [newIPEntry, setNewIPEntry] = useState({
    ip_address: '',
    description: '',
    is_active: true
  });

  const isAuthorized = effectiveRoles.includes('admin');

  useEffect(() => {
    if (!isAuthorized) {
      toast.error('You are not authorized to access this page');
      return;
    }
    fetchSecurityData();
  }, [isAuthorized]);

  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      const [sessionsRes, ipRes, twoFARes, eventsRes] = await Promise.all([
        supabase
          .from('user_sessions')
          .select('*, user:profiles!user_sessions_user_id_fkey(full_name, email, role)')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('ip_whitelist')
          .select('*, creator:profiles!ip_whitelist_created_by_fkey(full_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('user_2fa')
          .select('*, user:profiles!user_2fa_user_id_fkey(full_name, email)')
          .order('created_at', { ascending: false }),
        supabase
          .from('security_events')
          .select('*, user:profiles!security_events_user_id_fkey(full_name, email)')
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      if (sessionsRes.data) setSessions(sessionsRes.data);
      if (ipRes.data) setIpWhitelist(ipRes.data);
      if (twoFARes.data) setUser2FA(twoFARes.data);
      if (eventsRes.data) setSecurityEvents(eventsRes.data);
    } catch (error) {
      console.error('Error fetching security data:', error);
      toast.error('Failed to load security data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: boolean) => {
    return status ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100';
  };

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case 'login_attempt': return 'text-blue-600 bg-blue-100';
      case 'failed_login': return 'text-red-600 bg-red-100';
      case 'password_change': return 'text-yellow-600 bg-yellow-100';
      case '2fa_enabled': return 'text-green-600 bg-green-100';
      case '2fa_disabled': return 'text-orange-600 bg-orange-100';
      case 'session_created': return 'text-indigo-600 bg-indigo-100';
      case 'session_terminated': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const terminateSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to terminate this session?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('id', sessionId);

      if (error) throw error;
      
      toast.success('Session terminated successfully');
      fetchSecurityData();
    } catch (error) {
      console.error('Error terminating session:', error);
      toast.error('Failed to terminate session');
    }
  };

  const addIPToWhitelist = async () => {
    try {
      const { error } = await supabase
        .from('ip_whitelist')
        .insert({
          ...newIPEntry,
          created_by: profile?.id
        });

      if (error) throw error;
      
      toast.success('IP address added to whitelist');
      setNewIPEntry({ ip_address: '', description: '', is_active: true });
      setShowIPModal(false);
      fetchSecurityData();
    } catch (error) {
      console.error('Error adding IP to whitelist:', error);
      toast.error('Failed to add IP to whitelist');
    }
  };

  const removeIPFromWhitelist = async (ipId: string) => {
    if (!confirm('Are you sure you want to remove this IP from the whitelist?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('ip_whitelist')
        .delete()
        .eq('id', ipId);

      if (error) throw error;
      
      toast.success('IP address removed from whitelist');
      fetchSecurityData();
    } catch (error) {
      console.error('Error removing IP from whitelist:', error);
      toast.error('Failed to remove IP from whitelist');
    }
  };

  const toggle2FA = async (userId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('user_2fa')
        .update({ is_enabled: enabled })
        .eq('user_id', userId);

      if (error) throw error;
      
      toast.success(`2FA ${enabled ? 'enabled' : 'disabled'} successfully`);
      fetchSecurityData();
    } catch (error) {
      console.error('Error toggling 2FA:', error);
      toast.error('Failed to toggle 2FA');
    }
  };

  const isSessionExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = session.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         session.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         session.ip_address.includes(searchTerm);
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'active' && session.is_active && !isSessionExpired(session.expires_at)) ||
                         (filterStatus === 'inactive' && (!session.is_active || isSessionExpired(session.expires_at)));
    return matchesSearch && matchesFilter;
  });

  const filteredEvents = securityEvents.filter(event => {
    const matchesSearch = event.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.ip_address?.includes(searchTerm);
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'success' && event.success) ||
                         (filterStatus === 'failed' && !event.success);
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
          <h1 className="text-2xl font-bold text-gray-900">Security Management</h1>
          <p className="text-gray-600">Advanced security controls and monitoring</p>
        </div>
        <button
          onClick={fetchSecurityData}
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
              <p className="text-sm text-gray-600">Active Sessions</p>
              <p className="text-2xl font-bold text-gray-900">
                {sessions.filter(s => s.is_active && !isSessionExpired(s.expires_at)).length}
              </p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Whitelisted IPs</p>
              <p className="text-2xl font-bold text-gray-900">
                {ipWhitelist.filter(ip => ip.is_active).length}
              </p>
            </div>
            <Globe className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">2FA Enabled Users</p>
              <p className="text-2xl font-bold text-gray-900">
                {user2FA.filter(u => u.is_enabled).length}
              </p>
            </div>
            <Smartphone className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Security Events Today</p>
              <p className="text-2xl font-bold text-gray-900">
                {securityEvents.filter(e => 
                  new Date(e.created_at).toDateString() === new Date().toDateString()
                ).length}
              </p>
            </div>
            <Activity className="h-8 w-8 text-orange-600" />
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
              {activeTab === 'sessions' && (
                <>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </>
              )}
              {activeTab === 'events' && (
                <>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
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
              { id: 'sessions', name: 'User Sessions', icon: Users },
              { id: 'whitelist', name: 'IP Whitelist', icon: Globe },
              { id: '2fa', name: 'Two-Factor Auth', icon: Smartphone },
              { id: 'events', name: 'Security Events', icon: Activity }
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
          {/* User Sessions Tab */}
          {activeTab === 'sessions' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Active User Sessions</h3>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        IP Address
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User Agent
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Activity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Expires
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
                    {filteredSessions.map((session) => (
                      <tr key={session.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{session.user?.full_name}</p>
                            <p className="text-xs text-gray-500">{session.user?.email}</p>
                            <p className="text-xs text-gray-400">{session.user?.role}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {session.ip_address}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="max-w-xs truncate" title={session.user_agent}>
                            {session.user_agent || 'Unknown'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(session.last_activity).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(session.expires_at).toLocaleString()}
                          {isSessionExpired(session.expires_at) && (
                            <span className="ml-2 text-xs text-red-600 font-medium">EXPIRED</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            session.is_active && !isSessionExpired(session.expires_at)
                              ? 'text-green-600 bg-green-100'
                              : 'text-red-600 bg-red-100'
                          }`}>
                            {session.is_active && !isSessionExpired(session.expires_at) ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {session.is_active && !isSessionExpired(session.expires_at) && (
                            <button
                              onClick={() => terminateSession(session.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Terminate session"
                            >
                              <Ban className="h-4 w-4" />
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

          {/* IP Whitelist Tab */}
          {activeTab === 'whitelist' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">IP Whitelist</h3>
                <button
                  onClick={() => setShowIPModal(true)}
                  className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add IP
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        IP Address
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Added By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {ipWhitelist.map((ip) => (
                      <tr key={ip.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {ip.ip_address}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {ip.description || 'No description'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ip.is_active)}`}>
                            {ip.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {ip.creator?.full_name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => removeIPFromWhitelist(ip.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Remove from whitelist"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2FA Tab */}
          {activeTab === '2fa' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Two-Factor Authentication</h3>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Used
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Setup Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {user2FA.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{user.user?.full_name}</p>
                            <p className="text-xs text-gray-500">{user.user?.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(user.is_enabled)}`}>
                            {user.is_enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.last_used ? new Date(user.last_used).toLocaleString() : 'Never'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => toggle2FA(user.user_id, !user.is_enabled)}
                            className={`hover:text-${user.is_enabled ? 'red' : 'green'}-600`}
                            title={user.is_enabled ? 'Disable 2FA' : 'Enable 2FA'}
                          >
                            {user.is_enabled ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Security Events Tab */}
          {activeTab === 'events' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Security Events</h3>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Event Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        IP Address
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Success
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredEvents.map((event) => (
                      <tr key={event.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getEventTypeColor(event.event_type)}`}>
                            {event.event_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {event.user?.full_name || 'System'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {event.ip_address || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {event.success ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(event.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="max-w-xs truncate" title={JSON.stringify(event.details)}>
                            {event.details ? JSON.stringify(event.details) : 'No details'}
                          </div>
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

      {/* IP Whitelist Modal */}
      {showIPModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-xl bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Add IP to Whitelist</h3>
              <button
                onClick={() => setShowIPModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  IP Address
                </label>
                <input
                  type="text"
                  value={newIPEntry.ip_address}
                  onChange={(e) => setNewIPEntry({ ...newIPEntry, ip_address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="192.168.1.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newIPEntry.description}
                  onChange={(e) => setNewIPEntry({ ...newIPEntry, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  rows={3}
                  placeholder="Office network, home office, etc."
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  checked={newIPEntry.is_active}
                  onChange={(e) => setNewIPEntry({ ...newIPEntry, is_active: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="active" className="ml-2 text-sm text-gray-700">
                  Active
                </label>
              </div>

              <div className="flex items-center justify-end space-x-4 pt-4 border-t">
                <button
                  onClick={() => setShowIPModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addIPToWhitelist}
                  disabled={!newIPEntry.ip_address}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  Add IP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
