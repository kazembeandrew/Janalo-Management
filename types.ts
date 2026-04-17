export type UserRole = 'admin' | 'ceo' | 'cfo' | 'loan_officer' | 'hr' | 'accountant';

export interface Role {
  id: string;
  name: UserRole;
  description?: string;
}

export type InterestType = 'flat' | 'reducing';

export type LoanStatus = 'active' | 'completed' | 'defaulted' | 'pending' | 'rejected' | 'reassess' | 'approved' | 'overdue' | 'written_off';

export type ApprovalStatus = 'pending_approval' | 'approved' | 'rejected';

export type ExpenseStatus = ApprovalStatus | 'pending' | 'voided';

export type DocumentCategory = 'financial' | 'hr' | 'operational' | 'general' | 'template' | 'loan_application';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  deletion_status?: 'pending' | 'approved' | 'none' | 'pending_approval';
  created_at: string;
  updated_at?: string;
  delegated_role?: UserRole | null;
  delegation_start?: string | null;
  delegation_end?: string | null;
  revocation_reason?: string | null;
  // Additional fields for user management
  status?: 'active' | 'inactive' | 'pending';
  phone?: string;
  department?: string;
  position?: string;
  permissions?: string[];
  activated_at?: string;
  activated_by?: string;
  deactivated_at?: string;
  deactivated_by?: string;
  role_assigned_at?: string;
  role_assigned_by?: string;
}

export interface SystemDocument {
    id: string;
    name: string;
    storage_path: string;
    category: DocumentCategory;
    file_type: string;
    file_size: number;
    uploaded_by: string;
    created_at: string;
    uploader?: {
        full_name: string;
    };
}

export interface Visitation {
    id: string;
    loan_id: string;
    officer_id: string;
    visit_date: string;
    notes: string;
    location_lat?: number;
    location_long?: number;
    image_path?: string;
    created_at: string;
    users?: {
        full_name: string;
    };
}

export interface InternalAccount {
    id: string;
    name: string;
    account_category: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
    account_code: string;
    code: string;
    parent_id?: string | null;
    parent_account_code?: string;
    account_number_display?: string | null;
    description?: string | null;
    is_active?: boolean;
    balance: number;
    is_system_account: boolean;
    type?: string;
    status?: string;
    category?: string;
    created_at: string;
    updated_at: string;
    // Tree view computed properties
    children?: InternalAccount[];
}

export interface JournalEntry {
    id: string;
    reference_type: 'loan_disbursement' | 'repayment' | 'expense' | 'transfer' | 'injection' | 'adjustment' | 'loan_write_off';
    reference_id?: string | null;
    date: string;
    transaction_date?: string;
    description: string;
    transaction_type?: string;
    status?: string;
    debit_amount?: number;
    credit_amount?: number;
    reference?: string;
    created_by: string;
    created_at: string;
    journal_lines?: JournalLine[];
    users?: {
        full_name: string;
    };
}

export interface JournalLine {
    id: string;
    journal_entry_id: string;
    account_id: string;
    debit: number;
    credit: number;
    accounts?: {
        name: string;
        account_code: string;
    };
}

export interface Budget {
    id: string;
    category: string;
    amount: number;
    month: string; // YYYY-MM
    type: 'income' | 'expense';
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: any;
  created_at: string;
  users?: {
    full_name: string;
  };
}

export interface Borrower {
  id: string;
  full_name: string;
  phone: string;
  address: string;
  employment: string;
  gender?: string;
  marital_status?: string;
  created_by: string;
  created_at: string;
  loans?: Loan[];
}

