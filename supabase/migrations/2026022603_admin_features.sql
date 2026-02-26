-- ============================================================================
-- ADMIN FEATURES DATABASE MIGRATION
-- ============================================================================

-- ============================================================================
-- 1. ADVANCED ANALYTICS TABLES
-- ============================================================================

-- Revenue Forecasts
CREATE TABLE IF NOT EXISTS revenue_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forecast_date DATE NOT NULL,
    forecast_period VARCHAR(20) NOT NULL, -- 'monthly', 'quarterly', 'yearly'
    predicted_revenue DECIMAL(15,2) NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL, -- 0.00 to 1.00
    model_version VARCHAR(20) NOT NULL,
    actual_revenue DECIMAL(15,2),
    variance_percentage DECIMAL(5,2),
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Risk Assessments
CREATE TABLE IF NOT EXISTS risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_date DATE NOT NULL,
    portfolio_risk_score DECIMAL(5,2) NOT NULL, -- 0.00 to 100.00
    concentration_risk DECIMAL(5,2) NOT NULL,
    credit_risk DECIMAL(5,2) NOT NULL,
    liquidity_risk DECIMAL(5,2) NOT NULL,
    operational_risk DECIMAL(5,2) NOT NULL,
    market_risk DECIMAL(5,2) NOT NULL,
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    mitigation_actions TEXT[],
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer Lifetime Value
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
-- 2. COMPLIANCE & REGULATORY MANAGEMENT
-- ============================================================================

-- Compliance Requirements
CREATE TABLE IF NOT EXISTS compliance_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement_name VARCHAR(200) NOT NULL,
    regulatory_body VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'ad_hoc')),
    due_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue', 'cancelled')),
    assigned_to UUID REFERENCES public.users(id),
    completed_by UUID REFERENCES public.users(id),
    completion_date DATE,
    evidence_documents TEXT[], -- Array of document paths
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Regulatory Reports
CREATE TABLE IF NOT EXISTS regulatory_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_name VARCHAR(200) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    regulatory_body VARCHAR(100) NOT NULL,
    reporting_period_start DATE NOT NULL,
    reporting_period_end DATE NOT NULL,
    due_date DATE NOT NULL,
    submission_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generated', 'submitted', 'rejected', 'approved')),
    report_data JSONB, -- Store generated report data
    submission_reference VARCHAR(100),
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Policy Documents
CREATE TABLE IF NOT EXISTS policy_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    version VARCHAR(20) NOT NULL,
    effective_date DATE NOT NULL,
    expiry_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
    content TEXT NOT NULL,
    attachments TEXT[], -- Array of file paths
    reviewed_by UUID REFERENCES public.users(id),
    approved_by UUID REFERENCES public.users(id),
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. WORKFLOW AUTOMATION
-- ============================================================================

-- Workflow Definitions
CREATE TABLE IF NOT EXISTS workflow_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    entity_type VARCHAR(50) NOT NULL, -- 'loan', 'expense', 'document', etc.
    trigger_event VARCHAR(50) NOT NULL, -- 'create', 'update', 'status_change'
    conditions JSONB NOT NULL, -- Workflow conditions
    actions JSONB NOT NULL, -- Workflow actions
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow Executions
CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    execution_log JSONB, -- Detailed execution log
    triggered_by UUID REFERENCES public.users(id)
);

-- ============================================================================
-- 4. ADVANCED SECURITY
-- ============================================================================

-- User Sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    ip_address INET NOT NULL,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- IP Whitelist
CREATE TABLE IF NOT EXISTS ip_whitelist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL UNIQUE,
    description VARCHAR(200),
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Two-Factor Authentication
CREATE TABLE IF NOT EXISTS user_2fa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    secret_key VARCHAR(255),
    backup_codes TEXT[], -- Array of backup codes
    is_enabled BOOLEAN DEFAULT false,
    last_used TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security Events
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL, -- 'login_attempt', 'failed_login', 'password_change', etc.
    user_id UUID REFERENCES public.users(id),
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 5. SYSTEM ADMINISTRATION
-- ============================================================================

-- Database Health Metrics
CREATE TABLE IF NOT EXISTS database_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,2) NOT NULL,
    unit VARCHAR(20), -- 'MB', 'seconds', 'percentage', etc.
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'warning', 'critical')),
    threshold_warning DECIMAL(15,2),
    threshold_critical DECIMAL(15,2),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Backup Records
CREATE TABLE IF NOT EXISTS backup_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_type VARCHAR(20) NOT NULL CHECK (backup_type IN ('full', 'incremental', 'differential')),
    backup_size BIGINT NOT NULL, -- Size in bytes
    backup_path VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_by UUID REFERENCES public.users(id)
);

-- System Resource Monitoring
CREATE TABLE IF NOT EXISTS system_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cpu_usage DECIMAL(5,2) NOT NULL, -- Percentage
    memory_usage DECIMAL(5,2) NOT NULL, -- Percentage
    disk_usage DECIMAL(5,2) NOT NULL, -- Percentage
    active_connections INTEGER NOT NULL,
    database_connections INTEGER NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 6. COMMUNICATION & COLLABORATION
