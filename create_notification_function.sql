-- Create a simple get_notification_counts function that handles missing tables
CREATE OR REPLACE FUNCTION get_notification_counts(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB := '{}'::JSONB;
    v_count INTEGER;
BEGIN
    -- Initialize result object
    v_result := '{}'::JSONB;
    
    -- Try to get unread notifications count
    BEGIN
        SELECT COUNT(*) INTO v_count FROM notifications WHERE user_id = p_user_id AND read_at IS NULL;
        v_result := jsonb_set(v_result, '{unread_notifications}', v_count::TEXT::JSONB);
    EXCEPTION WHEN OTHERS THEN
        -- Table doesn't exist, set to 0
        v_result := jsonb_set(v_result, '{unread_notifications}', '0'::JSONB);
    END;
    
    -- Try to get pending tasks count  
    BEGIN
        SELECT COUNT(*) INTO v_count FROM tasks WHERE assigned_to = p_user_id AND status = 'pending';
        v_result := jsonb_set(v_result, '{pending_tasks}', v_count::TEXT::JSONB);
    EXCEPTION WHEN OTHERS THEN
        -- Table doesn't exist, set to 0
        v_result := jsonb_set(v_result, '{pending_tasks}', '0'::JSONB);
    END;
    
    -- Try to get unread messages count
    BEGIN
        SELECT COUNT(*) INTO v_count FROM messages WHERE recipient_id = p_user_id AND read_at IS NULL;
        v_result := jsonb_set(v_result, '{unread_messages}', v_count::TEXT::JSONB);
    EXCEPTION WHEN OTHERS THEN
        -- Table doesn't exist, set to 0
        v_result := jsonb_set(v_result, '{unread_messages}', '0'::JSONB);
    END;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_notification_counts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_notification_counts(UUID) TO service_role;
