-- Create the missing get_notification_counts function
CREATE OR REPLACE FUNCTION get_notification_counts(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB := '{}'::JSONB;
BEGIN
    -- Get unread notifications count
    SELECT jsonb_set(v_result, '{unread_notifications}', COUNT(*)::TEXT::JSONB)
    INTO v_result
    FROM notifications 
    WHERE user_id = p_user_id 
    AND read_at IS NULL;
    
    -- Get pending tasks count
    SELECT jsonb_set(v_result, '{pending_tasks}', COUNT(*)::TEXT::JSONB)
    INTO v_result
    FROM tasks 
    WHERE assigned_to = p_user_id 
    AND status = 'pending';
    
    -- Get unread messages count
    SELECT jsonb_set(v_result, '{unread_messages}', COUNT(*)::TEXT::JSONB)
    INTO v_result
    FROM messages 
    WHERE recipient_id = p_user_id 
    AND read_at IS NULL;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_notification_counts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_notification_counts(UUID) TO service_role;