export interface Loan {
  id: string;
  reference_no: string;
  borrower_id: string;
  officer_id: string;
  principal_amount: number;
  interest_rate: number;
  interest_type: InterestType;
  term_months: number;
  disbursement_date: string;
  monthly_payment?: number;
  monthly_installment: number;
  total_payable: number;
  principal_outstanding: number;
  interest_outstanding: number;
  penalty_outstanding: number;
  overpayment_amount?: number;
  status: LoanStatus;
  created_at: string;
  updated_at?: string;
  collateral_value?: number;
  collateral_document?: string;
  identity_document?: string;
  risk_level?: string;
  disbursed_by?: string;
  write_off_date?: string;
  write_off_reason?: string;
  repayments?: Repayment[];
  borrowers?: {
    full_name: string;
    address?: string;
    phone?: string;
  };
  users?: {
    email: string;
    full_name: string;
  };
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  expense_date?: string;
  // NOTE: account_id removed - expenses table doesn't have this column
  // Account mapping is done via category -> GL account code during approval
  recorded_by: string;
  reconciled_by?: string;
  reconciled_at?: string;
  status: ExpenseStatus;
  created_at: string;
  users?: {
    full_name: string;
  };
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigned_to: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: ApprovalStatus | 'in_progress' | 'completed';
  created_by: string;
  created_at: string;
  users?: {
    full_name: string;
  };
}

export interface Repayment {
  id: string;
  loan_id: string;
  amount_paid: number;
  principal_paid?: number;
  interest_paid?: number;
  penalty_paid?: number;
  overpayment_paid?: number;
  payment_date: string;
  payment_method?: string;
  recorded_by?: string;
  status?: string;
  amount_reversed?: number;
  account_id?: string;
  notes?: string;
  transaction_fee?: number;
  reference_number?: string;
  created_at: string;
  loans?: {
      borrowers?: {
          full_name: string;
      }
  };
  users?: {
      full_name: string;
  };
}

export interface LoanNote {
  id: string;
  loan_id: string;
  user_id: string;
  note: string;
  content: string;
  type?: string;
  is_system: boolean;
  created_at: string;
  creator?: string;
  users?: {
    full_name: string;
  };
}

export interface LoanDocument {
  id: string;
  loan_id: string;
  type: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
  createElement?: any;
  body?: string;
}

export interface AmortizationScheduleItem {
    month: number;
    paymentNumber?: number;
    installment: number;
    principal: number;
    interest: number;
    balance: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  priority: NotificationPriority;
  recipient_ids: string[];
  sender_id?: string;
  status: string;
  metadata: Record<string, any>;
  scheduled_for?: string;
  due_date?: string;
  action_url?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  is_read?: boolean;
  category: NotificationCategory;
  is_archived?: boolean;
  read_at?: string;
  actions?: Array<{ label: string; action: string; url?: string; primary?: boolean }>;
}

export type NotificationCategory = 'system' | 'loan' | 'repayment' | 'expense' | 'task' | 'message' | 'security' | 'general' | 'payroll';
export type NotificationPriority = 'low' | 'normal' | 'medium' | 'high' | 'urgent';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// ============================================
// PHASE 1: FINANCIAL MANAGEMENT TYPES
// ============================================

