-- 1. Performance Indexing
-- Adding indexes on columns frequently used in RLS policies and joins to prevent full table scans.

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry_id ON public.journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_id ON public.journal_lines(account_id);

-- 2. Tables not created yet (skipping storage hardening and other indexes)

-- 3. Financial Integrity: Double-Entry Enforcement
-- Trigger to ensure journal entries are balanced (Debits = Credits) at the database level.

CREATE OR REPLACE FUNCTION public.check_journal_entry_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_debit numeric;
  v_total_credit numeric;
BEGIN
  SELECT SUM(debit), SUM(credit)
  INTO v_total_debit, v_total_credit
  FROM public.journal_lines
  WHERE journal_entry_id = NEW.journal_entry_id;

  IF ABS(COALESCE(v_total_debit, 0) - COALESCE(v_total_credit, 0)) > 0.01 THEN
    RAISE EXCEPTION 'Journal entry % is not balanced. Debits (%) must equal Credits (%).', 
      NEW.journal_entry_id, v_total_debit, v_total_credit;
  END IF;

  RETURN NEW;
END;
$$;

-- We use a constraint trigger to check balance after all lines are inserted
DROP TRIGGER IF EXISTS trg_check_journal_balance ON public.journal_lines;
CREATE CONSTRAINT TRIGGER trg_check_journal_balance
AFTER INSERT OR UPDATE ON public.journal_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.check_journal_entry_balance();

-- 4. Tables not created yet (skipping RLS policies)