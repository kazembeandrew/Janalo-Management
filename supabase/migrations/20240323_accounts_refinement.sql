-- 1. Ensure account_code is unique to prevent duplicate system identifiers
ALTER TABLE public.internal_accounts 
ADD CONSTRAINT internal_accounts_account_code_key UNIQUE (account_code);

-- 2. Enforce valid accounting categories for the double-entry engine
-- UNIQUE CONSTRAINT ALREADY EXISTS (skipping)

-- 3. Add a flag to identify mandatory system accounts
ALTER TABLE public.internal_accounts 
ADD COLUMN IF NOT EXISTS is_system_account BOOLEAN DEFAULT false;

-- 4. Mark existing core accounts as system accounts
UPDATE public.internal_accounts 
SET is_system_account = true 
WHERE account_code IN ('CAPITAL', 'EQUITY', 'BANK', 'CASH');

-- 5. Update the balance calculation trigger to be more robust
CREATE OR REPLACE FUNCTION public.update_account_balance_from_journal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_category text;
BEGIN
  SELECT account_category INTO v_category FROM public.internal_accounts WHERE id = NEW.account_id;
  
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