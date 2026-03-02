-- DEBUG: Investigate why SHARED CAPITAL and LIQUIDITY increase when running balance fix
-- Execute this in Supabase SQL Editor BEFORE running the balance fix

-- 1. Check current account balances BEFORE fix
SELECT
    'BEFORE_FIX' as status,
    ia.account_code,
    ia.name,
    ia.account_category,
    ia.balance as current_balance,
    ia.updated_at
FROM public.internal_accounts ia
WHERE ia.account_code IN ('PORTFOLIO', 'CASH', 'BANK', 'EQUITY', 'CAPITAL', 'SHARED_CAPITAL')
ORDER BY ia.account_code;

-- 2. Check total journal entries by account to see what the calculated balance should be
SELECT
    ia.account_code,
    ia.name,
    ia.account_category,
    COUNT(jl.id) as journal_entry_count,
    COALESCE(SUM(jl.debit), 0) as total_debits,
    COALESCE(SUM(jl.credit), 0) as total_credits,
    CASE
        WHEN ia.account_category IN ('asset', 'expense') THEN
            COALESCE(SUM(jl.debit - jl.credit), 0)
        WHEN ia.account_category IN ('liability', 'equity', 'income') THEN
            COALESCE(SUM(jl.credit - jl.debit), 0)
        ELSE 0
    END as calculated_balance
FROM public.internal_accounts ia
LEFT JOIN public.journal_lines jl ON ia.id = jl.account_id
WHERE ia.account_code IN ('PORTFOLIO', 'CASH', 'BANK', 'EQUITY', 'CAPITAL', 'SHARED_CAPITAL')
GROUP BY ia.id, ia.account_code, ia.name, ia.account_category
ORDER BY ia.account_code;

-- 3. Check for duplicate journal entries (same description, amount, date)
SELECT
    je.description,
    je.date,
    je.reference_type,
    je.reference_id,
    COUNT(*) as duplicate_count,
    STRING_AGG(DISTINCT je.id::text, ', ') as journal_ids,
    SUM(jl.debit) as total_debits,
    SUM(jl.credit) as total_credits
FROM public.journal_entries je
JOIN public.journal_lines jl ON je.id = jl.journal_entry_id
WHERE je.description LIKE '%disbursement%' OR je.description LIKE '%loan%'
GROUP BY je.description, je.date, je.reference_type, je.reference_id
HAVING COUNT(*) > 1
ORDER BY je.date DESC;

-- 4. Check journal entries affecting SHARED_CAPITAL or EQUITY accounts
SELECT
    je.id,
    je.description,
    je.date,
    je.created_at,
    jl.account_id,
    ia.account_code,
    ia.name,
    jl.debit,
    jl.credit,
    CASE
        WHEN ia.account_category IN ('asset', 'expense') THEN jl.debit - jl.credit
        WHEN ia.account_category IN ('liability', 'equity', 'income') THEN jl.credit - jl.debit
        ELSE 0
    END as balance_impact
FROM public.journal_entries je
JOIN public.journal_lines jl ON je.id = jl.journal_entry_id
JOIN public.internal_accounts ia ON jl.account_id = ia.id
WHERE ia.account_code IN ('EQUITY', 'CAPITAL', 'SHARED_CAPITAL')
    AND je.created_at > NOW() - INTERVAL '30 days'
ORDER BY je.created_at DESC;

-- 5. Check what accounts contribute to liquidity calculation
SELECT
    ia.account_code,
    ia.name,
    ia.account_category,
    ia.balance,
    CASE WHEN ia.account_code IN ('CASH', 'BANK', 'MOBILE') THEN 'LIQUIDITY_ACCOUNT' ELSE 'NON_LIQUIDITY' END as liquidity_contributor
FROM public.internal_accounts ia
ORDER BY ia.account_code;

-- 6. Manual liquidity calculation
SELECT
    'MANUAL_CALCULATION' as type,
    COALESCE(SUM(CASE WHEN account_code = 'CASH' THEN balance ELSE 0 END), 0) as cash_balance,
    COALESCE(SUM(CASE WHEN account_code = 'BANK' THEN balance ELSE 0 END), 0) as bank_balance,
    COALESCE(SUM(CASE WHEN account_code = 'MOBILE' THEN balance ELSE 0 END), 0) as mobile_balance,
    COALESCE(SUM(CASE WHEN account_code IN ('CASH', 'BANK', 'MOBILE') THEN balance ELSE 0 END), 0) as total_liquidity
FROM public.internal_accounts
WHERE account_code IN ('CASH', 'BANK', 'MOBILE');
