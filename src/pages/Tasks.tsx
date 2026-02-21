import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Task, UserProfile } from '@/types';
import { 
    Plus, Search, ClipboardList, CheckCircle2, Clock, AlertCircle, X, 
    User, RefreshCw, Trash2, Check, Filter, Calendar, Info, ArrowRight,
    ChevronRight, LayoutGrid, ListFilter
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Tasks: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: '',
    priority: 'medium' as any
  });

  const isCEO = effectiveRoles.includes('ceo') || effectiveRoles.includes('admin');
  const isHR = effectiveRoles.includes('hr') || effectiveRoles.includes('admin');

  useEffect(() => {
    fetchTasks();
    fetchUsers();

    const channel = supabase.channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchTasks())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*, users!assigned_to(full_name)')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setTasks(data as any || []);
    } catch (e: any) {
        console.error("Task fetch error:", e);
    } finally {
        setLoading(false);
    }
  };

  const fetchUsers = async () => {
      const { data } = await supabase.from('users').select('*').eq('is_active', true);
      if (data) setUsers(data as any);
  };

  const logAudit = async (action: string, details: any, entityId: string) => {
      if (!profile) return;
      await supabase.from('audit_logs').insert({
          user_id: profile.id,
          action,
          entity_type: 'task',
          entity_id: entityId,
          details
      });
  };

  const createNotification = async (userId: string, title: string, message: string, taskId: string) => {
      await supabase.from('notifications').insert({
          user_id: userId,
          title,
          message,
          link: '/tasks',
          type: 'success'
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsProcessing(true);

    try {
      const { data, error } = await supabase.from('tasks').insert([{
        ...formData,
        created_by: profile.id,
        status: 'pending_approval'
      }]).select().single();

      if (error) throw error;
      
      await logAudit('Task Proposed', { title: formData.title, priority: formData.priority }, data.id);
      
      toast.success('Task proposed. Awaiting CEO authorization.');
      setIsModalOpen(false);
      setFormData({ title: '', description: '', assigned_to: '', priority: 'medium' });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateStatus = async (task: Task, newStatus: string) => {
      setIsProcessing(true);
      try {
          const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
          if (error) throw error;

          await logAudit(`Task ${newStatus.replace('_', ' ')}`, { title: task.title }, task.id);
          
          if (newStatus === 'approved') {
              await createNotification(task.assigned_to, 'New Task Assigned', `CEO has authorized the task: "${task.title}". You can now start working on it.`, task.id);
          } else if (newStatus === 'completed') {
              await createNotification(task.assigned_to, 'Task Completed', `CEO has marked your task "${task.title}" as completed.`, task.id);
          }

          toast.success(`Task updated to ${newStatus.replace('_', ' ')}`);
          if (selectedTask?.id === task.id) {
              setSelectedTask(prev => prev ? { ...prev, status: newStatus as any } : null);
          }
          fetchTasks();
      } catch (e: any) {
          toast.error("Update failed");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleDelete = async (task: Task) => {
      if (!confirm('Are you sure you want to permanently delete this task?')) return;
      try {
          const { error } = await supabase.from('tasks').delete().eq('id', task.id);
          if (error) throw error;
          await logAudit('Task Deleted', { title: task.title }, task.id);
          toast.success('Task removed');
          setSelectedTask(null);
          fetchTasks();
      } catch (e: any) {
          toast.error("Deletion failed");
      }
  };

  const getPriorityColor = (p: string) => {
      switch(p) {
          case 'critical': return 'bg-red-100 text-red-700 border-red-200';
          case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
          case 'medium': return 'bg-blue-100 text-blue-700 border-blue-200';
          default: return 'bg-gray-100 text-gray-700 border-gray-200';
      }
  };

  const filteredTasks = tasks.filter(t => {
      const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           t.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
      return matchesSearch && matchesPriority;
  });

  const renderTaskCard = (task: Task) => {
      const isAssignedToMe = profile?.id === task.assigned_to;
      
      return (
          <div 
            key={task.id} 
            onClick={() => setSelectedTask(task)}
            className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group cursor-pointer relative overflow-hidden"
          >
              <div className={`absolute top-0 left-0 w-1 h-full ${
                  task.priority === 'critical' ? 'bg-red-500' : 
                  task.priority === 'high' ? 'bg-orange-500' : 
                  task.priority === 'medium' ? 'bg-blue-500' : 'bg-gray-300'
              }`} />
              
              <div className="flex justify-between items-start mb-2">
                  <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase border ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isCEO && task.status === 'pending_approval' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleUpdateStatus(task, 'approved'); }} 
                            className="p-1 text-green-600 hover:bg-green-50 rounded" 
                            title="Approve"
                          >
                              <Check className="h-3.5 w-3.5" />
                          </button>
                      )}
                      {(isCEO || isHR) && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(task); }} 
                            className="p-1 text-red-600 hover:bg-red-50 rounded" 
                            title="Delete"
                          >
                              <Trash2 className="h-3.5 w-3.5" />
                          </button>
                      )}
                  </div>
              </div>
              
              <h4 className="text-sm font-bold text-gray-900 mb-1 line-clamp-1">{task.title}</h4>
              <p className="text-xs text-gray-500 line-clamp-2 mb-4 leading-relaxed">{task.description}</p>
              
              <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  <div className="flex items-center text-[10px] text-gray-400 font-medium">
                      <div className="h-5 w-5 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mr-1.5">
                          <User className="h-3 w-3" />
                      </div>
                      {task.users?.full_name || 'Unassigned'}
                  </div>
                  <div className="flex items-center gap-2">
                      {task.status === 'approved' && isAssignedToMe && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleUpdateStatus(task, 'in_progress'); }}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                          >
                              Start
                          </button>
                      )}
                      {task.status === 'in_progress' && isCEO && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleUpdateStatus(task, 'completed'); }}
                            className="text-[10px] font-bold text-green-600 hover:text-green-800"
                          >
                              Done
                          </button>
                      )}
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Operational Tasks & Allocations</h1>
            <p className="text-sm text-gray-500">Manage company objectives and staff resource allocation.</p>
        </div>
        {(isCEO || isHR) && (
            <button 
                onClick={() => setIsModalOpen(true)} 
                className="bg-indigo-900 hover:bg-indigo-800 text-white px-5 py-2.5 rounded-xl font-bold flex items-center shadow-lg shadow-indigo-200 transition-all active:scale-95"
            >
                <Plus className="h-5 w-5 mr-2" /> Propose Task
            </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search tasks or descriptions..." 
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
          </div>
          <div className="flex items-center gap-2">
              <ListFilter className="h-4 w-4 text-gray-400" />
              <select 
                className="bg-gray-50 border-none rounded-xl text-sm py-2 pl-3 pr-8 focus:ring-2 focus:ring-indigo-500 transition-all"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                  <option value="all">All Priorities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
              </select>
          </div>
      </div>

      {loading && tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
              <RefreshCw className="h-10 w-10 animate-spin text-indigo-600 mb-4" />
              <p className="text-gray-500 font-medium">Syncing operational board...</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {['pending_approval', 'approved', 'in_progress', 'completed'].map(status => {
                  const columnTasks = filteredTasks.filter(t => t.status === status);
                  return (
                    <div key={status} className="flex flex-col h-full">
                        <div className="flex items-center justify-between mb-4 px-1">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center">
                                {status.replace('_', ' ')}
                                <span className="ml-2 bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-[10px]">
                                    {columnTasks.length}
                                </span>
                            </h3>
                        </div>
                        
                        <div className="flex-1 space-y-4 min-h-[200px] bg-gray-100/50 p-3 rounded-2xl border border-dashed border-gray-200">
                            {columnTasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-32 text-center opacity-40">
                                    <ClipboardList className="h-8 w-8 mb-2" />
                                    <p className="text-[10px] font-bold uppercase tracking-wider">No Tasks</p>
                                </div>
                            ) : (
                                columnTasks.map(task => renderTaskCard(task))
                            )}
                        </div>
                    </div>
                  );
              })}
          </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-indigo-900 px-6 py-5 flex justify-between items-center">
                      <div className="flex items-center">
                          <div className="p-2 bg-white/10 rounded-lg mr-3">
                              <Info className="h-5 w-5 text-indigo-200" />
                          </div>
                          <h3 className="font-bold text-white">Task Details</h3>
                      </div>
                      <button onClick={() => setSelectedTask(null)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                          <X className="h-5 w-5 text-indigo-300" />
                      </button>
                  </div>
                  <div className="p-8 space-y-6">
                      <div>
                          <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getPriorityColor(selectedTask.priority)}`}>
                                  {selectedTask.priority}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-bold uppercase border border-gray-200">
                                  {selectedTask.status.replace('_', ' ')}
                              </span>
                          </div>
                          <h2 className="text-xl font-bold text-gray-900">{selectedTask.title}</h2>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedTask.description}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                  <User className="h-5 w-5" />
                              </div>
                              <div>
                                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Assigned To</p>
                                  <p className="text-sm font-bold text-gray-900">{selectedTask.users?.full_name || 'Unassigned'}</p>
                              </div>
                          </div>
                          <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                  <Calendar className="h-5 w-5" />
                              </div>
                              <div>
                                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Created On</p>
                                  <p className="text-sm font-bold text-gray-900">{new Date(selectedTask.created_at).toLocaleDateString()}</p>
                              </div>
                          </div>
                      </div>

                      <div className="pt-4 flex gap-3">
                          {isCEO && selectedTask.status === 'pending_approval' && (
                              <button 
                                onClick={() => handleUpdateStatus(selectedTask, 'approved')}
                                className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-700 transition-all shadow-lg shadow-green-100"
                              >
                                  Approve Task
                              </button>
                          )}
                          {selectedTask.status === 'approved' && profile?.id === selectedTask.assigned_to && (
                              <button 
                                onClick={() => handleUpdateStatus(selectedTask, 'in_progress')}
                                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                              >
                                  Start Working
                              </button>
                          )}
                          {selectedTask.status === 'in_progress' && isCEO && (
                              <button 
                                onClick={() => handleUpdateStatus(selectedTask, 'completed')}
                                className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-700 transition-all shadow-lg shadow-green-100"
                              >
                                  Mark as Completed
                              </button>
                          )}
                          {(isCEO || isHR) && (
                              <button 
                                onClick={() => handleDelete(selectedTask)}
                                className="px-4 py-3 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-all"
                              >
                                  <Trash2 className="h-5 w-5" />
                              </button>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Create Task Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                  <div className="bg-indigo-900 px-6 py-5 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center text-lg"><ClipboardList className="mr-3 h-6 w-6 text-indigo-300" /> Propose Task</h3>
                      <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5 text-indigo-300" /></button>
                  </div>
                  <form onSubmit={handleSubmit} className="p-8 space-y-5">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Task Title</label>
                          <input 
                            required 
                            type="text" 
                            className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 transition-all" 
                            placeholder="e.g. Open Lilongwe Branch" 
                            value={formData.title} 
                            onChange={e => setFormData({...formData, title: e.target.value})} 
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Description</label>
                          <textarea 
                            required 
                            className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 h-24 resize-none transition-all" 
                            placeholder="Details of the task or allocation..." 
                            value={formData.description} 
                            onChange={e => setFormData({...formData, description: e.target.value})} 
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Assign To</label>
                              <select 
                                required 
                                className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white transition-all" 
                                value={formData.assigned_to} 
                                onChange={e => setFormData({...formData, assigned_to: e.target.value})}
                              >
                                  <option value="">-- Select Staff --</option>
                                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Priority</label>
                              <select 
                                className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white transition-all" 
                                value={formData.priority} 
                                onChange={e => setFormData({...formData, priority: e.target.value as any})}
                              >
                                  <option value="low">Low</option>
                                  <option value="medium">Medium</option>
                                  <option value="high">High</option>
                                  <option value="critical">Critical</option>
                              </select>
                          </div>
                      </div>
                      <div className="pt-4">
                          <button 
                            type="submit" 
                            disabled={isProcessing} 
                            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-400 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]"
                          >
                              {isProcessing ? 'Submitting...' : 'Submit for CEO Authorization'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};