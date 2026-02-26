-- Drop all existing liquidity policies first, then recreate
-- Run this in Supabase SQL Editor

-- Drop policies on liquidity_config
DROP POLICY IF EXISTS "Executives can manage liquidity config" ON public.liquidity_config;
DROP POLICY IF EXISTS "All staff can view liquidity config" ON public.liquidity_config;

-- Drop policies on liquidity_alerts  
DROP POLICY IF EXISTS "Executives can view alerts" ON public.liquidity_alerts;
DROP POLICY IF EXISTS "System can create alerts" ON public.liquidity_alerts;
DROP POLICY IF EXISTS "Executives can acknowledge alerts" ON public.liquidity_alerts;

-- Recreate policies
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

-- Activate core functions
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

GRANT EXECUTE ON FUNCTION calculate_liquidity_position() TO authenticated;
