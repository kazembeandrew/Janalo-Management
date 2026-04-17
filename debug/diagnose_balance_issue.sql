-- Diagnose Balance Update Issue
-- This script checks if the balance update triggers and functions exist

-- Check 1: Verify balance update function exists
SELECT 
    'Function Check' as check_type,
    proname as function_name,
    CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END as status
FROM pg_proc 
WHERE proname = 'update_account_balance_from_journal'
GROUP BY proname;

-- Check 2: Verify trigger exists
SELECT 
    'Trigger Check' as check_type,
    tgname as trigger_name,
    CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END as status
FROM pg_trigger 
WHERE tgname = 'trg_update_account_balance_all'
GROUP BY tgname;

-- Check 3: Check recent journal entries and their impact on balances
SELECT 
    je.id as journal_entry_id,
    je.description,
    je.entry_date,
    je.status,
    jl.account_id,
    ia.name as account_name,
    ia.balance as current_balance,
    jl.debit,
    jl.credit
FROM journal_entries je
JOIN journal_lines jl ON jl.journal_entry_id = je.id
JOIN internal_accounts ia ON ia.id = jl.account_id
ORDER BY je.created_at DESC
LIMIT 10;

-- Check 4: Verify trial balance (should be balanced)
SELECT * FROM verify_trial_balance(CURRENT_DATE);

-- Check 5: Check for any direct balance updates (suspicious activity)
SELECT 
    'Direct Balance Updates' as check_type,
    COUNT(*) as count
FROM audit_trail
WHERE table_name = 'internal_accounts'
  AND action = 'UPDATE'
  AND old_data->>'balance' != new_data->>'balance'
  AND changed_at > CURRENT_DATE - INTERVAL '7 days';

-- Check 6: Test balance calculation manually
WITH calculated_balances AS (
    SELECT
        jl.account_id,
        SUM(
            CASE
                WHEN lower(COALESCE(NULLIF(ia.account_category, ''), NULLIF(ia.category, ''), NULLIF(ia.type, ''))) IN ('bank', 'cash', 'mobile') THEN (COALESCE(jl.debit,0) - COALESCE(jl.credit,0))
                WHEN lower(COALESCE(NULLIF(ia.account_category, ''), NULLIF(ia.category, ''), NULLIF(ia.type, ''))) IN ('asset', 'expense') THEN (COALESCE(jl.debit,0) - COALESCE(jl.credit,0))
                WHEN lower(COALESCE(NULLIF(ia.account_category, ''), NULLIF(ia.category, ''), NULLIF(ia.type, ''))) IN ('liability', 'equity', 'income') THEN (COALESCE(jl.credit,0) - COALESCE(jl.debit,0))
                WHEN lower(COALESCE(NULLIF(ia.account_category, ''), NULLIF(ia.category, ''), NULLIF(ia.type, ''))) = 'capital' THEN (COALESCE(jl.credit,0) - COALESCE(jl.debit,0))
                ELSE 0
            END
        ) AS calculated_balance
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    JOIN internal_accounts ia ON ia.id = jl.account_id
    WHERE COALESCE(je.status, 'posted') = 'posted'
    GROUP BY jl.account_id
)
SELECT 
    ia.id as account_id,
    ia.name as account_name,
    ia.balance as stored_balance,
    cb.calculated_balance,
    ia.balance - cb.calculated_balance as difference
FROM internal_accounts ia
LEFT JOIN calculated_balances cb ON cb.account_id = ia.id
WHERE ABS(COALESCE(ia.balance, 0) - COALESCE(cb.calculated_balance, 0)) > 0.01
ORDER BY ABS(ia.balance - cb.calculated_balance) DESC;
