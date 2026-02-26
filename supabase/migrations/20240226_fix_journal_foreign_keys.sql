-- Fix missing foreign key relationship for journal_lines.account_id -> internal_accounts(id)
-- This enables PostgREST to detect the relationship for embedding

-- Add foreign key constraint if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'journal_lines_account_id_fkey' 
        AND table_name = 'journal_lines'
    ) THEN
        ALTER TABLE public.journal_lines 
        ADD CONSTRAINT journal_lines_account_id_fkey 
        FOREIGN KEY (account_id) 
        REFERENCES public.internal_accounts(id) 
        ON DELETE RESTRICT;
    END IF;
END $$;

-- Also ensure journal_entry_id has a foreign key if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'journal_lines_journal_entry_id_fkey' 
        AND table_name = 'journal_lines'
    ) THEN
        ALTER TABLE public.journal_lines 
        ADD CONSTRAINT journal_lines_journal_entry_id_fkey 
        FOREIGN KEY (journal_entry_id) 
        REFERENCES public.journal_entries(id) 
        ON DELETE CASCADE;
    END IF;
END $$;
