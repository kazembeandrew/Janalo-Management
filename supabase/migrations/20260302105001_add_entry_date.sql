-- Add entry_date column to journal_entries
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS entry_date DATE DEFAULT CURRENT_DATE;
