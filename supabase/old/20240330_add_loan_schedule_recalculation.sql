-- Add loan amortization schedule table and recalculation functionality
-- This enables dynamic schedule recalculation after repayments

-- 1. Create loan amortization schedule table
CREATE TABLE IF NOT EXISTS public.loan_amortization_schedule (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    installment DECIMAL(15,2) NOT NULL,
    principal DECIMAL(15,2) NOT NULL,
    interest DECIMAL(15,2) NOT NULL,
    balance DECIMAL(15,2) NOT NULL,
    is_original BOOLEAN DEFAULT false, -- Distinguish between original and recalculated
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.loan_amortization_schedule ENABLE ROW LEVEL SECURITY;

-- 3. Policy for viewing schedule
CREATE POLICY "Users can view loan schedule" ON public.loan_amortization_schedule
FOR SELECT TO authenticated
USING (
    -- Loan officers can see their own loans' schedules
    EXISTS (
        SELECT 1 FROM public.loans 
        WHERE id = loan_amortization_schedule.loan_id 
        AND officer_id = auth.uid()
    )
    OR 
    -- Admins, CEO, Accountants, HR can see all
    get_auth_role() IN ('admin', 'ceo', 'accountant', 'hr')
);

-- 4. Policy for inserting/updating schedule
CREATE POLICY "Staff can manage loan schedule" ON public.loan_amortization_schedule
FOR ALL TO authenticated
USING (
    get_auth_role() IN ('admin', 'ceo', 'accountant', 'hr')
    OR (
        get_auth_role() = 'loan_officer'
        AND EXISTS (
            SELECT 1 FROM public.loans 
            WHERE id = loan_amortization_schedule.loan_id 
            AND officer_id = auth.uid()
        )
    )
)
WITH CHECK (
    get_auth_role() IN ('admin', 'ceo', 'accountant', 'hr')
    OR (
        get_auth_role() = 'loan_officer'
        AND EXISTS (
            SELECT 1 FROM public.loans 
            WHERE id = loan_amortization_schedule.loan_id 
            AND officer_id = auth.uid()
        )
    )
);

-- 5. Index for performance
CREATE INDEX IF NOT EXISTS idx_loan_amortization_schedule_loan_id ON public.loan_amortization_schedule(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_amortization_schedule_loan_month ON public.loan_amortization_schedule(loan_id, month);
