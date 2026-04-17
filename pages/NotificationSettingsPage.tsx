import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  Bell, 
  Settings, 
  ChevronLeft,
  Mail,
  Smartphone,
  Monitor,
  Clock,
  Moon,
  Sun,
  Check,
  AlertCircle,
  Info,
  Shield,
  DollarSign,
  FileText,
  CheckCircle,
  MessageSquare,
  Save,
  RefreshCw,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { NotificationCategory } from '@/components/NotificationBell';
import { getNotificationPreferences, updateNotificationPreferences } from '@/utils/notifications';

// ============================================================================
// TYPES
// ============================================================================

interface CategoryPreference {
  in_app: boolean;
  email: boolean;
  push: boolean;
}

interface NotificationPreferences {
  email_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  category_preferences: Record<NotificationCategory, CategoryPreference>;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  digest_enabled: boolean;
  digest_frequency: 'hourly' | 'daily' | 'weekly';
}

// ============================================================================
// CATEGORY CONFIGURATION
// ============================================================================

const CATEGORY_CONFIG: Record<NotificationCategory, { icon: React.ElementType; label: string; description: string }> = {
  system: { 
    icon: Info, 
    label: 'System', 
    description: 'System updates, maintenance alerts, and general announcements' 
  },
  loan: { 
    icon: DollarSign, 
    label: 'Loans', 
    description: 'Loan approvals, disbursements, and status changes' 
  },
  repayment: { 
    icon: CheckCircle, 
    label: 'Repayments', 
    description: 'Payment received confirmations and overdue alerts' 
  },
  expense: { 
    icon: FileText, 
    label: 'Expenses', 
    description: 'Expense approvals, rejections, and reimbursements' 
  },
  task: { 
    icon: CheckCircle, 
    label: 'Tasks', 
    description: 'Task assignments, due date reminders, and completions' 
  },
  message: { 
    icon: MessageSquare, 
    label: 'Messages', 
    description: 'Direct messages and conversation notifications' 
  },
  security: { 
    icon: Shield, 
    label: 'Security', 
    description: 'Security alerts, login notifications, and access changes' 
  },
  general: { 
    icon: Bell, 
    label: 'General', 
    description: 'General notifications and miscellaneous updates' 
  }
};

const defaultPreferences: NotificationPreferences = {
  email_enabled: true,
  push_enabled: true,
  in_app_enabled: true,
  category_preferences: {
    system: { in_app: true, email: true, push: true },
    loan: { in_app: true, email: true, push: true },
    repayment: { in_app: true, email: true, push: true },
    expense: { in_app: true, email: true, push: true },
    task: { in_app: true, email: true, push: true },
    message: { in_app: true, email: true, push: true },
    security: { in_app: true, email: true, push: true },
    general: { in_app: true, email: true, push: true }
  },
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  digest_enabled: false,
  digest_frequency: 'daily'
};

// ============================================================================
// COMPONENT
// ============================================================================

