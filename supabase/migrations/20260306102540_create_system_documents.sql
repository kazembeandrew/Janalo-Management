-- Create system_documents table (referenced in RLS migration but not created)
CREATE TABLE IF NOT EXISTS public.system_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('financial', 'hr', 'operational', 'general', 'template', 'loan_application')),
    file_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.system_documents ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_documents_category ON public.system_documents(category);
CREATE INDEX IF NOT EXISTS idx_system_documents_uploaded_by ON public.system_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_system_documents_created_at ON public.system_documents(created_at);

-- RLS Policies
CREATE POLICY "Users can view documents they have access to" ON public.system_documents
FOR SELECT TO authenticated USING (
    uploaded_by = auth.uid() OR
    get_auth_role() IN ('admin', 'ceo') OR
    EXISTS (
        SELECT 1 FROM document_permissions dp
        WHERE dp.document_id = id
        AND dp.role = get_auth_role()
    )
);

CREATE POLICY "Staff can upload documents" ON public.system_documents
FOR INSERT TO authenticated WITH CHECK (get_auth_role() IN ('admin', 'ceo', 'accountant', 'hr', 'loan_officer'));

CREATE POLICY "Staff can update their own documents" ON public.system_documents
FOR UPDATE TO authenticated USING (
    uploaded_by = auth.uid() OR
    get_auth_role() IN ('admin', 'ceo')
);
