import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/utils/finance';
import { OfficerFundAllocation, OfficerExpenseClaim, AllocationBalance, UserProfile } from '../types';
import { notificationsService } from './notifications';

const EXPENSE_CATEGORIES = ['Transport', 'Communication', 'Travel', 'Office Supplies', 'Other'];

interface CreateAllocationInput {
  officer_id: string;
  allocated_amount: number;
  allocated_period: string;
  category: string;
  notes?: string;
}

interface AllocationPostingResult {
  success: boolean;
  journal_entry_id?: string;
  message: string;
}

interface CreateClaimInput {
  allocation_id: string;
  expense_id: string;
}

export const fundAllocationService = {
  async getAllocations(filters?: {
    officer_id?: string;
    period?: string;
    category?: string;
    status?: string;
  }): Promise<OfficerFundAllocation[]> {
    let query = supabase
      .from('officer_fund_allocations')
      .select('*, users!officer_fund_allocations_officer_id_fkey(full_name)')
      .order('created_at', { ascending: false });

    if (filters?.officer_id) {
      query = query.eq('officer_id', filters.officer_id);
    }
    if (filters?.period) {
      query = query.eq('allocated_period', filters.period);
    }
    if (filters?.category) {
      query = query.eq('category', filters.category);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getAllocationBalance(officerId: string, period: string): Promise<AllocationBalance[]> {
    const { data, error } = await supabase.rpc('get_officer_allocation_balance', {
      p_officer_id: officerId,
      p_period: period
    });
    if (error) throw error;
    return data || [];
  },

  async createAllocation(input: CreateAllocationInput): Promise<OfficerFundAllocation> {
    const { data, error } = await supabase.rpc('allocate_funds_to_officer', {
      p_officer_id: input.officer_id,
      p_amount: input.allocated_amount,
      p_period: input.allocated_period,
      p_category: input.category,
      p_notes: input.notes
    });
    if (error) throw error;

    const { data: allocation, error: fetchError } = await supabase
      .from('officer_fund_allocations')
      .select('*, users!officer_fund_allocations_officer_id_fkey(full_name)')
      .eq('id', data)
      .single();
    if (fetchError) throw fetchError;
    return allocation;
  },

  /**
   * Post an allocation to the general ledger if it wasn't already posted
   * (useful for manual reconciliation)
   */
  async postAllocationToLedger(allocationId: string): Promise<AllocationPostingResult> {
    const { data, error } = await supabase.rpc('post_allocation_to_ledger', {
      p_allocation_id: allocationId
    });
    if (error) {
      return {
        success: false,
        message: `Failed to post allocation: ${error.message}`
      };
    }
    
    return {
      success: data?.[0]?.success || false,
      journal_entry_id: data?.[0]?.journal_entry_id,
      message: data?.[0]?.message || 'Unknown error'
    };
  },

  async updateAllocation(id: string, updates: Partial<OfficerFundAllocation>): Promise<OfficerFundAllocation> {
    const { data, error } = await supabase
      .from('officer_fund_allocations')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, users!officer_fund_allocations_officer_id_fkey(full_name)')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteAllocation(id: string): Promise<void> {
    const { error } = await supabase
      .from('officer_fund_allocations')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getExpenseClaims(filters?: {
    officer_id?: string;
    allocation_id?: string;
    status?: string;
  }): Promise<OfficerExpenseClaim[]> {
    let query = supabase
      .from('officer_expense_claims')
      .select('*, users!officer_expense_claims_officer_id_fkey(full_name), expenses(*)')
      .order('created_at', { ascending: false });

    if (filters?.officer_id) {
      query = query.eq('officer_id', filters.officer_id);
    }
    if (filters?.allocation_id) {
      query = query.eq('allocation_id', filters.allocation_id);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async createExpenseClaim(input: any): Promise<OfficerExpenseClaim> {
    const { data, error } = await supabase
      .from('officer_expense_claims')
      .insert({
        ...input,
        created_at: new Date().toISOString()
      })
      .select('*, users!officer_expense_claims_officer_id_fkey(full_name)')
      .single();
    if (error) throw error;
    return data;
  },

  async getOfficerClaims(officerId: string, period: string): Promise<OfficerExpenseClaim[]> {
    const { data, error } = await supabase
      .from('officer_expense_claims')
      .select('*, users!officer_expense_claims_officer_id_fkey(full_name)')
      .eq('officer_id', officerId)
      .filter('created_at', 'gte', `${period}-01`)
      .filter('created_at', 'lt', new Date(new Date(period).setMonth(new Date(period).getMonth() + 1)).toISOString().substring(0, 7) + '-01')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createClaim(input: CreateClaimInput): Promise<OfficerExpenseClaim> {
    const { data, error } = await supabase.rpc('claim_expense_against_allocation', {
      p_expense_id: input.expense_id,
      p_allocation_id: input.allocation_id
    });
    if (error) throw error;

    const { data: claim, error: fetchError } = await supabase
      .from('officer_expense_claims')
      .select('*, users!officer_expense_claims_officer_id_fkey(full_name), expenses(*)')
      .eq('id', data)
      .single();
    if (fetchError) throw fetchError;
    return claim;
  },

  async approveClaim(id: string, notes?: string): Promise<OfficerExpenseClaim> {
    const { data, error } = await supabase.rpc('approve_staff_expense_claim', {
      p_claim_id: id,
      p_notes: notes
    });
    
    if (error) throw error;
    
    // The RPC returns a table with success, message, journal_entry_id
    // We fetch the updated claim to return it
    const { data: claim, error: fetchError } = await supabase
      .from('officer_expense_claims')
      .select('*, users!officer_expense_claims_officer_id_fkey(full_name)')
      .eq('id', id)
      .single();
      
    if (fetchError) throw fetchError;

    // Send notification to staff member
    try {
      await notificationsService.createNotification({
        title: 'Expense Claim Approved',
        message: `Your claim for ${formatCurrency(claim.claim_amount)} has been approved.${notes ? ' Note: ' + notes : ''}`,
        type: 'success',
        priority: 'medium',
        recipient_ids: [claim.officer_id],
        category: 'general'
      });
    } catch (notifyError) {
      console.error('Failed to send approval notification:', notifyError);
    }

    return claim;
  },

  async rejectClaim(id: string, notes?: string): Promise<OfficerExpenseClaim> {
    const { data, error } = await supabase
      .from('officer_expense_claims')
      .update({
        status: 'rejected',
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        reviewed_at: new Date().toISOString(),
        notes: notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*, users!officer_expense_claims_officer_id_fkey(full_name)')
      .single();
    if (error) throw error;

    // Send notification to staff member
    try {
      await notificationsService.createNotification({
        title: 'Expense Claim Rejected',
        message: `Your claim for ${formatCurrency(data.claim_amount)} was rejected.${notes ? ' Reason: ' + notes : ''}`,
        type: 'error',
        priority: 'high',
        recipient_ids: [data.officer_id],
        category: 'general'
      });
    } catch (notifyError) {
      console.error('Failed to send rejection notification:', notifyError);
    }

    return data;
  },

  async reconcilePeriod(period: string): Promise<void> {
    const { error } = await supabase.rpc('reconcile_officer_allocations', {
      p_period: period
    });
    if (error) throw error;
  },

  async getEligibleStaff(): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('is_active', true)
      .order('full_name');
    if (error) throw error;
    return data || [];
  },

  getCategories(): string[] {
    return EXPENSE_CATEGORIES;
  },

  async getAllocationReport(period: string): Promise<{
    total_allocated: number;
    total_claimed: number;
    total_remaining: number;
    by_officer: Array<{
      officer_id: string;
      officer_name: string;
      allocated: number;
      claimed: number;
      remaining: number;
    }>;
    by_category: Array<{
      category: string;
      allocated: number;
      claimed: number;
      remaining: number;
    }>;
  }> {
    const { data: allocations, error } = await supabase
      .from('officer_fund_allocations')
      .select(`
        id,
        officer_id,
        category,
        allocated_amount,
        users!officer_fund_allocations_officer_id_fkey(full_name)
      `)
      .eq('allocated_period', period);

    if (error) throw error;

    const { data: claims, error: claimsError } = await supabase
      .from('officer_expense_claims')
      .select('allocation_id, claim_amount, status')
      .in('status', ['pending', 'approved']);

    if (claimsError) throw claimsError;

    const claimsByAllocation = (claims || []).reduce((acc, c) => {
      acc[c.allocation_id] = (acc[c.allocation_id] || 0) + c.claim_amount;
      return acc;
    }, {} as Record<string, number>);

    const byOfficer: Record<string, { name: string; allocated: number; claimed: number }> = {};
    const byCategory: Record<string, { allocated: number; claimed: number }> = {};

    let totalAllocated = 0;
    let totalClaimed = 0;

    for (const a of allocations || []) {
      const claimed = claimsByAllocation[a.id] || 0;
      totalAllocated += a.allocated_amount;
      totalClaimed += claimed;

      if (!byOfficer[a.officer_id]) {
        byOfficer[a.officer_id] = {
          name: (a as any).users?.full_name || 'Unknown',
          allocated: 0,
          claimed: 0
        };
      }
      byOfficer[a.officer_id].allocated += a.allocated_amount;
      byOfficer[a.officer_id].claimed += claimed;

      if (!byCategory[a.category]) {
        byCategory[a.category] = { allocated: 0, claimed: 0 };
      }
      byCategory[a.category].allocated += a.allocated_amount;
      byCategory[a.category].claimed += claimed;
    }

    return {
      total_allocated: totalAllocated,
      total_claimed: totalClaimed,
      total_remaining: totalAllocated - totalClaimed,
      by_officer: Object.entries(byOfficer).map(([id, v]) => ({
        officer_id: id,
        officer_name: v.name,
        allocated: v.allocated,
        claimed: v.claimed,
        remaining: v.allocated - v.claimed
      })),
      by_category: Object.entries(byCategory).map(([cat, v]) => ({
        category: cat,
        allocated: v.allocated,
        claimed: v.claimed,
        remaining: v.allocated - v.claimed
      }))
    };
  }
};