-- 1. Drop the restrictive old constraint
ALTER TABLE public.internal_accounts 
DROP CONSTRAINT IF EXISTS internal_accounts_type_check;

-- 2. Add a modernized constraint that supports our system codes
ALTER TABLE public.internal_accounts 
ADD CONSTRAINT internal_accounts_type_check 
CHECK (type IN ('bank', 'cash', 'mobile', 'equity', 'liability', 'operational', 'capital', 'asset', 'income', 'expense'));

-- 3. Ensure existing data is consistent
UPDATE public.internal_accounts SET type = 'equity' WHERE account_code = 'CAPITAL' AND type NOT IN ('equity', 'capital');