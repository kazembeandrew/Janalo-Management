-- ============================================================================
-- COMPLETE DATABASE SCHEMA FOR LOAN MANAGEMENT SYSTEM
-- Execute this entire script in Supabase SQL Editor to create a fresh schema
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. CORE TABLES
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'ceo', 'loan_officer', 'hr', 'accountant')),
    is_active BOOLEAN DEFAULT true,
    deletion_status TEXT DEFAULT 'none' CHECK (deletion_status IN ('pending', 'approved', 'none', 'pending_approval')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Delegation fields
    delegated_role TEXT CHECK (delegated_role IN ('admin', 'ceo', 'loan_officer', 'hr', 'accountant')),
    delegation_start TIMESTAMP WITH TIME ZONE,
    delegation_end TIMESTAMP WITH TIME ZONE,
    revocation_reason TEXT
);

-- Borrowers table
CREATE TABLE IF NOT EXISTS public.borrowers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    employment TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loans table
CREATE TABLE IF NOT EXISTS public.loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_no TEXT UNIQUE,
    borrower_id UUID NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
    officer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
    principal_amount DECIMAL(15,2) NOT NULL CHECK (principal_amount > 0),
    interest_rate DECIMAL(5,2) NOT NULL CHECK (interest_rate >= 0),
    interest_type TEXT NOT NULL CHECK (interest_type IN ('flat', 'reducing')),
    term_months INTEGER NOT NULL CHECK (term_months > 0),
    disbursement_date DATE,
    monthly_installment DECIMAL(15,2),
    total_payable DECIMAL(15,2),
    principal_outstanding DECIMAL(15,2) DEFAULT 0,
    interest_outstanding DECIMAL(15,2) DEFAULT 0,
    penalty_outstanding DECIMAL(15,2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'completed', 'defaulted', 'pending', 'rejected', 'reassess')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. ACCOUNTING TABLES
-- ============================================================================

-- Internal accounts (Chart of Accounts)
CREATE TABLE IF NOT EXISTS public.internal_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    account_category TEXT NOT NULL CHECK (account_category IN ('asset', 'liability', 'equity', 'income', 'expense')),
    account_code TEXT UNIQUE NOT NULL,
    parent_id UUID REFERENCES public.internal_accounts(id) ON DELETE CASCADE,
    account_number_display TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    balance DECIMAL(15,2) DEFAULT 0,
    is_system_account BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Journal entries
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_type TEXT NOT NULL CHECK (reference_type IN ('loan_disbursement', 'repayment', 'expense', 'transfer', 'injection', 'adjustment', 'reversal')),
    reference_id UUID,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reversed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Journal lines
CREATE TABLE IF NOT EXISTS public.journal_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.internal_accounts(id) ON DELETE CASCADE,
    debit DECIMAL(15,2) DEFAULT 0 CHECK (debit >= 0),
    credit DECIMAL(15,2) DEFAULT 0 CHECK (credit >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure only debit OR credit is set, not both
    CONSTRAINT journal_line_single_side CHECK (
        (debit = 0 AND credit > 0) OR (debit > 0 AND credit = 0)
    )
);

-- ============================================================================
-- 3. TRANSACTION TABLES
-- ============================================================================

-- Repayments
CREATE TABLE IF NOT EXISTS public.repayments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    amount_paid DECIMAL(15,2) NOT NULL CHECK (amount_paid > 0),
    principal_paid DECIMAL(15,2) DEFAULT 0,
    interest_paid DECIMAL(15,2) DEFAULT 0,
    penalty_paid DECIMAL(15,2) DEFAULT 0,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected', 'in_progress', 'completed')),
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. LOAN MANAGEMENT TABLES
-- ============================================================================

-- Loan notes
CREATE TABLE IF NOT EXISTS public.loan_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Visitations
CREATE TABLE IF NOT EXISTS public.visitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    officer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    location_lat DECIMAL(10,8),
    location_long DECIMAL(11,8),
    image_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loan documents
CREATE TABLE IF NOT EXISTS public.loan_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Borrower documents
CREATE TABLE IF NOT EXISTS public.borrower_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    borrower_id UUID NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 5. SYSTEM TABLES
-- ============================================================================

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
    category TEXT,
    link TEXT,
    is_read BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System documents
