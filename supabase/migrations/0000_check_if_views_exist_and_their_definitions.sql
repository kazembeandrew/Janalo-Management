SELECT table_name, view_definition 
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name IN ('active_user_sessions', 'pending_compliance', 'system_health_summary');