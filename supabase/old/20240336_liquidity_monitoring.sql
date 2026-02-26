-- Liquidity Threshold Monitoring and Alerts
-- Ensures institution maintains minimum liquidity ratios

-- 1. Create liquidity monitoring configuration table
CREATE TABLE IF NOT EXISTS public.liquidity_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    min_liquidity_ratio DECIMAL(5,2) NOT NULL DEFAULT 0.05,  -- 5% minimum
    critical_liquidity_ratio DECIMAL(5,2) NOT NULL DEFAULT 0.03,  -- 3% critical
    warning_liquidity_ratio DECIMAL(5,2) NOT NULL DEFAULT 0.08,  -- 8% warning
    max_disbursement_without_approval DECIMAL(15,2) NOT NULL DEFAULT 1000000,  -- 1M default
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
    alert_type TEXT NOT NULL,  -- warning, critical, recovery
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

-- 4. RLS Policies
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

-- 5. Function to calculate current liquidity position
CREATE OR REPLACE FUNCTION calculate_liquidity_position()
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
    -- Get available liquidity (cash, bank, mobile money)
    SELECT COALESCE(SUM(balance), 0) INTO v_cash_accounts
    FROM internal_accounts WHERE account_code = 'CASH' AND is_active != false;
    
    SELECT COALESCE(SUM(balance), 0) INTO v_bank_accounts
    FROM internal_accounts WHERE account_code = 'BANK' AND is_active != false;
    
    SELECT COALESCE(SUM(balance), 0) INTO v_mobile_accounts
    FROM internal_accounts WHERE account_code = 'MOBILE' AND is_active != false;
    
    v_total_liquidity := v_cash_accounts + v_bank_accounts + v_mobile_accounts;
    
    -- Get total loan portfolio (outstanding principal)
    SELECT COALESCE(SUM(principal_outstanding), 0) INTO v_total_portfolio
    FROM loans WHERE status IN ('active', 'pending');
    
    -- Get total liabilities
    SELECT COALESCE(SUM(balance), 0) INTO v_total_liabilities
    FROM internal_accounts WHERE account_category = 'liability' AND is_active != false;
    
    -- Calculate liquidity ratio (liquidity / portfolio)
    IF v_total_portfolio > 0 THEN
        v_liquidity_ratio := v_total_liquidity / v_total_portfolio;
    ELSE
        v_liquidity_ratio := 1.0;  -- If no loans, 100% liquid
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
        'config', to_jsonb(v_config),
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

