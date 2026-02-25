-- JANALO ENTERPRISES - DATABASE SCHEMA UPDATES

-- 1. Ensure reference_no exists on loans table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='reference_no') THEN
        ALTER TABLE public.loans ADD COLUMN reference_no TEXT UNIQUE;
    END IF;
END $$;

-- 2. Ensure full_name is unique on borrowers
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='borrowers_full_name_key') THEN
        ALTER TABLE public.borrowers ADD CONSTRAINT borrowers_full_name_key UNIQUE (full_name);
    END IF;
END $$;

-- 3. Visitation Table (if missing)
CREATE TABLE IF NOT EXISTS public.visitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE,
    officer_id UUID REFERENCES public.users(id),
    visit_date DATE DEFAULT CURRENT_DATE,
    notes TEXT NOT NULL,
    location_lat NUMERIC,
    location_long NUMERIC,
    image_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.visitations ENABLE ROW LEVEL SECURITY;

-- Policies for visitations
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'View Visitations') THEN
        CREATE POLICY "View Visitations" ON visitations FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Create Visitations') THEN
        CREATE POLICY "Create Visitations" ON visitations FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
END $$;

-- 4. Fix infinite recursion in document_permissions RLS policy
-- Drop the recursive policy and create non-recursive version
DROP POLICY IF EXISTS "Users can view permissions for accessible docs" ON public.document_permissions;
CREATE POLICY "Users can view permissions for accessible docs" ON public.document_permissions
FOR SELECT TO authenticated
USING (
    role = get_auth_role()
    OR 
    get_auth_role() IN ('admin', 'ceo', 'hr')
);

-- Fix system_documents policy to prevent recursion
DROP POLICY IF EXISTS "Users can view documents they have access to" ON public.system_documents;
CREATE POLICY "Users can view documents they have access to" ON public.system_documents
FOR SELECT TO authenticated 
USING (
    uploaded_by = auth.uid() OR 
    get_auth_role() IN ('admin', 'ceo') OR
    EXISTS (
        SELECT 1 FROM document_permissions dp 
        WHERE dp.document_id = id 
        AND dp.role = get_auth_role()
    )
);

ALTER TABLE public.document_permissions FORCE ROW LEVEL SECURITY;

-- 5. Fix missing loan-documents storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('loan-documents', 'loan-documents', false, 52428800,
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
          'application/vnd.ms-excel', 'text/csv'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
DROP POLICY IF EXISTS "Staff can view loan documents" ON storage.objects;
CREATE POLICY "Staff can view loan documents" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'loan-documents' AND (
    get_auth_role() = ANY (ARRAY['admin', 'ceo', 'accountant', 'hr'])
    OR EXISTS (SELECT 1 FROM public.loans WHERE officer_id = auth.uid() 
               AND id::text = (storage.foldername(name))[1])));

DROP POLICY IF EXISTS "Staff can upload loan documents" ON storage.objects;
CREATE POLICY "Staff can upload loan documents" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'loan-documents' AND 
    get_auth_role() = ANY (ARRAY['admin', 'ceo', 'accountant', 'hr', 'loan_officer']));

DROP POLICY IF EXISTS "Staff can delete loan documents" ON storage.objects;
CREATE POLICY "Staff can delete loan documents" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'loan-documents' AND (
    get_auth_role() = ANY (ARRAY['admin', 'ceo']) OR owner = auth.uid()));