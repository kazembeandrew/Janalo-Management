/**
 * Loans Service Layer
 * Centralized data access for loan operations with typed inputs/outputs
 */
import { supabase } from '@/lib/supabase';
import type { Loan, LoanStatus, RepaymentSchedule } from '@/types';

export interface LoanFilters {
  status?: LoanStatus | LoanStatus[];
  borrowerId?: string;
  loanOfficerId?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
}

export interface LoanWithDetails extends Loan {
  borrower_name?: string;
  borrower_phone?: string;
  outstanding_balance?: number;
  days_overdue?: number;
}

export interface CreateLoanInput {
  borrower_id: string;
  principal_amount: number;
  interest_rate: number;
  term_months: number;
  repayment_frequency: 'weekly' | 'biweekly' | 'monthly';
  loan_purpose?: string;
  collateral_description?: string;
  guarantor_names?: string;
  start_date?: string;
}

export interface UpdateLoanInput {
  id: string;
  principal_amount?: number;
  interest_rate?: number;
  term_months?: number;
  status?: LoanStatus;
  loan_officer_id?: string;
}

/**
 * Fetch loans with filtering and pagination
 */
export const fetchLoans = async (
  filters: LoanFilters = {},
  page: number = 0,
  pageSize: number = 100
): Promise<{ data: LoanWithDetails[]; count: number }> => {
  let query = supabase
    .from('loans')
    .select(`
      *,
      borrowers:borrower_id(name, phone),
      repayments(id, amount, payment_date)
    `, { count: 'exact' });

  // Apply filters
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    query = query.in('status', statuses);
  }

  if (filters.borrowerId) {
    query = query.eq('borrower_id', filters.borrowerId);
  }

  if (filters.loanOfficerId) {
    query = query.eq('loan_officer_id', filters.loanOfficerId);
  }

  if (filters.minAmount !== undefined) {
    query = query.gte('principal_amount', filters.minAmount);
  }

  if (filters.maxAmount !== undefined) {
    query = query.lte('principal_amount', filters.maxAmount);
  }

  if (filters.startDate) {
    query = query.gte('start_date', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('start_date', filters.endDate);
  }

  if (filters.searchQuery) {
    query = query.or(`loan_reference.ilike.%${filters.searchQuery}%,borrowers.name.ilike.%${filters.searchQuery}%`);
  }

  // Apply pagination
  const rangeStart = page * pageSize;
  const rangeEnd = rangeStart + pageSize - 1;
  query = query.range(rangeStart, rangeEnd).order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) throw error;

  // Transform data
  const transformedData: LoanWithDetails[] = (data || []).map(loan => ({
    ...loan,
    borrower_name: (loan.borrowers as any)?.name,
    borrower_phone: (loan.borrowers as any)?.phone,
    outstanding_balance: calculateOutstandingBalance(loan),
    days_overdue: calculateDaysOverdue(loan),
  }));

  return { data: transformedData, count: count || 0 };
};

/**
 * Fetch a single loan by ID with full details
 */
export const fetchLoanById = async (loanId: string): Promise<LoanWithDetails | null> => {
  const { data, error } = await supabase
    .from('loans')
    .select(`
      *,
      borrowers:borrower_id(name, phone, email, id_number),
      repayments(id, amount, payment_date, principal_portion, interest_portion)
    `)
    .eq('id', loanId)
    .single();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    borrower_name: (data.borrowers as any)?.name,
    borrower_phone: (data.borrowers as any)?.phone,
    outstanding_balance: calculateOutstandingBalance(data),
    days_overdue: calculateDaysOverdue(data),
  };
};

/**
 * Create a new loan using atomic RPC function
 */
export const createLoan = async (input: CreateLoanInput): Promise<Loan> => {
  const { data, error } = await supabase.rpc('create_loan_application', {
    p_borrower_id: input.borrower_id,
    p_principal_amount: input.principal_amount,
    p_interest_rate: input.interest_rate,
    p_term_months: input.term_months,
    p_repayment_frequency: input.repayment_frequency,
    p_loan_purpose: input.loan_purpose,
    p_collateral_description: input.collateral_description,
    p_guarantor_names: input.guarantor_names,
    p_start_date: input.start_date,
  });

  if (error) throw error;
  return data as Loan;
};

