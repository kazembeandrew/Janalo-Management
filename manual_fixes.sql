-- Manual SQL fixes for the database issues
-- Execute these commands manually in the Supabase SQL Editor

-- ============================================================================
-- 1. FIX JOURNAL_ENTRIES FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Drop existing foreign key constraints if they exist
DO $$
BEGIN
    DECLARE 
        constraint_rec RECORD;
    BEGIN
        FOR constraint_rec IN 
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'journal_entries' 
            AND constraint_type = 'FOREIGN KEY'
        LOOP
            EXECUTE 'ALTER TABLE public.journal_entries DROP CONSTRAINT IF EXISTS ' || constraint_rec.constraint_name;
        END LOOP;
    END;
END $$;

-- Add explicit foreign key constraints with specific names
DO $$
BEGIN
    -- created_by foreign key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'journal_entries_created_by_fkey' 
        AND table_name = 'journal_entries'
    ) THEN
        ALTER TABLE public.journal_entries 
        ADD CONSTRAINT journal_entries_created_by_fkey 
        FOREIGN KEY (created_by) 
        REFERENCES public.users(id) 
        ON DELETE SET NULL;
    END IF;

    -- updated_by foreign key  
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'journal_entries_updated_by_fkey' 
        AND table_name = 'journal_entries'
    ) THEN
        ALTER TABLE public.journal_entries 
        ADD CONSTRAINT journal_entries_updated_by_fkey 
        FOREIGN KEY (updated_by) 
        REFERENCES public.users(id) 
        ON DELETE SET NULL;
    END IF;

    -- reversed_by foreign key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'journal_entries_reversed_by_fkey' 
        AND table_name = 'journal_entries'
    ) THEN
        ALTER TABLE public.journal_entries 
        ADD CONSTRAINT journal_entries_reversed_by_fkey 
        FOREIGN KEY (reversed_by) 
        REFERENCES public.users(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- 2. FIX NOTIFICATION COUNTS FUNCTION
-- ============================================================================

-- Create a simplified version that works
CREATE OR REPLACE FUNCTION public.get_notification_counts_detailed(p_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := COALESCE(p_user_id, auth.uid());
BEGIN
    RETURN jsonb_build_object(
        'total_unread', (
            SELECT COUNT(*) 
            FROM public.notifications 
            WHERE user_id = v_user_id 
            AND NOT is_read 
            AND NOT is_archived 
            AND (expires_at IS NULL OR expires_at > NOW())
        ),
        'urgent_unread', (
            SELECT COUNT(*) 
            FROM public.notifications 
            WHERE user_id = v_user_id 
            AND NOT is_read 
            AND NOT is_archived 
            AND priority = 'urgent'
            AND (expires_at IS NULL OR expires_at > NOW())
        ),
        'high_unread', (
            SELECT COUNT(*) 
            FROM public.notifications 
            WHERE user_id = v_user_id 
            AND NOT is_read 
            AND NOT is_archived 
            AND priority = 'high'
            AND (expires_at IS NULL OR expires_at > NOW())
        ),
        'by_category', '{}'::jsonb
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 3. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_notification_counts_detailed TO authenticated;

-- ============================================================================
-- 4. TEST THE FUNCTION
-- ============================================================================

-- Test the function (you can run this to verify it works)
-- SELECT get_notification_counts_detailed('your-user-id-here');

-- ============================================================================
-- FIXES COMPLETE
-- ============================================================================