-- 6. Function to check liquidity before disbursement
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
    -- Get current position
    v_position := calculate_liquidity_position();
    
    -- Get config
    SELECT * INTO v_config FROM liquidity_config ORDER BY created_at DESC LIMIT 1;
    
    -- Check if below critical threshold
    IF (v_position->>'status')::TEXT = 'CRITICAL' THEN
        v_can_disburse := false;
        v_reason := format('Cannot disburse: Critical liquidity level (%s%%). Minimum required: %s%%',
                          (v_position->>'liquidity_percentage')::TEXT,
                          COALESCE(v_config.critical_liquidity_ratio * 100, 3));
    
    -- Check if below minimum threshold
    ELSIF (v_position->>'status')::TEXT = 'BELOW_MINIMUM' THEN
        -- Check if amount exceeds limit
        IF p_amount > COALESCE(v_config.max_disbursement_without_approval, 1000000) THEN
            v_can_disburse := false;
            v_reason := format('Cannot disburse MK %s without approval: Below minimum liquidity (%s%%)',
                              p_amount,
                              (v_position->>'liquidity_percentage')::TEXT);
        ELSE
            -- Allow small disbursements but flag
            v_can_disburse := true;
            v_reason := format('WARNING: Liquidity below minimum (%s%%)', (v_position->>'liquidity_percentage')::TEXT);
        END IF;
    
    -- Check if amount exceeds available liquidity
    ELSIF p_amount > (v_position->>'total_liquidity')::DECIMAL THEN
        v_can_disburse := false;
        v_reason := format('Cannot disburse MK %s: Insufficient funds. Available: MK %s',
                          p_amount,
                          (v_position->>'total_liquidity')::DECIMAL);
    END IF;
    
    -- Create alert if below warning threshold
    IF (v_position->>'status')::TEXT IN ('WARNING', 'BELOW_MINIMUM', 'CRITICAL') THEN
        INSERT INTO liquidity_alerts (
            alert_type,
            current_ratio,
            required_ratio,
            available_funds,
            total_portfolio,
            shortfall_amount,
            triggered_by
        )
        SELECT
            CASE 
                WHEN (v_position->>'status')::TEXT = 'CRITICAL' THEN 'critical'
                WHEN (v_position->>'status')::TEXT = 'BELOW_MINIMUM' THEN 'warning'
                ELSE 'warning'
            END,
            (v_position->>'liquidity_ratio')::DECIMAL,
            COALESCE(min_liquidity_ratio, 0.05),
            (v_position->>'total_liquidity')::DECIMAL,
            (v_position->>'total_portfolio')::DECIMAL,
            (v_position->>'shortfall')::DECIMAL,
            p_user_id
        FROM liquidity_config
        ORDER BY created_at DESC
        LIMIT 1
        ON CONFLICT DO NOTHING;
    END IF;
    
    RETURN jsonb_build_object(
        'can_disburse', v_can_disburse,
        'reason', v_reason,
        'position', v_position,
        'requires_approval', (v_position->>'status')::TEXT IN ('BELOW_MINIMUM', 'CRITICAL') 
            AND p_amount > COALESCE(v_config.max_disbursement_without_approval, 1000000)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to create liquidity alert
CREATE OR REPLACE FUNCTION create_liquidity_alert(
    p_user_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_position JSONB;
    v_alert_id UUID;
BEGIN
    v_position := calculate_liquidity_position();
    
    IF (v_position->>'status')::TEXT = 'HEALTHY' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Liquidity is healthy, no alert needed');
    END IF;
    
    INSERT INTO liquidity_alerts (
        alert_type,
        current_ratio,
        required_ratio,
        available_funds,
        total_portfolio,
        shortfall_amount,
        triggered_by,
        notes
    )
    SELECT
        CASE 
            WHEN (v_position->>'status')::TEXT = 'CRITICAL' THEN 'critical'
            WHEN (v_position->>'status')::TEXT = 'BELOW_MINIMUM' THEN 'warning'
            ELSE 'warning'
        END,
        (v_position->>'liquidity_ratio')::DECIMAL,
        COALESCE(min_liquidity_ratio, 0.05),
        (v_position->>'total_liquidity')::DECIMAL,
        (v_position->>'total_portfolio')::DECIMAL,
        (v_position->>'shortfall')::DECIMAL,
        p_user_id,
        p_notes
    FROM liquidity_config
    ORDER BY created_at DESC
    LIMIT 1
    RETURNING id INTO v_alert_id;
    
    -- Notify executives
    INSERT INTO notifications (user_id, title, message, type, link)
    SELECT 
        id,
        CASE 
            WHEN (v_position->>'status')::TEXT = 'CRITICAL' THEN 'CRITICAL: Liquidity Alert'
            ELSE 'WARNING: Low Liquidity'
        END,
        format('Current liquidity: %s%%. Minimum required: %s%%. Shortfall: MK %s',
               (v_position->>'liquidity_percentage')::TEXT,
               COALESCE((SELECT min_liquidity_ratio * 100 FROM liquidity_config ORDER BY created_at DESC LIMIT 1), 5),
               (v_position->>'shortfall')::DECIMAL
        ),
        CASE WHEN (v_position->>'status')::TEXT = 'CRITICAL' THEN 'error' ELSE 'warning' END,
        '/accounts'
    FROM users 
    WHERE role IN ('admin', 'ceo', 'accountant');
    
    RETURN jsonb_build_object(
        'success', true,
        'alert_id', v_alert_id,
        'status', (v_position->>'status')::TEXT
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function to get liquidity dashboard data
CREATE OR REPLACE FUNCTION get_liquidity_dashboard()
RETURNS JSONB AS $$
DECLARE
    v_position JSONB;
    v_recent_alerts JSONB;
    v_daily_history JSONB;
BEGIN
    v_position := calculate_liquidity_position();
    
    -- Recent alerts
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'type', alert_type,
            'ratio', current_ratio,
            'triggered_at', triggered_at,
            'acknowledged', acknowledged_by IS NOT NULL
        ) ORDER BY triggered_at DESC
    )
    INTO v_recent_alerts
    FROM liquidity_alerts
    WHERE triggered_at > NOW() - INTERVAL '30 days'
    LIMIT 10;
    
    RETURN jsonb_build_object(
        'current_position', v_position,
        'recent_alerts', COALESCE(v_recent_alerts, '[]'::jsonb),
        'last_updated', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Initialize default liquidity config if not exists
INSERT INTO liquidity_config (
    min_liquidity_ratio,
    critical_liquidity_ratio,
    warning_liquidity_ratio,
    max_disbursement_without_approval,
    auto_stop_disbursements
)
SELECT 
    0.05,  -- 5% minimum
    0.03,  -- 3% critical
    0.08,  -- 8% warning
    1000000,  -- 1M
    false
WHERE NOT EXISTS (SELECT 1 FROM liquidity_config);

-- 10. Create indexes
CREATE INDEX IF NOT EXISTS idx_liquidity_alerts_status ON public.liquidity_alerts(alert_type, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_liquidity_alerts_acknowledged ON public.liquidity_alerts(acknowledged_by) WHERE acknowledged_by IS NULL;

-- Grant permissions
GRANT EXECUTE ON FUNCTION calculate_liquidity_position() TO authenticated;
GRANT EXECUTE ON FUNCTION check_disbursement_liquidity(DECIMAL, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_liquidity_alert(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_liquidity_dashboard() TO authenticated;
