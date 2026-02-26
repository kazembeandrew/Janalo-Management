-- Add missing overpayment column to repayments table
-- This column is required by the process_repayment function

ALTER TABLE public.repayments 
ADD COLUMN IF NOT EXISTS overpayment DECIMAL(15,2) DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.repayments.overpayment IS 'Amount paid exceeding the total outstanding (principal + interest + penalty)';
