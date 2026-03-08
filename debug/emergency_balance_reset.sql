-- EMERGENCY BALANCE RESET - Use this if balances are corrupted
-- Execute this in Supabase SQL Editor

-- ============================================================================
-- CRITICAL: RESET ALL BALANCES TO ZERO FIRST
-- ============================================================================

-- Create backup before reset
CREATE TABLE IF NOT EXISTS emergency_balance_backup AS
SELECT
    id,
    account_code,
    name,
    account_category,
    balance as balance_before_reset,
    updated_at as updated_before_reset,
    NOW() as reset_timestamp
FROM public.internal_accounts;

-- Reset ALL balances to zero
UPDATE public.internal_accounts
SET balance = 0, updated_at = NOW();

-- ============================================================================
-- RECALCULATE FROM CLEAN SLATE
-- ============================================================================

-- Recalculate each account balance from journal history
UPDATE public.internal_accounts
SET balance = COALESCE((
    SELECT
        CASE
            WHEN account_category IN ('asset', 'expense') THEN SUM(debit - credit)
            WHEN account_category IN ('liability', 'equity', 'income') THEN SUM(credit - debit)
            ELSE 0
        END
    FROM public.journal_lines jl
    WHERE jl.account_id = internal_accounts.id
), 0),
updated_at = NOW();

-- ============================================================================
-- VERIFY THE RESET WORKED
-- ============================================================================

-- Check key account balances after emergency reset
SELECT
    'AFTER_EMERGENCY_RESET' as status,
    ia.account_code,
    ia.name,
    ia.account_category,
    ia.balance,
    ia.updated_at
FROM public.internal_accounts ia
WHERE ia.account_code IN ('PORTFOLIO', 'CASH', 'BANK', 'EQUITY', 'CAPITAL', 'SHARED_CAPITAL')
ORDER BY ia.account_code;

-- Check liquidity after reset
SELECT
    'EMERGENCY_RESET_LIQUIDITY' as type,
    COALESCE(SUM(CASE WHEN account_code = 'CASH' THEN balance ELSE 0 END), 0) as cash_balance,
    COALESCE(SUM(CASE WHEN account_code = 'BANK' THEN balance ELSE 0 END), 0) as bank_balance,
    COALESCE(SUM(CASE WHEN account_code IN ('CASH', 'BANK', 'MOBILE') THEN balance ELSE 0 END), 0) as total_liquidity
FROM public.internal_accounts
WHERE account_code IN ('CASH', 'BANK', 'MOBILE');

-- ============================================================================
-- CONFIRM TRIGGERS ARE WORKING FOR FUTURE TRANSACTIONS
-- ============================================================================

-- Test trigger with a small test entry
INSERT INTO public.journal_entries (reference_type, reference_id, description, created_by, date)
VALUES ('test', null, 'Balance trigger test', auth.uid(), CURRENT_DATE)
RETURNING id;

-- Get the journal entry ID and add test journal lines
-- (You'll need to replace TEST_JOURNAL_ID with the actual ID returned above)
-- INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit)
-- VALUES
--     ('TEST_JOURNAL_ID', (SELECT id FROM internal_accounts WHERE account_code = 'CASH'), 100, 0),
--     ('TEST_JOURNAL_ID', (SELECT id FROM internal_accounts WHERE account_code = 'PORTFOLIO'), 0, 100);

-- Check if balances updated after test entry
-- SELECT account_code, balance FROM internal_accounts WHERE account_code IN ('CASH', 'PORTFOLIO');
