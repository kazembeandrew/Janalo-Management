export interface CEORepaymentAccount {
  id: string;
  name: string;
  code: string;
  description: string;
  balance: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CEORepaymentEntry {
  id: string;
  account_id: string;
  amount: number;
  currency: string;
  payment_date: string;
  recorded_by: string;
  source_reference: string | null;
  notes: string | null;
  status: 'pending' | 'allocated' | 'reconciled' | 'cancelled';
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  account?: CEORepaymentAccount;
  recorded_by_user?: {
    full_name: string;
    role: string;
  };
}

export interface CEORepaymentAllocation {
  id: string;
  entry_id: string;
  loan_id: string;
  amount_allocated: number;
  allocation_type: 'standard' | 'penalty' | 'interest' | 'principal';
  created_at: string;
  created_by: string | null;
  entry?: CEORepaymentEntry;
  loan?: {
    reference_no: string;
    borrowers: {
      full_name: string;
    };
  };
}

export interface RepaymentAdherence {
  id: string;
  loan_id: string;
  ceo_allocation_id: string | null;
  loan_repayment_id: string | null;
  ceo_amount: number;
  loan_amount: number;
  variance: number;
  adherence_status: 'pending' | 'compliant' | 'overpaid' | 'underpaid' | 'reconciled';
  last_checked: string;
  checked_by: string | null;
  created_at: string;
  loan?: {
    reference_no: string;
    borrowers: {
      full_name: string;
    };
  };
  ceo_allocation?: CEORepaymentAllocation;
  loan_repayment?: {
    amount_paid: number;
    payment_date: string;
  };
}

export interface CEORepaymentSummary {
  account_id: string;
  account_name: string;
  account_code: string;
  account_balance: number;
  total_entries: number;
  pending_amount: number;
  allocated_amount: number;
  reconciled_amount: number;
  cancelled_amount: number;
}

export interface LoanCEOAllocationSummary {
  loan_id: string;
  reference_no: string;
  borrower_name: string;
  ceo_amount: number;
  loan_repayments: number;
  variance: number;
  adherence_status: string;
  last_checked: string;
}

export interface AllocationRequest {
  loan_id: string;
  amount: number;
  allocation_type?: 'standard' | 'penalty' | 'interest' | 'principal';
}

export interface CEORepaymentAllocationStatus {
  loan_id: string;
  ceo_total: number;
  loan_total: number;
  variance: number;
  status: string;
  allocations: Array<{
    entry_id: string;
    entry_amount: number;
    allocation_amount: number;
    allocation_date: string;
    source_reference: string | null;
    notes: string | null;
  }>;
}

// API Response types
export interface RecordCEORepaymentResponse {
  success: boolean;
  entry_id?: string;
  account_id?: string;
  amount?: number;
  payment_date?: string;
  error?: string;
}

export interface AllocateCEORepaymentResponse {
  success: boolean;
  entry_id?: string;
  total_allocated?: number;
  allocations_count?: number;
  error?: string;
}

export interface ReconcileRepaymentsResponse {
  success: boolean;
  loan_id?: string;
  ceo_total?: number;
  loan_total?: number;
  variance?: number;
  status?: string;
  error?: string;
}

export interface CancelCEORepaymentResponse {
  success: boolean;
  entry_id?: string;
  cancelled_by?: string;
  reason?: string;
  error?: string;
}

export interface BulkReconcileResponse {
  success: boolean;
  processed_loans?: number;
  compliant?: number;
  overpaid?: number;
  underpaid?: number;
  reconciled_by?: string;
  error?: string;
}