-- Fixed debug script - handles missing liquidity_metrics table

-- Step 1: Check if triggers exist
SELECT
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgfoid::regproc as function_name,
    tgenabled as enabled
FROM pg_trigger
WHERE tgrelid = 'public.journal_lines'::regclass
ORDER BY tgname;

-- Step 2: Check if balance update function exists
SELECT
    proname as function_name,
    pronargs as argument_count,
    prorettype::regtype as return_type
FROM pg_proc
WHERE proname LIKE '%balance%';

-- Step 3: Check recent journal entries
SELECT
    je.id,
    je.description,
    je.entry_date,
    je.reference_type,
    je.reference_id,
    COUNT(*) as entry_count,
    SUM(jl.debit) as total_debits,
    SUM(jl.credit) as total_credits,
    MIN(je.created_at) as first_created,
    MAX(je.created_at) as last_created
FROM public.journal_entries je
JOIN public.journal_lines jl ON je.id = jl.journal_entry_id
GROUP BY je.id, je.reference_type, je.reference_id, je.description, je.entry_date, je.created_at
ORDER BY je.created_at DESC
LIMIT 10;

-- Step 4: Check account balances
SELECT
    ia.account_code,
    ia.name,
    ia.account_category,
    ia.balance,
    ia.updated_at
FROM public.internal_accounts ia
WHERE ia.account_code IN ('PORTFOLIO', 'CASH', 'BANK', 'EQUITY', 'CAPITAL')
ORDER BY ia.account_code;

-- Step 5: Check if liquidity_metrics table exists (optional)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'liquidity_metrics' AND table_schema = 'public') THEN
        RAISE NOTICE 'liquidity_metrics table exists - checking data...';
        -- Check liquidity metrics if table exists
        PERFORM * FROM public.liquidity_metrics ORDER BY created_at DESC LIMIT 1;
    ELSE
        RAISE NOTICE 'liquidity_metrics table does not exist - need to create it';
    END IF;
END $$;

-- Step 6: Manual balance calculation test
-- This shows what balances SHOULD be based on journal lines
SELECT
    ia.account_code,
    ia.name,
    ia.balance as current_balance,
    COALESCE((
        SELECT SUM(jl.debit - jl.credit)
        FROM public.journal_lines jl
        WHERE jl.account_id = ia.id
    ), 0) as calculated_balance
FROM public.internal_accounts ia
WHERE ia.account_code IN ('PORTFOLIO', 'CASH', 'BANK', 'EQUITY', 'CAPITAL')
ORDER BY ia.account_code;

-- Step 7: Check if journal lines exist but triggers aren't working
SELECT
    'Total journal lines' as check_type,
    COUNT(*) as count
FROM public.journal_lines jl
UNION ALL
SELECT
    'Lines with PORTFOLIO account' as check_type,
    COUNT(*) as count
FROM public.journal_lines jl
JOIN public.internal_accounts ia ON jl.account_id = ia.id
WHERE ia.account_code = 'PORTFOLIO'
UNION ALL
SELECT
    'Lines with CASH/BANK accounts' as check_type,
    COUNT(*) as count
FROM public.journal_lines jl
JOIN public.internal_accounts ia ON jl.account_id = ia.id
WHERE ia.account_code IN ('CASH', 'BANK');
