-- COMPLETE FIX FOR BALANCE TRIGGER ISSUES
-- Execute this entire script in Supabase SQL Editor

-- ============================================================================
-- 1. ENSURE TRIGGER IS PROPERLY CREATED AND ENABLED
-- ============================================================================

-- Drop any existing triggers first to avoid conflicts
DROP TRIGGER IF EXISTS trg_update_account_balance ON public.journal_lines;
DROP TRIGGER IF EXISTS trg_reverse_account_balance ON public.journal_lines;

-- Recreate the balance update trigger
CREATE TRIGGER trg_update_account_balance
AFTER INSERT OR UPDATE ON public.journal_lines
FOR EACH ROW EXECUTE FUNCTION public.update_account_balance_from_journal();

-- Recreate the reverse balance trigger
CREATE TRIGGER trg_reverse_account_balance
AFTER DELETE ON public.journal_lines
FOR EACH ROW EXECUTE FUNCTION public.reverse_account_balance_from_journal();

-- ============================================================================
-- 2. RECREATE BALANCE UPDATE FUNCTION (ENSURE IT'S CORRECT)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_account_balance_from_journal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_category text;
BEGIN
  -- Get account category
  SELECT account_category INTO v_category
  FROM public.internal_accounts
  WHERE id = NEW.account_id;

  -- Assets and Expenses increase with Debits
  IF v_category IN ('asset', 'expense') THEN
    UPDATE public.internal_accounts
    SET balance = balance + (NEW.debit - NEW.credit),
        updated_at = NOW()
    WHERE id = NEW.account_id;

  -- Liabilities, Equity, and Income increase with Credits
  ELSIF v_category IN ('liability', 'equity', 'income') THEN
    UPDATE public.internal_accounts
    SET balance = balance + (NEW.credit - NEW.debit),
        updated_at = NOW()
    WHERE id = NEW.account_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. FIX ANY MISSING ACCOUNT BALANCES (REBUILD FROM JOURNAL HISTORY)
-- ============================================================================

-- Create a function to recalculate all account balances from scratch
CREATE OR REPLACE FUNCTION recalculate_all_account_balances()
RETURNS TEXT AS $$
DECLARE
    v_account RECORD;
    v_balance DECIMAL(15,2);
BEGIN
    -- Reset all balances to 0 first
    UPDATE public.internal_accounts SET balance = 0, updated_at = NOW();

    -- Recalculate balances for each account from journal history
    FOR v_account IN SELECT id, account_category FROM public.internal_accounts LOOP
        -- Calculate net balance for this account
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

        -- Update the account balance
        UPDATE public.internal_accounts
        SET balance = v_balance, updated_at = NOW()
        WHERE id = v_account.id;
    END LOOP;

    RETURN 'Account balances recalculated successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the recalculation
SELECT recalculate_all_account_balances();

-- ============================================================================
-- 4. GRANT NECESSARY PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.update_account_balance_from_journal() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_account_balance_from_journal() TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_all_account_balances() TO authenticated;

-- ============================================================================
-- 5. VERIFY THE FIX WORKS
-- ============================================================================

-- Check if balances are now correct
SELECT
    ia.account_code,
    ia.name,
    ia.account_category,
    ia.balance,
    ia.updated_at
FROM public.internal_accounts ia
WHERE ia.account_code IN ('PORTFOLIO', 'CASH', 'BANK', 'EQUITY', 'CAPITAL')
ORDER BY ia.account_code;

-- Check recent journal entries and their impact
SELECT
    je.id,
    je.reference_type,
    je.description,
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
WHERE je.created_at > NOW() - INTERVAL '7 days'
ORDER BY je.created_at DESC, je.id, jl.id
LIMIT 20;

-- ============================================================================
-- 6. CLEANUP (OPTIONAL)
-- ============================================================================

-- Drop the temporary recalculation function after verification
-- DROP FUNCTION IF EXISTS recalculate_all_account_balances();
