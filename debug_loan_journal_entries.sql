-- Check recent journal entries to see if loans are creating journal entries
-- Run this in Supabase SQL Editor

-- 1. Check recent journal entries
SELECT
    je.id,
    je.reference_type,
    je.reference_id,
    je.description,
    je.created_at,
    COUNT(jl.id) as line_count,
    SUM(CASE WHEN jl.debit > 0 THEN jl.debit ELSE 0 END) as total_debits,
    SUM(CASE WHEN jl.credit > 0 THEN jl.credit ELSE 0 END) as total_credits
FROM public.journal_entries je
LEFT JOIN public.journal_lines jl ON je.id = jl.journal_entry_id
WHERE je.reference_type = 'loan_disbursement'
    AND je.created_at > NOW() - INTERVAL '24 hours'
GROUP BY je.id, je.reference_type, je.reference_id, je.description, je.created_at
ORDER BY je.created_at DESC;

-- 2. Check if there are any loans that became active recently but no journal entry
SELECT
    l.id,
    l.reference_no,
    l.principal_amount,
    l.status,
    l.created_at,
    l.updated_at,
    b.full_name
FROM public.loans l
LEFT JOIN public.borrowers b ON l.borrower_id = b.id
LEFT JOIN public.journal_entries je ON je.reference_type = 'loan_disbursement' AND je.reference_id = l.id
WHERE l.status = 'active'
    AND l.updated_at > NOW() - INTERVAL '24 hours'
    AND je.id IS NULL
ORDER BY l.updated_at DESC;

-- 3. Check account balances before and after (if you have audit logs)
-- This would require audit logs of account balances

-- 4. Check if the post_journal_entry function exists and is accessible
SELECT
    proname as function_name,
    pronargs as argument_count,
    prorettype::regtype as return_type
FROM pg_proc
WHERE proname = 'post_journal_entry'
    AND pronamespace = 'public'::regnamespace;

-- 5. Test the balance trigger by manually inserting a journal line
-- (Don't run this unless testing)
-- First create a journal entry:
/*
INSERT INTO public.journal_entries (reference_type, reference_id, description, created_by, date)
VALUES ('test', null, 'Test balance trigger', auth.uid(), CURRENT_DATE)
RETURNING id;
*/
-- Then insert journal lines:
/*
INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit)
VALUES
    ('<journal_entry_id>', (SELECT id FROM internal_accounts WHERE account_code = 'PORTFOLIO'), 1000, 0),
    ('<journal_entry_id>', (SELECT id FROM internal_accounts WHERE account_code = 'CASH'), 0, 1000);
*/
-- Check if balances updated:
/*
SELECT account_code, balance FROM internal_accounts WHERE account_code IN ('PORTFOLIO', 'CASH');
*/
