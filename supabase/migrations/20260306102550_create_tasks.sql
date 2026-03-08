-- Create tasks table (referenced in RLS migration but not created)
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'in_progress', 'completed')),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);

-- RLS Policies
CREATE POLICY "Users can view tasks assigned to them or created by them" ON public.tasks
FOR SELECT TO authenticated USING (
    assigned_to = auth.uid() OR
    created_by = auth.uid() OR
    get_auth_role() IN ('admin', 'ceo', 'hr')
);

CREATE POLICY "Staff can create tasks" ON public.tasks
FOR INSERT TO authenticated WITH CHECK (get_auth_role() IN ('admin', 'ceo', 'accountant', 'loan_officer', 'hr'));

CREATE POLICY "Users can update tasks assigned to them" ON public.tasks
FOR UPDATE TO authenticated USING (
    assigned_to = auth.uid() OR
    get_auth_role() IN ('admin', 'ceo', 'hr')
);
