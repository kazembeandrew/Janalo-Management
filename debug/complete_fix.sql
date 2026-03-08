-- ============================================================================
-- COMPLETE DATABASE FIXES FOR JOURNAL ENTRIES AND NOTIFICATIONS
-- Execute this entire script in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. FIX JOURNAL_ENTRIES FOREIGN KEY CONSTRAINTS (PostgREST Embedding)
-- ============================================================================

-- Drop existing foreign key constraints to avoid conflicts
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

-- Add explicit foreign key constraints with specific names for PostgREST
ALTER TABLE public.journal_entries 
ADD CONSTRAINT journal_entries_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES public.users(id) 
ON DELETE SET NULL;

ALTER TABLE public.journal_entries 
ADD CONSTRAINT journal_entries_updated_by_fkey 
FOREIGN KEY (updated_by) 
REFERENCES public.users(id) 
ON DELETE SET NULL;

ALTER TABLE public.journal_entries 
ADD CONSTRAINT journal_entries_reversed_by_fkey 
FOREIGN KEY (reversed_by) 
REFERENCES public.users(id) 
ON DELETE SET NULL;

-- ============================================================================
-- 2. FIX NOTIFICATION COUNTS FUNCTION (Remove Nested Aggregates)
-- ============================================================================

-- Drop and recreate the function with a working version
DROP FUNCTION IF EXISTS public.get_notification_counts_detailed(p_user_id UUID);

CREATE OR REPLACE FUNCTION public.get_notification_counts_detailed(p_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := COALESCE(p_user_id, auth.uid());
    v_total_unread INTEGER;
    v_urgent_unread INTEGER;
    v_high_unread INTEGER;
    v_by_category JSONB;
BEGIN
    -- Get counts separately to avoid nested aggregates
    SELECT COUNT(*) INTO v_total_unread
    FROM public.notifications
    WHERE user_id = v_user_id
    AND NOT is_read 
    AND NOT is_archived 
    AND (expires_at IS NULL OR expires_at > NOW());
    
    SELECT COUNT(*) INTO v_urgent_unread
    FROM public.notifications
    WHERE user_id = v_user_id
    AND NOT is_read 
    AND NOT is_archived 
    AND priority = 'urgent'
    AND (expires_at IS NULL OR expires_at > NOW());
    
    SELECT COUNT(*) INTO v_high_unread
    FROM public.notifications
    WHERE user_id = v_user_id
    AND NOT is_read 
    AND NOT is_archived 
    AND priority = 'high'
    AND (expires_at IS NULL OR expires_at > NOW());
    
    -- Get category breakdown
    BEGIN
        SELECT jsonb_object_agg(category, count) INTO v_by_category
        FROM (
            SELECT COALESCE(category, 'general') as category, COUNT(*) as count
            FROM public.notifications
            WHERE user_id = v_user_id
            AND NOT is_read 
            AND NOT is_archived 
            AND (expires_at IS NULL OR expires_at > NOW())
            GROUP BY COALESCE(category, 'general')
        ) cat_counts;
    EXCEPTION
        WHEN OTHERS THEN
            v_by_category := '{}'::jsonb;
    END;
    
    -- Return result
    RETURN jsonb_build_object(
        'total_unread', COALESCE(v_total_unread, 0),
        'urgent_unread', COALESCE(v_urgent_unread, 0),
        'high_unread', COALESCE(v_high_unread, 0),
        'by_category', COALESCE(v_by_category, '{}'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 3. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_notification_counts_detailed TO authenticated;

-- ============================================================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_journal_entries_created_by ON public.journal_entries(created_by);
CREATE INDEX IF NOT EXISTS idx_journal_entries_updated_by ON public.journal_entries(updated_by);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reversed_by ON public.journal_entries(reversed_by);

-- ============================================================================
-- 5. TEST QUERIES (Run these to verify fixes work)
-- ============================================================================

-- Test 1: Journal entries with explicit foreign key relationships
-- This should now work without the PGRST201 error:
/*
SELECT 
  je.id,
  je.description,
  users!journal_entries_created_by_fkey(full_name),
  users!journal_entries_updated_by_fkey(full_name),
  users!journal_entries_reversed_by_fkey(full_name)
FROM public.journal_entries je
LIMIT 5;
*/

-- Test 2: Notification counts function
-- This should now work without the 400 error:
/*
SELECT get_notification_counts_detailed(NULL);
*/

-- ============================================================================
-- FIXES COMPLETE
-- ============================================================================

-- After running this script:
-- 1. The journal_entries embedding error (PGRST201) should be resolved
-- 2. The notification counts function error (400) should be resolved
-- 3. Your application should work properly again
