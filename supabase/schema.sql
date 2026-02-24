-- JANALO ENTERPRISES - ROBUST DATABASE SCHEMA

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Enums (Safe Creation)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('admin', 'ceo', 'loan_officer', 'hr', 'accountant');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interest_type') THEN
        CREATE TYPE public.interest_type AS ENUM ('flat', 'reducing');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loan_status') THEN
        CREATE TYPE public.loan_status AS ENUM ('active', 'completed', 'defaulted', 'pending', 'rejected', 'reassess');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_status') THEN
        CREATE TYPE public.approval_status AS ENUM ('pending_approval', 'approved', 'rejected');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_category') THEN
        CREATE TYPE public.document_category AS ENUM ('financial', 'hr', 'operational', 'general', 'template', 'loan_application');
    ELSE
        -- Ensure 'loan_application' exists in the existing type
        ALTER TYPE public.document_category ADD VALUE IF NOT EXISTS 'loan_application';
    END IF;
END $$;

-- 3. Tables (Safe Creation)

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    full_name TEXT,
    role public.user_role DEFAULT 'loan_officer',
    is_active BOOLEAN DEFAULT true,
    deletion_status TEXT DEFAULT 'none',
    delegated_role public.user_role,
    delegation_start TIMESTAMP WITH TIME ZONE,
    delegation_end TIMESTAMP WITH TIME ZONE,
    revocation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.borrowers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    employment TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_no TEXT UNIQUE,
    borrower_id UUID REFERENCES public.borrowers(id) ON DELETE CASCADE,
    officer_id UUID REFERENCES public.users(id),
    principal_amount NUMERIC NOT NULL,
    interest_rate NUMERIC NOT NULL,
    interest_type public.interest_type DEFAULT 'flat',
    term_months INTEGER NOT NULL,
    disbursement_date DATE NOT NULL,
    monthly_installment NUMERIC,
    total_payable NUMERIC,
    principal_outstanding NUMERIC,
    interest_outstanding NUMERIC,
    penalty_outstanding NUMERIC DEFAULT 0,
    status public.loan_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.repayments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE,
    amount_paid NUMERIC NOT NULL,
    principal_paid NUMERIC DEFAULT 0,
    interest_paid NUMERIC DEFAULT 0,
    penalty_paid NUMERIC DEFAULT 0,
    payment_date DATE DEFAULT CURRENT_DATE,
    recorded_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.internal_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    account_category TEXT NOT NULL,
    account_code TEXT NOT NULL,
    balance NUMERIC DEFAULT 0,
    account_number TEXT,
    bank_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_type TEXT NOT NULL,
    reference_id UUID,
    date DATE DEFAULT CURRENT_DATE,
    description TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.journal_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.internal_accounts(id),
    debit NUMERIC DEFAULT 0,
    credit NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    category public.document_category DEFAULT 'general',
    file_type TEXT,
    file_size BIGINT,
    uploaded_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.document_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.system_documents(id) ON DELETE CASCADE,
    role public.user_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES public.users(id),
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending_approval',
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id),
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. Triggers & Functions
CREATE OR REPLACE FUNCTION public.update_account_balance_from_journal()
RETURNS trigger AS $$
DECLARE
  v_category text;
BEGIN
  SELECT account_category INTO v_category FROM public.internal_accounts WHERE id = NEW.account_id;
  IF v_category IN ('asset', 'expense') THEN
    UPDATE public.internal_accounts SET balance = balance + (NEW.debit - NEW.credit), updated_at = NOW() WHERE id = NEW.account_id;
  ELSIF v_category IN ('liability', 'equity', 'income') THEN
    UPDATE public.internal_accounts SET balance = balance + (NEW.credit - NEW.debit), updated_at = NOW() WHERE id = NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_journal_line_insert ON public.journal_lines;
CREATE TRIGGER on_journal_line_insert
AFTER INSERT ON public.journal_lines
FOR EACH ROW EXECUTE FUNCTION public.update_account_balance_from_journal();