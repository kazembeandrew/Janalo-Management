-- Add reference_no column to loans table
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS reference_no TEXT;

-- Create a unique index to prevent duplicate reference numbers
CREATE UNIQUE INDEX IF NOT EXISTS loans_reference_no_idx ON public.loans (reference_no);

-- Update RLS policies to ensure the new column is accessible (usually automatic, but good to verify)
-- No changes needed to existing policies as they use SELECT * or specific logic not tied to column names