/**
 * Update an existing loan
 */
export const updateLoan = async (input: UpdateLoanInput): Promise<Loan> => {
  const updateData: Partial<Loan> = { ...input };
  delete (updateData as any).id;

  const { data, error } = await supabase
    .from('loans')
    .update(updateData)
    .eq('id', input.id)
    .select()
    .single();

  if (error) throw error;
  return data as Loan;
};

/**
 * Disburse a loan using atomic RPC function
 */
export const disburseLoan = async (
  loanId: string,
  disbursementAccountId: string,
  userId: string
): Promise<Loan> => {
  const { data, error } = await supabase.rpc('disburse_loan', {
    p_loan_id: loanId,
    p_disbursement_account_id: disbursementAccountId,
    p_user_id: userId,
  });

  if (error) throw error;
  return data as Loan;
};

/**
 * Bulk disburse multiple loans atomically
 */
export const bulkDisburseLoans = async (
  loanIds: string[],
  disbursementAccountId: string,
  userId: string
): Promise<{ success: boolean; message: string }> => {
  const { data, error } = await supabase.rpc('bulk_disburse_loans', {
    p_loan_ids: loanIds,
    p_disbursement_account_id: disbursementAccountId,
    p_user_id: userId,
  });

  if (error) throw error;
  return data as { success: boolean; message: string };
};

/**
 * Delete a loan (only if in draft/pending state)
 */
export const deleteLoan = async (loanId: string): Promise<void> => {
  const { error } = await supabase
    .from('loans')
    .delete()
    .eq('id', loanId)
    .in('status', ['draft', 'pending']);

  if (error) throw error;
};

/**
 * Calculate outstanding balance for a loan
 */
const calculateOutstandingBalance = (loan: Loan & { repayments?: any[] }): number => {
  if (!loan.repayments || loan.repayments.length === 0) {
    return loan.principal_outstanding || loan.principal_amount;
  }

  const totalRepaid = loan.repayments.reduce((sum, r) => sum + (r.principal_portion || 0), 0);
  return Math.max(0, loan.principal_amount - totalRepaid);
};

/**
 * Calculate days overdue for a loan
 */
const calculateDaysOverdue = (loan: Loan & { repayments?: any[] }): number => {
  if (!loan.due_date || loan.status === 'paid_off' || loan.status === 'written_off') {
    return 0;
  }

  const dueDate = new Date(loan.due_date);
  const today = new Date();
  
  if (today <= dueDate) {
    return 0;
  }

  const diffTime = Math.abs(today.getTime() - dueDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Fetch repayment schedule for a loan
 */
export const fetchRepaymentSchedule = async (loanId: string): Promise<RepaymentSchedule[]> => {
  const { data, error } = await supabase
    .from('repayment_schedules')
    .select('*')
    .eq('loan_id', loanId)
    .order('due_date', { ascending: true });

  if (error) throw error;
  return data as RepaymentSchedule[];
};

/**
 * Real-time subscription to loan changes
 */
export const subscribeToLoans = (
  callback: (payload: any) => void,
  filters?: { loanIds?: string[]; statuses?: LoanStatus[] }
) => {
  let channel = supabase.channel('loans-changes');

  const baseFilter = {
    event: '*',
    schema: 'public',
    table: 'loans',
  };

  if (filters?.loanIds && filters.loanIds.length > 0) {
    channel = channel.on(
      'postgres_changes',
      { ...baseFilter, filter: `id=in.(${filters.loanIds.join(',')})` },
      callback
    );
  } else if (filters?.statuses && filters.statuses.length > 0) {
    channel = channel.on(
      'postgres_changes',
      { ...baseFilter, filter: `status=in.(${filters.statuses.join(',')})` },
      callback
    );
  } else {
    channel = channel.on('postgres_changes', baseFilter, callback);
  }

  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// Re-export types for convenience
export type { Loan, LoanStatus };
