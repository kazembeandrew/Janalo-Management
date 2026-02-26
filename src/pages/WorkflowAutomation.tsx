import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  Zap, 
  Plus, 
  Play, 
  Pause, 
  Edit, 
  Trash2, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Settings,
  ArrowRight,
  Save,
  Eye,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  entity_type: string;
  trigger_event: string;
  conditions: any;
  actions: any;
  is_active: boolean;
  priority: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator?: {
    full_name: string;
  };
}

interface WorkflowExecution {
  id: string;
  workflow_id: string;
  entity_id: string;
  entity_type: string;
  status: string;
  started_at: string;
  completed_at?: string;
  error_message?: string;
  execution_log?: any;
  triggered_by?: string;
  workflow?: {
    name: string;
  };
}

interface WorkflowStep {
  id: string;
  type: 'condition' | 'action';
  data: any;
  order: number;
}

export const WorkflowAutomation: React.FC = () => {
  const { profile, effectiveRoles } = useAuth();
  const [activeTab, setActiveTab] = useState<'workflows' | 'executions' | 'builder'>('workflows');
  const [loading, setLoading] = useState(true);
  
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowDefinition | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    entity_type: 'loan',
    trigger_event: 'create',
    conditions: {},
    actions: {},
    priority: 1
  });

  const isAuthorized = effectiveRoles.includes('admin') || effectiveRoles.includes('ceo');

  useEffect(() => {
    if (!isAuthorized) {
      toast.error('You are not authorized to access this page');
      return;
    }
    fetchWorkflowData();
  }, [isAuthorized]);

  const fetchWorkflowData = async () => {
    setLoading(true);
    try {
      const [workflowsRes, executionsRes] = await Promise.all([
        supabase
          .from('workflow_definitions')
          .select('*, creator:profiles!workflow_definitions_created_by_fkey(full_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('workflow_executions')
          .select('*, workflow:workflow_definitions!workflow_executions_workflow_id_fkey(name)')
          .order('started_at', { ascending: false })
          .limit(50)
      ]);

      if (workflowsRes.data) setWorkflows(workflowsRes.data);
      if (executionsRes.data) setExecutions(executionsRes.data);
    } catch (error) {
      console.error('Error fetching workflow data:', error);
      toast.error('Failed to load workflow data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'cancelled': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getEntityTypeIcon = (entityType: string) => {
    switch (entityType) {
      case 'loan': return '💰';
      case 'expense': return '🧾';
      case 'document': return '📄';
      case 'user': return '👤';
      default: return '📋';
    }
  };

  const createWorkflow = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workflow_definitions')
        .insert({
          ...newWorkflow,
          created_by: profile?.id
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Workflow created successfully');
      setNewWorkflow({
        name: '',
        description: '',
        entity_type: 'loan',
        trigger_event: 'create',
        conditions: {},
        actions: {},
        priority: 1
      });
      fetchWorkflowData();
    } catch (error) {
      console.error('Error creating workflow:', error);
      toast.error('Failed to create workflow');
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkflow = async (workflowId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('workflow_definitions')
        .update({ is_active: isActive })
        .eq('id', workflowId);

      if (error) throw error;
      
      toast.success(`Workflow ${isActive ? 'activated' : 'deactivated'} successfully`);
      fetchWorkflowData();
    } catch (error) {
      console.error('Error toggling workflow:', error);
      toast.error('Failed to toggle workflow');
    }
  };

  const deleteWorkflow = async (workflowId: string) => {
    if (!confirm('Are you sure you want to delete this workflow? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('workflow_definitions')
        .delete()
        .eq('id', workflowId);

      if (error) throw error;
      
      toast.success('Workflow deleted successfully');
      fetchWorkflowData();
    } catch (error) {
      console.error('Error deleting workflow:', error);
      toast.error('Failed to delete workflow');
    }
  };

  const executeWorkflow = async (workflowId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('execute_workflow', { workflow_id: workflowId });
      if (error) throw error;
      
      toast.success('Workflow execution started');
      fetchWorkflowData();
    } catch (error) {
      console.error('Error executing workflow:', error);
      toast.error('Failed to execute workflow');
    } finally {
      setLoading(false);
    }
  };

  const addConditionStep = () => {
    const newStep: WorkflowStep = {
      id: Date.now().toString(),
      type: 'condition',
      data: {
        field: '',
        operator: 'equals',
        value: '',
        logic: 'and'
      },
      order: workflowSteps.length
    };
    setWorkflowSteps([...workflowSteps, newStep]);
  };

  const addActionStep = () => {
    const newStep: WorkflowStep = {
      id: Date.now().toString(),
      type: 'action',
      data: {
        action_type: 'send_notification',
        parameters: {}
      },
      order: workflowSteps.length
    };
    setWorkflowSteps([...workflowSteps, newStep]);
  };

  const updateStep = (stepId: string, data: any) => {
    setWorkflowSteps(workflowSteps.map(step => 
        step.id === stepId ? { ...step, data } : step
      ));
  };

  const removeStep = (stepId: string) => {
    setWorkflowSteps(workflowSteps.filter(step => step.id !== stepId));
  };

  const saveWorkflow = async () => {
    try {
      setLoading(true);
      const conditions = workflowSteps
        .filter(step => step.type === 'condition')
        .reduce((acc, step) => ({ ...acc, [step.id]: step.data }), {});
      
      const actions = workflowSteps
        .filter(step => step.type === 'action')
        .reduce((acc, step) => ({ ...acc, [step.id]: step.data }), {});

      if (editingWorkflow) {
        const { error } = await supabase
          .from('workflow_definitions')
          .update({
            name: newWorkflow.name,
            description: newWorkflow.description,
            entity_type: newWorkflow.entity_type,
            trigger_event: newWorkflow.trigger_event,
            conditions,
            actions,
            priority: newWorkflow.priority
          })
          .eq('id', editingWorkflow.id);

        if (error) throw error;
        toast.success('Workflow updated successfully');
      } else {
        const { error } = await supabase
          .from('workflow_definitions')
          .insert({
            ...newWorkflow,
            conditions,
            actions,
            created_by: profile?.id
          });

        if (error) throw error;
        toast.success('Workflow created successfully');
      }

      setShowBuilder(false);
      setEditingWorkflow(null);
      setWorkflowSteps([]);
      fetchWorkflowData();
    } catch (error) {
      console.error('Error saving workflow:', error);
      toast.error('Failed to save workflow');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
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
          <h1 className="text-2xl font-bold text-gray-900">Workflow Automation</h1>
          <p className="text-gray-600">Create and manage automated workflows</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={fetchWorkflowData}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              setEditingWorkflow(null);
              setWorkflowSteps([]);
              setNewWorkflow({
                name: '',
                description: '',
                entity_type: 'loan',
                trigger_event: 'create',
                conditions: {},
                actions: {},
                priority: 1
              });
              setShowBuilder(true);
            }}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Workflow
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Workflows</p>
              <p className="text-2xl font-bold text-gray-900">{workflows.length}</p>
            </div>
            <Zap className="h-8 w-8 text-indigo-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Workflows</p>
              <p className="text-2xl font-bold text-gray-900">
                {workflows.filter(w => w.is_active).length}
              </p>
            </div>
            <Play className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Running Executions</p>
              <p className="text-2xl font-bold text-gray-900">
                {executions.filter(e => e.status === 'running').length}
              </p>
            </div>
            <Clock className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Failed Today</p>
              <p className="text-2xl font-bold text-gray-900">
                {executions.filter(e => 
                  e.status === 'failed' && 
                  new Date(e.started_at).toDateString() === new Date().toDateString()
                ).length}
              </p>
            </div>
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Workflow Builder Modal */}
      {showBuilder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-xl bg-white">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {editingWorkflow ? 'Edit Workflow' : 'Create New Workflow'}
              </h3>
              <button
                onClick={() => setShowBuilder(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Workflow Name
                  </label>
                  <input
                    type="text"
                    value={newWorkflow.name}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter workflow name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Entity Type
                  </label>
                  <select
                    value={newWorkflow.entity_type}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, entity_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="loan">Loan</option>
                    <option value="expense">Expense</option>
                    <option value="document">Document</option>
                    <option value="user">User</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newWorkflow.description}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    rows={3}
                    placeholder="Describe what this workflow does"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trigger Event
                  </label>
                  <select
                    value={newWorkflow.trigger_event}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, trigger_event: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="create">Create</option>
                    <option value="update">Update</option>
                    <option value="status_change">Status Change</option>
                    <option value="delete">Delete</option>
                  </select>
                </div>
              </div>

              {/* Workflow Steps */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-900">Workflow Steps</h4>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={addConditionStep}
                      className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Condition
                    </button>
                    <button
                      onClick={addActionStep}
                      className="flex items-center px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Action
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {workflowSteps.map((step, index) => (
                    <div key={step.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-900">
                            {step.type === 'condition' ? '🔍 Condition' : '⚡ Action'} {index + 1}
                          </span>
                          {index < workflowSteps.length - 1 && (
                            <ArrowRight className="h-4 w-4 text-gray-400 mx-2" />
                          )}
                        </div>
                        <button
                          onClick={() => removeStep(step.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {step.type === 'condition' ? (
                        <div className="grid grid-cols-4 gap-3">
                          <select
                            value={step.data.field || ''}
                            onChange={(e) => updateStep(step.id, { ...step.data, field: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="">Select field...</option>
                            <option value="amount">Amount</option>
                            <option value="status">Status</option>
                            <option value="priority">Priority</option>
                          </select>
                          <select
                            value={step.data.operator || ''}
                            onChange={(e) => updateStep(step.id, { ...step.data, operator: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="equals">Equals</option>
                            <option value="not_equals">Not Equals</option>
                            <option value="greater_than">Greater Than</option>
                            <option value="less_than">Less Than</option>
                          </select>
                          <input
                            type="text"
                            value={step.data.value || ''}
                            onChange={(e) => updateStep(step.id, { ...step.data, value: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="Value"
                          />
                          <select
                            value={step.data.logic || 'and'}
                            onChange={(e) => updateStep(step.id, { ...step.data, logic: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="and">AND</option>
                            <option value="or">OR</option>
                          </select>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <select
                            value={step.data.action_type || ''}
                            onChange={(e) => updateStep(step.id, { ...step.data, action_type: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="send_notification">Send Notification</option>
                            <option value="send_email">Send Email</option>
                            <option value="update_status">Update Status</option>
                            <option value="assign_user">Assign User</option>
                            <option value="create_task">Create Task</option>
                          </select>
                          <input
                            type="text"
                            value={step.data.parameters?.message || ''}
                            onChange={(e) => updateStep(step.id, { 
                              ...step.data, 
                              parameters: { ...step.data.parameters, message: e.target.value }
                            })}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="Parameters (JSON)"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-4 pt-4 border-t">
                <button
                  onClick={() => setShowBuilder(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveWorkflow}
                  disabled={loading || !newWorkflow.name}
                  className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Workflow'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { id: 'workflows', name: 'Workflows', icon: Settings },
              { id: 'executions', name: 'Executions', icon: Clock },
              { id: 'builder', name: 'Visual Builder', icon: Zap }
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
          {/* Workflows Tab */}
          {activeTab === 'workflows' && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Workflow
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Entity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Trigger
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {workflows.map((workflow) => (
                      <tr key={workflow.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{workflow.name}</p>
                            <p className="text-xs text-gray-500">{workflow.description}</p>
                            <p className="text-xs text-gray-400">Created by {workflow.creator?.full_name}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="mr-2">{getEntityTypeIcon(workflow.entity_type)}</span>
                          {workflow.entity_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {workflow.trigger_event}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            workflow.is_active ? 'text-green-600 bg-green-100' : 'text-gray-600 bg-gray-100'
                          }`}>
                            {workflow.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {workflow.priority}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => toggleWorkflow(workflow.id, !workflow.is_active)}
                            className={`hover:text-${workflow.is_active ? 'yellow' : 'green'}-600`}
                            title={workflow.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {workflow.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => executeWorkflow(workflow.id)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Execute now"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                          <button
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteWorkflow(workflow.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
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

          {/* Executions Tab */}
          {activeTab === 'executions' && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Workflow
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Entity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Started
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duration
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
                    {executions.map((execution) => (
                      <tr key={execution.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {execution.workflow?.name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="mr-2">{getEntityTypeIcon(execution.entity_type)}</span>
                          {execution.entity_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(execution.started_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {execution.completed_at 
                            ? `${Math.round((new Date(execution.completed_at).getTime() - new Date(execution.started_at).getTime()) / 1000)}s`
                            : 'Running...'
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(execution.status)}`}>
                            {execution.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
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

          {/* Visual Builder Tab */}
          {activeTab === 'builder' && (
            <div className="text-center py-12">
              <Zap className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Visual Workflow Builder</h3>
              <p className="text-gray-600 mb-6">
                Drag-and-drop workflow builder coming soon. For now, use the "New Workflow" button to create workflows.
              </p>
              <button
                onClick={() => {
                  setEditingWorkflow(null);
                  setWorkflowSteps([]);
                  setNewWorkflow({
                    name: '',
                    description: '',
                    entity_type: 'loan',
                    trigger_event: 'create',
                    conditions: {},
                    actions: {},
                    priority: 1
                  });
                  setShowBuilder(true);
                }}
                className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Workflow
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
