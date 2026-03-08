-- Add delegation-related columns to users table
-- These columns are used for role delegation feature

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS delegated_role VARCHAR(50),
ADD COLUMN IF NOT EXISTS delegation_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delegation_end TIMESTAMP WITH TIME ZONE;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_users_delegated_role ON public.users(delegated_role);
CREATE INDEX IF NOT EXISTS idx_users_delegation_dates ON public.users(delegation_start, delegation_end);
