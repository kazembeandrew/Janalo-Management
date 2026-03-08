-- Phase 2: Enhanced Security & RBAC Implementation
-- Add proper permissions system for granular access control

-- 1. Create permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource VARCHAR(100) NOT NULL, -- accounts, journal_entries, reports, users
    action VARCHAR(50) NOT NULL,    -- create, read, update, delete, approve, post, void
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(resource, action)
);

-- 2. Create roles table (if not exists)
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create role_permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
    organization_id UUID, -- For future multi-tenant support
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, role_id)
);

-- 5. Enable RLS on new tables
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for permissions table
CREATE POLICY "Admins can manage permissions" ON public.permissions
    FOR ALL TO authenticated
    USING (get_auth_role() IN ('admin', 'ceo'));

-- 7. RLS Policies for role_permissions table
CREATE POLICY "Admins can manage role permissions" ON public.role_permissions
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'ceo')
        )
    );

-- 8. RLS Policies for roles table
CREATE POLICY "Admins can manage roles" ON public.roles
    FOR ALL TO authenticated
    USING (get_auth_role() IN ('admin', 'ceo'));

-- 9. RLS Policies for user_roles table
CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all user roles" ON public.user_roles
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'ceo')
        )
    );

-- 10. Insert default roles
INSERT INTO public.roles (name, description, is_system_role) VALUES
    ('admin', 'Full system access and user management', true),
    ('ceo', 'Executive access to all financial data', true),
    ('accountant', 'Can create and approve journal entries', true),
    ('hr', 'Human resources access', true),
    ('viewer', 'Read-only access to reports', true)
ON CONFLICT (name) DO NOTHING;

-- 11. Insert default permissions
INSERT INTO public.permissions (resource, action, description) VALUES
    -- Account permissions
    ('accounts', 'create', 'Create new accounts'),
    ('accounts', 'read', 'View account information'),
    ('accounts', 'update', 'Modify account details'),
    ('accounts', 'delete', 'Delete accounts'),

    -- Journal entry permissions
    ('journal_entries', 'create', 'Create draft journal entries'),
    ('journal_entries', 'read', 'View journal entries'),
    ('journal_entries', 'update', 'Edit draft journal entries'),
    ('journal_entries', 'delete', 'Delete draft journal entries'),
    ('journal_entries', 'post', 'Post draft entries'),
    ('journal_entries', 'approve', 'Approve journal entries'),
    ('journal_entries', 'void', 'Void posted entries'),

    -- Report permissions
    ('reports', 'read', 'View financial reports'),
    ('reports', 'generate', 'Generate custom reports'),

    -- User management permissions
    ('users', 'create', 'Create new users'),
    ('users', 'read', 'View user information'),
    ('users', 'update', 'Modify user details'),
    ('users', 'delete', 'Delete users'),
    ('users', 'manage_roles', 'Assign/remove user roles'),

    -- Audit permissions
    ('audit_logs', 'read', 'View audit logs'),
    ('audit_logs', 'export', 'Export audit data')
ON CONFLICT (resource, action) DO NOTHING;

-- 12. Assign default permissions to roles
-- Admin role gets all permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- CEO role gets most permissions except user management
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.resource IN ('accounts', 'journal_entries', 'reports', 'audit_logs')
WHERE r.name = 'ceo'
ON CONFLICT DO NOTHING;

-- Accountant role gets accounting permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.resource IN ('accounts', 'journal_entries', 'reports')
WHERE r.name = 'accountant'
ON CONFLICT DO NOTHING;

-- Viewer role gets read-only permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.action = 'read' AND p.resource IN ('accounts', 'journal_entries', 'reports')
WHERE r.name = 'viewer'
ON CONFLICT DO NOTHING;

-- 13. Create function to get user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(user_id UUID)
RETURNS TABLE (
    resource TEXT,
    action TEXT,
    description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        p.resource,
        p.action,
        p.description
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Create function to check user permission
CREATE OR REPLACE FUNCTION has_permission(user_id UUID, resource_name TEXT, action_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON ur.role_id = rp.role_id
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = user_id
        AND p.resource = resource_name
        AND p.action = action_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Grant permissions
GRANT EXECUTE ON FUNCTION get_user_permissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_permission(UUID, TEXT, TEXT) TO authenticated;
