-- Add entry_number column to journal_entries
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS entry_number TEXT UNIQUE;
