-- ============================================================================
-- RLS POLICY FIX FOR UPLOAD FUNCTIONALITY
-- Fixes: "new row violates row-level security policy" error
-- ============================================================================
-- Execute this in Supabase SQL Editor to fix the upload issue
-- ============================================================================

-- ============================================================================
-- STEP 1: Drop existing incorrect policies for system_documents
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage system documents" ON public.system_documents;

-- ============================================================================
-- STEP 2: Create proper RLS policies for system_documents
-- ============================================================================

-- SELECT: Any authenticated user can view system documents
CREATE POLICY "Authenticated users can view system documents" 
ON public.system_documents
FOR SELECT TO authenticated USING (true);

-- INSERT: Allow staff roles (hr, accountant, loan_officer) plus admin/ceo to upload
-- This matches the frontend logic: canUpload = isCEO || isHR || isAccountant || isOfficer
CREATE POLICY "Staff can insert system documents" 
ON public.system_documents
FOR INSERT TO authenticated WITH CHECK (
    get_auth_role() IN ('admin', 'ceo', 'hr', 'accountant', 'loan_officer')
);

-- UPDATE: Allow admins/ceo or the original uploader to update
CREATE POLICY "Admins and owner can update system documents" 
ON public.system_documents
FOR UPDATE TO authenticated USING (
    get_auth_role() IN ('admin', 'ceo') OR 
    uploaded_by = auth.uid()
);

-- DELETE: Only admins/ceo can delete system documents
CREATE POLICY "Admins can delete system documents" 
ON public.system_documents
FOR DELETE TO authenticated USING (
    get_auth_role() IN ('admin', 'ceo')
);

-- ============================================================================
-- STEP 3: Verify the policies were created correctly
-- ============================================================================

SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'system_documents';

-- ============================================================================
-- STEP 4: Test upload capability
-- ============================================================================

-- This will show which roles can currently perform inserts
SELECT 
    'TEST_RESULT' AS test_type,
    (SELECT COUNT(*) FROM public.system_documents) AS current_docs_count,
    'POLICIES_UPDATED' AS status;
