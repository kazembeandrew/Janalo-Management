-- SAFER BALANCE RECALCULATION - Only run ONCE and backup first
-- Execute this in Supabase SQL Editor

-- ============================================================================
-- BACKUP CURRENT BALANCES FIRST
-- ============================================================================

CREATE TABLE IF NOT EXISTS balance_backup_$(date +%Y%m%d_%H%M%S) AS
SELECT
    id,
    account_code,
    name,
    account_category,
    balance as balance_before_recalc,
    updated_at as updated_before_recalc,
    NOW() as backup_timestamp
FROM public.internal_accounts;

-- ============================================================================
-- FIXED RECALCULATION FUNCTION (with better error handling)
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_all_account_balances_safely()
RETURNS TABLE(account_code TEXT, old_balance DECIMAL, new_balance DECIMAL, difference DECIMAL) AS $$
DECLARE
    v_account RECORD;
    v_balance DECIMAL(15,2);
    v_old_balance DECIMAL(15,2);
BEGIN
    -- Create temporary table to track changes
    CREATE TEMP TABLE balance_changes (
        account_code TEXT,
        old_balance DECIMAL(15,2),
        new_balance DECIMAL(15,2),
        difference DECIMAL(15,2)
    );

    -- Process each account
    FOR v_account IN SELECT id, account_code, account_category, balance FROM public.internal_accounts ORDER BY account_code LOOP
        -- Store old balance
        v_old_balance := v_account.balance;

        -- Calculate correct balance from journal history
        SELECT
            CASE
                WHEN v_account.account_category IN ('asset', 'expense') THEN
                    COALESCE(SUM(debit - credit), 0)
                WHEN v_account.account_category IN ('liability', 'equity', 'income') THEN
                    COALESCE(SUM(credit - debit), 0)
                ELSE 0
            END INTO v_balance
        FROM public.journal_lines
        WHERE account_id = v_account.id;

        -- Update account with correct balance
        UPDATE public.internal_accounts
        SET balance = v_balance, updated_at = NOW()
        WHERE id = v_account.id;

        -- Track the change
        INSERT INTO balance_changes VALUES (v_account.account_code, v_old_balance, v_balance, v_balance - v_old_balance);
    END LOOP;

    -- Return the changes for verification
    RETURN QUERY SELECT * FROM balance_changes ORDER BY account_code;

    -- Clean up temp table
    DROP TABLE balance_changes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RUN THE SAFE RECALCULATION
-- ============================================================================

SELECT * FROM recalculate_all_account_balances_safely();

-- ============================================================================
-- VERIFY RESULTS
-- ============================================================================

-- Check key account balances after recalculation
SELECT
    ia.account_code,
    ia.name,
    ia.account_category,
    ia.balance,
    ia.updated_at
FROM public.internal_accounts ia
WHERE ia.account_code IN ('PORTFOLIO', 'CASH', 'BANK', 'EQUITY', 'CAPITAL', 'SHARED_CAPITAL')
ORDER BY ia.account_code;

-- Check liquidity calculation
SELECT
    'AFTER_RECALC' as status,
    COALESCE(SUM(CASE WHEN account_code = 'CASH' THEN balance ELSE 0 END), 0) as cash_balance,
    COALESCE(SUM(CASE WHEN account_code = 'BANK' THEN balance ELSE 0 END), 0) as bank_balance,
    COALESCE(SUM(CASE WHEN account_code IN ('CASH', 'BANK', 'MOBILE') THEN balance ELSE 0 END), 0) as total_liquidity
FROM public.internal_accounts
WHERE account_code IN ('CASH', 'BANK', 'MOBILE');

-- ============================================================================
-- CLEANUP
-- ============================================================================

DROP FUNCTION IF EXISTS recalculate_all_account_balances_safely();