CREATE TABLE IF NOT EXISTS public.system_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('financial', 'hr', 'operational', 'general', 'template', 'loan_application')),
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Budgets
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
    month TEXT NOT NULL, -- YYYY-MM format
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 6. LIQUIDITY MANAGEMENT TABLES
-- ============================================================================

-- Liquidity configuration
CREATE TABLE IF NOT EXISTS public.liquidity_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    min_liquidity_ratio DECIMAL(5,2) NOT NULL DEFAULT 0.05,
    critical_liquidity_ratio DECIMAL(5,2) NOT NULL DEFAULT 0.03,
    warning_liquidity_ratio DECIMAL(5,2) NOT NULL DEFAULT 0.08,
    max_disbursement_without_approval DECIMAL(15,2) NOT NULL DEFAULT 1000000,
    auto_stop_disbursements BOOLEAN DEFAULT false,
    alert_email_enabled BOOLEAN DEFAULT true,
    alert_sms_enabled BOOLEAN DEFAULT false,
    last_checked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES public.users(id)
);

-- Liquidity alerts
CREATE TABLE IF NOT EXISTS public.liquidity_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type TEXT NOT NULL CHECK (alert_type IN ('warning', 'critical', 'recovery')),
    current_ratio DECIMAL(5,2) NOT NULL,
    required_ratio DECIMAL(5,2) NOT NULL,
    available_funds DECIMAL(15,2) NOT NULL,
    total_portfolio DECIMAL(15,2) NOT NULL,
    shortfall_amount DECIMAL(15,2),
    triggered_by UUID REFERENCES public.users(id),
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged_by UUID REFERENCES public.users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- Closed periods
CREATE TABLE IF NOT EXISTS public.closed_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    month TEXT NOT NULL UNIQUE, -- YYYY-MM format
    closed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
    closed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

-- ============================================================================
-- 7. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(is_active) WHERE is_active = true;

