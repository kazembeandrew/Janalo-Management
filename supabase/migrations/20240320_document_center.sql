-- Create Document Categories Enum
DO $$ BEGIN
    CREATE TYPE document_category AS ENUM ('financial', 'hr', 'operational', 'general', 'template');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create System Documents Table
CREATE TABLE IF NOT EXISTS public.system_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    category document_category NOT NULL DEFAULT 'general',
    file_type TEXT,
    file_size BIGINT,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Document Permissions Table
CREATE TABLE IF NOT EXISTS public.document_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID REFERENCES public.system_documents(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'loan_officer', 'accountant', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(document_id, role)
);

-- Enable RLS
ALTER TABLE public.system_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_permissions ENABLE ROW LEVEL SECURITY;

-- Policies for system_documents
CREATE POLICY "Users can view documents they have access to" ON public.system_documents
FOR SELECT TO authenticated
USING (
    -- Admin and CEO see everything
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'ceo')
    OR 
    -- Uploader sees their own
    uploaded_by = auth.uid()
    OR
    -- Role-based access via permissions table
    EXISTS (
        SELECT 1 FROM public.document_permissions dp
        WHERE dp.document_id = public.system_documents.id
        AND dp.role = (SELECT role FROM public.users WHERE id = auth.uid())
    )
);

CREATE POLICY "Authorized roles can upload documents" ON public.system_documents
FOR INSERT TO authenticated
WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'ceo', 'hr', 'accountant')
    AND (
        -- Accountants can only upload financial docs
        (SELECT role FROM public.users WHERE id = auth.uid()) != 'accountant' 
        OR category = 'financial'
    )
);

CREATE POLICY "Admins and Uploaders can delete documents" ON public.system_documents
FOR DELETE TO authenticated
USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'ceo')
    OR uploaded_by = auth.uid()
);

-- Policies for document_permissions
CREATE POLICY "Admins and HR can manage permissions" ON public.document_permissions
FOR ALL TO authenticated
USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'ceo', 'hr'));

CREATE POLICY "Users can view permissions for accessible docs" ON public.document_permissions
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.system_documents sd
        WHERE sd.id = public.document_permissions.document_id
        -- Reuse the logic from the documents table select policy
    )
);