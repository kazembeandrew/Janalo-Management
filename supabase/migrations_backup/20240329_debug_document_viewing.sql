-- Debug document viewing issues
-- Check if files exist and if URLs are accessible

-- 1. Check if system_documents table has records
SELECT 
    id,
    name,
    storage_path,
    file_type,
    file_size,
    created_at,
    uploaded_by
FROM public.system_documents
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check if storage objects exist for these paths
SELECT 
    name,
    created_at,
    updated_at,
    etag
FROM storage.objects
WHERE bucket_id = 'loan-documents'
AND name LIKE 'system/%'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Test public URL generation (run this in browser console)
-- This is what the app does:
-- const { data } = supabase.storage.from('loan-documents').getPublicUrl('system/1234567890_filename.pdf');

-- 4. Check RLS policies on storage.objects
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage';

-- 5. Check if bucket exists and is accessible
SELECT 
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types,
    created_at
FROM storage.buckets 
WHERE id = 'loan-documents';

-- 6. Test URL access manually
-- After running the query above, try accessing URLs like:
-- https://[PROJECT_REF].supabase.co/storage/v1/object/public/loan-documents/system/[filename]

-- 7. Alternative: Use signed URLs instead of public URLs
-- This bypasses RLS issues
SELECT storage.create_signed_url(
    'loan-documents',
    'system/example.pdf',
    3600  -- 1 hour expiry
);

-- 8. Check storage usage by folder
SELECT 
    CASE 
        WHEN name LIKE 'system/%' THEN 'SYSTEM_DOCUMENTS'
        WHEN name LIKE 'chat-attachments/%' THEN 'CHAT_ATTACHMENTS'
        WHEN name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' THEN 'LOAN_FILES'
        ELSE 'OTHER'
    END as folder_type,
    COUNT(*) as file_count
FROM storage.objects 
WHERE bucket_id = 'loan-documents'
GROUP BY folder_type;
