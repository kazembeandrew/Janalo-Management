-- RECREATE ALL RLS POLICIES - Fix dashboard access
-- Execute this entire script in Supabase SQL Editor
-- This will restore data access so pages can load after login
-- NOTE: This migration only attempts to modify tables that exist in the database

-- ============================================================================
-- ENABLE RLS ON ALL TABLES (Only if table exists)
-- ============================================================================

-- Users table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Borrowers table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'borrowers' AND table_schema = 'public') THEN
        ALTER TABLE public.borrowers ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Loans table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loans' AND table_schema = 'public') THEN
        ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Internal accounts table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'internal_accounts' AND table_schema = 'public') THEN
        ALTER TABLE public.internal_accounts ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Journal entries table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal_entries' AND table_schema = 'public') THEN
        ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Journal lines table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal_lines' AND table_schema = 'public') THEN
        ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Repayments table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'repayments' AND table_schema = 'public') THEN
        ALTER TABLE public.repayments ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Expenses table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses' AND table_schema = 'public') THEN
        ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Tasks table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks' AND table_schema = 'public') THEN
        ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Notifications table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications' AND table_schema = 'public') THEN
        ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Loan notes table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loan_notes' AND table_schema = 'public') THEN
        ALTER TABLE public.loan_notes ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Visitations table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'visitations' AND table_schema = 'public') THEN
        ALTER TABLE public.visitations ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Loan documents table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loan_documents' AND table_schema = 'public') THEN
        ALTER TABLE public.loan_documents ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Borrower documents table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'borrower_documents' AND table_schema = 'public') THEN
        ALTER TABLE public.borrower_documents ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- System documents table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_documents' AND table_schema = 'public') THEN
        ALTER TABLE public.system_documents ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Budgets table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'budgets' AND table_schema = 'public') THEN
        ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Audit logs table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public') THEN
        ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Liquidity config table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'liquidity_config' AND table_schema = 'public') THEN
        ALTER TABLE public.liquidity_config ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Liquidity alerts table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'liquidity_alerts' AND table_schema = 'public') THEN
        ALTER TABLE public.liquidity_alerts ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ============================================================================
-- DROP EXISTING POLICIES (Only if they exist)
-- ============================================================================

-- Users policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Users can view all users" ON public.users;
        DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
        DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
    END IF;
END $$;

-- Borrowers policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'borrowers' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Authenticated users can view borrowers" ON public.borrowers;
        DROP POLICY IF EXISTS "Loan officers can create borrowers" ON public.borrowers;
        DROP POLICY IF EXISTS "Loan officers can update borrowers" ON public.borrowers;
    END IF;
END $$;

-- Loans policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loans' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Authenticated users can view loans" ON public.loans;
        DROP POLICY IF EXISTS "Loan officers can manage loans" ON public.loans;
        DROP POLICY IF EXISTS "Accountants can view loans" ON public.loans;
    END IF;
END $$;

-- Internal accounts policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'internal_accounts' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Accountants and executives can view accounts" ON public.internal_accounts;
        DROP POLICY IF EXISTS "Accountants can manage accounts" ON public.internal_accounts;
    END IF;
END $$;

-- Journal entries policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal_entries' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Accountants can view journal entries" ON public.journal_entries;
        DROP POLICY IF EXISTS "System can create journal entries" ON public.journal_entries;
    END IF;
END $$;

-- Journal lines policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal_lines' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Accountants can view journal lines" ON public.journal_lines;
    END IF;
END $$;

-- Repayments policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'repayments' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Users can view repayments on their loans" ON public.repayments;
        DROP POLICY IF EXISTS "Loan officers can create repayments" ON public.repayments;
    END IF;
END $$;

-- Expenses policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Accountants can manage expenses" ON public.expenses;
    END IF;
END $$;

-- Tasks policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Executives can manage tasks" ON public.tasks;
        DROP POLICY IF EXISTS "Users can view assigned tasks" ON public.tasks;
    END IF;
END $$;

-- Notifications policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
        DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
        DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
    END IF;
END $$;

-- Loan notes policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loan_notes' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Loan officers can manage loan notes" ON public.loan_notes;
    END IF;
