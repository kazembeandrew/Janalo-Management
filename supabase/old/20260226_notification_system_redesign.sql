-- ============================================================================
-- NOTIFICATION SYSTEM REDESIGN - FULL SCHEMA UPGRADE
-- ============================================================================
-- This migration completely redesigns the notification system with:
-- 1. Enhanced notification fields (priority, category, actions, expiry)
-- 2. User notification preferences
-- 3. Notification templates for system notifications
-- 4. Improved RLS policies
-- 5. Helper functions for notification management
-- ============================================================================

-- ============================================================================
-- 1. ENHANCE NOTIFICATIONS TABLE
-- ============================================================================

-- Add new columns if they don't exist
DO $$
BEGIN
    -- Priority column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='notifications' AND column_name='priority') THEN
        ALTER TABLE public.notifications ADD COLUMN priority TEXT DEFAULT 'normal' 
            CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
    END IF;

    -- Category column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='notifications' AND column_name='category') THEN
        ALTER TABLE public.notifications ADD COLUMN category TEXT DEFAULT 'general' 
            CHECK (category IN ('system', 'loan', 'repayment', 'expense', 'task', 'message', 'security', 'general'));
    END IF;

    -- Actions JSON column for interactive buttons
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='notifications' AND column_name='actions') THEN
        ALTER TABLE public.notifications ADD COLUMN actions JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- Read at timestamp (more precise than boolean)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='notifications' AND column_name='read_at') THEN
        ALTER TABLE public.notifications ADD COLUMN read_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Archived flag
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='notifications' AND column_name='is_archived') THEN
        ALTER TABLE public.notifications ADD COLUMN is_archived BOOLEAN DEFAULT false;
    END IF;

    -- Expires at for time-sensitive notifications
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='notifications' AND column_name='expires_at') THEN
        ALTER TABLE public.notifications ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Sender information
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='notifications' AND column_name='sender_id') THEN
        ALTER TABLE public.notifications ADD COLUMN sender_id UUID REFERENCES public.users(id);
    END IF;

    -- Related entity for context
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='notifications' AND column_name='related_entity_type') THEN
        ALTER TABLE public.notifications ADD COLUMN related_entity_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='notifications' AND column_name='related_entity_id') THEN
        ALTER TABLE public.notifications ADD COLUMN related_entity_id UUID;
    END IF;
END $$;

-- Migrate existing is_read data to read_at
UPDATE public.notifications 
SET read_at = created_at 
WHERE is_read = true AND read_at IS NULL;

