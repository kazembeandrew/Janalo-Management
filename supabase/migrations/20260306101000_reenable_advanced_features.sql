-- Re-enable Advanced Features Migration
-- Now that core tables (borrowers, loans) exist, we can enable the advanced features
-- that were commented out in the admin features migration

-- ============================================================================
-- 1. BUDGETS TABLE (Required for budget variance analysis)
-- ============================================================================

CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    amount DECIMAL(15,2) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    budget_type VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (budget_type IN ('monthly', 'quarterly', 'yearly', 'annual')),
    department VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. CUSTOMER LIFETIME VALUE (Now that borrowers table exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_lifetime_value (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    borrower_id UUID REFERENCES borrowers(id) ON DELETE CASCADE,
    clv_score DECIMAL(15,2) NOT NULL,
    total_revenue_generated DECIMAL(15,2) NOT NULL,
    acquisition_cost DECIMAL(15,2),
    retention_cost DECIMAL(15,2),
    profitability_score DECIMAL(5,2),
    loyalty_score DECIMAL(5,2),
    last_calculated DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. BUDGET VARIANCE ANALYSIS (Now that budgets table exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS budget_variance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE,
    actual_amount DECIMAL(15,2) NOT NULL,
    variance_amount DECIMAL(15,2) NOT NULL,
    variance_percentage DECIMAL(5,2) NOT NULL,
    analysis_period VARCHAR(20) NOT NULL, -- 'monthly', 'quarterly', 'yearly'
    notes TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. CUSTOMER SATISFACTION SURVEYS (Now that borrowers and loans exist)
-- ============================================================================

CREATE TABLE IF NOT EXISTS satisfaction_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    borrower_id UUID REFERENCES borrowers(id) ON DELETE CASCADE,
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
    survey_type VARCHAR(50) NOT NULL, -- 'service_quality', 'loan_process', etc.
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    survey_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 5. REFERRAL PROGRAM (Now that borrowers table exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS referral_program (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID REFERENCES borrowers(id),
    referred_id UUID REFERENCES borrowers(id),
    referral_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    reward_amount DECIMAL(15,2),
    reward_paid BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_lifetime_value ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_variance ENABLE ROW LEVEL SECURITY;
ALTER TABLE satisfaction_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_program ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Budgets - Admin and CEO only
CREATE POLICY "Admin and CEO access to budgets" ON budgets
FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE public.users.id = auth.uid()
        AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'ceo')
    )
);

-- Customer Lifetime Value - Admin, CEO, and Accountants
CREATE POLICY "Executives and accountants access to CLV" ON customer_lifetime_value
FOR ALL TO authenticated USING (
    get_auth_role() IN ('admin', 'ceo', 'accountant')
);

-- Budget Variance - Same as budgets
CREATE POLICY "Admin and CEO access to budget variance" ON budget_variance
FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE public.users.id = auth.uid()
        AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'ceo')
    )
);

-- Satisfaction Surveys - Loan officers can view related surveys, executives can view all
CREATE POLICY "Loan officers can view related surveys" ON satisfaction_surveys
FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM loans l
        WHERE l.id = satisfaction_surveys.loan_id
        AND l.officer_id = auth.uid()
    ) OR get_auth_role() IN ('admin', 'ceo', 'hr')
);

CREATE POLICY "Loan officers can create surveys" ON satisfaction_surveys
FOR INSERT TO authenticated WITH CHECK (
    get_auth_role() IN ('admin', 'ceo', 'loan_officer', 'hr')
);

-- Referral Program - Similar to CLV
CREATE POLICY "Executives and loan officers access to referrals" ON referral_program
FOR ALL TO authenticated USING (
    get_auth_role() IN ('admin', 'ceo', 'loan_officer', 'hr')
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category);
CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_clv_borrower_id ON customer_lifetime_value(borrower_id);
CREATE INDEX IF NOT EXISTS idx_budget_variance_budget_id ON budget_variance(budget_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_borrower_id ON satisfaction_surveys(borrower_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_loan_id ON satisfaction_surveys(loan_id);
CREATE INDEX IF NOT EXISTS idx_referral_referrer_id ON referral_program(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_referred_id ON referral_program(referred_id);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON budgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_lifetime_value_updated_at BEFORE UPDATE ON customer_lifetime_value
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SAMPLE DATA FOR TESTING
-- ============================================================================

-- Insert sample budgets
INSERT INTO budgets (category, subcategory, amount, period_start, period_end, budget_type, department, created_by) VALUES
('Operating Expenses', 'Office Supplies', 5000.00, '2024-01-01', '2024-12-31', 'annual', 'General',
 (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1)),
('Loan Loss Provision', NULL, 100000.00, '2024-01-01', '2024-12-31', 'annual', 'Risk Management',
 (SELECT id FROM public.users WHERE role = 'ceo' LIMIT 1)),
('Marketing', 'Digital Marketing', 25000.00, '2024-01-01', '2024-12-31', 'annual', 'Marketing',
 (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1))
ON CONFLICT DO NOTHING;