-- ============================================================================

-- Company Announcements
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    target_roles TEXT[], -- Array of roles that should see this
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    read_by UUID[], -- Array of user IDs who have read this
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge Base Articles
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    tags TEXT[], -- Array of tags
    is_published BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES public.users(id),
    updated_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 7. FINANCIAL MANAGEMENT ENHANCEMENTS
-- ============================================================================

-- Cash Flow Projections
CREATE TABLE IF NOT EXISTS cash_flow_projections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projection_date DATE NOT NULL,
    projected_inflow DECIMAL(15,2) NOT NULL,
    projected_outflow DECIMAL(15,2) NOT NULL,
    net_cash_flow DECIMAL(15,2) NOT NULL,
    confidence_level DECIMAL(3,2) NOT NULL, -- 0.00 to 1.00
    notes TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Investment Portfolio
CREATE TABLE IF NOT EXISTS investment_portfolio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investment_name VARCHAR(200) NOT NULL,
    investment_type VARCHAR(50) NOT NULL, -- 'stocks', 'bonds', 'mutual_funds', etc.
    current_value DECIMAL(15,2) NOT NULL,
    initial_investment DECIMAL(15,2) NOT NULL,
    purchase_date DATE NOT NULL,
    maturity_date DATE,
    interest_rate DECIMAL(5,2),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'matured', 'sold', 'cancelled')),
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Budget Variance Analysis
CREATE TABLE IF NOT EXISTS budget_variance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE,
    actual_amount DECIMAL(15,2) NOT NULL,
    variance_amount DECIMAL(15,2) NOT NULL,
    variance_percentage DECIMAL(5,2) NOT NULL,
    analysis_period VARCHAR(20) NOT NULL, -- 'monthly', 'quarterly', 'yearly'
    notes TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 8. CUSTOMER RELATIONSHIP MANAGEMENT
-- ============================================================================

-- Communication Templates
CREATE TABLE IF NOT EXISTS communication_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(200) NOT NULL,
    template_type VARCHAR(50) NOT NULL, -- 'sms', 'email', 'whatsapp'
    subject VARCHAR(200), -- For email templates
    content TEXT NOT NULL,
    variables TEXT[], -- Array of variable names that can be substituted
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer Satisfaction Surveys
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

-- Referral Program
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

-- Customer Segments
CREATE TABLE IF NOT EXISTS customer_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_name VARCHAR(100) NOT NULL,
    segment_criteria JSONB NOT NULL, -- Rules for segment membership
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 9. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_date ON revenue_forecasts(forecast_date);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_date ON risk_assessments(assessment_date);
CREATE INDEX IF NOT EXISTS idx_clv_borrower_id ON customer_lifetime_value(borrower_id);

-- Compliance indexes
CREATE INDEX IF NOT EXISTS idx_compliance_due_date ON compliance_requirements(due_date);
CREATE INDEX IF NOT EXISTS idx_regulatory_reports_due ON regulatory_reports(due_date);
CREATE INDEX IF NOT EXISTS idx_policy_documents_status ON policy_documents(status);

-- Workflow indexes
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_entity ON workflow_executions(entity_id, entity_type);

-- Security indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at);

-- System admin indexes
CREATE INDEX IF NOT EXISTS idx_database_health_metric ON database_health(metric_name);
CREATE INDEX IF NOT EXISTS idx_database_health_recorded ON database_health(recorded_at);
CREATE INDEX IF NOT EXISTS idx_backup_records_status ON backup_records(status);

-- Communication indexes
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE revenue_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_lifetime_value ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_2fa ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE database_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flow_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_variance ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE satisfaction_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_program ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Admin and CEO access for most tables)
-- This is a simplified version - you may want to refine these based on specific requirements

-- Analytics tables - Admin and CEO only
CREATE POLICY "Admin and CEO access to analytics" ON revenue_forecasts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'ceo')
        )
    );

CREATE POLICY "Admin and CEO access to risk assessments" ON risk_assessments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'ceo')
        )
    );

-- Compliance tables - Admin, CEO, and Accountant
CREATE POLICY "Admin, CEO, and Accountant access to compliance" ON compliance_requirements
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'ceo', 'accountant')
        )
    );

-- Security tables - Admin only
CREATE POLICY "Admin only access to security" ON user_sessions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admin only access to IP whitelist" ON ip_whitelist
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Communication tables - All authenticated users for announcements, Admin for templates
CREATE POLICY "All authenticated users can read announcements" ON announcements
    FOR SELECT USING (
        auth.role() = 'authenticated' 
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
    );

CREATE POLICY "Admin full access to announcements" ON announcements
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'ceo')
        )
    );

