-- Database Optimization Migration
-- Created: 2025-03-01
-- Purpose: Performance improvements, data integrity, and security enhancements

-- ========================================
-- CRITICAL PERFORMANCE INDEXES
-- ========================================

-- Loans table indexes for common queries
CREATE INDEX IF NOT EXISTS idx_loans_borrower_status ON loans(borrower_id, status);
CREATE INDEX IF NOT EXISTS idx_loans_officer_date ON loans(officer_id, disbursement_date);
CREATE INDEX IF NOT EXISTS idx_loans_status_date ON loans(status, created_at);
CREATE INDEX IF NOT EXISTS idx_loans_reference_no ON loans(reference_no) WHERE reference_no IS NOT NULL;

-- Repayments performance indexes
CREATE INDEX IF NOT EXISTS idx_repayments_loan_date ON repayments(loan_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_repayments_recorded_date ON repayments(recorded_by, payment_date);

-- Journal entries performance
CREATE INDEX IF NOT EXISTS idx_journal_entries_ref ON journal_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date, created_at);

-- Journal lines for accounting queries
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);

-- Notifications performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- Audit logs for security queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_date ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_date ON audit_logs(action, created_at DESC);

-- Security events monitoring
CREATE INDEX IF NOT EXISTS idx_security_events_user_date ON security_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type_date ON security_events(event_type, created_at DESC);

-- User sessions for active session management
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active, expires_at) WHERE is_active = true;

-- ========================================
-- DATA INTEGRITY CONSTRAINTS
-- ========================================

-- Loans table constraints
ALTER TABLE loans 
ADD CONSTRAINT chk_loans_principal_outstanding_non_negative 
CHECK (principal_outstanding >= 0);

ALTER TABLE loans 
ADD CONSTRAINT chk_loans_interest_outstanding_non_negative 
CHECK (interest_outstanding >= 0);

ALTER TABLE loans 
ADD CONSTRAINT chk_loans_penalty_outstanding_non_negative 
CHECK (penalty_outstanding >= 0);

ALTER TABLE loans 
ADD CONSTRAINT chk_loans_principal_amount_positive 
CHECK (principal_amount > 0);

ALTER TABLE loans 
ADD CONSTRAINT chk_loans_interest_rate_positive 
CHECK (interest_rate >= 0);

ALTER TABLE loans 
ADD CONSTRAINT chk_loans_term_months_positive 
CHECK (term_months > 0);

-- Repayments constraints
ALTER TABLE repayments 
ADD CONSTRAINT chk_repayments_amount_positive 
CHECK (amount_paid > 0);

ALTER TABLE repayments 
ADD CONSTRAINT chk_repayments_principal_non_negative 
CHECK (principal_paid >= 0);

ALTER TABLE repayments 
ADD CONSTRAINT chk_repayments_interest_non_negative 
CHECK (interest_paid >= 0);

ALTER TABLE repayments 
ADD CONSTRAINT chk_repayments_penalty_non_negative 
CHECK (penalty_paid >= 0);

ALTER TABLE repayments 
ADD CONSTRAINT chk_repayments_overpayment_non_negative 
CHECK (overpayment >= 0);

-- Journal lines constraints
ALTER TABLE journal_lines 
ADD CONSTRAINT chk_journal_lines_debit_credit_validation 
CHECK (
  (debit > 0 AND credit = 0) OR 
  (credit > 0 AND debit = 0) OR 
  (debit = 0 AND credit = 0)
);

-- Internal accounts constraints (skip if data violates constraint)
DO $$
BEGIN
    BEGIN
        ALTER TABLE internal_accounts 
        ADD CONSTRAINT chk_internal_accounts_balance_non_negative 
        CHECK (balance >= 0 OR account_category IN ('liability', 'equity', 'income'));
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Skipping internal_accounts balance constraint due to existing data';
    END;
END $$;

-- Fund transactions constraints
ALTER TABLE fund_transactions 
ADD CONSTRAINT chk_fund_transactions_amount_positive 
CHECK (amount > 0);

-- Expenses constraints
ALTER TABLE expenses 
ADD CONSTRAINT chk_expenses_amount_positive 
CHECK (amount > 0);

-- ========================================
-- ROW LEVEL SECURITY POLICIES
-- ========================================

-- Enable RLS on sensitive tables
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Loans RLS policies
CREATE POLICY "Users can view loans they are assigned or created" ON loans
FOR SELECT USING (
  officer_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'ceo', 'accountant')
  )
);

