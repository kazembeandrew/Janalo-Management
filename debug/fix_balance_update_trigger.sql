-- ============================================================================
-- COMPREHENSIVE FIX: Fund Transfer Balance Update & Schema Issues
-- This script fixes multiple issues:
-- 1. Missing balance update trigger (trg_update_account_balance_all)
-- 2. verify_trial_balance function referencing wrong column
-- 3. Rebuilds all account balances from journal history
-- ============================================================================

-- Step 0: Check current schema state
DO $$
DECLARE
    has_entry_date BOOLEAN;
    has_date_column BOOLEAN;
BEGIN
    -- Check if entry_date column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'journal_entries' 
        AND column_name = 'entry_date'
    ) INTO has_entry_date;
    
    -- Check if date column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'journal_entries' 
        AND column_name = 'date'
    ) INTO has_date_column;
    
    RAISE NOTICE 'Schema Check Results:';
    RAISE NOTICE '  - entry_date column exists: %', has_entry_date;
    RAISE NOTICE '  - date column exists: %', has_date_column;
    
    -- If entry_date doesn't exist, add it
    IF NOT has_entry_date THEN
        RAISE NOTICE 'Adding entry_date column to journal_entries...';
        ALTER TABLE public.journal_entries ADD COLUMN entry_date DATE DEFAULT CURRENT_DATE;
        
        -- Migrate existing data from date to entry_date if date column exists
        IF has_date_column THEN
            UPDATE public.journal_entries SET entry_date = date WHERE entry_date IS NULL;
            RAISE NOTICE 'Migrated existing dates to entry_date column';
        END IF;
    END IF;
END $$;

-- Step 1: Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trg_update_account_balance ON public.journal_lines;
DROP TRIGGER IF EXISTS trg_reverse_account_balance ON public.journal_lines;
DROP TRIGGER IF EXISTS trg_update_account_balance_all ON public.journal_lines;

-- Step 2: Drop existing function if it exists
DROP FUNCTION IF EXISTS public.update_account_balance_from_journal();

-- Step 3: Create the balance update function
CREATE OR REPLACE FUNCTION public.update_account_balance_from_journal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category text;
  v_debit_delta numeric;
  v_credit_delta numeric;
  v_account_id uuid;
