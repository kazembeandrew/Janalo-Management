-- Add status column to journal_entries
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
