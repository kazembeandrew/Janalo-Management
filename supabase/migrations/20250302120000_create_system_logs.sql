-- Create system_logs table for storing system events and logs
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level TEXT NOT NULL CHECK (level IN ('INFO', 'WARNING', 'ERROR', 'DEBUG')),
    message TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can view all system logs" ON public.system_logs
FOR SELECT TO authenticated
USING (get_auth_role() = ANY (ARRAY['admin', 'ceo']));

CREATE POLICY "Users can view logs they created" ON public.system_logs
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "System can insert logs" ON public.system_logs
FOR INSERT TO authenticated
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_category ON public.system_logs(category);

-- Insert some sample logs to replace the hardcoded ones
INSERT INTO public.system_logs (level, message, category, created_at) VALUES
('INFO', 'Database backup completed successfully', 'backup', NOW() - INTERVAL '5 minutes'),
('WARNING', 'High memory usage detected: 85%', 'system', NOW() - INTERVAL '10 minutes'),
('ERROR', 'Failed to connect to external service', 'system', NOW() - INTERVAL '15 minutes'),
('INFO', 'System maintenance completed', 'maintenance', NOW() - INTERVAL '1 hour'),
('INFO', 'User authentication successful', 'auth', NOW() - INTERVAL '2 hours');
