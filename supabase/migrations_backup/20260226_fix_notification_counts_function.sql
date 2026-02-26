-- Fix get_notification_counts_detailed function to handle edge cases properly
-- This fixes the 400 error when calling the function

-- ============================================================================
-- 1. FIX THE FUNCTION TO HANDLE NULL AGGREGATION PROPERLY
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_notification_counts_detailed(p_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := COALESCE(p_user_id, auth.uid());
    v_total_unread INTEGER := 0;
    v_urgent_unread INTEGER := 0;
    v_high_unread INTEGER := 0;
    v_by_category JSONB := '{}'::jsonb;
BEGIN
    -- Get basic counts
    SELECT 
        COUNT(*) FILTER (WHERE NOT is_read AND NOT is_archived),
        COUNT(*) FILTER (WHERE NOT is_read AND NOT is_archived AND priority = 'urgent'),
        COUNT(*) FILTER (WHERE NOT is_read AND NOT is_archived AND priority = 'high')
    INTO v_total_unread, v_urgent_unread, v_high_unread
    FROM public.notifications
    WHERE user_id = v_user_id
    AND (expires_at IS NULL OR expires_at > NOW());
    
    -- Get category breakdown safely
    BEGIN
        SELECT jsonb_object_agg(
            COALESCE(category, 'general'),
            category_count
        ) INTO v_by_category
        FROM (
            SELECT 
                COALESCE(category, 'general') as category,
                COUNT(*) as category_count
            FROM public.notifications
            WHERE user_id = v_user_id
            AND NOT is_read 
            AND NOT is_archived
            AND (expires_at IS NULL OR expires_at > NOW())
            GROUP BY COALESCE(category, 'general')
        ) category_counts;
    EXCEPTION
        WHEN OTHERS THEN
            v_by_category := '{}'::jsonb;
    END;
    
    -- Ensure by_category is not null
    IF v_by_category IS NULL THEN
        v_by_category := '{}'::jsonb;
    END IF;
    
    -- Build the result
    RETURN jsonb_build_object(
        'total_unread', COALESCE(v_total_unread, 0),
        'urgent_unread', COALESCE(v_urgent_unread, 0),
        'high_unread', COALESCE(v_high_unread, 0),
        'by_category', v_by_category
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 2. CREATE A SIMPLER VERSION FOR FALLBACK
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_notification_counts_simple(p_user_id UUID DEFAULT NULL)
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
        'by_category', (
            SELECT COALESCE(
                jsonb_object_agg(COALESCE(category, 'general'), cnt),
                '{}'::jsonb
            )
            FROM (
                SELECT 
                    COALESCE(category, 'general') as category,
                    COUNT(*) as cnt
                FROM public.notifications 
                WHERE user_id = v_user_id 
                AND NOT is_read 
                AND NOT is_archived 
                AND (expires_at IS NULL OR expires_at > NOW())
                GROUP BY COALESCE(category, 'general')
            ) cat_counts
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 3. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_notification_counts_detailed TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_notification_counts_simple TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
