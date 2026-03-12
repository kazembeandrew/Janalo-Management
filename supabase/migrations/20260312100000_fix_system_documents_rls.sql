-- Migration: Fix system_documents RLS policies for upload functionality
-- Date: 2026-03-12
-- Fixes: "new row violates row-level security policy" error during document upload

BEGIN;

-- Drop existing incorrect policy for system_documents
DROP POLICY IF EXISTS "Admins can manage system documents" ON public.system_documents;

-- Create proper RLS policies for system_documents

-- SELECT: Any authenticated user can view system documents
CREATE POLICY "Authenticated users can view system documents" 
ON public.system_documents
FOR SELECT TO authenticated USING (true);

-- INSERT: Allow staff roles (hr, accountant, loan_officer) plus admin/ceo to upload
CREATE POLICY "Staff can insert system documents" 
ON public.system_documents
FOR INSERT TO authenticated WITH CHECK (
    get_auth_role() IN ('admin', 'ceo', 'hr', 'accountant', 'loan_officer')
);

-- UPDATE: Allow admins/ceo or the original uploader to update
CREATE POLICY "Admins and owner can update system documents" 
ON public.system_documents
FOR UPDATE TO authenticated USING (
    get_auth_role() IN ('admin', 'ceo') OR uploaded_by = auth.uid()
);

-- DELETE: Only admins/ceo can delete system documents
CREATE POLICY "Admins can delete system documents" 
ON public.system_documents
FOR DELETE TO authenticated USING (get_auth_role() IN ('admin', 'ceo'));

COMMIT;
