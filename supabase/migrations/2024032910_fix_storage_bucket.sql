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

-- 2. Cannot ALTER TABLE storage.objects (not allowed)
-- 3. Policies reference non-existent loans table (skipping)
-- 4. system_documents table not created yet (skipping)