-- ============================================================================
-- 2. CREATE NOTIFICATION PREFERENCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Channel preferences
    email_enabled BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    in_app_enabled BOOLEAN DEFAULT true,
    
    -- Category preferences (JSON for flexibility)
    category_preferences JSONB DEFAULT '{
        "system": {"in_app": true, "email": true, "push": true},
        "loan": {"in_app": true, "email": true, "push": true},
        "repayment": {"in_app": true, "email": true, "push": true},
        "expense": {"in_app": true, "email": true, "push": true},
        "task": {"in_app": true, "email": true, "push": true},
        "message": {"in_app": true, "email": true, "push": true},
        "security": {"in_app": true, "email": true, "push": true},
        "general": {"in_app": true, "email": true, "push": true}
    }'::jsonb,
    
    -- Quiet hours
    quiet_hours_enabled BOOLEAN DEFAULT false,
    quiet_hours_start TIME DEFAULT '22:00',
    quiet_hours_end TIME DEFAULT '08:00',
    
    -- Digest preferences
    digest_enabled BOOLEAN DEFAULT false,
    digest_frequency TEXT DEFAULT 'daily' CHECK (digest_frequency IN ('hourly', 'daily', 'weekly')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Enable RLS on preferences
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. CREATE NOTIFICATION TEMPLATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL, -- e.g., 'loan_approved', 'repayment_received'
    name TEXT NOT NULL,
    description TEXT,
    
    -- Template content
    title_template TEXT NOT NULL, -- Can use {{variables}}
    message_template TEXT NOT NULL,
    
    -- Default settings
    default_priority TEXT DEFAULT 'normal' CHECK (default_priority IN ('low', 'normal', 'high', 'urgent')),
    default_category TEXT DEFAULT 'general' CHECK (default_category IN ('system', 'loan', 'repayment', 'expense', 'task', 'message', 'security', 'general')),
    default_actions JSONB DEFAULT '[]'::jsonb,
    
    -- Template variables schema for validation
    variables_schema JSONB DEFAULT '{}'::jsonb,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on templates (admin only)
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

-- Insert default templates
INSERT INTO public.notification_templates (code, name, description, title_template, message_template, default_priority, default_category, default_actions) VALUES
('loan_approved', 'Loan Approved', 'Sent when a loan is approved', 
 'Loan Approved: {{borrower_name}}', 
 'The loan application for {{borrower_name}} has been approved for {{amount}}.',
 'high', 'loan', '[{"label": "View Loan", "action": "view_loan", "url": "/loans/{{loan_id}}"}]'::jsonb),

('repayment_received', 'Repayment Received', 'Sent when a repayment is recorded',
 'Repayment Received: {{amount}}',
 'A repayment of {{amount}} has been received from {{borrower_name}}.',
 'normal', 'repayment', '[{"label": "View Details", "action": "view_repayment", "url": "/loans/{{loan_id}}"}]'::jsonb),

('task_assigned', 'Task Assigned', 'Sent when a task is assigned to user',
 'New Task: {{task_title}}',
 'You have been assigned a new task: "{{task_title}}". Due: {{due_date}}',
 'normal', 'task', '[{"label": "View Task", "action": "view_task", "url": "/tasks"}]'::jsonb),

('expense_approved', 'Expense Approved', 'Sent when an expense is approved',
 'Expense Approved: {{description}}',
 'Your expense request for "{{description}}" ({{amount}}) has been approved.',
 'normal', 'expense', '[{"label": "View Expense", "action": "view_expense", "url": "/expenses"}]'::jsonb),

('security_alert', 'Security Alert', 'Sent for security-related events',
 'Security Alert: {{alert_type}}',
 '{{message}}',
 'urgent', 'security', '[{"label": "Review", "action": "review_security", "url": "/settings"}]'::jsonb),

('system_maintenance', 'System Maintenance', 'Sent for scheduled maintenance',
 'Scheduled Maintenance: {{maintenance_type}}',
 'The system will undergo {{maintenance_type}} maintenance on {{scheduled_date}}. Expected downtime: {{duration}}.',
 'low', 'system', '[]'::jsonb)

ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 4. CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to create notification from template
CREATE OR REPLACE FUNCTION public.create_notification_from_template(
    p_template_code TEXT,
    p_user_id UUID,
    p_variables JSONB DEFAULT '{}'::jsonb,
    p_sender_id UUID DEFAULT NULL,
    p_related_entity_type TEXT DEFAULT NULL,
    p_related_entity_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_template RECORD;
    v_title TEXT;
    v_message TEXT;
    v_notification_id UUID;
    v_link TEXT;
    var_key TEXT;
BEGIN
    -- Get template
    SELECT * INTO v_template FROM public.notification_templates 
    WHERE code = p_template_code AND is_active = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template % not found or inactive', p_template_code;
    END IF;
    
    -- Replace variables in title and message
    v_title := v_template.title_template;
    v_message := v_template.message_template;
    v_link := NULL;
    
    -- Simple variable replacement
    FOR var_key IN SELECT jsonb_object_keys(p_variables) LOOP
        v_title := REPLACE(v_title, '{{' || var_key || '}}', p_variables->>var_key);
        v_message := REPLACE(v_message, '{{' || var_key || '}}', p_variables->>var_key);
    END LOOP;
    
    -- Extract link from first action if available
    IF jsonb_array_length(v_template.default_actions) > 0 THEN
        v_link := (v_template.default_actions->0)->>'url';
        -- Replace variables in link too
        FOR var_key IN SELECT jsonb_object_keys(p_variables) LOOP
            v_link := REPLACE(v_link, '{{' || var_key || '}}', p_variables->>var_key);
        END LOOP;
    END IF;
    
    -- Insert notification
    INSERT INTO public.notifications (
        user_id, title, message, link, type, priority, category, 
        actions, sender_id, related_entity_type, related_entity_id
    ) VALUES (
        p_user_id, v_title, v_message, v_link, 
        CASE v_template.default_priority
            WHEN 'urgent' THEN 'error'
            WHEN 'high' THEN 'warning'
            ELSE 'info'
        END,
        v_template.default_priority,
        v_template.default_category,
        v_template.default_actions,
        p_sender_id,
        p_related_entity_type,
        p_related_entity_id
    ) RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION public.mark_notification_read(
    p_notification_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.notifications 
    SET is_read = true, read_at = NOW()
    WHERE id = p_notification_id 
    AND user_id = p_user_id
    AND is_read = false;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to archive notification
CREATE OR REPLACE FUNCTION public.archive_notification(
    p_notification_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.notifications 
    SET is_archived = true
    WHERE id = p_notification_id 
    AND user_id = p_user_id
    AND is_archived = false;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to get unread notification count with category breakdown
CREATE OR REPLACE FUNCTION public.get_notification_counts_detailed(p_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := COALESCE(p_user_id, auth.uid());
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_unread', COUNT(*) FILTER (WHERE NOT is_read AND NOT is_archived),
        'urgent_unread', COUNT(*) FILTER (WHERE NOT is_read AND NOT is_archived AND priority = 'urgent'),
        'high_unread', COUNT(*) FILTER (WHERE NOT is_read AND NOT is_archived AND priority = 'high'),
        'by_category', jsonb_object_agg(
            COALESCE(category, 'general'),
            COUNT(*) FILTER (WHERE NOT is_read AND NOT is_archived)
        ) FILTER (WHERE NOT is_read AND NOT is_archived)
    ) INTO v_result
    FROM public.notifications
    WHERE user_id = v_user_id
    AND (expires_at IS NULL OR expires_at > NOW());
    
    RETURN COALESCE(v_result, '{"total_unread": 0, "urgent_unread": 0, "high_unread": 0, "by_category": {}}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to get or create user preferences
CREATE OR REPLACE FUNCTION public.get_or_create_notification_preferences(p_user_id UUID DEFAULT NULL)
RETURNS public.notification_preferences AS $$
DECLARE
    v_user_id UUID := COALESCE(p_user_id, auth.uid());
    v_prefs public.notification_preferences;
BEGIN
    SELECT * INTO v_prefs FROM public.notification_preferences WHERE user_id = v_user_id;
    
    IF NOT FOUND THEN
        INSERT INTO public.notification_preferences (user_id) VALUES (v_user_id) RETURNING * INTO v_prefs;
    END IF;
    
    RETURN v_prefs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to cleanup old/expired notifications
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS TABLE(deleted_count INTEGER, archived_count INTEGER) AS $$
DECLARE
    v_deleted INTEGER := 0;
    v_archived INTEGER := 0;
    v_temp INTEGER;
BEGIN
    -- Archive notifications older than 90 days that are read
    UPDATE public.notifications 
    SET is_archived = true
    WHERE is_read = true 
    AND is_archived = false
    AND created_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS v_archived = ROW_COUNT;
    
    -- Delete archived notifications older than 1 year
    DELETE FROM public.notifications 
    WHERE is_archived = true 
    AND created_at < NOW() - INTERVAL '1 year';
    GET DIAGNOSTICS v_temp = ROW_COUNT;
    v_deleted := v_deleted + v_temp;
    
    -- Delete expired notifications
    DELETE FROM public.notifications 
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
    GET DIAGNOSTICS v_temp = ROW_COUNT;
    v_deleted := v_deleted + v_temp;
    
    RETURN QUERY SELECT v_deleted, v_archived;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to batch create notifications for multiple users
CREATE OR REPLACE FUNCTION public.batch_create_notifications(
    p_user_ids UUID[],
    p_title TEXT,
    p_message TEXT,
    p_link TEXT DEFAULT NULL,
    p_type TEXT DEFAULT 'info',
    p_priority TEXT DEFAULT 'normal',
    p_category TEXT DEFAULT 'general'
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    INSERT INTO public.notifications (user_id, title, message, link, type, priority, category)
    SELECT unnest(p_user_ids), p_title, p_message, p_link, p_type, p_priority, p_category;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 5. UPDATE RLS POLICIES
-- ============================================================================

-- Notifications table policies
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authorized roles can send notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

-- SELECT: Users can view their own non-archived notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
FOR SELECT TO authenticated 
USING (
    user_id = auth.uid() 
    AND (is_archived = false OR is_archived IS NULL)
    AND (expires_at IS NULL OR expires_at > NOW())
);

-- SELECT archived: Users can view their archived notifications
CREATE POLICY "Users can view archived notifications" ON public.notifications
FOR SELECT TO authenticated 
USING (
    user_id = auth.uid() 
    AND is_archived = true
);

-- INSERT: Authorized roles can create notifications
CREATE POLICY "Authorized roles can create notifications" ON public.notifications
FOR INSERT TO authenticated 
WITH CHECK (
    get_auth_role() = ANY (ARRAY['admin', 'ceo', 'hr', 'accountant', 'loan_officer'])
);

-- UPDATE: Users can only update their own notifications (mark as read, archive)
CREATE POLICY "Users can update own notifications" ON public.notifications
FOR UPDATE TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: Users can only delete their own notifications
CREATE POLICY "Users can delete own notifications" ON public.notifications
FOR DELETE TO authenticated 
USING (user_id = auth.uid());

-- Notification preferences policies
DROP POLICY IF EXISTS "Users can view own preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.notification_preferences;

CREATE POLICY "Users can view own preferences" ON public.notification_preferences
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can update own preferences" ON public.notification_preferences
FOR UPDATE TO authenticated 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow insert only for self or admins
CREATE POLICY "Users can create own preferences" ON public.notification_preferences
FOR INSERT TO authenticated 
WITH CHECK (user_id = auth.uid() OR get_auth_role() = ANY (ARRAY['admin', 'ceo']));

-- Notification templates policies (admin only)
DROP POLICY IF EXISTS "Admins can manage templates" ON public.notification_templates;

CREATE POLICY "Admins can manage templates" ON public.notification_templates
FOR ALL TO authenticated 
USING (get_auth_role() = ANY (ARRAY['admin', 'ceo']))
WITH CHECK (get_auth_role() = ANY (ARRAY['admin', 'ceo']));

CREATE POLICY "All users can view templates" ON public.notification_templates
FOR SELECT TO authenticated USING (is_active = true);

-- ============================================================================
-- 6. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user_archived ON public.notifications(user_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON public.notifications(priority) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_category ON public.notifications(user_id, category) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON public.notifications(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_related ON public.notifications(related_entity_type, related_entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sender ON public.notifications(sender_id);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON public.notification_preferences(user_id);

-- ============================================================================
-- 7. CREATE TRIGGERS
-- ============================================================================

-- Trigger to auto-create user preferences on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.notification_preferences (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_create_user_preferences ON public.users;
CREATE TRIGGER trg_create_user_preferences
    AFTER INSERT ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_preferences();

-- Trigger to update the updated_at column
CREATE OR REPLACE FUNCTION public.update_notification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notification_prefs_updated_at ON public.notification_preferences;
CREATE TRIGGER trg_notification_prefs_updated_at
    BEFORE UPDATE ON public.notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.update_notification_updated_at();

DROP TRIGGER IF EXISTS trg_notification_templates_updated_at ON public.notification_templates;
CREATE TRIGGER trg_notification_templates_updated_at
    BEFORE UPDATE ON public.notification_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_notification_updated_at();

-- ============================================================================
-- 8. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.create_notification_from_template TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_notification_counts_detailed TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_notification_preferences TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION public.batch_create_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_notifications TO service_role;

-- ============================================================================
-- 9. MIGRATE EXISTING DATA
-- ============================================================================

-- Create preferences for existing users who don't have them
INSERT INTO public.notification_preferences (user_id)
SELECT id FROM public.users
WHERE id NOT IN (SELECT user_id FROM public.notification_preferences)
ON CONFLICT (user_id) DO NOTHING;

-- Update existing notifications with default category based on type
UPDATE public.notifications 
SET category = CASE type
    WHEN 'error' THEN 'system'
    WHEN 'warning' THEN 'security'
    ELSE 'general'
END
WHERE category IS NULL;

-- Set priority for existing unread notifications
UPDATE public.notifications 
SET priority = 'normal'
WHERE priority IS NULL;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
