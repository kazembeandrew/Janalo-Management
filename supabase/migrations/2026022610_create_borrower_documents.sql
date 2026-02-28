-- Create borrower_documents table for storing loan application documents
CREATE TABLE IF NOT EXISTS public.borrower_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    borrower_id UUID REFERENCES public.borrowers(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'id_card', 'guarantor', 'collateral'
    file_name VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    uploaded_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.borrower_documents ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_borrower_documents_borrower_id ON public.borrower_documents(borrower_id);
CREATE INDEX IF NOT EXISTS idx_borrower_documents_type ON public.borrower_documents(type);

-- RLS Policies
-- Admin and CEO can access all borrower documents
CREATE POLICY "Admin and CEO access borrower documents" ON public.borrower_documents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid()
            AND public.users.role IN ('admin', 'ceo')
        )
    );

-- Loan officers can access documents for borrowers they manage
CREATE POLICY "Loan officers access own borrower documents" ON public.borrower_documents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.borrowers b
            WHERE b.id = borrower_documents.borrower_id
            AND (
                b.created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.loans l
                    WHERE l.borrower_id = b.id
                    AND l.officer_id = auth.uid()
                )
            )
        )
    );