BEGIN
  -- Helper: apply a delta to one account id
  -- Category is derived from account_category when available, else category, else type.
  -- Non-standard categories like bank/cash/mobile are treated as asset.
  IF TG_OP = 'INSERT' THEN
    v_account_id := NEW.account_id;
    v_debit_delta := COALESCE(NEW.debit, 0);
    v_credit_delta := COALESCE(NEW.credit, 0);

    SELECT COALESCE(NULLIF(account_category, ''), NULLIF(category, ''), NULLIF(type, ''))
    INTO v_category
    FROM public.internal_accounts
    WHERE id = v_account_id;

    v_category := lower(COALESCE(v_category, ''));
    IF v_category IN ('bank', 'cash', 'mobile') THEN v_category := 'asset'; END IF;
    IF v_category = 'capital' THEN v_category := 'equity'; END IF;

    UPDATE public.internal_accounts
    SET balance = balance + CASE
      WHEN v_category IN ('asset', 'expense') THEN (v_debit_delta - v_credit_delta)
      WHEN v_category IN ('liability', 'equity', 'income') THEN (v_credit_delta - v_debit_delta)
      ELSE 0
    END,
    updated_at = NOW()
    WHERE id = v_account_id;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_account_id := OLD.account_id;
    v_debit_delta := COALESCE(OLD.debit, 0);
    v_credit_delta := COALESCE(OLD.credit, 0);

    SELECT COALESCE(NULLIF(account_category, ''), NULLIF(category, ''), NULLIF(type, ''))
    INTO v_category
    FROM public.internal_accounts
    WHERE id = v_account_id;

    v_category := lower(COALESCE(v_category, ''));
    IF v_category IN ('bank', 'cash', 'mobile') THEN v_category := 'asset'; END IF;
    IF v_category = 'capital' THEN v_category := 'equity'; END IF;

    UPDATE public.internal_accounts
    SET balance = balance - CASE
      WHEN v_category IN ('asset', 'expense') THEN (v_debit_delta - v_credit_delta)
      WHEN v_category IN ('liability', 'equity', 'income') THEN (v_credit_delta - v_debit_delta)
      ELSE 0
    END,
    updated_at = NOW()
    WHERE id = v_account_id;

    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If account_id changed, subtract old impact from OLD.account_id and add new impact to NEW.account_id
    IF NEW.account_id <> OLD.account_id THEN
      -- Apply DELETE logic to old account
      v_account_id := OLD.account_id;
      v_debit_delta := COALESCE(OLD.debit, 0);
      v_credit_delta := COALESCE(OLD.credit, 0);

      SELECT COALESCE(NULLIF(account_category, ''), NULLIF(category, ''), NULLIF(type, ''))
      INTO v_category
      FROM public.internal_accounts
      WHERE id = v_account_id;

      v_category := lower(COALESCE(v_category, ''));
      IF v_category IN ('bank', 'cash', 'mobile') THEN v_category := 'asset'; END IF;
      IF v_category = 'capital' THEN v_category := 'equity'; END IF;

      UPDATE public.internal_accounts
      SET balance = balance - CASE
        WHEN v_category IN ('asset', 'expense') THEN (v_debit_delta - v_credit_delta)
        WHEN v_category IN ('liability', 'equity', 'income') THEN (v_credit_delta - v_debit_delta)
        ELSE 0
      END,
      updated_at = NOW()
      WHERE id = v_account_id;

      -- Apply INSERT logic to new account
      v_account_id := NEW.account_id;
      v_debit_delta := COALESCE(NEW.debit, 0);
      v_credit_delta := COALESCE(NEW.credit, 0);

      SELECT COALESCE(NULLIF(account_category, ''), NULLIF(category, ''), NULLIF(type, ''))
      INTO v_category
      FROM public.internal_accounts
      WHERE id = v_account_id;

      v_category := lower(COALESCE(v_category, ''));
      IF v_category IN ('bank', 'cash', 'mobile') THEN v_category := 'asset'; END IF;
      IF v_category = 'capital' THEN v_category := 'equity'; END IF;

      UPDATE public.internal_accounts
      SET balance = balance + CASE
        WHEN v_category IN ('asset', 'expense') THEN (v_debit_delta - v_credit_delta)
        WHEN v_category IN ('liability', 'equity', 'income') THEN (v_credit_delta - v_debit_delta)
        ELSE 0
      END,
      updated_at = NOW()
      WHERE id = v_account_id;
    ELSE
      -- Same account, just adjust for amount changes
      v_account_id := NEW.account_id;
      
      SELECT COALESCE(NULLIF(account_category, ''), NULLIF(category, ''), NULLIF(type, ''))
      INTO v_category
      FROM public.internal_accounts
      WHERE id = v_account_id;

      v_category := lower(COALESCE(v_category, ''));
      IF v_category IN ('bank', 'cash', 'mobile') THEN v_category := 'asset'; END IF;
      IF v_category = 'capital' THEN v_category := 'equity'; END IF;

      -- Net change = (new debit - new credit) - (old debit - old credit)
      UPDATE public.internal_accounts
      SET balance = balance + CASE
        WHEN v_category IN ('asset', 'expense') THEN 
          ((COALESCE(NEW.debit, 0) - COALESCE(NEW.credit, 0)) - (COALESCE(OLD.debit, 0) - COALESCE(OLD.credit, 0)))
        WHEN v_category IN ('liability', 'equity', 'income') THEN 
          ((COALESCE(NEW.credit, 0) - COALESCE(NEW.debit, 0)) - (COALESCE(OLD.credit, 0) - COALESCE(OLD.debit, 0)))
        ELSE 0
      END,
      updated_at = NOW()
      WHERE id = v_account_id;
    END IF;

    RETURN NEW;
  END IF;
END;
$$;

-- Step 4: Create the trigger on journal_lines
CREATE TRIGGER trg_update_account_balance_all
AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
FOR EACH ROW
EXECUTE FUNCTION public.update_account_balance_from_journal();

-- Step 5: Fix verify_trial_balance function to use correct column
CREATE OR REPLACE FUNCTION public.verify_trial_balance(
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  is_balanced BOOLEAN,
  total_debits DECIMAL(15,2),
  total_credits DECIMAL(15,2),
  difference DECIMAL(15,2),
  unbalanced_entries UUID[]
) AS $$
DECLARE
  v_total_debits DECIMAL(15,2);
  v_total_credits DECIMAL(15,2);
  v_difference DECIMAL(15,2);
  v_date_column TEXT;
