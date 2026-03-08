-- Create expenses table (referenced in RLS migration but not created)
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL,
    description TEXT,
    amount DECIMAL(15,2) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_recorded_by ON public.expenses(recorded_by);

-- RLS Policies
CREATE POLICY "Staff can view expenses" ON public.expenses
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant', 'loan_officer', 'hr'));

CREATE POLICY "Staff can create expenses" ON public.expenses
FOR INSERT TO authenticated WITH CHECK (get_auth_role() IN ('admin', 'ceo', 'accountant', 'loan_officer'));

CREATE POLICY "Executives can approve expenses" ON public.expenses
FOR UPDATE TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));
