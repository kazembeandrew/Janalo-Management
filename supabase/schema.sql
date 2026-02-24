-- JANALO MANAGEMENT SYSTEM - DATABASE MAINTENANCE

-- Function to optimize database performance by updating statistics
CREATE OR REPLACE FUNCTION public.optimize_database()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role text;
BEGIN
    -- 1. Security Check: Only Admin or CEO can execute
    SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
    IF v_role NOT IN ('admin', 'ceo') THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can perform system maintenance.';
    END IF;

    -- 2. Update statistics for high-traffic tables
    -- This helps the PostgreSQL query planner make better decisions
    ANALYZE public.loans;
    ANALYZE public.repayments;
    ANALYZE public.borrowers;
    ANALYZE public.audit_logs;
    ANALYZE public.journal_lines;
    ANALYZE public.direct_messages;

    -- 3. Log the maintenance action
    INSERT INTO public.audit_logs (user_id, action, entity_type, details)
    VALUES (
        auth.uid(), 
        'DATABASE_OPTIMIZATION', 
        'system', 
        jsonb_build_object('timestamp', now(), 'status', 'success')
    );

    RETURN json_build_object(
        'status', 'success',
        'message', 'Database statistics updated and query plans optimized.',
        'timestamp', now()
    );
END;
$$;