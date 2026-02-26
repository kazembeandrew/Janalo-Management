DROP POLICY IF EXISTS "Users can view documents they have access to" ON public.system_documents;

CREATE POLICY "Users can view documents they have access to" ON public.system_documents
FOR SELECT TO authenticated
USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','ceo')
    OR uploaded_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.document_permissions dp
        WHERE dp.document_id = public.system_documents.id
        AND dp.role = (SELECT role FROM public.users WHERE id = auth.uid())
    )
);