-- Loans indexes
CREATE INDEX IF NOT EXISTS idx_loans_borrower_id ON public.loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_officer_id ON public.loans(officer_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_reference_no ON public.loans(reference_no);

-- Accounting indexes
CREATE INDEX IF NOT EXISTS idx_internal_accounts_category ON public.internal_accounts(account_category);
CREATE INDEX IF NOT EXISTS idx_internal_accounts_code ON public.internal_accounts(account_code);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON public.journal_entries(date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference ON public.journal_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_journal_entry ON public.journal_lines(journal_entry_id);

-- Transaction indexes
CREATE INDEX IF NOT EXISTS idx_repayments_loan_id ON public.repayments(loan_id);
CREATE INDEX IF NOT EXISTS idx_repayments_date ON public.repayments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

-- ============================================================================
-- 8. FUNCTIONS
-- ============================================================================

-- Function to get user role (including delegation)
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
    delegated_role TEXT;
BEGIN
    -- Get the current user
    SELECT role INTO user_role
    FROM public.users
    WHERE id = auth.uid();

    -- Check for active delegation
    SELECT u.delegated_role INTO delegated_role
    FROM public.users u
    WHERE u.id = auth.uid()
    AND u.delegation_start <= NOW()
    AND (u.delegation_end IS NULL OR u.delegation_end > NOW());

    -- Return delegated role if active, otherwise regular role
    RETURN COALESCE(delegated_role, user_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get notification counts
CREATE OR REPLACE FUNCTION public.get_notification_counts_detailed(p_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := COALESCE(p_user_id, auth.uid());
    v_total_unread INTEGER;
    v_urgent_unread INTEGER;
    v_high_unread INTEGER;
    v_by_category JSONB;
BEGIN
    -- Get counts separately to avoid nested aggregates
    SELECT COUNT(*) INTO v_total_unread
    FROM public.notifications
    WHERE user_id = v_user_id
    AND NOT is_read
    AND NOT is_archived
    AND (expires_at IS NULL OR expires_at > NOW());

    SELECT COUNT(*) INTO v_urgent_unread
    FROM public.notifications
    WHERE user_id = v_user_id
    AND NOT is_read
    AND NOT is_archived
    AND type = 'error'
    AND (expires_at IS NULL OR expires_at > NOW());

    SELECT COUNT(*) INTO v_high_unread
    FROM public.notifications
    WHERE user_id = v_user_id
    AND NOT is_read
    AND NOT is_archived
    AND type = 'warning'
    AND (expires_at IS NULL OR expires_at > NOW());

    -- Get category breakdown
    SELECT jsonb_object_agg(category, count) INTO v_by_category
    FROM (
        SELECT COALESCE(category, 'general') as category, COUNT(*) as count
        FROM public.notifications
        WHERE user_id = v_user_id
        AND NOT is_read
        AND NOT is_archived
        AND (expires_at IS NULL OR expires_at > NOW())
        GROUP BY COALESCE(category, 'general')
    ) cat_counts;

    -- Return result
    RETURN jsonb_build_object(
        'total_unread', COALESCE(v_total_unread, 0),
        'urgent_unread', COALESCE(v_urgent_unread, 0),
        'high_unread', COALESCE(v_high_unread, 0),
        'by_category', COALESCE(v_by_category, '{}'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate liquidity position
CREATE OR REPLACE FUNCTION public.calculate_liquidity_position()
RETURNS JSONB AS $$
DECLARE
    v_cash_accounts DECIMAL(15,2);
    v_bank_accounts DECIMAL(15,2);
    v_mobile_accounts DECIMAL(15,2);
    v_total_liquidity DECIMAL(15,2);
    v_total_portfolio DECIMAL(15,2);
    v_total_liabilities DECIMAL(15,2);
    v_liquidity_ratio DECIMAL(5,2);
    v_config RECORD;
BEGIN
    -- Get available liquidity
    SELECT COALESCE(SUM(balance), 0) INTO v_cash_accounts
    FROM internal_accounts WHERE account_code = 'CASH' AND is_active != false;

    SELECT COALESCE(SUM(balance), 0) INTO v_bank_accounts
    FROM internal_accounts WHERE account_code = 'BANK' AND is_active != false;

    SELECT COALESCE(SUM(balance), 0) INTO v_mobile_accounts
    FROM internal_accounts WHERE account_code = 'MOBILE' AND is_active != false;

    v_total_liquidity := v_cash_accounts + v_bank_accounts + v_mobile_accounts;

    -- Get total loan portfolio
    SELECT COALESCE(SUM(principal_outstanding), 0) INTO v_total_portfolio
    FROM loans WHERE status IN ('active', 'pending');

    -- Get total liabilities
    SELECT COALESCE(SUM(balance), 0) INTO v_total_liabilities
    FROM internal_accounts WHERE account_category = 'liability' AND is_active != false;

    -- Calculate liquidity ratio
    IF v_total_portfolio > 0 THEN
        v_liquidity_ratio := v_total_liquidity / v_total_portfolio;
    ELSE
        v_liquidity_ratio := 1.0;
    END IF;

    -- Get config
    SELECT * INTO v_config FROM liquidity_config ORDER BY created_at DESC LIMIT 1;

    RETURN jsonb_build_object(
        'total_liquidity', v_total_liquidity,
        'cash_accounts', v_cash_accounts,
        'bank_accounts', v_bank_accounts,
        'mobile_accounts', v_mobile_accounts,
        'total_portfolio', v_total_portfolio,
        'total_liabilities', v_total_liabilities,
        'liquidity_ratio', v_liquidity_ratio,
        'liquidity_percentage', ROUND(v_liquidity_ratio * 100, 2),
        'status', CASE
            WHEN v_liquidity_ratio < COALESCE(v_config.critical_liquidity_ratio, 0.03) THEN 'CRITICAL'
            WHEN v_liquidity_ratio < COALESCE(v_config.min_liquidity_ratio, 0.05) THEN 'BELOW_MINIMUM'
            WHEN v_liquidity_ratio < COALESCE(v_config.warning_liquidity_ratio, 0.08) THEN 'WARNING'
            ELSE 'HEALTHY'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Balance update trigger functions
CREATE OR REPLACE FUNCTION public.update_account_balance_from_journal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_category text;
BEGIN
  SELECT account_category INTO v_category FROM public.internal_accounts WHERE id = NEW.account_id;

  -- Assets and Expenses increase with Debits
  IF v_category IN ('asset', 'expense') THEN
    UPDATE public.internal_accounts
    SET balance = balance + (NEW.debit - NEW.credit),
        updated_at = NOW()
    WHERE id = NEW.account_id;

  -- Liabilities, Equity, and Income increase with Credits
  ELSIF v_category IN ('liability', 'equity', 'income') THEN
    UPDATE public.internal_accounts
    SET balance = balance + (NEW.credit - NEW.debit),
        updated_at = NOW()
    WHERE id = NEW.account_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_account_balance_from_journal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_category text;
BEGIN
  SELECT account_category INTO v_category FROM public.internal_accounts WHERE id = OLD.account_id;

  -- Assets and Expenses decrease with Debits when deleted
  IF v_category IN ('asset', 'expense') THEN
    UPDATE public.internal_accounts
    SET balance = balance - (OLD.debit - OLD.credit),
        updated_at = NOW()
    WHERE id = OLD.account_id;

  -- Liabilities, Equity, and Income decrease with Credits when deleted
  ELSIF v_category IN ('liability', 'equity', 'income') THEN
    UPDATE public.internal_accounts
    SET balance = balance - (OLD.credit - OLD.debit),
        updated_at = NOW()
    WHERE id = OLD.account_id;
  END IF;

  RETURN OLD;
END;
$$;

-- ============================================================================
-- 9. TRIGGERS
-- ============================================================================

-- Balance update triggers
DROP TRIGGER IF EXISTS trg_update_account_balance ON public.journal_lines;
CREATE TRIGGER trg_update_account_balance
AFTER INSERT OR UPDATE ON public.journal_lines
FOR EACH ROW EXECUTE FUNCTION public.update_account_balance_from_journal();

DROP TRIGGER IF EXISTS trg_reverse_account_balance ON public.journal_lines;
CREATE TRIGGER trg_reverse_account_balance
AFTER DELETE ON public.journal_lines
FOR EACH ROW EXECUTE FUNCTION public.reverse_account_balance_from_journal();

-- ============================================================================
-- 10. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrower_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidity_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidity_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closed_periods ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view all users" ON public.users
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.users
FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Admins can manage users" ON public.users
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo'));

-- Borrowers policies
CREATE POLICY "Authenticated users can view borrowers" ON public.borrowers
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Loan officers can create borrowers" ON public.borrowers
FOR INSERT TO authenticated WITH CHECK (get_auth_role() IN ('admin', 'ceo', 'loan_officer'));

CREATE POLICY "Loan officers can update borrowers" ON public.borrowers
FOR UPDATE TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'loan_officer'));

-- Loans policies
CREATE POLICY "Authenticated users can view loans" ON public.loans
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Loan officers can manage loans" ON public.loans
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'loan_officer'));

CREATE POLICY "Accountants can view loans" ON public.loans
FOR SELECT TO authenticated USING (get_auth_role() = 'accountant');

-- Accounting policies
CREATE POLICY "Accountants and executives can view accounts" ON public.internal_accounts
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

CREATE POLICY "Accountants can manage accounts" ON public.internal_accounts
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

CREATE POLICY "Accountants can view journal entries" ON public.journal_entries
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

CREATE POLICY "System can create journal entries" ON public.journal_entries
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Accountants can view journal lines" ON public.journal_lines
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

-- Transaction policies
CREATE POLICY "Users can view repayments on their loans" ON public.repayments
FOR SELECT TO authenticated USING (
    get_auth_role() IN ('admin', 'ceo', 'accountant') OR
    EXISTS (SELECT 1 FROM loans WHERE id = repayments.loan_id AND officer_id = auth.uid())
);

CREATE POLICY "Loan officers can create repayments" ON public.repayments
FOR INSERT TO authenticated WITH CHECK (
    get_auth_role() IN ('admin', 'ceo', 'loan_officer', 'accountant') OR
    EXISTS (SELECT 1 FROM loans WHERE id = repayments.loan_id AND officer_id = auth.uid())
);

CREATE POLICY "Accountants can manage expenses" ON public.expenses
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

CREATE POLICY "Executives can manage tasks" ON public.tasks
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo'));

CREATE POLICY "Users can view assigned tasks" ON public.tasks
FOR SELECT TO authenticated USING (assigned_to = auth.uid() OR get_auth_role() IN ('admin', 'ceo'));

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON public.notifications
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON public.notifications
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update own notifications" ON public.notifications
FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Loan management policies
CREATE POLICY "Loan officers can manage loan notes" ON public.loan_notes
FOR ALL TO authenticated USING (
    get_auth_role() IN ('admin', 'ceo', 'loan_officer') OR
    EXISTS (SELECT 1 FROM loans WHERE id = loan_notes.loan_id AND officer_id = auth.uid())
);

CREATE POLICY "Loan officers can manage visitations" ON public.visitations
FOR ALL TO authenticated USING (
    get_auth_role() IN ('admin', 'ceo', 'loan_officer') OR
    EXISTS (SELECT 1 FROM loans WHERE id = visitations.loan_id AND officer_id = auth.uid())
);

CREATE POLICY "Loan officers can manage loan documents" ON public.loan_documents
FOR ALL TO authenticated USING (
    get_auth_role() IN ('admin', 'ceo', 'loan_officer') OR
    EXISTS (SELECT 1 FROM loans WHERE id = loan_documents.loan_id AND officer_id = auth.uid())
);

CREATE POLICY "Users can view borrower documents for their loans" ON public.borrower_documents
FOR SELECT TO authenticated USING (
    get_auth_role() IN ('admin', 'ceo') OR
    EXISTS (SELECT 1 FROM loans WHERE borrower_id = borrower_documents.borrower_id AND officer_id = auth.uid())
);

-- System policies
CREATE POLICY "Authenticated users can view system documents" ON public.system_documents
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage system documents" ON public.system_documents
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo'));

CREATE POLICY "Accountants can manage budgets" ON public.budgets
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

CREATE POLICY "System can create audit logs" ON public.audit_logs
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins can view audit logs" ON public.audit_logs
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo'));

-- Liquidity policies
CREATE POLICY "Executives can manage liquidity config" ON public.liquidity_config
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

CREATE POLICY "All staff can view liquidity config" ON public.liquidity_config
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Executives can view alerts" ON public.liquidity_alerts
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

CREATE POLICY "System can create alerts" ON public.liquidity_alerts
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Executives can acknowledge alerts" ON public.liquidity_alerts
FOR UPDATE TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

CREATE POLICY "Accountants can manage closed periods" ON public.closed_periods
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

-- ============================================================================
-- 11. GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant permissions on functions
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_notification_counts_detailed(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_liquidity_position() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_account_balance_from_journal() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_account_balance_from_journal() TO authenticated;

-- ============================================================================
-- 12. INITIAL DATA
-- ============================================================================

-- Insert default liquidity configuration
INSERT INTO public.liquidity_config (
    min_liquidity_ratio,
    critical_liquidity_ratio,
    warning_liquidity_ratio,
    max_disbursement_without_approval
) VALUES (0.05, 0.03, 0.08, 1000000)
ON CONFLICT DO NOTHING;

-- Insert system accounts (basic chart of accounts)
INSERT INTO public.internal_accounts (name, account_category, account_code, is_system_account) VALUES
('Cash on Hand', 'asset', 'CASH', true),
('Bank Account', 'asset', 'BANK', true),
('Mobile Money', 'asset', 'MOBILE', true),
('Loan Portfolio', 'asset', 'PORTFOLIO', true),
('Share Capital', 'equity', 'CAPITAL', true),
('Retained Earnings', 'equity', 'EQUITY', true),
('Interest Income', 'income', 'INTEREST_INCOME', true),
('Operational Expenses', 'expense', 'OPERATIONAL', true)
ON CONFLICT (account_code) DO NOTHING;

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================

-- After running this schema:
-- 1. All tables, relationships, and constraints are created
-- 2. RLS policies are applied for security
-- 3. Functions and triggers are set up
-- 4. Initial data is inserted
-- 5. Test the application to ensure everything works
