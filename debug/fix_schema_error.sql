-- FIX SCHEMA CREATION ERROR
-- The existing internal_accounts table has a different structure
-- Execute this first to fix the table structure

-- ============================================================================
-- 1. BACKUP EXISTING DATA
-- ============================================================================

CREATE TABLE IF NOT EXISTS internal_accounts_backup AS
SELECT * FROM public.internal_accounts;

-- ============================================================================
-- 2. DROP EXISTING TABLE AND RECREATE
-- ============================================================================

-- Drop all dependent objects first
DROP TRIGGER IF EXISTS trg_update_account_balance ON public.journal_lines;
DROP TRIGGER IF EXISTS trg_reverse_account_balance ON public.journal_lines;
DROP FUNCTION IF EXISTS public.update_account_balance_from_journal();
DROP FUNCTION IF EXISTS public.reverse_account_balance_from_journal();

-- Drop the table
DROP TABLE IF EXISTS public.internal_accounts CASCADE;

-- ============================================================================
-- 3. RECREATE TABLE WITH CORRECT STRUCTURE
-- ============================================================================

CREATE TABLE public.internal_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    account_category TEXT NOT NULL CHECK (account_category IN ('asset', 'liability', 'equity', 'income', 'expense')),
    account_code TEXT UNIQUE NOT NULL,
    parent_id UUID REFERENCES public.internal_accounts(id) ON DELETE CASCADE,
    account_number_display TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    balance DECIMAL(15,2) DEFAULT 0,
    is_system_account BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. RESTORE SYSTEM ACCOUNTS
-- ============================================================================

INSERT INTO public.internal_accounts (name, account_category, account_code, is_system_account) VALUES
('Cash on Hand', 'asset', 'CASH', true),
('Bank Account', 'asset', 'BANK', true),
('Mobile Money', 'asset', 'MOBILE', true),
('Loan Portfolio', 'asset', 'PORTFOLIO', true),
('Share Capital', 'equity', 'CAPITAL', true),
('Retained Earnings', 'equity', 'EQUITY', true),
('Interest Income', 'income', 'INTEREST_INCOME', true),
('Operational Expenses', 'expense', 'OPERATIONAL', true)
ON CONFLICT (account_code) DO NOTHING;

-- ============================================================================
-- 5. RECREATE FUNCTIONS AND TRIGGERS
-- ============================================================================

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

CREATE OR REPLACE FUNCTION public.reverse_account_balance_from_journal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Recreate triggers
CREATE TRIGGER trg_update_account_balance
AFTER INSERT OR UPDATE ON public.journal_lines
FOR EACH ROW EXECUTE FUNCTION public.update_account_balance_from_journal();

CREATE TRIGGER trg_reverse_account_balance
AFTER DELETE ON public.journal_lines
FOR EACH ROW EXECUTE FUNCTION public.reverse_account_balance_from_journal();

-- ============================================================================
-- 6. RESTORE PERMISSIONS AND POLICIES
-- ============================================================================

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.update_account_balance_from_journal() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_account_balance_from_journal() TO authenticated;

-- Enable RLS
ALTER TABLE public.internal_accounts ENABLE ROW LEVEL SECURITY;

-- Recreate policies
CREATE POLICY "Accountants and executives can view accounts" ON public.internal_accounts
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

CREATE POLICY "Accountants can manage accounts" ON public.internal_accounts
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

-- ============================================================================
-- 7. VERIFY FIX
-- ============================================================================

SELECT
    'AFTER_FIX' as status,
    account_code,
    name,
    account_category,
    balance
FROM public.internal_accounts
ORDER BY account_code;

-- ============================================================================
-- CLEANUP (Optional - run after verification)
-- ============================================================================

-- DROP TABLE IF EXISTS internal_accounts_backup;
