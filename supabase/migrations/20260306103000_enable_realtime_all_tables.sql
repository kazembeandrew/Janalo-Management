-- ============================================================================
-- ENABLE REALTIME FOR ALL TABLES THAT REQUIRE IT
-- ============================================================================

-- This migration enables Row Level Security (RLS) and proper policies
-- for real-time subscriptions on all tables that require live updates

-- ============================================================================
-- 1. LOANS TABLE - Enable realtime for loan status updates and modifications
-- ============================================================================

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Loan officers can view their loans" ON public.loans;
DROP POLICY IF EXISTS "Loan officers can create loans" ON public.loans;
DROP POLICY IF EXISTS "Loan officers can update their loans" ON public.loans;
DROP POLICY IF EXISTS "Executives can view all loans" ON public.loans;
DROP POLICY IF EXISTS "Executives can update all loans" ON public.loans;

-- Create comprehensive RLS policies for loans
CREATE POLICY "Users can view loans they have access to" ON public.loans
FOR SELECT TO authenticated USING (
    officer_id = auth.uid() OR
    get_auth_role() IN ('admin', 'ceo', 'accountant', 'hr')
);

CREATE POLICY "Users can insert loans" ON public.loans
FOR INSERT TO authenticated WITH CHECK (
    get_auth_role() IN ('loan_officer', 'admin', 'ceo')
);

CREATE POLICY "Users can update loans they have access to" ON public.loans
FOR UPDATE TO authenticated USING (
    officer_id = auth.uid() OR
    get_auth_role() IN ('admin', 'ceo', 'accountant')
);

-- ============================================================================
-- 2. ACCOUNTS TABLE - Enable realtime for balance changes
-- ============================================================================

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view accounts" ON public.accounts;
DROP POLICY IF EXISTS "Executives can manage accounts" ON public.accounts;

CREATE POLICY "Authenticated users can view accounts" ON public.accounts
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Executives can manage accounts" ON public.accounts
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

-- ============================================================================
-- 3. JOURNAL ENTRIES TABLE - Enable realtime for transaction updates
-- ============================================================================

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Staff can create journal entries" ON public.journal_entries;

CREATE POLICY "Staff can view journal entries" ON public.journal_entries
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant', 'loan_officer', 'hr'));

CREATE POLICY "Staff can create journal entries" ON public.journal_entries
FOR INSERT TO authenticated WITH CHECK (get_auth_role() IN ('admin', 'ceo', 'accountant'));

-- ============================================================================
-- 4. BORROWERS TABLE - Enable realtime for borrower information changes
-- ============================================================================

ALTER TABLE public.borrowers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view borrowers" ON public.borrowers;
DROP POLICY IF EXISTS "Staff can manage borrowers" ON public.borrowers;

CREATE POLICY "Staff can view borrowers" ON public.borrowers
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant', 'loan_officer', 'hr'));

CREATE POLICY "Staff can manage borrowers" ON public.borrowers
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant', 'loan_officer'));

-- ============================================================================
-- 5. USERS TABLE - Enable realtime for user status/role changes
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update users" ON public.users;

CREATE POLICY "Users can view their own profile" ON public.users
FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "Admins can view all users" ON public.users
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'hr'));

CREATE POLICY "Admins can update users" ON public.users
FOR UPDATE TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'hr'));

-- ============================================================================
-- 6. INTERNAL ACCOUNTS TABLE - Enable realtime for account changes
-- ============================================================================

ALTER TABLE public.internal_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view internal accounts" ON public.internal_accounts;
DROP POLICY IF EXISTS "Executives can manage internal accounts" ON public.internal_accounts;

CREATE POLICY "Staff can view internal accounts" ON public.internal_accounts
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant', 'loan_officer', 'hr'));

CREATE POLICY "Executives can manage internal accounts" ON public.internal_accounts
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

-- ============================================================================
-- 7. REPAYMENTS TABLE - Enable realtime for repayment updates
-- ============================================================================

ALTER TABLE public.repayments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view repayments for accessible loans" ON public.repayments;
DROP POLICY IF EXISTS "Staff can create repayments" ON public.repayments;

CREATE POLICY "Users can view repayments for accessible loans" ON public.repayments
FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.loans l
        WHERE l.id = repayments.loan_id
        AND (l.officer_id = auth.uid() OR get_auth_role() IN ('admin', 'ceo', 'accountant', 'hr'))
    )
);

