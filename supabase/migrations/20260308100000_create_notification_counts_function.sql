-- Create the get_notification_counts_detailed RPC function
-- This function is called by the NotificationBell component

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_notification_counts_detailed(UUID);

-- Create the function
CREATE OR REPLACE FUNCTION get_notification_counts_detailed(p_user_id UUID)
RETURNS JSONB AS $
DECLARE
    result JSONB;
    total_unread_count BIGINT;
    urgent_count BIGINT;
    high_count BIGINT;
BEGIN
    -- Get counts from notifications table
    SELECT 
        COUNT(*) FILTER (WHERE is_read = false)::BIGINT,
        COUNT(*) FILTER (WHERE is_read = false AND type = 'error')::BIGINT,
        COUNT(*) FILTER (WHERE is_read = false AND type = 'warning')::BIGINT
    INTO total_unread_count, urgent_count, high_count
    FROM notifications
    WHERE user_id = p_user_id;
    
    -- Build the result object
    result := jsonb_build_object(
        'total_unread', COALESCE(total_unread_count, 0),
        'urgent_unread', COALESCE(urgent_count, 0),
        'high_unread', COALESCE(high_count, 0),
        'by_category', jsonb_build_object(
            'system', 0,
            'loan', 0,
            'repayment', 0,
            'expense', 0,
            'task', 0,
            'message', 0,
            'security', 0,
            'general', COALESCE(total_unread_count, 0)
        )
    );
    
    RETURN result;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also create get_notification_counts as an alias for Layout.tsx
DROP FUNCTION IF EXISTS get_notification_counts();

CREATE OR REPLACE FUNCTION get_notification_counts()
RETURNS JSONB AS $
DECLARE
    result JSONB;
BEGIN
    -- Return a simple count for backward compatibility
    SELECT jsonb_build_object(
        'total_unread', COUNT(*)::INT
    ) INTO result
    FROM notifications
    WHERE is_read = false;
    
    RETURN result;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;
