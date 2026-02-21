import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Task, UserProfile } from '@/types';
import { Plus, Search, ClipboardList, CheckCircle2, Clock, AlertCircle, X, User, RefreshCw, Trash2, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export const Tasks: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsProcessing(true);

    try {
      const { error } = await supabase.from('tasks').insert([{
        ...formData,
        created_by: profile.id,
        status: 'pending_approval'
      }]);

      if (error) throw error;
      
      toast.success('Task proposed. Awaiting CEO authorization.');
      setIsModalOpen(false);
      setFormData({ title: '', description: '', assigned_to: '', priority: 'medium' });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
      const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
      if (!error) {
          toast.success(`Task updated to ${newStatus.replace('_', ' ')}`);
          fetchTasks();
      }
  };

  const handleDelete = async (id: string) => {
      if (!confirm('Delete this task?')) return;
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (!error) {
          toast.success('Task removed');
          fetchTasks();
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Operational Tasks & Allocations</h1>
            <p className="text-sm text-gray-500">Manage company objectives and staff resource allocation.</p>
        </div>
        {(isCEO || isHR) && (
            <button onClick={() => setIsModalOpen(true)} className="bg-indigo-900 text-white px-4 py-2 rounded-xl font-bold flex items-center shadow-lg shadow-indigo-200">
                <Plus className="h-4 w-4 mr-2" /> Propose Task
            </button>
        )}
      </div>

      {loading && tasks.length === 0 ? (
          <div className="flex justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['pending_approval', 'approved', 'in_progress', 'completed'].map(status => (
                  <div key={status} className="space-y-4">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center">
                          {status.replace('_', ' ')}
                          <span className="ml-2 bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md text-[10px]">
                              {tasks.filter(t => t.status === status).length}
                          </span>
                      </h3>
                      <div className="space-y-3">
                          {tasks.filter(t => t.status === status).map(task => (
                              <div key={task.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                                  <div className="flex justify-between items-start mb-2">
                                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase border ${getPriorityColor(task.priority)}`}>
                                          {task.priority}
                                      </span>
                                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          {isCEO && task.status === 'pending_approval' && (
                                              <button onClick={() => handleUpdateStatus(task.id, 'approved')} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Approve"><Check className="h-3 w-3" /></button>
                                          )}
                                          {(isCEO || isHR) && (
                                              <button onClick={() => handleDelete(task.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Delete"><Trash2 className="h-3 w-3" /></button>
                                          )}
                                      </div>
                                  </div>
                                  <h4 className="text-sm font-bold text-gray-900 mb-1">{task.title}</h4>
                                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">{task.description}</p>
                                  <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                                      <div className="flex items-center text-[10px] text-gray-400">
                                          <User className="h-3 w-3 mr-1" />
                                          {task.users?.full_name || 'Unassigned'}
                                      </div>
                                      {task.status === 'approved' && (profile?.id === task.assigned_to || isCEO) && (
                                          <button onClick={() => handleUpdateStatus(task.id, 'in_progress')} className="text-[10px] font-bold text-indigo-600 hover:underline">Start Task</button>
                                      )}
                                      {task.status === 'in_progress' && (profile?.id === task.assigned_to || isCEO) && (
                                          <button onClick={() => handleUpdateStatus(task.id, 'completed')} className="text-[10px] font-bold text-green-600 hover:underline">Complete</button>
                                      )}
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              ))}
          </div>
      )}

      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                  <div className="bg-indigo-900 px-6 py-5 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center text-lg"><ClipboardList className="mr-3 h-6 w-6 text-indigo-300" /> Propose Task</h3>
                      <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="h-5 w-5 text-indigo-300" /></button>
                  </div>
                  <form onSubmit={handleSubmit} className="p-8 space-y-5">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Task Title</label>
                          <input required type="text" className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Open Lilongwe Branch" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Description</label>
                          <textarea required className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 h-24" placeholder="Details of the task or allocation..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Assign To</label>
                              <select required className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white" value={formData.assigned_to} onChange={e => setFormData({...formData, assigned_to: e.target.value})}>
                                  <option value="">-- Select Staff --</option>
                                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Priority</label>
                              <select className="block w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-white" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as any})}>
                                  <option value="low">Low</option>
                                  <option value="medium">Medium</option>
                                  <option value="high">High</option>
                                  <option value="critical">Critical</option>
                              </select>
                          </div>
                      </div>
                      <div className="pt-4">
                          <button type="submit" disabled={isProcessing} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-400 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]">
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