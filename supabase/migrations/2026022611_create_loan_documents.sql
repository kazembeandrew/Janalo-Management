-- Create loan_documents table for storing post-approval loan documents
CREATE TABLE IF NOT EXISTS public.loan_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'application_form', etc.
    file_name VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    uploaded_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.loan_documents ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_loan_documents_loan_id ON public.loan_documents(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_documents_type ON public.loan_documents(type);

-- RLS Policies
-- Admin and CEO can access all loan documents
CREATE POLICY "Admin and CEO access loan documents" ON public.loan_documents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid()
            AND public.users.role IN ('admin', 'ceo')
        )
    );

-- Loan officers can access documents for loans they manage
CREATE POLICY "Loan officers access loan documents" ON public.loan_documents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.loans l
            WHERE l.id = loan_documents.loan_id
            AND l.officer_id = auth.uid()
        )
    );

-- Accountants can access loan documents
CREATE POLICY "Accountants access loan documents" ON public.loan_documents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid()
            AND public.users.role = 'accountant'
        )
    );
