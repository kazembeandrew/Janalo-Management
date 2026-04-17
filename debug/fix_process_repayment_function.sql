-- =============================================================================
-- FIX: process_repayment_with_idempotency Function Missing
-- =============================================================================
-- This script fixes the error:
-- "Could not find the function public.process_repayment_with_idempotency"
-- 
-- Root cause: Either migration not applied OR parameter signature mismatch
-- Solution: Recreate function with correct parameter order matching frontend calls
-- =============================================================================

BEGIN;

-- Drop existing function if it exists (with any signature)
DROP FUNCTION IF EXISTS public.process_repayment_with_idempotency(
    UUID, DECIMAL, UUID, UUID, DATE, UUID, TEXT, TEXT, TEXT
);

DROP FUNCTION IF EXISTS public.process_repayment_with_idempotency(
    UUID, DECIMAL, UUID, DATE, UUID, TEXT, TEXT, TEXT, TEXT
);

-- Recreate with the EXACT signature expected by the frontend
-- Frontend calls with these named parameters:
-- p_account_id, p_amount, p_idempotency_key, p_loan_id, p_notes, 
-- p_payment_date, p_payment_method, p_reference, p_user_id

CREATE OR REPLACE FUNCTION public.process_repayment_with_idempotency(
    p_account_id      UUID,
    p_amount          DECIMAL,
    p_idempotency_key UUID,
    p_loan_id         UUID,
    p_notes           TEXT DEFAULT NULL,
    p_payment_date    DATE DEFAULT CURRENT_DATE,
    p_payment_method  TEXT DEFAULT 'cash',
    p_reference       TEXT DEFAULT NULL,
    p_user_id         UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing RECORD;
BEGIN
    -- Check for existing repayment with same idempotency key
    SELECT * INTO v_existing
    FROM repayments
    WHERE idempotency_key = p_idempotency_key;
    
    IF FOUND THEN
      -- Return existing repayment info (idempotent response)
      RETURN jsonb_build_object(
        'success', true,
        'duplicate', true,
        'existing_repayment_id', v_existing.id,
        'message', 'Repayment already processed with this key'
      );
    END IF;
    
    -- Proceed with normal atomic processing
    -- Note: process_repayment_atomic expects (p_loan_id, p_amount, p_account_id, p_user_id, ...)
    RETURN public.process_repayment_atomic(
        p_loan_id,
        p_amount,
        p_account_id,
        p_user_id,
        p_payment_date,
        p_notes,
        p_reference,
        p_payment_method
    );
END;
$$;

-- Add documentation comment
COMMENT ON FUNCTION public.process_repayment_with_idempotency(UUID, DECIMAL, UUID, UUID, TEXT, DATE, TEXT, TEXT, UUID) IS
'Idempotent repayment processing:
 - Prevents duplicate repayments from double-clicks
 - Uses idempotency_key for deduplication
 - Returns existing repayment if already processed
 - Call this from frontend for safety';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.process_repayment_with_idempotency(
    UUID, DECIMAL, UUID, UUID, TEXT, DATE, TEXT, TEXT, UUID
) TO authenticated;

COMMIT;

-- Verification query
SELECT 
    proname as function_name,
    pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc
WHERE proname = 'process_repayment_with_idempotency'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
