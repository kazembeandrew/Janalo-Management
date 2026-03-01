-- Fix existing policies that are causing conflicts
-- This migration handles existing policies that already exist in the database

-- Skip creation of existing borrower_documents policies
DO $$
BEGIN
    -- Check if policy already exists before creating
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'borrower_documents' 
        AND policyname = 'Admin and CEO access borrower documents'
    ) THEN
        CREATE POLICY "Admin and CEO access borrower documents" ON public.borrower_documents
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.users
                WHERE public.users.id = auth.uid()
                AND public.users.role IN ('admin', 'ceo')
            )
        );
    END IF;
END $$;

-- Skip creation of existing loan_documents policies  
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'loan_documents' 
        AND policyname = 'Admin and CEO access loan documents'
    ) THEN
        CREATE POLICY "Admin and CEO access loan documents" ON public.loan_documents
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.users
                WHERE public.users.id = auth.uid()
                AND public.users.role IN ('admin', 'ceo')
            )
        );
    END IF;
END $$;