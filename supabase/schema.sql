-- JANALO ENTERPRISES - DATABASE SCHEMA UPDATES

-- 1. Ensure reference_no exists on loans table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='reference_no') THEN
        ALTER TABLE public.loans ADD COLUMN reference_no TEXT UNIQUE;
    END IF;
END $$;

-- 2. Ensure full_name is unique on borrowers
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='borrowers_full_name_key') THEN
        ALTER TABLE public.borrowers ADD CONSTRAINT borrowers_full_name_key UNIQUE (full_name);
    END IF;
END $$;

-- 3. Visitation Table (if missing)
CREATE TABLE IF NOT EXISTS public.visitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE,
    officer_id UUID REFERENCES public.users(id),
    visit_date DATE DEFAULT CURRENT_DATE,
    notes TEXT NOT NULL,
    location_lat NUMERIC,
    location_long NUMERIC,
    image_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.visitations ENABLE ROW LEVEL SECURITY;

-- Policies for visitations
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'View Visitations') THEN
        CREATE POLICY "View Visitations" ON visitations FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Create Visitations') THEN
        CREATE POLICY "Create Visitations" ON visitations FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
END $$;