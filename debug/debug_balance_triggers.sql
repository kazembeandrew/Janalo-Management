-- Check if balance triggers are working and liquidity is being calculated

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

-- Step 5: Check liquidity calculation (if exists)
SELECT * FROM public.liquidity_metrics
ORDER BY created_at DESC
LIMIT 5;

-- Step 6: Test trigger manually by creating a test journal entry
-- Uncomment below to test:
/*
INSERT INTO public.journal_entries (reference_type, reference_id, description, created_by, date)
VALUES ('test', null, 'Test entry for balance trigger', auth.uid(), CURRENT_DATE)
RETURNING id;

-- Then check the balance
SELECT account_code, balance FROM public.internal_accounts WHERE account_code = 'PORTFOLIO';
*/
