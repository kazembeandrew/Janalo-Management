-- Add missing columns for user management features
-- These columns are required by the Users.tsx page

-- Add deletion_status column if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS deletion_status VARCHAR(50) DEFAULT NULL;

-- Add revocation_reason column if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS revocation_reason TEXT DEFAULT NULL;

-- Create index for deletion_status for faster queries
CREATE INDEX IF NOT EXISTS idx_users_deletion_status ON public.users(deletion_status);
