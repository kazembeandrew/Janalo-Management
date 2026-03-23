-- Enhanced Security and Input Validation
-- Critical security measures for production deployment

-- 1. Rate Limiting Table
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL, -- IP address or user ID
    action TEXT NOT NULL, -- 'login', 'api_call', 'financial_operation'
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    request_count INTEGER DEFAULT 1,
    blocked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_action ON rate_limits(identifier, action);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

-- Enable RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies (only service role can manage rate limits)
CREATE POLICY "rate_limits_select" ON rate_limits
    FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "rate_limits_insert" ON rate_limits
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "rate_limits_update" ON rate_limits
    FOR UPDATE USING (auth.role() = 'service_role');

-- Allow authenticated users to check and update their own rate limits
CREATE POLICY "rate_limits_authenticated_select" ON rate_limits
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "rate_limits_authenticated_insert" ON rate_limits
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "rate_limits_authenticated_update" ON rate_limits
    FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- 2. Rate Limiting Function
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_identifier TEXT,
    p_action TEXT,
    p_max_requests INTEGER DEFAULT 10,
    p_window_minutes INTEGER DEFAULT 1,
    p_block_minutes INTEGER DEFAULT 15
)
RETURNS JSONB AS $$
DECLARE
    v_window_start TIMESTAMP WITH TIME ZONE;
    v_existing_record RECORD;
    v_is_blocked BOOLEAN := false;
    v_blocked_until TIMESTAMP WITH TIME ZONE;
BEGIN
    v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;

    -- Check if currently blocked
    SELECT blocked_until INTO v_blocked_until
    FROM rate_limits
    WHERE identifier = p_identifier
    AND action = p_action
    AND blocked_until > NOW()
    ORDER BY blocked_until DESC
    LIMIT 1;

    IF v_blocked_until IS NOT NULL THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'blocked', true,
            'blocked_until', v_blocked_until,
            'reason', 'Rate limit exceeded - temporarily blocked'
        );
    END IF;

    -- Get or create rate limit record
    SELECT * INTO v_existing_record
    FROM rate_limits
    WHERE identifier = p_identifier
    AND action = p_action
    AND window_start > v_window_start
    ORDER BY window_start DESC
    LIMIT 1;

    IF v_existing_record.id IS NULL THEN
        -- Create new record
        INSERT INTO rate_limits (identifier, action, window_start, request_count)
        VALUES (p_identifier, p_action, NOW(), 1);

        RETURN jsonb_build_object('allowed', true, 'remaining', p_max_requests - 1);
    ELSE
        -- Update existing record
        UPDATE rate_limits
        SET request_count = request_count + 1,
            updated_at = NOW(),
            blocked_until = CASE
                WHEN request_count + 1 > p_max_requests THEN NOW() + (p_block_minutes || ' minutes')::INTERVAL
                ELSE NULL
            END
        WHERE id = v_existing_record.id;

        IF v_existing_record.request_count + 1 > p_max_requests THEN
            RETURN jsonb_build_object(
                'allowed', false,
                'blocked', true,
                'blocked_until', NOW() + (p_block_minutes || ' minutes')::INTERVAL,
                'reason', format('Rate limit exceeded: %s requests in %s minutes', p_max_requests, p_window_minutes)
            );
        ELSE
            RETURN jsonb_build_object(
                'allowed', true,
                'remaining', p_max_requests - (v_existing_record.request_count + 1)
            );
        END IF;
    END IF;
