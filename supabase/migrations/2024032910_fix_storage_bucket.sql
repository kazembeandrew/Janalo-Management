-- Fix missing loan-documents storage bucket
-- Run this if you get "Bucket not found" error

-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'loan-documents',
    'loan-documents',
    false,
    52428800,  -- 50MB limit
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
    ]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS on storage.objects (if not already)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Staff can view loan documents" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload loan documents" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete loan documents" ON storage.objects;

-- 4. Create SELECT policy - who can view/download files
CREATE POLICY "Staff can view loan documents"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'loan-documents' AND (
        -- Admins, CEO, Accountants, HR can view all
        get_auth_role() = ANY (ARRAY['admin', 'ceo', 'accountant', 'hr'])
        OR 
        -- Loan officers can see documents for loans they manage
        EXISTS (
            SELECT 1 FROM public.loans 
            WHERE officer_id = auth.uid() 
            AND id::text = (storage.foldername(name))[1]
        )
    )
);

-- 5. Create INSERT policy - who can upload files
CREATE POLICY "Staff can upload loan documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'loan-documents' AND (
        get_auth_role() = ANY (ARRAY['admin', 'ceo', 'accountant', 'hr', 'loan_officer'])
    )
);

-- 6. Create DELETE policy - who can delete files
CREATE POLICY "Staff can delete loan documents"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'loan-documents' AND (
        -- Admins and CEO can delete any
        get_auth_role() = ANY (ARRAY['admin', 'ceo'])
        OR
        -- Others can only delete their own uploads
        owner = auth.uid()
    )
);

-- 7. Fix system_documents table FK if needed
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'system_documents_uploaded_by_fkey'
    ) THEN
        ALTER TABLE public.system_documents 
        ADD CONSTRAINT system_documents_uploaded_by_fkey 
        FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;
