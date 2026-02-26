import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, UserX, Banknote, Check, X, AlertCircle, ArrowRight, Receipt, ClipboardList, TrendingUp, ShieldAlert, RefreshCw, Search, Filter, ChevronDown, Clock, DollarSign, Users, FileText, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import { formatCurrency } from '@/utils/finance';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

type QueueFilter = 'all' | 'critical' | 'loans' | 'expenses' | 'tasks' | 'users' | 'system';
type SortOption = 'priority' | 'date' | 'type' | 'amount';

interface QueueItem {
  id: string;
  type: 'loan' | 'expense' | 'task' | 'user' | 'system_reset';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  amount?: number;
  createdAt: string;
  data: any;
}

export const CEOOversight: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const navigate = useNavigate();
  const [pendingLoans, setPendingLoans] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [pendingExpenses, setPendingExpenses] = useState<any[]>([]);
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [pendingReset, setPendingReset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<QueueFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('priority');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const isExec = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo');

  const fetchOversightData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    
    try {
        // 1. Fetch Reset State (Resilient Query)
        const { data: logs, error: logError } = await supabase
            .from('audit_logs')
            .select('id, action, user_id, created_at, details')
            .in('action', ['SYSTEM_RESET_REQUESTED', 'SYSTEM_RESET_CANCELLED', 'SYSTEM_FACTORY_RESET'])
            .order('created_at', { ascending: false })
            .limit(1);
        
        if (logError) {
            console.error("[CEOOversight] Audit log fetch failed:", logError);
        } else {
            const latest = logs?.[0];
            if (latest && latest.action === 'SYSTEM_RESET_REQUESTED') {
                const { data: userData } = await supabase
                    .from('users')
                    .select('full_name')
                    .eq('id', latest.user_id)
                    .single();
                
                setPendingReset({ ...latest, users: userData });
            } else {
                setPendingReset(null);
            }
        }

        // 2. Fetch other pending items independently
        const [loansRes, usersRes, expensesRes, tasksRes] = await Promise.all([
            supabase.from('loans').select('*, borrowers(full_name)').eq('status', 'pending').order('created_at', { ascending: false }),
            supabase.from('users').select('*').eq('deletion_status', 'pending_approval'),
            supabase.from('expenses').select('*, users!recorded_by(full_name)').eq('status', 'pending_approval').order('created_at', { ascending: false }),
            supabase.from('tasks').select('*, users!assigned_to(full_name)').eq('status', 'pending_approval').order('created_at', { ascending: false })
        ]);

        setPendingLoans(loansRes.data || []);
        setPendingUsers(usersRes.data || []);
        setPendingExpenses(expensesRes.data || []);
        setPendingTasks(tasksRes.data || []);

    } catch (err) {
        console.error("[CEOOversight] Critical fetch error:", err);
    } finally {
        setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchOversightData();
    
    // Enhanced real-time subscriptions with better error handling
    const channel = supabase.channel('oversight-realtime-enhanced')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'loans' }, 
        (payload) => {
          console.log('[CEOOversight] Real-time loan update:', payload);
          fetchOversightData();
        }
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'users' }, 
        (payload) => {
          console.log('[CEOOversight] Real-time user update:', payload);
          fetchOversightData();
        }
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'expenses' }, 
        (payload) => {
          console.log('[CEOOversight] Real-time expense update:', payload);
          fetchOversightData();
        }
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tasks' }, 
        (payload) => {
          console.log('[CEOOversight] Real-time task update:', payload);
          fetchOversightData();
        }
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'audit_logs' }, 
        (payload) => {
          console.log('[CEOOversight] Real-time audit log update:', payload);
          fetchOversightData();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[CEOOversight] Real-time subscriptions active');
        } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[CEOOversight] Real-time subscription lost, attempting reconnect...');
          // Fallback: refresh data every 30 seconds if real-time fails
          const fallbackInterval = setInterval(fetchOversightData, 30000);
          setTimeout(() => clearInterval(fallbackInterval), 300000); // Stop fallback after 5 minutes
        }
      });

    return () => { 
      console.log('[CEOOversight] Cleaning up real-time subscriptions');
      supabase.removeChannel(channel); 
    };
  }, [fetchOversightData]);

  const handleApproveExpense = async (exp: any) => {
      try {
        // Log the approval action for audit trail
        await supabase.from('audit_logs').insert({
          user_id: profile?.id,
          action: 'EXPENSE_APPROVED',
          entity_type: 'expense',
          entity_id: exp.id,
          details: {
            amount: exp.amount,
            description: exp.description,
            approved_by: profile?.full_name,
            approved_at: new Date().toISOString()
          }
        });

        const { error } = await supabase.from('expenses').update({ status: 'approved' }).eq('id', exp.id);
        if (!error) {
            toast.success("Expense authorized");
            fetchOversightData();
        } else {
          throw error;
        }
      } catch (error: any) {
        console.error('[CEOOversight] Expense approval failed:', error);
        toast.error("Failed to approve expense: " + error.message);
      }
  };

  const handleApproveTask = async (task: any) => {
      try {
        // Log the approval action for audit trail
        await supabase.from('audit_logs').insert({
          user_id: profile?.id,
          action: 'TASK_APPROVED',
          entity_type: 'task',
          entity_id: task.id,
          details: {
            task_title: task.title,
            assigned_to: task.users?.full_name,
            approved_by: profile?.full_name,
            approved_at: new Date().toISOString()
          }
        });

        const { error } = await supabase.from('tasks').update({ status: 'approved' }).eq('id', task.id);
        if (!error) {
            toast.success("Task authorized");
            fetchOversightData();
        } else {
          throw error;
        }
      } catch (error: any) {
        console.error('[CEOOversight] Task approval failed:', error);
        toast.error("Failed to approve task: " + error.message);
      }
  };

  const handleApproveUser = async (user: any) => {
      try {
        // Log the approval action for audit trail
        await supabase.from('audit_logs').insert({
          user_id: profile?.id,
          action: 'USER_ARCHIVE_APPROVED',
          entity_type: 'user',
          entity_id: user.id,
          details: {
            user_name: user.full_name,
            approved_by: profile?.full_name,
            approved_at: new Date().toISOString(),
            reason: 'Archiving approved by Executive'
          }
        });

        const { error } = await supabase
          .from('users')
          .update({ 
              is_active: false, 
              deletion_status: 'approved',
              revocation_reason: 'Archiving approved by Executive'
          })
          .eq('id', user.id);
        
        if (!error) {
            toast.success("User archive confirmed");
            fetchOversightData();
        } else {
          throw error;
        }
      } catch (error: any) {
        console.error('[CEOOversight] User archive approval failed:', error);
        toast.error("Failed to approve user archive: " + error.message);
      }
  };

  const handleExecuteReset = async () => {
      if (!profile || !pendingReset) return;

      if (profile.id === pendingReset.user_id) {
          toast.error("Dual Authorization Required: A different administrator must authorize this reset.");
          return;
      }

      if (!window.confirm("CRITICAL: You are about to execute a system-wide Factory Reset. This will erase all business data. Continue?")) return;

      setIsProcessing(true);
      try {
          const { error } = await supabase.rpc('wipe_all_data');
          if (error) throw error;

          toast.success("System reset successful.");
          setTimeout(() => navigate('/'), 1500);
      } catch (e: any) {
          toast.error("Reset failed: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const queueItems = useMemo((): QueueItem[] => {
    const items: QueueItem[] = [];

    // System Reset - Critical Priority
    if (pendingReset) {
      items.push({
        id: `reset-${pendingReset.id}`,
        type: 'system_reset',
        priority: 'critical',
        title: 'Factory Reset Request',
        description: `Requested by ${pendingReset.users?.full_name || 'Administrator'}`,
        createdAt: pendingReset.created_at,
        data: pendingReset
      });
    }

    // Pending Loans - High Priority
    pendingLoans.forEach(loan => {
      items.push({
        id: `loan-${loan.id}`,
        type: 'loan',
        priority: 'high',
        title: 'Loan Approval',
        description: loan.borrowers?.full_name || 'Unknown Borrower',
        amount: loan.principal_amount,
        createdAt: loan.created_at,
        data: loan
      });
    });

    // Pending Expenses - Medium Priority
    pendingExpenses.forEach(exp => {
      items.push({
        id: `expense-${exp.id}`,
        type: 'expense',
        priority: 'medium',
        title: 'Expense Authorization',
        description: exp.description,
        amount: exp.amount,
        createdAt: exp.created_at,
        data: exp
      });
    });

    // Pending Tasks - Medium Priority
    pendingTasks.forEach(task => {
      items.push({
        id: `task-${task.id}`,
        type: 'task',
        priority: task.priority === 'critical' ? 'high' : 'medium',
        title: 'Task/Allocation',
        description: `${task.title} - Assigned to ${task.users?.full_name || 'Unassigned'}`,
        createdAt: task.created_at,
        data: task
      });
    });

    // Pending User Deletions - Low Priority
    pendingUsers.forEach(user => {
      items.push({
        id: `user-${user.id}`,
        type: 'user',
        priority: 'low',
        title: 'Archive Request',
        description: `${user.full_name} - HR Request`,
        createdAt: user.created_at,
        data: user
      });
    });

    return items;
  }, [pendingLoans, pendingUsers, pendingExpenses, pendingTasks, pendingReset]);

  const filteredAndSortedItems = useMemo(() => {
    let filtered = queueItems;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter(item => {
        switch (activeFilter) {
          case 'critical': return item.priority === 'critical';
          case 'loans': return item.type === 'loan';
          case 'expenses': return item.type === 'expense';
          case 'tasks': return item.type === 'task';
          case 'users': return item.type === 'user';
          case 'system': return item.type === 'system_reset';
          default: return true;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        case 'date':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'type':
          return a.type.localeCompare(b.type);
        case 'amount':
          return (b.amount || 0) - (a.amount || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [queueItems, searchQuery, activeFilter, sortBy]);

  const handleSelectAll = () => {
    if (selectedItems.size === filteredAndSortedItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredAndSortedItems.map(item => item.id)));
    }
  };

  const handleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleBulkApprove = async () => {
    const itemsToApprove = filteredAndSortedItems.filter(item => selectedItems.has(item.id));
    
    for (const item of itemsToApprove) {
      switch (item.type) {
        case 'expense':
          await handleApproveExpense(item.data);
          break;
        case 'task':
          await handleApproveTask(item.data);
          break;
        case 'user':
          await handleApproveUser(item.data);
          break;
        // Loans and system resets require individual review
      }
    }
    
    setSelectedItems(new Set());
    toast.success(`Approved ${itemsToApprove.length} items`);
  };

  const totalPending = pendingLoans.length + 
                       pendingUsers.length + 
                       pendingExpenses.length + 
                       pendingTasks.length + 
                       (pendingReset ? 1 : 0);

  if (loading && totalPending === 0) return (
      <div className="flex items-center justify-center p-12">
          <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'medium': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'low': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'system_reset': return ShieldAlert;
      case 'loan': return Banknote;
      case 'expense': return Receipt;
      case 'task': return ClipboardList;
      case 'user': return UserX;
      default: return FileText;
    }
  };

  const renderQueueItem = (item: QueueItem) => {
    const Icon = getTypeIcon(item.type);
    const isSelected = selectedItems.has(item.id);
    const canBulkApprove = ['expense', 'task', 'user'].includes(item.type);
    
    return (
      <div
        key={item.id}
        className={`bg-white border rounded-xl p-4 shadow-sm flex items-center justify-between hover:shadow-md transition-all ${
          item.priority === 'critical' ? 'border-red-200 animate-pulse' : 'border-gray-100'
        } ${isSelected ? 'ring-2 ring-indigo-500' : ''}`}
      >
        <div className="flex items-center flex-1">
          {canBulkApprove && (
            <button
              onClick={() => handleSelectItem(item.id)}
              className="mr-3 p-1 hover:bg-gray-100 rounded transition-colors"
              title={isSelected ? 'Deselect item' : 'Select item'}
            >
              {isSelected ? (
                <CheckSquare className="h-4 w-4 text-indigo-600" />
              ) : (
                <Square className="h-4 w-4 text-gray-400" />
              )}
            </button>
          )}
          
          <div className={`p-2 rounded-lg mr-4 ${getPriorityColor(item.priority)}`}>
            <Icon className="h-5 w-5" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {item.title}
              </p>
              {item.priority === 'critical' && (
                <AlertTriangle className="h-3 w-3 text-red-500" />
              )}
            </div>
            <p className="text-sm font-bold text-gray-900">{item.description}</p>
            <div className="flex items-center gap-4 mt-1">
              {item.amount && (
                <p className="text-xs font-bold text-green-600">
                  {formatCurrency(item.amount)}
                </p>
              )}
              <p className="text-xs text-gray-500 flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {new Date(item.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {item.type === 'loan' && (
            <Link 
              to={`/loans/${item.data.id}`} 
              className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all"
              title="Review loan details"
            >
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          
          {item.type === 'system_reset' && profile?.id !== item.data.user_id && (
            <button 
              onClick={handleExecuteReset}
              disabled={isProcessing}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-700 transition-all flex items-center"
              title="Authorize and execute factory reset"
            >
              {isProcessing ? (
                <RefreshCw className="h-3 w-3 animate-spin mr-2" />
              ) : (
                <Check className="h-3 w-3 mr-2" />
              )}
              Authorize & Execute
            </button>
          )}
          
          {item.type === 'expense' && (
            <button 
              onClick={() => handleApproveExpense(item.data)} 
              className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              title="Approve expense"
            >
              <Check className="h-4 w-4" />
            </button>
          )}
          
          {item.type === 'task' && (
            <button 
              onClick={() => handleApproveTask(item.data)} 
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
              title="Approve task"
            >
              <Check className="h-4 w-4" />
            </button>
          )}
          
          {item.type === 'user' && (
            <button 
              onClick={() => handleApproveUser(item.data)} 
              className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              title="Approve user archive"
            >
              <Check className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  if (totalPending === 0) return (
      <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-200">
          <ShieldCheck className="h-12 w-12 text-green-100 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-gray-900">System Clear</h3>
          <p className="text-xs text-gray-500">No actions currently require your oversight.</p>
      </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <ShieldCheck className="h-5 w-5 mr-2 text-indigo-600" />
              Oversight Queue
          </h3>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full uppercase">
                {totalPending} Pending Actions
            </span>
            {selectedItems.size > 0 && (
              <button
                onClick={handleBulkApprove}
                className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors flex items-center"
                title={`Approve ${selectedItems.size} selected items`}
              >
                <Check className="h-3 w-3 mr-1" />
                Approve ({selectedItems.size})
              </button>
            )}
          </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search queue items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              title="Toggle filters"
            >
              <Filter className="h-4 w-4" />
              Filters
              <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {showFilters && (
              <div className="flex items-center gap-2">
                <select
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value as QueueFilter)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  aria-label="Filter by category"
                  title="Filter queue items by category"
                >
                  <option value="all">All Items</option>
                  <option value="critical">Critical Only</option>
                  <option value="loans">Loans</option>
                  <option value="expenses">Expenses</option>
                  <option value="tasks">Tasks</option>
                  <option value="users">Users</option>
                  <option value="system">System</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  aria-label="Sort items"
                  title="Sort queue items by selected criteria"
                >
                  <option value="priority">Sort by Priority</option>
                  <option value="date">Sort by Date</option>
                  <option value="type">Sort by Type</option>
                  <option value="amount">Sort by Amount</option>
                </select>
              </div>
            )}
          </div>

          {filteredAndSortedItems.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 transition-colors"
                title={selectedItems.size === filteredAndSortedItems.length ? 'Deselect all' : 'Select all'}
              >
                {selectedItems.size === filteredAndSortedItems.length ? (
                  <CheckSquare className="h-3 w-3" />
                ) : (
                  <Square className="h-3 w-3" />
                )}
                Select All
              </button>
            </div>
          )}
        </div>

        {/* Active Filters Display */}
        {(activeFilter !== 'all' || searchQuery) && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Active filters:</span>
            {activeFilter !== 'all' && (
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                {activeFilter}
              </span>
            )}
            {searchQuery && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">
                "{searchQuery}"
              </span>
            )}
          </div>
        )}
      </div>

      {/* Queue Items */}
      {filteredAndSortedItems.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-200">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-gray-900">No Items Found</h3>
          <p className="text-xs text-gray-500">
            {searchQuery || activeFilter !== 'all' 
              ? 'Try adjusting your search or filters' 
              : 'No actions match your criteria'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAndSortedItems.map(renderQueueItem)}
        </div>
      )}
    </div>
  );
};