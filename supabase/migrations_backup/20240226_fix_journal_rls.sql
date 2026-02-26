-- Fix missing RLS policies for journal_entries and journal_lines tables
-- This allows authenticated users to view ledger entries

-- Enable RLS on journal_entries if not already enabled
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- Enable RLS on journal_lines if not already enabled
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to view all journal entries
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'View Journal Entries') THEN
        CREATE POLICY "View Journal Entries" ON public.journal_entries
        FOR SELECT TO authenticated
        USING (true);
    END IF;
END $$;

-- Policy: Allow authenticated users to insert journal entries
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Insert Journal Entries') THEN
        CREATE POLICY "Insert Journal Entries" ON public.journal_entries
        FOR INSERT TO authenticated
        WITH CHECK (true);
    END IF;
END $$;

-- Policy: Allow authenticated users to view all journal lines
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'View Journal Lines') THEN
        CREATE POLICY "View Journal Lines" ON public.journal_lines
        FOR SELECT TO authenticated
        USING (true);
    END IF;
END $$;

-- Policy: Allow authenticated users to insert journal lines
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Insert Journal Lines') THEN
        CREATE POLICY "Insert Journal Lines" ON public.journal_lines
        FOR INSERT TO authenticated
        WITH CHECK (true);
    END IF;
END $$;

-- Also ensure internal_accounts has proper SELECT policy for the relationship
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'View Internal Accounts') THEN
        CREATE POLICY "View Internal Accounts" ON public.internal_accounts
        FOR SELECT TO authenticated
        USING (true);
    END IF;
END $$;

-- Grant necessary permissions
GRANT SELECT, INSERT ON public.journal_entries TO authenticated;
GRANT SELECT, INSERT ON public.journal_lines TO authenticated;
