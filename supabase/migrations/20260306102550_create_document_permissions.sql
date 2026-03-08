-- Create document_permissions table (referenced in system_documents policies but not created)
CREATE TABLE IF NOT EXISTS public.document_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.system_documents(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    can_view BOOLEAN NOT NULL DEFAULT true,
    can_edit BOOLEAN NOT NULL DEFAULT false,
    can_delete BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.document_permissions ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_permissions_document_id ON public.document_permissions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_permissions_role ON public.document_permissions(role);

-- RLS Policies
CREATE POLICY "Users can view permissions for accessible docs" ON public.document_permissions
FOR SELECT TO authenticated USING (
    role = get_auth_role()
    OR
    get_auth_role() IN ('admin', 'ceo', 'hr')
);

CREATE POLICY "Admins can manage document permissions" ON public.document_permissions
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'hr'));