-- ============================================================================
-- 11. FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to relevant tables
CREATE TRIGGER update_revenue_forecasts_updated_at BEFORE UPDATE ON revenue_forecasts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_risk_assessments_updated_at BEFORE UPDATE ON risk_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_requirements_updated_at BEFORE UPDATE ON compliance_requirements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_regulatory_reports_updated_at BEFORE UPDATE ON regulatory_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
    event_type_param VARCHAR(50),
    user_id_param UUID,
    ip_address_param INET,
    user_agent_param TEXT,
    success_param BOOLEAN,
    details_param JSONB
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO security_events (
        event_type, 
        user_id, 
        ip_address, 
        user_agent, 
        success, 
        details
    ) VALUES (
        event_type_param,
        user_id_param,
        ip_address_param,
        user_agent_param,
        success_param,
        details_param
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 12. VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for active user sessions
CREATE OR REPLACE VIEW active_user_sessions AS
SELECT 
    us.*,
    p.full_name,
    p.email,
    p.role
FROM user_sessions us
JOIN profiles p ON us.user_id = p.id
WHERE us.is_active = true
AND us.expires_at > NOW();

-- View for pending compliance requirements
CREATE OR REPLACE VIEW pending_compliance AS
SELECT 
    cr.*,
    p.full_name as assigned_name
FROM compliance_requirements cr
LEFT JOIN profiles p ON cr.assigned_to = p.id
WHERE cr.status IN ('pending', 'in_progress')
AND (cr.due_date IS NULL OR cr.due_date >= CURRENT_DATE);

-- View for system health summary
CREATE OR REPLACE VIEW system_health_summary AS
SELECT 
    'database_connections' as metric,
    COUNT(*) as value,
    CASE 
        WHEN COUNT(*) < 50 THEN 'healthy'
        WHEN COUNT(*) < 80 THEN 'warning'
        ELSE 'critical'
    END as status
FROM pg_stat_activity 
WHERE state = 'active'

UNION ALL

SELECT 
    'disk_usage' as metric,
    (SELECT ROUND((pg_database_size(current_database()) / 1024.0 / 1024.0 / 1024.0), 2)) as value,
    CASE 
        WHEN (pg_database_size(current_database()) / 1024.0 / 1024.0 / 1024.0) < 5 THEN 'healthy'
        WHEN (pg_database_size(current_database()) / 1024.0 / 1024.0 / 1024.0) < 10 THEN 'warning'
        ELSE 'critical'
    END as status;

-- ============================================================================
-- 13. SAMPLE DATA (Optional - for development)
-- ============================================================================

-- Insert sample compliance requirements
INSERT INTO compliance_requirements (requirement_name, regulatory_body, description, frequency, due_date, assigned_to, created_by) VALUES
('Monthly Financial Report', 'Central Bank', 'Submit monthly financial statements and loan portfolio reports', 'monthly', CURRENT_DATE + INTERVAL '7 days', 
 (SELECT id FROM profiles WHERE role = 'accountant' LIMIT 1),
 (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1)),
('Anti-Money Laundering Check', 'Financial Intelligence Unit', 'Conduct AML checks on all new borrowers', 'weekly', CURRENT_DATE + INTERVAL '3 days',
 (SELECT id FROM profiles WHERE role = 'loan_officer' LIMIT 1),
 (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1)),
('Loan Portfolio Review', 'Banking Supervisor', 'Quarterly review of loan portfolio quality and risk assessment', 'quarterly', CURRENT_DATE + INTERVAL '30 days',
 (SELECT id FROM profiles WHERE role = 'ceo' LIMIT 1),
 (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1));

-- Insert sample communication templates
INSERT INTO communication_templates (template_name, template_type, subject, content, variables, created_by) VALUES
('Loan Approval Notification', 'sms', 'Loan Approved', 'Dear {borrower_name}, your loan application for {loan_amount} has been approved. Reference: {loan_reference}', ARRAY['borrower_name', 'loan_amount', 'loan_reference'],
 (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1)),
('Payment Reminder', 'email', 'Payment Reminder', 'This is a reminder that your loan payment of {payment_amount} is due on {due_date}. Please ensure timely payment.', ARRAY['payment_amount', 'due_date'],
 (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1)),
('Welcome Message', 'sms', 'Welcome to Janalo', 'Welcome {borrower_name}! Thank you for choosing Janalo for your financial needs. We are committed to serving you.', ARRAY['borrower_name'],
 (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1));

-- Insert sample announcements
INSERT INTO announcements (title, content, priority, target_roles, created_by) VALUES
('System Maintenance Scheduled', 'The system will undergo maintenance on Saturday from 2:00 AM to 4:00 AM. Please save your work and log out before this time.', 'high', ARRAY['admin', 'ceo', 'loan_officer', 'accountant', 'hr'],
 (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1)),
('New Compliance Requirements', 'Please review the updated compliance requirements in the Compliance section. Training sessions will be scheduled next week.', 'normal', ARRAY['admin', 'ceo', 'accountant'],
 (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1));

COMMIT;
