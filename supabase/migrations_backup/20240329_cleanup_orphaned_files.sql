-- Clean orphaned files from storage bucket
-- Files that exist in storage but not referenced in database tables

-- 1. Find orphaned files (view only, safe to run)
SELECT 
    so.name as storage_path,
    so.size,
    so.created_at,
    CASE 
        WHEN so.name LIKE 'system/%' THEN 'SYSTEM_DOCUMENT'
        WHEN so.name LIKE 'chat-attachments/%' THEN 'CHAT_ATTACHMENT'
        WHEN REGEXP_MATCHES(so.name, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/%') THEN 'LOAN_DOCUMENT'
        ELSE 'UNKNOWN'
    END as file_type,
    'ORPHANED' as status
FROM storage.objects so
WHERE so.bucket_id = 'loan-documents'
AND (
    -- Not in system_documents table
    (so.name LIKE 'system/%' AND NOT EXISTS (
        SELECT 1 FROM public.system_documents sd WHERE sd.storage_path = so.name
    ))
    OR
    -- Not in visitations table (loan_id/filename pattern)
    (REGEXP_MATCHES(so.name, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/%') 
     AND NOT EXISTS (
        SELECT 1 FROM public.visitations v WHERE v.image_path = so.name
    ))
    OR
    -- Not in loan_documents table (collateral images)
    (REGEXP_MATCHES(so.name, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/%') 
     AND NOT EXISTS (
        SELECT 1 FROM public.loan_documents ld WHERE ld.storage_path = so.name
    ))
    OR
    -- Not in messages (chat attachments)
    (so.name LIKE 'chat-attachments/%' AND NOT EXISTS (
        SELECT 1 FROM public.direct_messages dm WHERE dm.attachment_path = so.name
    ))
)
ORDER BY so.created_at DESC;

-- 2. Delete orphaned files (UNCOMMENT TO EXECUTE)
-- WARNING: This will permanently delete files from storage

/*
DELETE FROM storage.objects 
WHERE bucket_id = 'loan-documents'
AND (
    -- System documents not in database
    (name LIKE 'system/%' AND NOT EXISTS (
        SELECT 1 FROM public.system_documents sd WHERE sd.storage_path = storage.objects.name
    ))
    OR
    -- Visit images not in database
    (REGEXP_MATCHES(name, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/%') 
     AND NOT EXISTS (
        SELECT 1 FROM public.visitations v WHERE v.image_path = storage.objects.name
     ))
    OR
    -- Loan documents not in database
    (REGEXP_MATCHES(name, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/%') 
     AND NOT EXISTS (
        SELECT 1 FROM public.loan_documents ld WHERE ld.storage_path = storage.objects.name
     ))
    OR
    -- Chat attachments not in database
    (name LIKE 'chat-attachments/%' AND NOT EXISTS (
        SELECT 1 FROM public.direct_messages dm WHERE dm.attachment_path = storage.objects.name
    ))
);
*/

-- 3. Alternative: Delete specific file types by age
-- Example: Delete system documents older than 30 days that are orphaned
/*
DELETE FROM storage.objects 
WHERE bucket_id = 'loan-documents'
AND name LIKE 'system/%'
AND created_at < NOW() - INTERVAL '30 days'
AND NOT EXISTS (
    SELECT 1 FROM public.system_documents sd WHERE sd.storage_path = storage.objects.name
);
*/

-- 4. Check storage usage by folder type
SELECT 
    CASE 
        WHEN name LIKE 'system/%' THEN 'SYSTEM_DOCUMENTS'
        WHEN name LIKE 'chat-attachments/%' THEN 'CHAT_ATTACHMENTS'
        WHEN REGEXP_MATCHES(name, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/%') THEN 'LOAN_FILES'
        ELSE 'OTHER'
    END as folder_type,
    COUNT(*) as file_count,
    ROUND(SUM(size) / 1024 / 1024, 2) as size_mb
FROM storage.objects 
WHERE bucket_id = 'loan-documents'
GROUP BY folder_type
ORDER BY size_mb DESC;
