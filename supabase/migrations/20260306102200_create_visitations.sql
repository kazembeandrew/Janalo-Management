-- Create visitations table (referenced in realtime migration but not created by migrations)
CREATE TABLE IF NOT EXISTS public.visitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE,
    officer_id UUID REFERENCES public.users(id),
    visit_date DATE DEFAULT CURRENT_DATE,
    notes TEXT NOT NULL,
    location_lat NUMERIC,
    location_long NUMERIC,
    image_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.visitations ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (will be updated by realtime migration)
CREATE POLICY "View Visitations" ON visitations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Create Visitations" ON visitations FOR INSERT TO authenticated WITH CHECK (true);
