-- Create system accounts that are required for the application
-- This ensures Share Capital, Bank, Cash, and other core accounts exist

-- Insert core system accounts (only if they don't already exist)
INSERT INTO public.internal_accounts (name, category, code, type, balance, is_system_account, is_active)
SELECT 'Share Capital', 'equity', 'CAPITAL', 'equity', 0, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.internal_accounts WHERE code = 'CAPITAL');

INSERT INTO public.internal_accounts (name, category, code, type, balance, is_system_account, is_active)
SELECT 'Main Bank Account', 'asset', 'BANK', 'bank', 0, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.internal_accounts WHERE code = 'BANK');

INSERT INTO public.internal_accounts (name, category, code, type, balance, is_system_account, is_active)
SELECT 'Petty Cash', 'asset', 'CASH', 'cash', 0, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.internal_accounts WHERE code = 'CASH');

INSERT INTO public.internal_accounts (name, category, code, type, balance, is_system_account, is_active)
SELECT 'Mobile Money', 'asset', 'MOBILE', 'mobile', 0, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.internal_accounts WHERE code = 'MOBILE');

INSERT INTO public.internal_accounts (name, category, code, type, balance, is_system_account, is_active)
SELECT 'Retained Earnings', 'equity', 'EQUITY', 'equity', 0, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.internal_accounts WHERE code = 'EQUITY');

INSERT INTO public.internal_accounts (name, category, code, type, balance, is_system_account, is_active)
SELECT 'Loan Portfolio', 'asset', 'PORTFOLIO', 'asset', 0, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.internal_accounts WHERE code = 'PORTFOLIO');

-- Add balance column if it doesn't exist (for older databases)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_accounts' AND column_name = 'balance') THEN
        ALTER TABLE public.internal_accounts ADD COLUMN balance DECIMAL(15,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_accounts' AND column_name = 'is_system_account') THEN
        ALTER TABLE public.internal_accounts ADD COLUMN is_system_account BOOLEAN DEFAULT false;
    END IF;
END $$;
