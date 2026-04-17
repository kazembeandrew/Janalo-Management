import { 
  BaseServiceClass, 
  ServiceResult, 
  PaginationParams, 
  ListResponse 
} from './_shared/baseService';
import { UserRole } from '../types';
import { validateRequiredFields } from './_shared/utils';
import { supabase } from '../integrations/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

export interface ApprovalRequest {
  id: string;
  request_type: 'repayment_reversal' | 'loan_write_off' | 'journal_adjustment' | 'expense_approval' | 'loan_disbursement' | 'account_adjustment';
  reference_id: string;
  reference_number?: string;
  amount?: number;
  currency: string;
  requested_by: string;
  requested_at: string;
  reason: string;
  supporting_documents?: string[];
  required_approver_role: UserRole;
  approver_user_id?: string;
  approval_level: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  requester?: {
    full_name: string;
    role: UserRole;
  };
  approver?: {
    full_name: string;
    role: UserRole;
  };
}

export interface ApprovalHistory {
  id: string;
  approval_request_id: string;
  action: 'submitted' | 'approved' | 'rejected' | 'delegated' | 'commented' | 'cancelled';
  performed_by: string;
  performed_at: string;
  comment?: string;
  previous_status?: string;
  new_status?: string;
  delegated_to?: string;
  delegation_reason?: string;
  performer?: {
    full_name: string;
    role: UserRole;
  };
}

export interface ApprovalThreshold {
  id: string;
  operation_type: string;
  level_1_role: UserRole;
  level_1_max_amount: number | null;
  level_2_role: UserRole | null;
  level_2_max_amount: number | null;
  level_3_role: UserRole | null;
  level_3_max_amount: number | null;
  requires_dual_approval: boolean;
  requires_board_approval: boolean;
  auto_approve_below: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PendingApprovalSummary {
  approval_id: string;
  request_type: string;
  reference_number: string;
  amount: number;
  requested_by_name: string;
  requested_at: string;
  reason: string;
  days_pending: number;
  expires_in_days: number;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class ApprovalWorkflowService extends BaseServiceClass {
  private static instance: ApprovalWorkflowService;

  public static getInstance(): ApprovalWorkflowService {
    if (!ApprovalWorkflowService.instance) {
      ApprovalWorkflowService.instance = new ApprovalWorkflowService();
    }
    return ApprovalWorkflowService.instance;
  }

  // ============================================================================
  // APPROVAL REQUESTS
  // ============================================================================

  /**
   * Request approval for repayment reversal
   */
  async requestRepaymentReversal(params: {
    repayment_id: string;
    reason: string;
  }): Promise<ServiceResult<any>> {
    return this.handleAsyncOperation(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('request_repayment_reversal_approval', {
        p_repayment_id: params.repayment_id,
        p_user_id: user.id,
        p_reason: params.reason
      });

      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to request approval');
      }

      return data;
    }, 'Failed to request repayment reversal approval');
  }