END $$;

-- Visitations policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'visitations' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Loan officers can manage visitations" ON public.visitations;
    END IF;
END $$;

-- Loan documents policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loan_documents' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Loan officers can manage loan documents" ON public.loan_documents;
    END IF;
END $$;

-- Borrower documents policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'borrower_documents' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Users can view borrower documents for their loans" ON public.borrower_documents;
    END IF;
END $$;

-- System documents policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_documents' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Authenticated users can view system documents" ON public.system_documents;
        DROP POLICY IF EXISTS "Admins can manage system documents" ON public.system_documents;
    END IF;
END $$;

-- Budgets policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'budgets' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Accountants can manage budgets" ON public.budgets;
    END IF;
END $$;

-- Audit logs policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "System can create audit logs" ON public.audit_logs;
        DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
    END IF;
END $$;

-- Liquidity config policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'liquidity_config' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Executives can manage liquidity config" ON public.liquidity_config;
        DROP POLICY IF EXISTS "All staff can view liquidity config" ON public.liquidity_config;
    END IF;
END $$;

-- Liquidity alerts policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'liquidity_alerts' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Executives can view alerts" ON public.liquidity_alerts;
        DROP POLICY IF EXISTS "System can create alerts" ON public.liquidity_alerts;
        DROP POLICY IF EXISTS "Executives can acknowledge alerts" ON public.liquidity_alerts;
    END IF;
END $$;

-- ============================================================================
-- CREATE POLICIES (Only if table exists)
-- ============================================================================

-- Users policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
        CREATE POLICY "Users can view all users" ON public.users
        FOR SELECT TO authenticated USING (true);

        CREATE POLICY "Users can update own profile" ON public.users
        FOR UPDATE TO authenticated USING (auth.uid() = id);

        CREATE POLICY "Admins can manage users" ON public.users
        FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo'));
    END IF;
END $$;

-- Borrowers policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'borrowers' AND table_schema = 'public') THEN
        CREATE POLICY "Authenticated users can view borrowers" ON public.borrowers
        FOR SELECT TO authenticated USING (true);

        CREATE POLICY "Loan officers can create borrowers" ON public.borrowers
        FOR INSERT TO authenticated WITH CHECK (get_auth_role() IN ('admin', 'ceo', 'loan_officer'));

        CREATE POLICY "Loan officers can update borrowers" ON public.borrowers
        FOR UPDATE TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'loan_officer'));
    END IF;
END $$;

-- Loans policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loans' AND table_schema = 'public') THEN
        CREATE POLICY "Authenticated users can view loans" ON public.loans
        FOR SELECT TO authenticated USING (true);

        CREATE POLICY "Loan officers can manage loans" ON public.loans
        FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'loan_officer'));

        CREATE POLICY "Accountants can view loans" ON public.loans
        FOR SELECT TO authenticated USING (get_auth_role() = 'accountant');
    END IF;
END $$;

-- Internal accounts policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'internal_accounts' AND table_schema = 'public') THEN
        CREATE POLICY "Accountants and executives can view accounts" ON public.internal_accounts
        FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

        CREATE POLICY "Accountants can manage accounts" ON public.internal_accounts
        FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));
    END IF;
END $$;

-- Journal entries policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal_entries' AND table_schema = 'public') THEN
        CREATE POLICY "Accountants can view journal entries" ON public.journal_entries
        FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

        CREATE POLICY "System can create journal entries" ON public.journal_entries
        FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
END $$;

-- Journal lines policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal_lines' AND table_schema = 'public') THEN
        CREATE POLICY "Accountants can view journal lines" ON public.journal_lines
        FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));
    END IF;
END $$;

-- Repayments policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'repayments' AND table_schema = 'public') THEN
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
    END IF;
END $$;

-- Expenses policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses' AND table_schema = 'public') THEN
        CREATE POLICY "Accountants can manage expenses" ON public.expenses
        FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));
    END IF;
END $$;

