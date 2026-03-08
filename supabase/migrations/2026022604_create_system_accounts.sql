-- Create missing system accounts required by process_repayment function
-- These accounts are needed for double-entry bookkeeping

-- Insert PORTFOLIO account (Asset - Loan Portfolio)
INSERT INTO public.internal_accounts (name, category, code, type, balance, is_system_account)
SELECT 'Loan Portfolio', 'asset', 'PORTFOLIO', 'asset', 0, true
WHERE NOT EXISTS (SELECT 1 FROM public.internal_accounts WHERE code = 'PORTFOLIO');

-- Insert EQUITY account (Equity - Interest Revenue/Equity)
-- Note: Using EQUITY code for revenue tracking as expected by process_repayment
INSERT INTO public.internal_accounts (name, category, code, type, balance, is_system_account)
SELECT 'Interest Revenue', 'equity', 'EQUITY', 'equity', 0, true
WHERE NOT EXISTS (SELECT 1 FROM public.internal_accounts WHERE code = 'EQUITY');

-- Also ensure CAPITAL account exists
INSERT INTO public.internal_accounts (name, category, code, type, balance, is_system_account)
SELECT 'Capital', 'equity', 'CAPITAL', 'capital', 0, true
WHERE NOT EXISTS (SELECT 1 FROM public.internal_accounts WHERE code = 'CAPITAL');