BEGIN
  -- Determine which date column to use
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'journal_entries' 
      AND column_name = 'entry_date'
    ) THEN 'entry_date'
    ELSE 'date'
  END INTO v_date_column;
  
  -- Build dynamic query based on available column
  EXECUTE format(
    'SELECT COALESCE(SUM(jl.debit), 0), COALESCE(SUM(jl.credit), 0)
     FROM public.journal_lines jl
     JOIN public.journal_entries je ON jl.journal_entry_id = je.id
     WHERE je.%I = $1
       AND COALESCE(je.status, ''posted'') = ''posted''',
    v_date_column
  ) INTO v_total_debits, v_total_credits USING p_date;

  v_difference := ABS(v_total_debits - v_total_credits);

  RETURN QUERY
  EXECUTE format(
    'SELECT
      $2 < 0.01,
      $3,
      $4,
      $5,
      ARRAY(
        SELECT je.id
        FROM public.journal_entries je
        JOIN public.journal_lines jl ON jl.journal_entry_id = je.id
        WHERE je.%I = $1
          AND COALESCE(je.status, ''posted'') = ''posted''
        GROUP BY je.id
        HAVING ABS(SUM(jl.debit) - SUM(jl.credit)) > 0.01
      )',
    v_date_column
  ) USING p_date, v_difference, v_total_debits, v_total_credits, v_difference;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.verify_trial_balance(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_trial_balance(DATE) TO service_role;

-- Step 6: Rebuild all account balances from journal history
DO $$
DECLARE
  v_accounts_updated INTEGER := 0;
BEGIN
  -- Reset all balances to 0 first
  UPDATE public.internal_accounts SET balance = 0, updated_at = NOW();
  
  -- Recalculate balances from all posted journal entries
  WITH calculated_balances AS (
    SELECT
      jl.account_id,
      SUM(
        CASE
          WHEN lower(COALESCE(NULLIF(ia.account_category, ''), NULLIF(ia.category, ''), NULLIF(ia.type, ''))) IN ('bank', 'cash', 'mobile', 'asset', 'expense') THEN 
            (COALESCE(jl.debit, 0) - COALESCE(jl.credit, 0))
          WHEN lower(COALESCE(NULLIF(ia.account_category, ''), NULLIF(ia.category, ''), NULLIF(ia.type, ''))) IN ('liability', 'equity', 'income', 'capital') THEN 
            (COALESCE(jl.credit, 0) - COALESCE(jl.debit, 0))
          ELSE 0
        END
      ) AS new_balance
    FROM public.journal_lines jl
    JOIN public.journal_entries je ON je.id = jl.journal_entry_id
    JOIN public.internal_accounts ia ON ia.id = jl.account_id
    WHERE COALESCE(je.status, 'posted') = 'posted'
    GROUP BY jl.account_id
  )
  UPDATE public.internal_accounts ia
  SET balance = cb.new_balance,
      updated_at = NOW()
  FROM calculated_balances cb
  WHERE ia.id = cb.account_id;
  
  GET DIAGNOSTICS v_accounts_updated = ROW_COUNT;
  
  RAISE NOTICE 'Balance rebuild complete: % accounts updated', v_accounts_updated;
END $$;

-- Step 7: Verification queries
DO $$
DECLARE
  v_trigger_exists BOOLEAN;
  v_function_exists BOOLEAN;
  v_trial_balance RECORD;
BEGIN
  -- Check trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_account_balance_all'
  ) INTO v_trigger_exists;
  
  -- Check function
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_account_balance_from_journal'
  ) INTO v_function_exists;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fix Applied Successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Trigger Status: %', CASE WHEN v_trigger_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
  RAISE NOTICE 'Function Status: %', CASE WHEN v_function_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
  RAISE NOTICE '========================================';
  
  -- Run trial balance check
  SELECT * INTO v_trial_balance FROM public.verify_trial_balance(CURRENT_DATE);
  
  RAISE NOTICE '';
  RAISE NOTICE 'Current Trial Balance:';
  RAISE NOTICE '  Total Debits:   $%', v_trial_balance.total_debits;
  RAISE NOTICE '  Total Credits:  $%', v_trial_balance.total_credits;
  RAISE NOTICE '  Difference:     $%', v_trial_balance.difference;
  RAISE NOTICE '  Is Balanced:    %', CASE WHEN v_trial_balance.is_balanced THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE '========================================';
END $$;