export const NotificationSettingsPage: React.FC = () => {
  const { profile } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch preferences
  useEffect(() => {
    const loadPreferences = async () => {
      setIsLoading(true);
      const data = await getNotificationPreferences();
      if (data) {
        setPreferences({
          ...defaultPreferences,
          ...data
        });
      }
      setIsLoading(false);
    };
    
    loadPreferences();
  }, []);

  // Track changes
  useEffect(() => {
    setHasChanges(true);
  }, [preferences]);

  // Save preferences
  const handleSave = async () => {
    setIsSaving(true);
    const success = await updateNotificationPreferences(preferences);
    if (success) {
      toast.success('Notification preferences saved successfully');
      setHasChanges(false);
    } else {
      toast.error('Failed to save preferences');
    }
    setIsSaving(false);
  };

  // Toggle global settings
  const toggleGlobal = (key: 'email_enabled' | 'push_enabled' | 'in_app_enabled') => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Toggle category preference
  const toggleCategory = (category: NotificationCategory, type: 'in_app' | 'email' | 'push') => {
    setPreferences(prev => ({
      ...prev,
      category_preferences: {
        ...prev.category_preferences,
        [category]: {
          ...prev.category_preferences[category],
          [type]: !prev.category_preferences[category][type]
        }
      }
    }));
  };

  // Toggle quiet hours
  const toggleQuietHours = () => {
    setPreferences(prev => ({
      ...prev,
      quiet_hours_enabled: !prev.quiet_hours_enabled
    }));
  };

  // Toggle digest
  const toggleDigest = () => {
    setPreferences(prev => ({
      ...prev,
      digest_enabled: !prev.digest_enabled
    }));
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link 
            to="/notifications"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Settings className="h-6 w-6 text-indigo-600" />
              Notification Settings
            </h1>
            <p className="text-sm text-gray-500">
              Customize how and when you receive notifications
            </p>
          </div>
        </div>
        
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Changes
            </>
          )}
        </button>
      </div>

      {/* Global Settings */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Bell className="h-5 w-5 text-indigo-600" />
            Notification Channels
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Choose how you want to receive notifications across all categories
          </p>
        </div>
        
        <div className="p-6 space-y-6">
          {/* In-App */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-100 rounded-xl">
                <Monitor className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">In-App Notifications</h3>
                <p className="text-sm text-gray-500">Show notifications within the application</p>
              </div>
            </div>
            <button
              onClick={() => toggleGlobal('in_app_enabled')}
              className={`p-1 rounded-full transition-all ${preferences.in_app_enabled ? 'text-indigo-600' : 'text-gray-300'}`}
            >
              {preferences.in_app_enabled ? (
                <ToggleRight className="h-8 w-8" />
              ) : (
                <ToggleLeft className="h-8 w-8" />
              )}
            </button>
          </div>

          {/* Email */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Email Notifications</h3>
                <p className="text-sm text-gray-500">Receive notifications via email</p>
              </div>
            </div>
            <button
              onClick={() => toggleGlobal('email_enabled')}
              className={`p-1 rounded-full transition-all ${preferences.email_enabled ? 'text-blue-600' : 'text-gray-300'}`}
            >
              {preferences.email_enabled ? (
                <ToggleRight className="h-8 w-8" />
              ) : (
                <ToggleLeft className="h-8 w-8" />
              )}
            </button>
          </div>

          {/* Push */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <Smartphone className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Push Notifications</h3>
                <p className="text-sm text-gray-500">Receive push notifications on your device</p>
              </div>
            </div>
            <button
              onClick={() => toggleGlobal('push_enabled')}
              className={`p-1 rounded-full transition-all ${preferences.push_enabled ? 'text-green-600' : 'text-gray-300'}`}
            >
              {preferences.push_enabled ? (
                <ToggleRight className="h-8 w-8" />
              ) : (
                <ToggleLeft className="h-8 w-8" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Category Settings */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-indigo-600" />
            Category Preferences
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Customize notification settings for each category
          </p>
        </div>
        
        <div className="divide-y divide-gray-100">
          {(Object.keys(CATEGORY_CONFIG) as NotificationCategory[]).map((category) => {
            const config = CATEGORY_CONFIG[category];
            const prefs = preferences.category_preferences[category];
            
            return (
              <div key={category} className="p-6 hover:bg-gray-50/50 transition-all">
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <config.icon className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{config.label}</h3>
                    <p className="text-sm text-gray-500">{config.description}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 ml-12">
                  {/* In-App */}
                  <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-all">
                    <input
                      type="checkbox"
                      checked={prefs.in_app}
                      onChange={() => toggleCategory(category, 'in_app')}
                      disabled={!preferences.in_app_enabled}
                      className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 disabled:opacity-50"
                    />
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">In-App</span>
                    </div>
                  </label>
                  
                  {/* Email */}
                  <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-all">
                    <input
                      type="checkbox"
                      checked={prefs.email}
                      onChange={() => toggleCategory(category, 'email')}
                      disabled={!preferences.email_enabled}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                    />
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">Email</span>
                    </div>
                  </label>
                  
                  {/* Push */}
                  <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-all">
                    <input
                      type="checkbox"
                      checked={prefs.push}
                      onChange={() => toggleCategory(category, 'push')}
                      disabled={!preferences.push_enabled}
                      className="h-4 w-4 text-green-600 rounded border-gray-300 focus:ring-green-500 disabled:opacity-50"
                    />
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">Push</span>
                    </div>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Moon className="h-5 w-5 text-indigo-600" />
            Quiet Hours
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Pause non-urgent notifications during specific hours
          </p>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-100 rounded-xl">
                <Clock className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Enable Quiet Hours</h3>
                <p className="text-sm text-gray-500">Automatically silence notifications during set times</p>
              </div>
            </div>
            <button
              onClick={toggleQuietHours}
              className={`p-1 rounded-full transition-all ${preferences.quiet_hours_enabled ? 'text-indigo-600' : 'text-gray-300'}`}
            >
              {preferences.quiet_hours_enabled ? (
                <ToggleRight className="h-8 w-8" />
              ) : (
                <ToggleLeft className="h-8 w-8" />
              )}
            </button>
          </div>

          {preferences.quiet_hours_enabled && (
            <div className="ml-16 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Sun className="h-4 w-4 inline mr-1" />
                  Start Time
                </label>
                <input
                  type="time"
                  value={preferences.quiet_hours_start}
                  onChange={(e) => setPreferences(prev => ({ ...prev, quiet_hours_start: e.target.value }))}
                  aria-label="Quiet hours start time"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Moon className="h-4 w-4 inline mr-1" />
                  End Time
                </label>
                <input
                  type="time"
                  value={preferences.quiet_hours_end}
                  onChange={(e) => setPreferences(prev => ({ ...prev, quiet_hours_end: e.target.value }))}
                  aria-label="Quiet hours end time"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Digest Settings */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-indigo-600" />
            Notification Digest
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Receive a summary of notifications instead of individual alerts
          </p>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-xl">
                <Mail className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Enable Digest Mode</h3>
                <p className="text-sm text-gray-500">Group notifications into a single summary email</p>
              </div>
            </div>
            <button
              onClick={toggleDigest}
              className={`p-1 rounded-full transition-all ${preferences.digest_enabled ? 'text-amber-600' : 'text-gray-300'}`}
            >
              {preferences.digest_enabled ? (
                <ToggleRight className="h-8 w-8" />
              ) : (
                <ToggleLeft className="h-8 w-8" />
              )}
            </button>
          </div>

          {preferences.digest_enabled && (
            <div className="ml-16">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Digest Frequency
              </label>
              <select
                value={preferences.digest_frequency}
                onChange={(e) => setPreferences(prev => ({ ...prev, digest_frequency: e.target.value as 'hourly' | 'daily' | 'weekly' }))}
                aria-label="Digest frequency"
                className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Saving Changes...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Save All Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default NotificationSettingsPage;
