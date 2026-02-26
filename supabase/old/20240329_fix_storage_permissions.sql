-- Fix storage bucket using Supabase storage functions
-- Run this if you get permission errors with direct storage.objects access

-- 1. Create the bucket using storage.insert_bucket
SELECT storage.insert_bucket(
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
);

-- 2. Create RLS policies using storage.policies
-- View policy
SELECT storage.insert_policy(
    'loan-documents',
    'Staff can view loan documents',
    'SELECT',
    'authenticated',
    'bucket_id = \'loan-documents\' AND (get_auth_role() = ANY (ARRAY[\'admin\', \'ceo\', \'accountant\', \'hr\']) OR EXISTS (SELECT 1 FROM public.loans WHERE officer_id = auth.uid() AND id::text = storage.foldername(name)[1]))',
    NULL
);

-- Upload policy
SELECT storage.insert_policy(
    'loan-documents',
    'Staff can upload loan documents',
    'INSERT',
    'authenticated',
    'bucket_id = \'loan-documents\' AND get_auth_role() = ANY (ARRAY[\'admin\', \'ceo\', \'accountant\', \'hr\', \'loan_officer\'])',
    'bucket_id = \'loan-documents\' AND get_auth_role() = ANY (ARRAY[\'admin\', \'ceo\', \'accountant\', \'hr\', \'loan_officer\'])'
);

-- Delete policy
SELECT storage.insert_policy(
    'loan-documents',
    'Staff can delete loan documents',
    'DELETE',
    'authenticated',
    'bucket_id = \'loan-documents\' AND (get_auth_role() = ANY (ARRAY[\'admin\', \'ceo\']) OR owner = auth.uid())',
    NULL
);

-- Alternative: If the above doesn't work, try creating bucket via Dashboard
-- Go to Storage section in Supabase Dashboard and create bucket manually
-- Then run just the RLS policies below:

-- RLS policies for manually created bucket
DROP POLICY IF EXISTS "Staff can view loan documents" ON storage.objects;
CREATE POLICY "Staff can view loan documents" ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'loan-documents' AND (
        get_auth_role() = ANY (ARRAY['admin', 'ceo', 'accountant', 'hr'])
        OR EXISTS (SELECT 1 FROM public.loans WHERE officer_id = auth.uid() 
                   AND id::text = (storage.foldername(name))[1])
    )
);

DROP POLICY IF EXISTS "Staff can upload loan documents" ON storage.objects;
CREATE POLICY "Staff can upload loan documents" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'loan-documents' AND 
    get_auth_role() = ANY (ARRAY['admin', 'ceo', 'accountant', 'hr', 'loan_officer'])
);

DROP POLICY IF EXISTS "Staff can delete loan documents" ON storage.objects;
CREATE POLICY "Staff can delete loan documents" ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'loan-documents' AND (
        get_auth_role() = ANY (ARRAY['admin', 'ceo']) OR owner = auth.uid()
    )
);
