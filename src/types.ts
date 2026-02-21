export type UserRole = 'admin' | 'ceo' | 'loan_officer' | 'hr' | 'accountant';

export type InterestType = 'flat' | 'reducing';

export type LoanStatus = 'active' | 'completed' | 'defaulted' | 'pending' | 'rejected' | 'reassess';

export type ApprovalStatus = 'pending_approval' | 'approved' | 'rejected';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  deletion_status?: 'pending' | 'approved' | 'none' | 'pending_approval';
  created_at: string;
  delegated_role?: UserRole | null;
  delegation_start?: string | null;
  delegation_end?: string | null;
}

export interface InternalAccount {
    id: string;
    name: string;
    type: 'bank' | 'cash' | 'equity' | 'liability';
    balance: number;
    account_number?: string;
    bank_name?: string;
    created_at: string;
    updated_at: string;
}

export interface FundTransaction {
    id: string;
    from_account_id?: string;
    to_account_id?: string;
    amount: number;
    type: 'transfer' | 'injection' | 'disbursement' | 'repayment' | 'expense';
    description: string;
    reference_id?: string; // ID of the loan, expense, etc.
    recorded_by: string;
    created_at: string;
    users?: {
        full_name: string;
    };
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
  created_by: string;
  created_at: string;
}

export interface Loan {
  id: string;
  borrower_id: string;
  officer_id: string;
  principal_amount: number;
  interest_rate: number;
  interest_type: InterestType;
  term_months: number;
  disbursement_date: string;
  monthly_installment: number;
  total_payable: number;
  principal_outstanding: number;
  interest_outstanding: number;
  penalty_outstanding: number;
  status: LoanStatus;
  created_at: string;
  updated_at: string;
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
  recorded_by: string;
  status: ApprovalStatus;
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
  principal_paid: number;
  interest_paid: number;
  penalty_paid: number;
  payment_date: string;
  recorded_by: string;
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
  content: string;
  is_system: boolean;
  created_at: string;
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