CREATE POLICY "Staff can create repayments" ON public.repayments
FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.loans l
        WHERE l.id = repayments.loan_id
        AND (l.officer_id = auth.uid() OR get_auth_role() IN ('admin', 'ceo', 'accountant'))
    )
);

-- ============================================================================
-- 8. LOAN NOTES TABLE - Enable realtime for note updates
-- ============================================================================

ALTER TABLE public.loan_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view notes for accessible loans" ON public.loan_notes;
DROP POLICY IF EXISTS "Staff can manage notes" ON public.loan_notes;

CREATE POLICY "Users can view notes for accessible loans" ON public.loan_notes
FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.loans l
        WHERE l.id = loan_notes.loan_id
        AND (l.officer_id = auth.uid() OR get_auth_role() IN ('admin', 'ceo', 'accountant', 'hr'))
    )
);

CREATE POLICY "Staff can manage notes" ON public.loan_notes
FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.loans l
        WHERE l.id = loan_notes.loan_id
        AND (l.officer_id = auth.uid() OR get_auth_role() IN ('admin', 'ceo', 'accountant', 'hr'))
    )
);

-- ============================================================================
-- 9. JOURNAL LINES TABLE - Enable realtime for transaction line updates
-- ============================================================================

ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view journal lines" ON public.journal_lines;

CREATE POLICY "Staff can view journal lines" ON public.journal_lines
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

CREATE POLICY "Staff can manage journal lines" ON public.journal_lines
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

-- ============================================================================
-- 10. NOTIFICATIONS TABLE - Enable realtime for notifications (only if table exists)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'notifications'
    ) THEN
        EXECUTE 'ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY';

        -- Drop existing policies (using EXECUTE to avoid syntax issues)
        EXECUTE 'DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications';
        EXECUTE 'DROP POLICY IF EXISTS "System can create notifications" ON public.notifications';
        EXECUTE 'DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications';

        -- Create new policies
        EXECUTE 'CREATE POLICY "Users can view their notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR get_auth_role() IN (''admin'', ''ceo''))';
        EXECUTE 'CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true)';
        EXECUTE 'CREATE POLICY "Users can update their notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid())';
    END IF;
END $$;

-- ============================================================================
-- 11. LIQUIDITY ALERTS TABLE - Enable realtime for critical alerts
-- ============================================================================

-- Already enabled in previous migration, but ensure policies are correct
ALTER TABLE public.liquidity_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Executives can view alerts" ON public.liquidity_alerts;

CREATE POLICY "Executives can view alerts" ON public.liquidity_alerts
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

-- ============================================================================
-- 12. COMPLIANCE REQUIREMENTS TABLE - Enable realtime for compliance status changes
-- ============================================================================

ALTER TABLE public.compliance_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view compliance requirements" ON public.compliance_requirements;
DROP POLICY IF EXISTS "Compliance officers can manage requirements" ON public.compliance_requirements;

CREATE POLICY "Staff can view compliance requirements" ON public.compliance_requirements
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant', 'hr'));

CREATE POLICY "Compliance officers can manage requirements" ON public.compliance_requirements
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant', 'hr'));

-- ============================================================================
-- 13. REGULATORY REPORTS TABLE - Enable realtime for report status updates
-- ============================================================================

ALTER TABLE public.regulatory_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view regulatory reports" ON public.regulatory_reports;
DROP POLICY IF EXISTS "Compliance officers can manage reports" ON public.regulatory_reports;

CREATE POLICY "Staff can view regulatory reports" ON public.regulatory_reports
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant', 'hr'));

CREATE POLICY "Compliance officers can manage reports" ON public.regulatory_reports
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant', 'hr'));

-- ============================================================================
-- 14. VISITATIONS TABLE - Enable realtime for field officer updates (already enabled)
-- ============================================================================

-- Already enabled in schema.sql, but ensure policies are comprehensive
ALTER TABLE public.visitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View Visitations" ON public.visitations;
DROP POLICY IF EXISTS "Create Visitations" ON public.visitations;

