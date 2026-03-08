-- Core Tables Migration
-- Creates the fundamental tables for the loan management system
-- This migration addresses the missing core table definitions

-- Borrowers table
CREATE TABLE IF NOT EXISTS public.borrowers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    employment TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint on full_name as expected by schema.sql
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='borrowers_full_name_key') THEN
        ALTER TABLE public.borrowers ADD CONSTRAINT borrowers_full_name_key UNIQUE (full_name);
    END IF;
END $$;

-- Loans table
CREATE TABLE IF NOT EXISTS public.loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_no TEXT UNIQUE,
    borrower_id UUID NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
    officer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
    principal_amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,2) NOT NULL,
    interest_type TEXT NOT NULL CHECK (interest_type IN ('flat', 'reducing')),
    term_months INTEGER NOT NULL,
    disbursement_date DATE,
    monthly_installment DECIMAL(15,2),
    total_payable DECIMAL(15,2),
    principal_outstanding DECIMAL(15,2) DEFAULT 0,
    interest_outstanding DECIMAL(15,2) DEFAULT 0,
    penalty_outstanding DECIMAL(15,2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'completed', 'defaulted', 'pending', 'rejected', 'reassess')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Repayments table
CREATE TABLE IF NOT EXISTS public.repayments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    amount_paid DECIMAL(15,2) NOT NULL,
    principal_paid DECIMAL(15,2) DEFAULT 0,
    interest_paid DECIMAL(15,2) DEFAULT 0,
    penalty_paid DECIMAL(15,2) DEFAULT 0,
    overpayment DECIMAL(15,2) DEFAULT 0,
    payment_date DATE NOT NULL,
    recorded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
    idempotency_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loan notes table (referenced in atomic transactions)
CREATE TABLE IF NOT EXISTS public.loan_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on core tables
ALTER TABLE public.borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_notes ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies for core tables
-- Borrowers: Users can view borrowers they created or have access to
CREATE POLICY "Users can view borrowers" ON public.borrowers
FOR SELECT TO authenticated USING (
    created_by = auth.uid() OR
    get_auth_role() IN ('admin', 'ceo', 'loan_officer', 'hr')
);

CREATE POLICY "Users can create borrowers" ON public.borrowers
FOR INSERT TO authenticated WITH CHECK (
    get_auth_role() IN ('admin', 'ceo', 'loan_officer')
);

-- Loans: Officers can view their own loans, executives can view all
CREATE POLICY "Loan officers can view their loans" ON public.loans
FOR SELECT TO authenticated USING (
    officer_id = auth.uid() OR
    get_auth_role() IN ('admin', 'ceo', 'accountant', 'hr')
);

CREATE POLICY "Loan officers can create loans" ON public.loans
FOR INSERT TO authenticated WITH CHECK (
    get_auth_role() IN ('admin', 'ceo', 'loan_officer')
);

CREATE POLICY "Authorized users can update loans" ON public.loans
FOR UPDATE TO authenticated USING (
    officer_id = auth.uid() OR
    get_auth_role() IN ('admin', 'ceo', 'accountant')
);

-- Repayments: Similar access pattern to loans
CREATE POLICY "Users can view repayments" ON public.repayments
FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM loans l
        WHERE l.id = repayments.loan_id
        AND (l.officer_id = auth.uid() OR get_auth_role() IN ('admin', 'ceo', 'accountant', 'hr'))
    )
);

CREATE POLICY "Authorized users can create repayments" ON public.repayments
FOR INSERT TO authenticated WITH CHECK (
    get_auth_role() IN ('admin', 'ceo', 'loan_officer', 'accountant')
);

-- Loan notes: Similar to loans
CREATE POLICY "Users can view loan notes" ON public.loan_notes
FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM loans l
        WHERE l.id = loan_notes.loan_id
        AND (l.officer_id = auth.uid() OR get_auth_role() IN ('admin', 'ceo', 'accountant', 'hr'))
    )
);

CREATE POLICY "Authorized users can create loan notes" ON public.loan_notes
FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
        SELECT 1 FROM loans l
        WHERE l.id = loan_notes.loan_id
        AND (l.officer_id = auth.uid() OR get_auth_role() IN ('admin', 'ceo', 'loan_officer', 'accountant'))
    )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_borrowers_created_by ON borrowers(created_by);
CREATE INDEX IF NOT EXISTS idx_loans_borrower_id ON loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_officer_id ON loans(officer_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_reference_no ON loans(reference_no);
CREATE INDEX IF NOT EXISTS idx_repayments_loan_id ON repayments(loan_id);
CREATE INDEX IF NOT EXISTS idx_repayments_payment_date ON repayments(payment_date);
CREATE INDEX IF NOT EXISTS idx_loan_notes_loan_id ON loan_notes(loan_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_borrowers_updated_at BEFORE UPDATE ON borrowers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
