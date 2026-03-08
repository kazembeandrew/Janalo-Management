-- Create loan_documents table (referenced in realtime migration but not created)
CREATE TABLE IF NOT EXISTS public.loan_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'application_form', 'contract', 'id_proof', etc.
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
CREATE POLICY "Users can view loan documents for accessible loans" ON public.loan_documents
FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.loans l
        WHERE l.id = loan_documents.loan_id
        AND (l.officer_id = auth.uid() OR get_auth_role() IN ('admin', 'ceo', 'accountant', 'hr'))
    )
);

CREATE POLICY "Staff can manage loan documents" ON public.loan_documents
FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.loans l
        WHERE l.id = loan_documents.loan_id
        AND (l.officer_id = auth.uid() OR get_auth_role() IN ('admin', 'ceo', 'accountant', 'loan_officer', 'hr'))
    )
);