CREATE POLICY "Users can view visitations for accessible loans" ON public.visitations
FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.loans l
        WHERE l.id = visitations.loan_id
        AND (l.officer_id = auth.uid() OR get_auth_role() IN ('admin', 'ceo', 'accountant', 'hr'))
    )
);

CREATE POLICY "Staff can create visitations" ON public.visitations
FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.loans l
        WHERE l.id = visitations.loan_id
        AND (l.officer_id = auth.uid() OR get_auth_role() IN ('admin', 'ceo', 'accountant', 'loan_officer'))
    )
);

-- ============================================================================
-- 15. LOAN DOCUMENTS TABLE - Enable realtime for document updates (only if table exists)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'loan_documents'
    ) THEN
        EXECUTE 'ALTER TABLE public.loan_documents ENABLE ROW LEVEL SECURITY';

        -- Drop existing policies (using EXECUTE to avoid syntax issues)
        EXECUTE 'DROP POLICY IF EXISTS "Users can view loan documents for accessible loans" ON public.loan_documents';
        EXECUTE 'DROP POLICY IF EXISTS "Staff can manage loan documents" ON public.loan_documents';

        -- Create new policies
        EXECUTE 'CREATE POLICY "Users can view loan documents for accessible loans" ON public.loan_documents FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.loans l WHERE l.id = loan_documents.loan_id AND (l.officer_id = auth.uid() OR get_auth_role() IN (''admin'', ''ceo'', ''accountant'', ''hr''))))';
        EXECUTE 'CREATE POLICY "Staff can manage loan documents" ON public.loan_documents FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.loans l WHERE l.id = loan_documents.loan_id AND (l.officer_id = auth.uid() OR get_auth_role() IN (''admin'', ''ceo'', ''accountant'', ''loan_officer'', ''hr''))))';
    END IF;
END $$;

-- ============================================================================
-- 16. BORROWER DOCUMENTS TABLE - Enable realtime for document updates
-- ============================================================================

ALTER TABLE public.borrower_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view borrower documents for accessible borrowers" ON public.borrower_documents;
DROP POLICY IF EXISTS "Staff can manage borrower documents" ON public.borrower_documents;

CREATE POLICY "Users can view borrower documents for accessible borrowers" ON public.borrower_documents
FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.loans l
        WHERE l.borrower_id = borrower_documents.borrower_id
        AND (l.officer_id = auth.uid() OR get_auth_role() IN ('admin', 'ceo', 'accountant', 'hr'))
    )
);

CREATE POLICY "Staff can manage borrower documents" ON public.borrower_documents
FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.loans l
        WHERE l.borrower_id = borrower_documents.borrower_id
        AND (l.officer_id = auth.uid() OR get_auth_role() IN ('admin', 'ceo', 'accountant', 'loan_officer', 'hr'))
    )
);

-- ============================================================================
-- 17. REVENUE FORECASTS TABLE - Enable realtime for forecast updates
-- ============================================================================

ALTER TABLE public.revenue_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Executives can view revenue forecasts" ON public.revenue_forecasts
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

CREATE POLICY "System can manage revenue forecasts" ON public.revenue_forecasts
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

-- ============================================================================
-- 18. RISK ASSESSMENTS TABLE - Enable realtime for risk assessment updates
-- ============================================================================

ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Executives can view risk assessments" ON public.risk_assessments
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

CREATE POLICY "System can manage risk assessments" ON public.risk_assessments
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

-- ============================================================================
-- 19. POLICY DOCUMENTS TABLE - Enable realtime for policy document updates
-- ============================================================================

ALTER TABLE public.policy_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view policy documents" ON public.policy_documents
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant', 'loan_officer', 'hr'));

CREATE POLICY "Compliance officers can manage policy documents" ON public.policy_documents
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant', 'hr'));

-- ============================================================================
-- 20. SYSTEM LOGS TABLE - Enable realtime for system log monitoring
-- ============================================================================

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view system logs" ON public.system_logs
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo'));

CREATE POLICY "System can create logs" ON public.system_logs
FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================================
-- 21. AUDIT LOGS TABLE - Enable realtime for audit trail monitoring
-- ============================================================================

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can create audit logs" ON public.audit_logs;

CREATE POLICY "Admins can view audit logs" ON public.audit_logs
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'hr'));

CREATE POLICY "System can create audit logs" ON public.audit_logs
FOR INSERT TO authenticated WITH CHECK (true);
