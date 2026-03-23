-- Scheduled Job Setup for PAR and Trial Balance Verification
-- These functions should be called daily by a cron job or scheduled task

-- Daily PAR and Provisioning Job
CREATE OR REPLACE FUNCTION daily_par_provisioning_job()
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_trial_balance JSONB;
BEGIN
    -- Run PAR and provisioning calculation
    SELECT calculate_par_and_provision() INTO v_result;

    -- Run trial balance verification
    SELECT jsonb_build_object(
        'is_balanced', tb.is_balanced,
        'total_debits', tb.total_debits,
        'total_credits', tb.total_credits,
        'difference', tb.difference,
        'unbalanced_entries', tb.unbalanced_entries
    ) INTO v_trial_balance
    FROM verify_trial_balance(CURRENT_DATE) tb;

    -- Log results
    INSERT INTO system_logs (level, message, details, created_by)
    VALUES (
        CASE WHEN (v_trial_balance->>'is_balanced')::BOOLEAN THEN 'info' ELSE 'warning' END,
        'Daily PAR/Provisioning and Trial Balance Check Completed',
        jsonb_build_object(
            'par_results', v_result,
            'trial_balance', v_trial_balance,
            'date', CURRENT_DATE
        ),
        (SELECT id FROM users WHERE role = 'admin' LIMIT 1)
    );

    -- Alert if trial balance is not balanced
    IF NOT (v_trial_balance->>'is_balanced')::BOOLEAN THEN
        -- In a real system, this would send an email/SMS alert
        INSERT INTO notifications (
            user_id,
            title,
            message,
            type,
            priority
        )
        SELECT
            u.id,
            'Trial Balance Error',
            format('Trial balance is unbalanced on %s. Debits: %s, Credits: %s, Difference: %s',
                   CURRENT_DATE,
                   v_trial_balance->>'total_debits',
                   v_trial_balance->>'total_credits',
                   v_trial_balance->>'difference'),
            'system',
            'critical'
        FROM users u
        WHERE u.role IN ('admin', 'ceo', 'accountant');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'par_results', v_result,
        'trial_balance', v_trial_balance,
        'date', CURRENT_DATE
    );
END;
$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant permissions
GRANT EXECUTE ON FUNCTION daily_par_provisioning_job() TO authenticated;
GRANT EXECUTE ON FUNCTION daily_par_provisioning_job() TO service_role;

-- Monthly Financial Statement Generation
CREATE OR REPLACE FUNCTION generate_monthly_financial_statements(p_month DATE DEFAULT CURRENT_DATE)
RETURNS JSONB AS $$
DECLARE
    v_month_start DATE := date_trunc('month', p_month);
    v_month_end DATE := v_month_start + INTERVAL '1 month' - INTERVAL '1 day';
    v_income DECIMAL(15,2);
    v_expenses DECIMAL(15,2);
    v_assets DECIMAL(15,2);
    v_liabilities DECIMAL(15,2);
    v_equity DECIMAL(15,2);
BEGIN
    -- Calculate income for the month
    SELECT COALESCE(SUM(jl.credit - jl.debit), 0) INTO v_income
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    JOIN internal_accounts ia ON jl.account_id = ia.id
    WHERE ia.account_category = 'income'
    AND je.date BETWEEN v_month_start AND v_month_end;

    -- Calculate expenses for the month
    SELECT COALESCE(SUM(jl.debit - jl.credit), 0) INTO v_expenses
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    JOIN internal_accounts ia ON jl.account_id = ia.id
    WHERE ia.account_category = 'expense'
    AND je.date BETWEEN v_month_start AND v_month_end;

    -- Calculate current asset balances
    SELECT COALESCE(SUM(balance), 0) INTO v_assets
    FROM internal_accounts
    WHERE account_category = 'asset';

    -- Calculate current liability balances
    SELECT COALESCE(SUM(balance), 0) INTO v_liabilities
    FROM internal_accounts
    WHERE account_category = 'liability';

    -- Calculate equity (assets - liabilities)
    v_equity := v_assets - v_liabilities;

    -- Store monthly financial statement
    INSERT INTO monthly_financial_statements (
        month,
        total_income,
        total_expenses,
        net_income,
        total_assets,
        total_liabilities,
        total_equity,
        generated_at
    ) VALUES (
        v_month_start,
        v_income,
        v_expenses,
        v_income - v_expenses,
        v_assets,
        v_liabilities,
        v_equity,
        NOW()
    )
    ON CONFLICT (month) DO UPDATE SET
        total_income = EXCLUDED.total_income,
        total_expenses = EXCLUDED.total_expenses,
        net_income = EXCLUDED.net_income,
        total_assets = EXCLUDED.total_assets,
        total_liabilities = EXCLUDED.total_liabilities,
        total_equity = EXCLUDED.total_equity,
        generated_at = EXCLUDED.generated_at;

    RETURN jsonb_build_object(
        'month', v_month_start,
        'income', v_income,
        'expenses', v_expenses,
        'net_income', v_income - v_expenses,
        'assets', v_assets,
        'liabilities', v_liabilities,
        'equity', v_equity
    );
END;
$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create monthly financial statements table
CREATE TABLE IF NOT EXISTS monthly_financial_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month DATE NOT NULL UNIQUE,
    total_income DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_expenses DECIMAL(15,2) NOT NULL DEFAULT 0,
    net_income DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_assets DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_liabilities DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_equity DECIMAL(15,2) NOT NULL DEFAULT 0,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE monthly_financial_statements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "monthly_financial_statements_select" ON monthly_financial_statements
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'ceo', 'accountant')
        )
    );

-- Grant permissions
GRANT EXECUTE ON FUNCTION generate_monthly_financial_statements(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_monthly_financial_statements(DATE) TO service_role;
