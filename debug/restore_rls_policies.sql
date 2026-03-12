-- RECREATE ALL RLS POLICIES - Fix dashboard access
-- Execute this entire script in Supabase SQL Editor
-- This will restore data access so pages can load after login

-- ============================================================================
-- ENABLE RLS ON ALL TABLES FIRST
-- ============================================================================

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

-- ============================================================================
-- USERS POLICIES
-- ============================================================================

CREATE POLICY "Users can view all users" ON public.users
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.users
FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Admins can manage users" ON public.users
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo'));

-- ============================================================================
-- BORROWERS POLICIES
-- ============================================================================

CREATE POLICY "Authenticated users can view borrowers" ON public.borrowers
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Loan officers can create borrowers" ON public.borrowers
FOR INSERT TO authenticated WITH CHECK (get_auth_role() IN ('admin', 'ceo', 'loan_officer'));

CREATE POLICY "Loan officers can update borrowers" ON public.borrowers
FOR UPDATE TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'loan_officer'));

-- ============================================================================
-- LOANS POLICIES
-- ============================================================================

CREATE POLICY "Authenticated users can view loans" ON public.loans
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Loan officers can manage loans" ON public.loans
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'loan_officer'));

CREATE POLICY "Accountants can view loans" ON public.loans
FOR SELECT TO authenticated USING (get_auth_role() = 'accountant');

-- ============================================================================
-- ACCOUNTING POLICIES
-- ============================================================================

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

-- ============================================================================
-- TRANSACTION POLICIES
-- ============================================================================

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

-- ============================================================================
-- NOTIFICATIONS POLICIES
-- ============================================================================

CREATE POLICY "Users can view own notifications" ON public.notifications
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON public.notifications
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update own notifications" ON public.notifications
FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ============================================================================
-- LOAN MANAGEMENT POLICIES
-- ============================================================================

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

-- System documents policies - FIXED with proper INSERT and WITH CHECK

CREATE POLICY "Authenticated users can view system documents" ON public.system_documents
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can insert system documents" ON public.system_documents
FOR INSERT TO authenticated WITH CHECK (
    get_auth_role() IN ('admin', 'ceo', 'hr', 'accountant', 'loan_officer')
);

CREATE POLICY "Admins and owner can update system documents" ON public.system_documents
FOR UPDATE TO authenticated USING (
    get_auth_role() IN ('admin', 'ceo') OR uploaded_by = auth.uid()
);

CREATE POLICY "Admins can delete system documents" ON public.system_documents
FOR DELETE TO authenticated USING (get_auth_role() IN ('admin', 'ceo'));

CREATE POLICY "Accountants can manage budgets" ON public.budgets
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

CREATE POLICY "System can create audit logs" ON public.audit_logs
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins can view audit logs" ON public.audit_logs
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo'));

-- ============================================================================
-- LIQUIDITY POLICIES
-- ============================================================================

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
-- VERIFY POLICIES ARE CREATED
-- ============================================================================

SELECT
    schemaname,
    tablename,
    COUNT(*) as policies_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- ============================================================================
-- TEST DASHBOARD ACCESS
-- ============================================================================

-- Test if user can now access dashboard data
SELECT
    'POLICY_TEST' as test_type,
    (SELECT COUNT(*) FROM public.loans) as loans_accessible,
    (SELECT COUNT(*) FROM public.notifications WHERE user_id = 'ad9c0387-d5c2-418d-88c7-42e8d8dd7c98') as notifications_accessible,
    (SELECT COUNT(*) FROM public.internal_accounts) as accounts_accessible,
    CASE
        WHEN (SELECT COUNT(*) FROM public.loans) > 0 THEN 'ACCESS_RESTORED'
        ELSE 'STILL_BLOCKED'
    END as dashboard_status;

-- ============================================================================
-- SUCCESS CONFIRMATION
-- ============================================================================

/*
After running this script:
1. All tables should have RLS enabled with appropriate policies
2. Dashboard queries should return data instead of empty results
3. Pages should now load after login

If dashboard still doesn't work, check browser console for any remaining API errors.
*/
