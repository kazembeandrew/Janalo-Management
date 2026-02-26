import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  Server, 
  Database, 
  HardDrive, 
  Activity, 
  Download, 
  Upload, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  BarChart3, 
  Cpu, 
  MemoryStick, 
  Wifi,
  Play,
  Pause,
  Settings,
  Calendar,
  FileText,
  Trash2,
  Eye
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DatabaseHealth {
  id: string;
  metric_name: string;
  metric_value: number;
  unit?: string;
  status: string;
  threshold_warning?: number;
  threshold_critical?: number;
  recorded_at: string;
}

interface BackupRecord {
  id: string;
  backup_type: string;
  backup_size: number;
  backup_path: string;
  status: string;
  started_at: string;
  completed_at?: string;
  error_message?: string;
  created_by: string;
  creator?: {
    full_name: string;
  };
}

interface SystemResource {
  id: string;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  active_connections: number;
  database_connections: number;
  recorded_at: string;
}

export const SystemAdministration: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [activeTab, setActiveTab] = useState<'health' | 'backups' | 'resources' | 'logs'>('health');
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  const [databaseHealth, setDatabaseHealth] = useState<DatabaseHealth[]>([]);
  const [backupRecords, setBackupRecords] = useState<BackupRecord[]>([]);
  const [systemResources, setSystemResources] = useState<SystemResource[]>([]);
  
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupType, setBackupType] = useState<'full' | 'incremental' | 'differential'>('full');

  const isAuthorized = effectiveRoles.includes('admin');

  useEffect(() => {
    if (!isAuthorized) {
      toast.error('You are not authorized to access this page');
      return;
    }
    fetchSystemData();
  }, [isAuthorized]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchSystemData();
      }, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchSystemData = async () => {
    setLoading(true);
    try {
      const [healthRes, backupRes, resourceRes] = await Promise.all([
        supabase
          .from('database_health')
          .select('*')
          .order('recorded_at', { ascending: false })
          .limit(50),
        supabase
          .from('backup_records')
          .select('*, creator:profiles!backup_records_created_by_fkey(full_name)')
          .order('started_at', { ascending: false })
          .limit(20),
        supabase
          .from('system_resources')
          .select('*')
          .order('recorded_at', { ascending: false })
          .limit(100)
      ]);

      if (healthRes.data) setDatabaseHealth(healthRes.data);
      if (backupRes.data) setBackupRecords(backupRes.data);
      if (resourceRes.data) setSystemResources(resourceRes.data);
    } catch (error) {
      console.error('Error fetching system data:', error);
      toast.error('Failed to load system data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      case 'completed': return 'text-green-600 bg-green-100';
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getMetricIcon = (metricName: string) => {
    switch (metricName) {
      case 'database_connections': return <Database className="h-4 w-4" />;
      case 'disk_usage': return <HardDrive className="h-4 w-4" />;
      case 'cpu_usage': return <Cpu className="h-4 w-4" />;
      case 'memory_usage': return <MemoryStick className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const createBackup = async () => {
    try {
      setIsCreatingBackup(true);
      const { data, error } = await supabase.rpc('create_system_backup', { 
        backup_type: backupType 
      });
      
      if (error) throw error;
      
      toast.success('Backup creation started');
      fetchSystemData();
    } catch (error) {
      console.error('Error creating backup:', error);
      toast.error('Failed to create backup');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const downloadBackup = async (backupPath: string) => {
    try {
      const { data, error } = await supabase.storage.from('backups').download(backupPath);
      if (error) throw error;
      
      // Create download link
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = backupPath.split('/').pop() || 'backup';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Backup downloaded successfully');
    } catch (error) {
      console.error('Error downloading backup:', error);
      toast.error('Failed to download backup');
    }
  };

  const deleteBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to delete this backup? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('backup_records')
        .delete()
        .eq('id', backupId);

      if (error) throw error;
      
      toast.success('Backup deleted successfully');
      fetchSystemData();
    } catch (error) {
      console.error('Error deleting backup:', error);
      toast.error('Failed to delete backup');
    }
  };

  const getLatestMetrics = () => {
    const latest: { [key: string]: DatabaseHealth } = {};
    
    databaseHealth.forEach(metric => {
      if (!latest[metric.metric_name] || new Date(metric.recorded_at) > new Date(latest[metric.metric_name].recorded_at)) {
        latest[metric.metric_name] = metric;
      }
    });
    
    return Object.values(latest);
  };

  const getLatestResources = () => {
    return systemResources.length > 0 ? systemResources[0] : null;
  };

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">You are not authorized to access this page</p>
        </div>
      </div>
    );
  }

  const latestMetrics = getLatestMetrics();
  const latestResources = getLatestResources();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Administration</h1>
          <p className="text-gray-600">Database health, backups, and system monitoring</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="autoRefresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="autoRefresh" className="ml-2 text-sm text-gray-700">
              Auto Refresh (30s)
            </label>
          </div>
          <button
            onClick={fetchSystemData}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Database Status</p>
              <p className="text-2xl font-bold text-gray-900">
                {latestMetrics.find(m => m.metric_name === 'database_connections')?.status || 'Unknown'}
              </p>
            </div>
            <Database className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">CPU Usage</p>
              <p className="text-2xl font-bold text-gray-900">
                {latestResources ? `${latestResources.cpu_usage.toFixed(1)}%` : 'N/A'}
              </p>
            </div>
            <Cpu className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Memory Usage</p>
              <p className="text-2xl font-bold text-gray-900">
                {latestResources ? `${latestResources.memory_usage.toFixed(1)}%` : 'N/A'}
              </p>
            </div>
            <MemoryStick className="h-8 w-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Disk Usage</p>
              <p className="text-2xl font-bold text-gray-900">
                {latestResources ? `${latestResources.disk_usage.toFixed(1)}%` : 'N/A'}
              </p>
            </div>
            <HardDrive className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { id: 'health', name: 'Database Health', icon: Database },
              { id: 'backups', name: 'Backup Management', icon: HardDrive },
              { id: 'resources', name: 'System Resources', icon: BarChart3 },
              { id: 'logs', name: 'System Logs', icon: FileText }
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
          {/* Database Health Tab */}
          {activeTab === 'health' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Database Health Metrics</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {latestMetrics.map((metric) => (
                  <div key={metric.id} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        {getMetricIcon(metric.metric_name)}
                        <span className="ml-2 text-sm font-medium text-gray-900">
                          {metric.metric_name.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(metric.status)}`}>
                        {metric.status}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-2xl font-bold text-gray-900">
                          {metric.metric_value.toFixed(1)}
                        </span>
                        <span className="text-sm text-gray-500">{metric.unit || ''}</span>
                      </div>
                      
                      {(metric.threshold_warning || metric.threshold_critical) && (
                        <div className="space-y-1">
                          {metric.threshold_warning && (
                            <div className="flex justify-between text-xs">
                              <span className="text-yellow-600">Warning:</span>
                              <span className="text-gray-600">{metric.threshold_warning}</span>
                            </div>
                          )}
                          {metric.threshold_critical && (
                            <div className="flex justify-between text-xs">
                              <span className="text-red-600">Critical:</span>
                              <span className="text-gray-600">{metric.threshold_critical}</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            metric.status === 'healthy' ? 'bg-green-500' :
                            metric.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ 
                            width: `${Math.min((metric.metric_value / (metric.threshold_critical || 100)) * 100, 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                    
                    <div className="mt-4 text-xs text-gray-500">
                      Last updated: {new Date(metric.recorded_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Backup Management Tab */}
          {activeTab === 'backups' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Backup Management</h3>
                <div className="flex items-center space-x-4">
                  <select
                    value={backupType}
                    onChange={(e) => setBackupType(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="full">Full Backup</option>
                    <option value="incremental">Incremental</option>
                    <option value="differential">Differential</option>
                  </select>
                  <button
                    onClick={createBackup}
                    disabled={isCreatingBackup}
                    className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    <Upload className={`h-4 w-4 mr-2 ${isCreatingBackup ? 'animate-pulse' : ''}`} />
                    {isCreatingBackup ? 'Creating...' : 'Create Backup'}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Started
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {backupRecords.map((backup) => (
                      <tr key={backup.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            backup.backup_type === 'full' ? 'text-purple-600 bg-purple-100' :
                            backup.backup_type === 'incremental' ? 'text-blue-600 bg-blue-100' :
                            'text-green-600 bg-green-100'
                          }`}>
                            {backup.backup_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatBytes(backup.backup_size)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(backup.status)}`}>
                            {backup.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(backup.started_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {backup.completed_at 
                            ? `${Math.round((new Date(backup.completed_at).getTime() - new Date(backup.started_at).getTime()) / 1000)}s`
                            : 'Running...'
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {backup.creator?.full_name || 'System'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          {backup.status === 'completed' && (
                            <button
                              onClick={() => downloadBackup(backup.backup_path)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Download backup"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteBackup(backup.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete backup"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* System Resources Tab */}
          {activeTab === 'resources' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">System Resources</h3>
              
              {latestResources && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <Cpu className="h-6 w-6 text-blue-600" />
                      <span className="text-sm font-medium text-gray-900">CPU</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-2xl font-bold text-gray-900">
                          {latestResources.cpu_usage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${latestResources.cpu_usage}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <MemoryStick className="h-6 w-6 text-green-600" />
                      <span className="text-sm font-medium text-gray-900">Memory</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-2xl font-bold text-gray-900">
                          {latestResources.memory_usage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${latestResources.memory_usage}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <HardDrive className="h-6 w-6 text-yellow-600" />
                      <span className="text-sm font-medium text-gray-900">Disk</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-2xl font-bold text-gray-900">
                          {latestResources.disk_usage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-yellow-500 h-2 rounded-full"
                          style={{ width: `${latestResources.disk_usage}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <Wifi className="h-6 w-6 text-purple-600" />
                      <span className="text-sm font-medium text-gray-900">Connections</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-2xl font-bold text-gray-900">
                          {latestResources.active_connections}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        DB: {latestResources.database_connections}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-8">
                <h4 className="text-md font-semibold text-gray-900 mb-4">Resource History</h4>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    <BarChart3 className="h-8 w-8 mr-2" />
                    Resource usage charts coming soon
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* System Logs Tab */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">System Logs</h3>
              
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <select className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                        <option>All Levels</option>
                        <option>Error</option>
                        <option>Warning</option>
                        <option>Info</option>
                      </select>
                      <input
                        type="date"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <button className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                      <Download className="h-4 w-4 mr-2" />
                      Export Logs
                    </button>
                  </div>
                  
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {/* Sample log entries */}
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">INFO</span>
                          <span className="text-sm text-gray-900">Database backup completed successfully</span>
                        </div>
                        <span className="text-xs text-gray-500">2024-02-26 14:30:15</span>
                      </div>
                    </div>
                    
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">WARNING</span>
                          <span className="text-sm text-gray-900">High memory usage detected: 85%</span>
                        </div>
                        <span className="text-xs text-gray-500">2024-02-26 14:25:32</span>
                      </div>
                    </div>
                    
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">ERROR</span>
                          <span className="text-sm text-gray-900">Failed to connect to external service</span>
                        </div>
                        <span className="text-xs text-gray-500">2024-02-26 14:20:45</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