CREATE POLICY "Loan officers can update assigned loans" ON loans
FOR UPDATE USING (
  officer_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'ceo')
  )
);

-- Borrowers RLS policies
CREATE POLICY "Users can view borrowers they are assigned" ON borrowers
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM loans 
    WHERE loans.borrower_id = borrowers.id AND loans.officer_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'ceo', 'hr')
  )
);

-- Repayments RLS policies
CREATE POLICY "Users can view repayments for their loans" ON repayments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM loans 
    WHERE loans.id = repayments.loan_id AND 
    (loans.officer_id = auth.uid())
  ) OR
  recorded_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'ceo', 'accountant')
  )
);

-- ========================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to key tables (skip if already exists)
DO $$
BEGIN
    -- Loans trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_loans_updated_at') THEN
        CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Borrowers trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_borrowers_updated_at') THEN
        CREATE TRIGGER update_borrowers_updated_at BEFORE UPDATE ON borrowers
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Repayments trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_repayments_updated_at') THEN
        CREATE TRIGGER update_repayments_updated_at BEFORE UPDATE ON repayments
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Users trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
        CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ========================================
-- VIEWS FOR COMMON QUERIES
-- ========================================

-- Active loans summary view
CREATE OR REPLACE VIEW active_loans_summary AS
SELECT 
    l.id,
    l.reference_no,
    b.full_name as borrower_name,
    u.full_name as officer_name,
    l.principal_amount,
    l.principal_outstanding,
    l.interest_outstanding,
    l.penalty_outstanding,
    l.status,
    l.disbursement_date,
    l.monthly_installment,
    CASE 
        WHEN l.disbursement_date + (l.term_months || ' months')::interval < CURRENT_DATE THEN 'overdue'
        WHEN l.principal_outstanding > 0 THEN 'active'
        ELSE 'completed'
    END as loan_status_calc
FROM loans l
JOIN borrowers b ON l.borrower_id = b.id
JOIN users u ON l.officer_id = u.id
WHERE l.status = 'active';

-- Portfolio performance view
CREATE OR REPLACE VIEW portfolio_performance AS
SELECT 
    COUNT(*) as total_loans,
    SUM(principal_amount) as total_principal,
    SUM(principal_outstanding) as total_outstanding,
    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_loans,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_loans,
    SUM(CASE WHEN status = 'defaulted' THEN 1 ELSE 0 END) as defaulted_loans,
    ROUND(
        (SUM(CASE WHEN status = 'defaulted' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 2
    ) as default_rate_percentage
FROM loans;

-- ========================================
-- SECURITY ENHANCEMENTS
-- ========================================

-- Function to check if user has specific role (drop and recreate)
DROP FUNCTION IF EXISTS has_role(TEXT);
CREATE FUNCTION has_role(role_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() AND role = role_param AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log security events automatically
CREATE OR REPLACE FUNCTION log_security_event()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO security_events (event_type, user_id, success, details)
    VALUES (
        TG_TABLE_NAME || '_' || TG_OP,
        auth.uid(),
        true,
        json_build_object('table', TG_TABLE_NAME, 'operation', TG_OP, 'record_id', COALESCE(NEW.id, OLD.id))
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add security logging to critical tables (skip if already exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_loans_security') THEN
        CREATE TRIGGER log_loans_security AFTER INSERT OR UPDATE OR DELETE ON loans
            FOR EACH ROW EXECUTE FUNCTION log_security_event();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_users_security') THEN
        CREATE TRIGGER log_users_security AFTER INSERT OR UPDATE OR DELETE ON users
            FOR EACH ROW EXECUTE FUNCTION log_security_event();
    END IF;
END $$;

-- ========================================
-- PERFORMANCE MONITORING
-- ========================================

-- Create table for query performance tracking
CREATE TABLE IF NOT EXISTS query_performance_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    query_name text NOT NULL,
    execution_time_ms numeric NOT NULL,
    rows_affected integer,
    executed_by uuid REFERENCES users(id),
    executed_at timestamp with time zone DEFAULT now()
);

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

-- Grant specific permissions for authenticated users
GRANT INSERT, UPDATE, DELETE ON loans TO authenticated;
GRANT INSERT, UPDATE, DELETE ON repayments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON borrowers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON journal_entries TO authenticated;
GRANT INSERT, UPDATE, DELETE ON journal_lines TO authenticated;
