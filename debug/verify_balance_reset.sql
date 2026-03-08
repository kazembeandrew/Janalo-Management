-- VERIFY EMERGENCY BALANCE RESET RESULTS
-- Execute this in Supabase SQL Editor

-- ============================================================================
-- CHECK BALANCES AFTER RESET
-- ============================================================================

-- Check key account balances
SELECT
    'AFTER_RESET' as status,
    ia.account_code,
    ia.name,
    ia.account_category,
    ia.balance,
    ia.updated_at
FROM public.internal_accounts ia
WHERE ia.account_code IN ('PORTFOLIO', 'CASH', 'BANK', 'EQUITY', 'CAPITAL', 'SHARED_CAPITAL')
ORDER BY ia.account_code;

-- ============================================================================
-- VERIFY LIQUIDITY CALCULATION
-- ============================================================================

SELECT
    'LIQUIDITY_CHECK' as type,
    COALESCE(SUM(CASE WHEN account_code = 'CASH' THEN balance ELSE 0 END), 0) as cash_balance,
    COALESCE(SUM(CASE WHEN account_code = 'BANK' THEN balance ELSE 0 END), 0) as bank_balance,
    COALESCE(SUM(CASE WHEN account_code = 'MOBILE' THEN balance ELSE 0 END), 0) as mobile_balance,
    COALESCE(SUM(CASE WHEN account_code IN ('CASH', 'BANK', 'MOBILE') THEN balance ELSE 0 END), 0) as total_liquidity
FROM public.internal_accounts
WHERE account_code IN ('CASH', 'BANK', 'MOBILE');

-- ============================================================================
-- TEST TRIGGER IS WORKING (Add test transaction)
-- ============================================================================

-- Create another test journal entry to verify triggers work
INSERT INTO public.journal_entries (reference_type, reference_id, description, created_by, date)
VALUES ('test_trigger', null, 'Testing balance trigger functionality', auth.uid(), CURRENT_DATE)
RETURNING id as test_journal_id;

-- Note: After getting the test_journal_id above, run these inserts manually:
-- (Replace TEST_JOURNAL_ID with the actual ID returned)

/*
-- Add test journal lines: Debit CASH $1000, Credit PORTFOLIO $1000
INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit)
VALUES
    ('TEST_JOURNAL_ID', (SELECT id FROM internal_accounts WHERE account_code = 'CASH'), 1000, 0),
    ('TEST_JOURNAL_ID', (SELECT id FROM internal_accounts WHERE account_code = 'PORTFOLIO'), 0, 1000);

-- Check if balances updated
SELECT
    account_code,
    balance as balance_after_test,
    updated_at
FROM public.internal_accounts
WHERE account_code IN ('CASH', 'PORTFOLIO');
*/

-- ============================================================================
-- CLEANUP TEST ENTRIES (Optional)
-- ============================================================================

-- Remove test entries after verification
-- DELETE FROM public.journal_lines WHERE journal_entry_id IN (
--     SELECT id FROM public.journal_entries WHERE reference_type = 'test'
-- );
-- DELETE FROM public.journal_entries WHERE reference_type = 'test';

-- ============================================================================
-- COMPARE WITH BACKUP (If needed)
-- ============================================================================

-- Check what balances were before reset
-- SELECT * FROM emergency_balance_backup ORDER BY account_code;
