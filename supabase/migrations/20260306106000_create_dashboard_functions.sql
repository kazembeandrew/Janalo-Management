-- Dashboard RPC Functions
-- These functions are required by the dashboard component

-- Function to get dashboard statistics
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Calculate dashboard statistics
    SELECT jsonb_build_object(
        'total_portfolio', COALESCE(SUM(principal_amount), 0),
        'total_principal_outstanding', COALESCE(SUM(principal_outstanding), 0),
        'total_interest_outstanding', COALESCE(SUM(interest_outstanding), 0),
        'active_count', COUNT(*) FILTER (WHERE status = 'active'),
        'total_clients', COUNT(DISTINCT borrower_id),
        'par_count', COUNT(*) FILTER (WHERE status IN ('defaulted', 'reassess')),
        'interest_earned', 0, -- Placeholder, would need journal entries calculation
        'total_disbursed', COALESCE(SUM(principal_amount), 0),
        'recovery_rate', 0, -- Placeholder
        'completed_count', COUNT(*) FILTER (WHERE status = 'completed'),
        'reassess_count', COUNT(*) FILTER (WHERE status = 'reassess'),
        'total_liquidity', 0, -- Placeholder
        'interest_target', 0 -- Placeholder
    ) INTO result
    FROM loans;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get monthly revenue data
CREATE OR REPLACE FUNCTION get_monthly_revenue()
RETURNS TABLE(month TEXT, income DECIMAL) AS $$
BEGIN
    -- Return placeholder data - would need to aggregate from journal entries
    RETURN QUERY
    SELECT
        to_char(date_trunc('month', CURRENT_DATE - interval '1 month' * n), 'YYYY-MM') as month,
        (random() * 100000 + 50000)::DECIMAL(10,2) as income
    FROM generate_series(0, 11) n;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get officer performance data
CREATE OR REPLACE FUNCTION get_officer_performance()
RETURNS TABLE(officer_id TEXT, officer_name TEXT, active_count BIGINT, portfolio_value DECIMAL, at_risk_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id::TEXT as officer_id,
        COALESCE(u.full_name, 'Unknown Officer')::TEXT as officer_name,
        COUNT(l.id) FILTER (WHERE l.status = 'active')::BIGINT as active_count,
        COALESCE(SUM(l.principal_amount), 0)::DECIMAL(15,2) as portfolio_value,
        COUNT(l.id) FILTER (WHERE l.status IN ('defaulted', 'reassess'))::BIGINT as at_risk_count
    FROM users u
    LEFT JOIN loans l ON l.officer_id = u.id
    WHERE u.role = 'loan_officer'
    GROUP BY u.id, u.full_name
    ORDER BY portfolio_value DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
