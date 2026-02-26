-- Fix journal_entries foreign key relationships for PostgREST embedding
-- This migration adds explicit foreign key constraints with specific names
-- to allow PostgREST to properly embed users table relationships

-- ============================================================================
-- 1. ADD EXPLICIT FOREIGN KEY CONSTRAINTS WITH SPECIFIC NAMES
-- ============================================================================

-- Drop existing foreign key constraints if they exist (they might be unnamed)
DO $$
BEGIN
    -- Check and drop existing constraints
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'journal_entries' 
        AND constraint_name LIKE '%_fkey'
    ) THEN
        -- Get all foreign key constraints on journal_entries that reference users
        DECLARE 
            constraint_rec RECORD;
        BEGIN
            FOR constraint_rec IN 
                SELECT constraint_name 
                FROM information_schema.table_constraints 
                WHERE table_name = 'journal_entries' 
                AND constraint_type = 'FOREIGN KEY'
            LOOP
                EXECUTE 'ALTER TABLE public.journal_entries DROP CONSTRAINT ' || constraint_rec.constraint_name;
            END LOOP;
        END;
    END IF;
END $$;

-- Add explicit foreign key constraints with specific names
DO $$
BEGIN
    -- created_by foreign key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'journal_entries_created_by_fkey' 
        AND table_name = 'journal_entries'
    ) THEN
        ALTER TABLE public.journal_entries 
        ADD CONSTRAINT journal_entries_created_by_fkey 
        FOREIGN KEY (created_by) 
        REFERENCES public.users(id) 
        ON DELETE SET NULL;
    END IF;

    -- updated_by foreign key  
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'journal_entries_updated_by_fkey' 
        AND table_name = 'journal_entries'
    ) THEN
        ALTER TABLE public.journal_entries 
        ADD CONSTRAINT journal_entries_updated_by_fkey 
        FOREIGN KEY (updated_by) 
        REFERENCES public.users(id) 
        ON DELETE SET NULL;
    END IF;

    -- reversed_by foreign key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'journal_entries_reversed_by_fkey' 
        AND table_name = 'journal_entries'
    ) THEN
        ALTER TABLE public.journal_entries 
        ADD CONSTRAINT journal_entries_reversed_by_fkey 
        FOREIGN KEY (reversed_by) 
        REFERENCES public.users(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- 2. ENSURE COLUMNS EXIST
-- ============================================================================

-- Add columns if they don't exist (for safety)
DO $$
BEGIN
    -- created_by column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='journal_entries' AND column_name='created_by') THEN
        ALTER TABLE public.journal_entries ADD COLUMN created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;

    -- updated_by column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='journal_entries' AND column_name='updated_by') THEN
        ALTER TABLE public.journal_entries ADD COLUMN updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;

    -- reversed_by column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='journal_entries' AND column_name='reversed_by') THEN
        ALTER TABLE public.journal_entries ADD COLUMN reversed_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_journal_entries_created_by ON public.journal_entries(created_by);
CREATE INDEX IF NOT EXISTS idx_journal_entries_updated_by ON public.journal_entries(updated_by);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reversed_by ON public.journal_entries(reversed_by);

-- ============================================================================
-- 4. UPDATE POSTGREST CONFIGURATION
-- ============================================================================

-- Note: The PostgREST configuration will automatically detect the named foreign keys
-- and allow embedding using the following syntax:
-- - users!journal_entries_created_by_fkey (for created_by relationship)
-- - users!journal_entries_updated_by_fkey (for updated_by relationship)  
-- - users!journal_entries_reversed_by_fkey (for reversed_by relationship)

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