export interface AccountTree {
  id: string;
  parent_id?: string | null;
  account_id: string;
  name: string;
  level: number;
  path: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface AccountingPeriod {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_closed: boolean;
  closed_at?: string;
  closed_by?: string;
  fiscal_year: string;
  created_at: string;
  updated_at?: string;
}

export interface Account {
  id: string;
  account_code: string;
  name: string;
  description?: string;
  account_type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  account_subtype?: string;
  parent_id?: string | null;
  is_active: boolean;
  is_system_account: boolean;
  balance: number;
  currency: string;
  created_at: string;
  updated_at?: string;
}

export interface BudgetVariance {
  id: string;
  budget_id: string;
  account_id: string;
  period_id: string;
  budgeted_amount: number;
  actual_amount: number;
  variance_amount: number;
  variance_percentage: number;
  variance_type: 'favorable' | 'unfavorable' | 'neutral';
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface CashFlowProjection {
  id: string;
  projection_date: string;
  category: 'operating' | 'investing' | 'financing';
  description: string;
  projected_inflow: number;
  projected_outflow: number;
  net_cash_flow: number;
  opening_balance: number;
  closing_balance: number;
  confidence_level: 'high' | 'medium' | 'low';
  assumptions?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

// ============================================
// PHASE 2: LOAN MANAGEMENT ENHANCEMENTS TYPES
// ============================================

export interface Collateral {
  id: string;
  loan_id: string;
  collateral_type: 'real_estate' | 'vehicle' | 'equipment' | 'inventory' | 'guarantee' | 'savings' | 'other';
  description: string;
  estimated_value: number;
  appraisal_date?: string;
  appraiser_name?: string;
  document_reference?: string;
  status: 'pending' | 'verified' | 'rejected' | 'released';
  verified_by?: string;
  verified_at?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface Guarantor {
  id: string;
  loan_id: string;
  guarantor_name: string;
  guarantor_type: 'individual' | 'corporate';
  id_number?: string;
  phone: string;
  email?: string;
  address: string;
  relationship: string;
  guaranteed_amount: number;
  guarantee_percentage: number;
  guarantee_type: 'limited' | 'unlimited';
  status: 'active' | 'released' | 'called';
  document_reference?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface LoanRestructure {
  id: string;
  loan_id: string;
  restructure_date: string;
  reason: string;
  previous_term_months: number;
  new_term_months: number;
  previous_interest_rate: number;
  new_interest_rate: number;
  previous_monthly_payment: number;
  new_monthly_payment: number;
  outstanding_principal: number;
  accrued_interest: number;
  penalty_amount: number;
  total_restructured_amount: number;
  approved_by: string;
  approved_at: string;
  effective_date: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface LoanWriteOff {
  id: string;
  loan_id: string;
  write_off_date: string;
  write_off_amount: number;
  principal_written_off: number;
  interest_written_off: number;
  penalty_written_off: number;
  reason: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  journal_entry_id?: string;
  recovery_expected: boolean;
  recovery_amount?: number;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface LoanRecoveryPayment {
  id: string;
  loan_id: string;
  write_off_id?: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number?: string;
  recovered_by: string;
  account_id: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

// ============================================
// PHASE 3: USER & ROLE MANAGEMENT TYPES
// ============================================

export interface RoleDefinition {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_system: boolean;
  is_active: boolean;
  permissions?: string[];
  created_at: string;
  updated_at?: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission: string;
  resource: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_approve: boolean;
  restrictions?: Record<string, any>;
  created_at: string;
}

export interface UserRoleAssignment {
  id: string;
  user_id: string;
  role_id: string;
  assigned_by: string;
  assigned_at: string;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Employee {
  id: string;
  user_id?: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  hire_date: string;
  termination_date?: string;
  employment_status: 'active' | 'on_leave' | 'terminated' | 'suspended';
  manager_id?: string;
  salary?: number;
  salary_currency?: string;
  address?: string;
  date_of_birth?: string;
  id_number?: string;
  created_at: string;
  updated_at?: string;
}

// ============================================
// PHASE 4: NOTIFICATIONS & COMMUNICATIONS TYPES
// ============================================

export interface NotificationPreference {
  id: string;
  user_id: string;
  notification_type: 'email' | 'sms' | 'push' | 'in_app';
  event_type: string;
  is_enabled: boolean;
  frequency: 'immediate' | 'daily' | 'weekly';
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  created_at: string;
  updated_at?: string;
}

export interface Conversation {
  id: string;
  subject: string;
  type: 'direct' | 'group' | 'announcement';
  created_by: string;
  is_active: boolean;
  last_message_at?: string;
  message_count: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at?: string;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'owner' | 'participant' | 'admin';
  joined_at: string;
  left_at?: string;
  is_active: boolean;
  last_read_at?: string;
  created_at: string;
  updated_at?: string;
}

// ============================================
// PHASE 5: BUSINESS INTELLIGENCE TYPES
// ============================================

export interface CustomerLifetimeValue {
  id: string;
  customer_id: string;
  calculation_date: string;
  total_revenue: number;
  total_cost: number;
  net_value: number;
  predicted_future_value: number;
  clv_score: number;
  tier: 'platinum' | 'gold' | 'silver' | 'bronze';
  calculation_method: string;
  data_points: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface DevicePushToken {
  id: string;
  user_id: string;
  device_id: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  app_version?: string;
  is_active: boolean;
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface ExpenseReconciliation {
  id: string;
  expense_id: string;
  reconciliation_date: string;
  expected_amount: number;
  actual_amount: number;
  difference: number;
  status: 'matched' | 'discrepancy' | 'pending';
  reconciled_by: string;
  discrepancy_reason?: string;
  supporting_document?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface FundTransaction {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  transaction_date: string;
  reference_number: string;
  description: string;
  transaction_type: 'transfer' | 'allocation' | 'reversal';
  status: 'pending' | 'completed' | 'cancelled' | 'failed';
  approved_by?: string;
  approved_at?: string;
  journal_entry_id?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface InvestmentPortfolio {
  id: string;
  name: string;
  description?: string;
  portfolio_type: 'conservative' | 'balanced' | 'aggressive';
  total_value: number;
  currency: string;
  risk_level: 'low' | 'medium' | 'high';
  target_return: number;
  actual_return: number;
  manager_id?: string;
  is_active: boolean;
  inception_date: string;
  benchmark?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface PayrollRecord {
  id: string;
  employee_id: string;
  pay_period_start: string;
  pay_period_end: string;
  pay_date: string;
  gross_salary: number;
  basic_salary: number;
  allowances: number;
  bonuses: number;
  overtime: number;
  deductions: number;
  tax_withheld: number;
  social_security: number;
  other_deductions: number;
  net_salary: number;
  payment_method: 'bank_transfer' | 'check' | 'cash';
  status: 'draft' | 'approved' | 'paid' | 'cancelled';
  bank_account?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
  
  // Accounting Integration Fields (Added 2026-04-06)
  journal_entry_id?: string | null;           // Linked journal entry ID
  payment_account_id?: string | null;         // Bank/cash account used for payment
  accounting_status?: 'pending' | 'posted' | 'error';  // Integration status
  accounting_posted_at?: string | null;       // When journal entry was posted
  accounting_error_message?: string | null;   // Error details if failed
}

export interface PendingApproval {
  id: string;
  entity_type: string;
  entity_id: string;
  approval_type: string;
  requested_by: string;
  requested_at: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'approved' | 'rejected' | 'escalated' | 'cancelled';
  current_approver_id?: string;
  approval_chain?: string[];
  current_step: number;
  total_steps: number;
  due_date?: string;
  escalated_at?: string;
  completed_at?: string;
  notes?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at?: string;
}

export interface PolicyDocument {
  id: string;
  title: string;
  document_number: string;
  version: string;
  category: 'hr' | 'finance' | 'operations' | 'compliance' | 'it' | 'general';
  content?: string;
  storage_path?: string;
  file_type?: string;
  file_size?: number;
  effective_date: string;
  expiry_date?: string;
  status: 'draft' | 'active' | 'archived' | 'superseded';
  approved_by?: string;
  approved_at?: string;
  previous_version_id?: string;
  tags?: string[];
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface RevenueForecast {
  id: string;
  forecast_date: string;
  period_start: string;
  period_end: string;
  category: string;
  forecasted_revenue: number;
  conservative_estimate: number;
  optimistic_estimate: number;
  actual_revenue?: number;
  variance?: number;
  variance_percentage?: number;
  confidence_level: number;
  methodology: string;
  assumptions?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface OfficerFundAllocation {
  id: string;
  officer_id: string;
  allocated_amount: number;
  allocated_period: string;
  category: string;
  allocated_by?: string;
  status: 'active' | 'depleted' | 'reconciled';
  notes?: string;
  allocation_journal_entry_id?: string;
  created_at: string;
  updated_at?: string;
  users?: {
    full_name: string;
  };
}

export interface OfficerExpenseClaim {
  id: string;
  officer_id: string;
  allocation_id?: string;
  expense_id?: string;
  claim_amount: number;
  claim_date: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  users?: {
    full_name: string;
  };
  expenses?: Expense;
}

export interface AllocationBalance {
  allocation_id: string;
  category: string;
  allocated_amount: number;
  claimed_amount: number;
  remaining_balance: number;
  status: string;
}