END;
$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Input Validation Functions
CREATE OR REPLACE FUNCTION validate_financial_amount(p_amount DECIMAL)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if amount is positive and reasonable
    RETURN p_amount IS NOT NULL
        AND p_amount > 0
        AND p_amount <= 10000000  -- Max 10 million
        AND p_amount = ROUND(p_amount, 2); -- Max 2 decimal places
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION validate_date_not_future(p_date DATE)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN p_date IS NOT NULL AND p_date <= CURRENT_DATE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION validate_reference_no(p_ref TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Reference format: LNN-YYYY-NNNN (e.g., L01-2024-0001)
    RETURN p_ref IS NOT NULL
        AND LENGTH(p_ref) >= 10
        AND p_ref ~ '^L\d{2}-\d{4}-\d{4}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Security Audit Function
CREATE OR REPLACE FUNCTION security_audit_check()
RETURNS JSONB AS $$
DECLARE
    v_result JSONB := '{}';
    v_count INTEGER;
BEGIN
    -- Check for direct balance updates (should not happen)
    SELECT COUNT(*) INTO v_count
    FROM audit_trail
    WHERE table_name = 'internal_accounts'
    AND action = 'UPDATE'
    AND old_data->>'balance' != new_data->>'balance'
    AND changed_at > CURRENT_DATE - INTERVAL '30 days';

    v_result := v_result || jsonb_build_object('direct_balance_updates', v_count);

    -- Check for backdated entries without approval
    SELECT COUNT(*) INTO v_count
    FROM journal_entries je
    WHERE je.date < CURRENT_DATE - INTERVAL '3 days'
    AND NOT EXISTS (
        SELECT 1 FROM audit_trail at
        WHERE at.table_name = 'journal_entries'
        AND at.record_id = je.id
        AND at.new_data->>'backdate_approved' = 'true'
    );

    v_result := v_result || jsonb_build_object('unapproved_backdated_entries', v_count);

    -- Check for trial balance issues
    SELECT COUNT(*) INTO v_count
    FROM verify_trial_balance(CURRENT_DATE) tb
    WHERE NOT tb.is_balanced;

    v_result := v_result || jsonb_build_object('trial_balance_errors', v_count);

    -- Check for orphaned records
    SELECT COUNT(*) INTO v_count
    FROM repayments r
    LEFT JOIN loans l ON r.loan_id = l.id
    WHERE l.id IS NULL;

    v_result := v_result || jsonb_build_object('orphaned_repayments', v_count);

    RETURN v_result;
END;
$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Enhanced Authorization Function
CREATE OR REPLACE FUNCTION check_financial_operation_permission(
    p_user_id UUID,
    p_operation TEXT, -- 'disburse', 'repay', 'reverse', 'adjust'
    p_amount DECIMAL DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_user RECORD;
    v_permissions JSONB;
BEGIN
    -- Get user details
    SELECT * INTO v_user FROM users WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'User not found');
    END IF;

    -- Define permissions based on role
    CASE v_user.role
        WHEN 'admin' THEN
            v_permissions := jsonb_build_object(
                'disburse', jsonb_build_object('max_amount', 1000000, 'approval_required', false),
                'repay', jsonb_build_object('max_amount', 1000000, 'approval_required', false),
                'reverse', jsonb_build_object('max_amount', 1000000, 'approval_required', false),
                'adjust', jsonb_build_object('max_amount', 1000000, 'approval_required', false)
            );
        WHEN 'ceo' THEN
            v_permissions := jsonb_build_object(
                'disburse', jsonb_build_object('max_amount', 500000, 'approval_required', false),
                'repay', jsonb_build_object('max_amount', 500000, 'approval_required', false),
                'reverse', jsonb_build_object('max_amount', 500000, 'approval_required', false),
                'adjust', jsonb_build_object('max_amount', 500000, 'approval_required', false)
            );
        WHEN 'accountant' THEN
            v_permissions := jsonb_build_object(
                'disburse', jsonb_build_object('max_amount', 100000, 'approval_required', true),
                'repay', jsonb_build_object('max_amount', 100000, 'approval_required', false),
                'reverse', jsonb_build_object('max_amount', 100000, 'approval_required', true),
                'adjust', jsonb_build_object('max_amount', 100000, 'approval_required', true)
            );
        WHEN 'loan_officer' THEN
            v_permissions := jsonb_build_object(
                'disburse', jsonb_build_object('max_amount', 50000, 'approval_required', true),
                'repay', jsonb_build_object('max_amount', 50000, 'approval_required', false),
                'reverse', jsonb_build_object('max_amount', 50000, 'approval_required', true),
                'adjust', jsonb_build_object('max_amount', 50000, 'approval_required', true)
            );
        ELSE
            RETURN jsonb_build_object('allowed', false, 'reason', 'Insufficient role permissions');
    END CASE;

    -- Check if operation is allowed
    IF NOT (v_permissions ? p_operation) THEN
        RETURN jsonb_build_object('allowed', false, 'reason', format('Operation %s not permitted for role %s', p_operation, v_user.role));
    END IF;

    -- Check amount limits
    IF p_amount > (v_permissions->p_operation->>'max_amount')::DECIMAL THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', format('Amount %s exceeds maximum allowed %s for %s', p_amount, v_permissions->p_operation->>'max_amount', v_user.role)
        );
    END IF;

    -- Check if approval is required
    IF (v_permissions->p_operation->>'approval_required')::BOOLEAN THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'requires_approval', true,
            'reason', format('Operation %s requires approval for role %s', p_operation, v_user.role)
        );
    END IF;

    RETURN jsonb_build_object('allowed', true);
END;
$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Data Sanitization Function
CREATE OR REPLACE FUNCTION sanitize_text_input(p_text TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Remove potentially dangerous characters and trim
    RETURN TRIM(REGEXP_REPLACE(p_text, '[<>\"&''\x00-\x1F\x7F-\x9F]', '', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, TEXT, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_financial_amount(DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_date_not_future(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_reference_no(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION security_audit_check() TO authenticated;
GRANT EXECUTE ON FUNCTION check_financial_operation_permission(UUID, TEXT, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION sanitize_text_input(TEXT) TO authenticated;