-- Tasks policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks' AND table_schema = 'public') THEN
        CREATE POLICY "Executives can manage tasks" ON public.tasks
        FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo'));

        CREATE POLICY "Users can view assigned tasks" ON public.tasks
        FOR SELECT TO authenticated USING (assigned_to = auth.uid() OR get_auth_role() IN ('admin', 'ceo'));
    END IF;
END $$;

-- Notifications policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications' AND table_schema = 'public') THEN
        CREATE POLICY "Users can view own notifications" ON public.notifications
        FOR SELECT TO authenticated USING (user_id = auth.uid());

        CREATE POLICY "System can create notifications" ON public.notifications
        FOR INSERT TO authenticated WITH CHECK (true);

        CREATE POLICY "Users can update own notifications" ON public.notifications
        FOR UPDATE TO authenticated USING (user_id = auth.uid());
    END IF;
END $$;

-- Loan notes policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loan_notes' AND table_schema = 'public') THEN
        CREATE POLICY "Loan officers can manage loan notes" ON public.loan_notes
        FOR ALL TO authenticated USING (
            get_auth_role() IN ('admin', 'ceo', 'loan_officer') OR
            EXISTS (SELECT 1 FROM loans WHERE id = loan_notes.loan_id AND officer_id = auth.uid())
        );
    END IF;
END $$;

-- Visitations policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'visitations' AND table_schema = 'public') THEN
        CREATE POLICY "Loan officers can manage visitations" ON public.visitations
        FOR ALL TO authenticated USING (
            get_auth_role() IN ('admin', 'ceo', 'loan_officer') OR
            EXISTS (SELECT 1 FROM loans WHERE id = visitations.loan_id AND officer_id = auth.uid())
        );
    END IF;
END $$;

-- Loan documents policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loan_documents' AND table_schema = 'public') THEN
        CREATE POLICY "Loan officers can manage loan documents" ON public.loan_documents
        FOR ALL TO authenticated USING (
            get_auth_role() IN ('admin', 'ceo', 'loan_officer') OR
            EXISTS (SELECT 1 FROM loans WHERE id = loan_documents.loan_id AND officer_id = auth.uid())
        );
    END IF;
END $$;

-- Borrower documents policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'borrower_documents' AND table_schema = 'public') THEN
        CREATE POLICY "Users can view borrower documents for their loans" ON public.borrower_documents
        FOR SELECT TO authenticated USING (
            get_auth_role() IN ('admin', 'ceo') OR
            EXISTS (SELECT 1 FROM loans WHERE borrower_id = borrower_documents.borrower_id AND officer_id = auth.uid())
        );
    END IF;
END $$;

-- System documents policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_documents' AND table_schema = 'public') THEN
        CREATE POLICY "Authenticated users can view system documents" ON public.system_documents
        FOR SELECT TO authenticated USING (true);

        CREATE POLICY "Admins can manage system documents" ON public.system_documents
        FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo'));
    END IF;
END $$;

-- Budgets policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'budgets' AND table_schema = 'public') THEN
        CREATE POLICY "Accountants can manage budgets" ON public.budgets
        FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));
    END IF;
END $$;

-- Audit logs policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public') THEN
        CREATE POLICY "System can create audit logs" ON public.audit_logs
        FOR INSERT TO authenticated WITH CHECK (true);

        CREATE POLICY "Admins can view audit logs" ON public.audit_logs
        FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo'));
    END IF;
END $$;

-- Liquidity config policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'liquidity_config' AND table_schema = 'public') THEN
        CREATE POLICY "Executives can manage liquidity config" ON public.liquidity_config
        FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

        CREATE POLICY "All staff can view liquidity config" ON public.liquidity_config
        FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- Liquidity alerts policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'liquidity_alerts' AND table_schema = 'public') THEN
        CREATE POLICY "Executives can view alerts" ON public.liquidity_alerts
        FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

        CREATE POLICY "System can create alerts" ON public.liquidity_alerts
        FOR INSERT TO authenticated WITH CHECK (true);

        CREATE POLICY "Executives can acknowledge alerts" ON public.liquidity_alerts
        FOR UPDATE TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));
    END IF;
END $$;
