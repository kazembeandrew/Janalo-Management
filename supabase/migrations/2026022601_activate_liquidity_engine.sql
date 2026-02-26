-- Activate Liquidity Engine (idempotent version)
-- Drops and recreates objects to avoid "already exists" errors

-- 1. Create liquidity monitoring configuration table
CREATE TABLE IF NOT EXISTS public.liquidity_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- 2. Create liquidity alerts table
CREATE TABLE IF NOT EXISTS public.liquidity_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type TEXT NOT NULL,
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

-- 3. Enable RLS
ALTER TABLE public.liquidity_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidity_alerts ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies (drop if exists first)
DROP POLICY IF EXISTS "Executives can manage liquidity config" ON public.liquidity_config;
CREATE POLICY "Executives can manage liquidity config" ON public.liquidity_config
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

DROP POLICY IF EXISTS "All staff can view liquidity config" ON public.liquidity_config;
CREATE POLICY "All staff can view liquidity config" ON public.liquidity_config
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Executives can view alerts" ON public.liquidity_alerts;
CREATE POLICY "Executives can view alerts" ON public.liquidity_alerts
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

DROP POLICY IF EXISTS "System can create alerts" ON public.liquidity_alerts;
CREATE POLICY "System can create alerts" ON public.liquidity_alerts
FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Executives can acknowledge alerts" ON public.liquidity_alerts;
CREATE POLICY "Executives can acknowledge alerts" ON public.liquidity_alerts
FOR UPDATE TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

-- 5. Initialize default liquidity config
INSERT INTO liquidity_config (
    min_liquidity_ratio, critical_liquidity_ratio, warning_liquidity_ratio,
    max_disbursement_without_approval, auto_stop_disbursements
)
SELECT 0.05, 0.03, 0.08, 1000000, false
WHERE NOT EXISTS (SELECT 1 FROM liquidity_config);

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS idx_liquidity_alerts_status ON public.liquidity_alerts(alert_type, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_liquidity_alerts_acknowledged ON public.liquidity_alerts(acknowledged_by) WHERE acknowledged_by IS NULL;

-- 7. Create core liquidity function
CREATE OR REPLACE FUNCTION calculate_liquidity_position()
RETURNS JSONB AS $$
DECLARE
    v_cash_accounts DECIMAL(15,2);
    v_bank_accounts DECIMAL(15,2);
    v_mobile_accounts DECIMAL(15,2);
    v_total_liquidity DECIMAL(15,2);
    v_total_portfolio DECIMAL(15,2);
    v_liquidity_ratio DECIMAL(5,2);
    v_config RECORD;
BEGIN
    SELECT COALESCE(SUM(balance), 0) INTO v_cash_accounts
    FROM internal_accounts WHERE account_code = 'CASH' AND is_active != false;
    
    SELECT COALESCE(SUM(balance), 0) INTO v_bank_accounts
    FROM internal_accounts WHERE account_code = 'BANK' AND is_active != false;
    
    SELECT COALESCE(SUM(balance), 0) INTO v_mobile_accounts
    FROM internal_accounts WHERE account_code = 'MOBILE' AND is_active != false;
    
    v_total_liquidity := v_cash_accounts + v_bank_accounts + v_mobile_accounts;
    
    SELECT COALESCE(SUM(principal_outstanding), 0) INTO v_total_portfolio
    FROM loans WHERE status IN ('active', 'pending');
    
    IF v_total_portfolio > 0 THEN
        v_liquidity_ratio := v_total_liquidity / v_total_portfolio;
    ELSE
        v_liquidity_ratio := 1.0;
    END IF;
    
    SELECT * INTO v_config FROM liquidity_config ORDER BY created_at DESC LIMIT 1;
    
    RETURN jsonb_build_object(
        'total_liquidity', v_total_liquidity,
        'cash_accounts', v_cash_accounts,
        'bank_accounts', v_bank_accounts,
        'mobile_accounts', v_mobile_accounts,
        'total_portfolio', v_total_portfolio,
        'liquidity_ratio', v_liquidity_ratio,
        'liquidity_percentage', ROUND(v_liquidity_ratio * 100, 2),
        'status', CASE
            WHEN v_liquidity_ratio < COALESCE(v_config.critical_liquidity_ratio, 0.03) THEN 'CRITICAL'
            WHEN v_liquidity_ratio < COALESCE(v_config.min_liquidity_ratio, 0.05) THEN 'BELOW_MINIMUM'
            WHEN v_liquidity_ratio < COALESCE(v_config.warning_liquidity_ratio, 0.08) THEN 'WARNING'
            ELSE 'HEALTHY'
        END,
        'shortfall', CASE
            WHEN v_liquidity_ratio < COALESCE(v_config.min_liquidity_ratio, 0.05)
            THEN GREATEST(0, (COALESCE(v_config.min_liquidity_ratio, 0.05) * v_total_portfolio) - v_total_liquidity)
            ELSE 0
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create disbursement check function
CREATE OR REPLACE FUNCTION check_disbursement_liquidity(
    p_amount DECIMAL(15,2),
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_position JSONB;
    v_config RECORD;
    v_can_disburse BOOLEAN := true;
    v_reason TEXT := '';
BEGIN
    v_position := calculate_liquidity_position();
    SELECT * INTO v_config FROM liquidity_config ORDER BY created_at DESC LIMIT 1;
    
    IF (v_position->>'status')::TEXT = 'CRITICAL' THEN
        v_can_disburse := false;
        v_reason := format('Cannot disburse: Critical liquidity level (%s%%)',
                          (v_position->>'liquidity_percentage')::TEXT);
    ELSIF (v_position->>'status')::TEXT = 'BELOW_MINIMUM' THEN
        IF p_amount > COALESCE(v_config.max_disbursement_without_approval, 1000000) THEN
            v_can_disburse := false;
            v_reason := format('Cannot disburse MK %s: Below minimum liquidity', p_amount);
        END IF;
    ELSIF p_amount > (v_position->>'total_liquidity')::DECIMAL THEN
        v_can_disburse := false;
        v_reason := format('Cannot disburse MK %s: Insufficient funds', p_amount);
    END IF;
    
    RETURN jsonb_build_object(
        'can_disburse', v_can_disburse,
        'reason', v_reason,
        'position', v_position
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION calculate_liquidity_position() TO authenticated;
GRANT EXECUTE ON FUNCTION check_disbursement_liquidity(DECIMAL, UUID) TO authenticated;
