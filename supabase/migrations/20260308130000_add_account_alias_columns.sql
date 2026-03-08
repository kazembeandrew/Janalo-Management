-- Add alias columns to internal_accounts table to match frontend expectations
-- The frontend expects account_code and account_category columns

-- Add columns if they don't exist
ALTER TABLE public.internal_accounts 
ADD COLUMN IF NOT EXISTS account_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS account_category VARCHAR(50);

-- Copy data from existing columns to new columns
UPDATE public.internal_accounts 
SET account_code = code, 
    account_category = category
WHERE account_code IS NULL OR account_category IS NULL;

-- Create triggers to keep columns in sync
CREATE OR REPLACE FUNCTION sync_account_code_category()
RETURNS TRIGGER AS $$
BEGIN
    NEW.account_code := NEW.code;
    NEW.account_category := NEW.category;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_sync_account_code_category ON public.internal_accounts;
CREATE TRIGGER trigger_sync_account_code_category
BEFORE INSERT OR UPDATE ON public.internal_accounts
FOR EACH ROW
EXECUTE FUNCTION sync_account_code_category();
