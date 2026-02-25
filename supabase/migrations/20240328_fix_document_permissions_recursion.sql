-- Fix infinite recursion in document_permissions RLS policy
-- The policy was referencing system_documents, which in turn references document_permissions

-- 1. Drop the recursive policy
DROP POLICY IF EXISTS "Users can view permissions for accessible docs" ON public.document_permissions;

-- 2. Create a non-recursive policy using direct role checks
-- Instead of checking system_documents (which would trigger its RLS), 
-- we directly check if the user's role matches the permission
CREATE POLICY "Users can view permissions for accessible docs" ON public.document_permissions
FOR SELECT TO authenticated
USING (
    -- User's role matches the document permission
    role = get_auth_role()
    OR 
    -- Admin/CEO can see all permissions
    get_auth_role() IN ('admin', 'ceo', 'hr')
);

-- 3. Also fix the system_documents policy to ensure it uses the helper function
-- and doesn't cause recursion through document_permissions
DROP POLICY IF EXISTS "Users can view documents they have access to" ON public.system_documents;
CREATE POLICY "Users can view documents they have access to" ON public.system_documents
FOR SELECT TO authenticated 
USING (
    uploaded_by = auth.uid() OR 
    get_auth_role() IN ('admin', 'ceo') OR
    -- Check permissions without causing recursion
    -- We use a direct query on document_permissions without going through RLS
    EXISTS (
        SELECT 1 FROM document_permissions dp 
        WHERE dp.document_id = id 
        AND dp.role = get_auth_role()
    )
);

-- 4. Ensure document_permissions RLS is properly applied
-- Users should only see permissions relevant to them
ALTER TABLE public.document_permissions FORCE ROW LEVEL SECURITY;