  /**
   * Request approval for loan write-off
   */
  async requestLoanWriteOff(params: {
    loan_id: string;
    reason: string;
    supporting_documents?: string[];
  }): Promise<ServiceResult<any>> {
    return this.handleAsyncOperation(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('request_loan_writeoff_approval', {
        p_loan_id: params.loan_id,
        p_user_id: user.id,
        p_reason: params.reason,
        p_supporting_docs: params.supporting_documents || []
      });

      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to request approval');
      }

      return data;
    }, 'Failed to request loan write-off approval');
  }

  /**
   * Create generic approval request
   */
  async createApprovalRequest(input: {
    request_type: ApprovalRequest['request_type'];
    reference_id: string;
    reference_number?: string;
    amount?: number;
    reason: string;
    supporting_documents?: string[];
  }): Promise<ServiceResult<ApprovalRequest>> {
    return this.handleAsyncOperation(async () => {
      const requiredFields = ['request_type', 'reference_id', 'reason'];
      const missing = validateRequiredFields(input, requiredFields);
      
      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Determine required approver
      const { data: approverInfo, error: approverError } = await supabase.rpc(
        'determine_required_approver',
        {
          p_operation_type: input.request_type,
          p_amount: input.amount || 0
        }
      );

      if (approverError) throw approverError;

      const approverData = approverInfo as { auto_approve?: boolean; required_role?: string; required_user_id?: string; approval_level?: number };

      // Check if auto-approved
      if (approverData?.auto_approve) {
        throw new Error('This request is below the approval threshold and does not require approval');
      }

      // Create approval request
      const { data, error } = await supabase
        .from('approval_requests')
        .insert({
          request_type: input.request_type,
          reference_id: input.reference_id,
          reference_number: input.reference_number,
          amount: input.amount,
          requested_by: user.id,
          reason: input.reason,
          supporting_documents: input.supporting_documents,
          required_approver_role: approverData.required_role,
          approver_user_id: approverData.required_user_id,
          approval_level: approverData.approval_level,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      // Log history
      await supabase.from('approval_history').insert({
        approval_request_id: data.id,
        action: 'submitted',
        performed_by: user.id,
        comment: input.reason,
        new_status: 'pending'
      });

      return data as ApprovalRequest;
    }, 'Failed to create approval request');
  }

  /**
   * Get approval request by ID with history
   */
  async getApprovalRequestById(id: string): Promise<ServiceResult<ApprovalRequest & { history?: ApprovalHistory[] }>> {
    return this.handleAsyncOperation(async () => {
      const { data: request, error: reqError } = await supabase
        .from('approval_requests')
        .select(`
          *,
          requester:users!requested_by(full_name, role),
          approver:users!approved_by(full_name, role)
        `)
        .eq('id', id)
        .single();

      if (reqError) throw reqError;
      if (!request) throw new Error('Approval request not found');

      const { data: history, error: histError } = await supabase
        .from('approval_history')
        .select(`
          *,
          performer:users!performed_by(full_name, role)
        `)
        .eq('approval_request_id', id)
        .order('performed_at', { ascending: true });

      if (histError) throw histError;

      return {
        ...request,
        history: history || []
      } as any;
    }, 'Failed to fetch approval request');
  }

  /**
   * Get pending approvals for current user
   */
  async getPendingApprovals(): Promise<ServiceResult<PendingApprovalSummary[]>> {
    return this.handleAsyncOperation(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('get_pending_approvals_for_user', {
        p_user_id: user.id
      });

      if (error) throw error;
      return (data as PendingApprovalSummary[]) || [];
    }, 'Failed to fetch pending approvals');
  }

  /**
   * Get all approval requests with filtering
   */
  async getApprovalRequests(
    filters?: {
      status?: string;
      request_type?: string;
      requested_by?: string;
    },
    pagination?: PaginationParams
  ): Promise<ServiceResult<ListResponse<ApprovalRequest>>> {
    return this.handleAsyncOperation(async () => {
      let query = supabase
        .from('approval_requests')
        .select(`
          *,
          requester:users!requested_by(full_name, role),
          approver:users!approved_by(full_name, role)
        `, { count: 'exact' });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.request_type) {
        query = query.eq('request_type', filters.request_type);
      }
      if (filters?.requested_by) {
        query = query.eq('requested_by', filters.requested_by);
      }

      query = query.order('requested_at', { ascending: false });

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const start = (page - 1) * limit;

      const { data, count, error } = await query.range(start, start + limit - 1);

      if (error) throw error;

      return {
        data: (data || []) as ApprovalRequest[],
        total: count || 0,
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : 0
      };
    }, 'Failed to fetch approval requests');
  }

  // ============================================================================
  // APPROVAL ACTIONS
  // ============================================================================

  /**
   * Approve or reject an approval request
   */
  async processApproval(params: {
    approval_id: string;
    approve: boolean;
    comment?: string;
    rejection_reason?: string;
  }): Promise<ServiceResult<any>> {
    return this.handleAsyncOperation(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!params.approve && !params.rejection_reason) {
        throw new Error('Rejection reason is required when rejecting');
      }

      const { data, error } = await supabase.rpc('process_approval', {
        p_approval_id: params.approval_id,
        p_approver_id: user.id,
        p_approve: params.approve,
        p_comment: params.comment,
        p_rejection_reason: params.rejection_reason
      });

      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to process approval');
      }

      return data;
    }, 'Failed to process approval');
  }

  /**
   * Cancel approval request (by requester only)
   */
  async cancelApprovalRequest(approvalId: string, reason: string): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: request, error: fetchError } = await supabase
        .from('approval_requests')
        .select('requested_by, status')
        .eq('id', approvalId)
        .single();

      if (fetchError) throw fetchError;
      if (!request) throw new Error('Approval request not found');

      const reqData = request as { requested_by: string; status: string };

      if (reqData.requested_by !== user.id) {
        throw new Error('Only the requester can cancel an approval request');
      }

      if (reqData.status !== 'pending') {
        throw new Error('Cannot cancel a request that is not pending');
      }

      const { error } = await supabase
        .from('approval_requests')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', approvalId);

      if (error) throw error;

      // Log history
      await supabase.from('approval_history').insert({
        approval_request_id: approvalId,
        action: 'cancelled',
        performed_by: user.id,
        comment: reason,
        previous_status: 'pending',
        new_status: 'cancelled'
      });

      return true;
    }, 'Failed to cancel approval request');
  }

  // ============================================================================
  // APPROVAL THRESHOLDS
  // ============================================================================

  /**
   * Get approval thresholds configuration
   */
  async getApprovalThresholds(): Promise<ServiceResult<ApprovalThreshold[]>> {
    return this.handleAsyncOperation(async () => {
      const { data, error } = await supabase
        .from('approval_thresholds')
        .select('*')
        .eq('is_active', true)
        .order('operation_type', { ascending: true });

      if (error) throw error;
      return (data || []) as any;
    }, 'Failed to fetch approval thresholds');
  }

  /**
   * Update approval threshold (admin only)
   */
  async updateApprovalThreshold(thresholdId: string, updates: Partial<ApprovalThreshold>): Promise<ServiceResult<ApprovalThreshold>> {
    return this.handleAsyncOperation(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Verify admin role
      const { data: userProfile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userProfile?.role !== 'admin') {
        throw new Error('Only administrators can update approval thresholds');
      }

      const { data, error } = await supabase
        .from('approval_thresholds')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', thresholdId)
        .select()
        .single();

      if (error) throw error;
      return data as any;
    }, 'Failed to update approval threshold');
  }

  // ============================================================================
  // DELEGATION
  // ============================================================================

  /**
   * Delegate approval authority to another user
   */
  async delegateApprovalAuthority(params: {
    delegated_to_role: UserRole;
    delegation_start: string;
    delegation_end: string;
  }): Promise<ServiceResult<boolean>> {
    return this.handleAsyncOperation(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('users')
        .update({
          delegated_role: params.delegated_to_role,
          delegation_start: params.delegation_start,
          delegation_end: params.delegation_end
        })
        .eq('id', user.id);

      if (error) throw error;
      return true;
    }, 'Failed to delegate approval authority');
  }
}

// Export singleton instance
export const approvalWorkflowService = ApprovalWorkflowService.getInstance();
