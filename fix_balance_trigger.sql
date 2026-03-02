-- Execute this directly in Supabase SQL Editor to fix the balance trigger issue

-- Create the missing trigger to update account balances when journal lines are inserted
CREATE TRIGGER trg_update_account_balance
AFTER INSERT OR UPDATE ON public.journal_lines
FOR EACH ROW EXECUTE FUNCTION public.update_account_balance_from_journal();

-- Also create a trigger for when journal lines are deleted (reverse the balance change)
CREATE OR REPLACE FUNCTION public.reverse_account_balance_from_journal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category text;
BEGIN
  SELECT account_category INTO v_category FROM public.internal_accounts WHERE id = OLD.account_id;
  
  -- Assets and Expenses decrease with Debits when deleted
  IF v_category IN ('asset', 'expense') THEN
    UPDATE public.internal_accounts 
    SET balance = balance - (OLD.debit - OLD.credit), 
        updated_at = NOW() 
    WHERE id = OLD.account_id;
    
  -- Liabilities, Equity, and Income decrease with Credits when deleted
  ELSIF v_category IN ('liability', 'equity', 'income') THEN
    UPDATE public.internal_accounts 
    SET balance = balance - (OLD.credit - OLD.debit), 
        updated_at = NOW() 
    WHERE id = OLD.account_id;
  END IF;
  
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_reverse_account_balance
AFTER DELETE ON public.journal_lines
FOR EACH ROW EXECUTE FUNCTION public.reverse_account_balance_from_journal();

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.reverse_account_balance_from_journal() TO authenticated;
