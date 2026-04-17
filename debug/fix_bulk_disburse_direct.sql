-- ============================================================================
-- DIRECT FIX: Run this SQL directly in Supabase SQL Editor
-- This bypasses migration system and applies fix immediately
-- ============================================================================

-- STEP 1: Verify current broken state
SELECT 'BEFORE FIX - Function contains manual balance update:' as status,
       prosrc LIKE '%UPDATE internal_accounts SET%' AND prosrc LIKE '%balance = balance -%' as has_bug
FROM pg_proc 
WHERE proname = 'bulk_disburse_loans_secure';

-- STEP 2: Drop and recreate function CORRECTLY
DROP FUNCTION IF EXISTS bulk_disburse_loans_secure(UUID[], UUID, UUID, DATE, TEXT) CASCADE;

CREATE FUNCTION bulk_disburse_loans_secure(
    p_loan_ids          UUID[],
    p_account_id        UUID,
    p_user_id           UUID,
    p_disbursement_date DATE DEFAULT CURRENT_DATE,
    p_note              TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_required  DECIMAL;
    v_account_balance DECIMAL;
    v_portfolio_uuid  UUID;
    v_seq             INTEGER;
    v_ref_no          TEXT;
    v_loan_id         UUID;
    v_loan            RECORD;
    v_disbursed_count INTEGER := 0;
    v_failed_count    INTEGER := 0;
    v_errors          TEXT[] := ARRAY[]::TEXT[];
    v_entry_id        UUID;
BEGIN
    -- 1. Lock account first
    SELECT balance INTO v_account_balance
    FROM internal_accounts
    WHERE id = p_account_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Account not found');
    END IF;

    -- 2. Calculate total required
    SELECT SUM(principal_amount) INTO v_total_required
    FROM loans
    WHERE id = ANY(p_loan_ids)
      AND status IN ('pending', 'pending_approval', 'approved');

    v_total_required := COALESCE(v_total_required, 0);

    IF v_total_required = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No eligible loans found');
    END IF;

    -- 3. Check funds
    IF v_account_balance < v_total_required THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Insufficient funds. Required: %s, Available: %s', 
                   v_total_required, v_account_balance)
        );
    END IF;

    -- 4. Get portfolio account
    SELECT id INTO v_portfolio_uuid
    FROM internal_accounts
    WHERE account_code = 'PORTFOLIO'
    LIMIT 1;

    IF v_portfolio_uuid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'PORTFOLIO account not found');
    END IF;

    -- 5. Process each loan
    FOREACH v_loan_id IN ARRAY p_loan_ids LOOP
        BEGIN
            SELECT * INTO v_loan
            FROM loans
            WHERE id = v_loan_id
            FOR UPDATE;

            IF NOT FOUND THEN
                v_failed_count := v_failed_count + 1;
                v_errors := array_append(v_errors, format('Loan %s not found', v_loan_id));
                CONTINUE;
            END IF;

            IF v_loan.status NOT IN ('pending', 'pending_approval', 'approved') THEN
                v_failed_count := v_failed_count + 1;
                v_errors := array_append(v_errors, format('Loan %s status %s not eligible', v_loan_id, v_loan.status));
                CONTINUE;
            END IF;

            -- Generate reference
            SELECT COALESCE(sequence, 0) + 1 INTO v_seq
            FROM sequence_counters
            WHERE counter_type = 'loan_reference'
            FOR UPDATE;

            IF NOT FOUND THEN
                v_seq := 1;
                INSERT INTO sequence_counters (counter_type, sequence) VALUES ('loan_reference', 1);
            ELSE
                UPDATE sequence_counters SET sequence = v_seq WHERE counter_type = 'loan_reference';
            END IF;

            v_ref_no := 'LN-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(v_seq::text, 6, '0');

            -- Update loan
            UPDATE loans SET
                status = 'active',
                reference_no = v_ref_no,
                disbursement_date = p_disbursement_date,
                updated_at = NOW()
            WHERE id = v_loan.id;

            -- Create journal entry (this triggers balance update via journal_lines)
            INSERT INTO journal_entries (
                reference_type, reference_id, entry_date, description, created_by, status
            ) VALUES (
                'loan_disbursement', v_loan.id, p_disbursement_date,
                format('Bulk disbursement: %s%s', COALESCE(v_loan.reference_no, v_loan.id::TEXT), 
                       CASE WHEN p_note IS NOT NULL THEN (' - ' || p_note) ELSE '' END),
                p_user_id,
                'posted'
            )
            RETURNING id INTO v_entry_id;

            -- Create journal lines (trigger will update account balances)
            INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES
                (v_entry_id, v_portfolio_uuid, v_loan.principal_amount, 0),
                (v_entry_id, p_account_id, 0, v_loan.principal_amount);

            -- Add audit note
            INSERT INTO loan_notes (loan_id, user_id, content, is_system) VALUES
                (v_loan.id, p_user_id, 'LOAN APPROVED AND DISBURSED. Reference: ' || v_ref_no, true);

            v_disbursed_count := v_disbursed_count + 1;

        EXCEPTION WHEN OTHERS THEN
            v_failed_count := v_failed_count + 1;
            v_errors := array_append(v_errors, format('Loan %s: %s', v_loan_id, SQLERRM));
        END;
    END LOOP;

    -- NO MANUAL BALANCE UPDATE - journal_lines triggers handle this

    RETURN jsonb_build_object(
        'success', v_failed_count = 0,
        'disbursed_count', v_disbursed_count,
        'failed_count', v_failed_count,
        'errors', CASE WHEN array_length(v_errors, 1) > 0 THEN v_errors ELSE NULL END
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION bulk_disburse_loans_secure(UUID[], UUID, UUID, DATE, TEXT) TO authenticated;

-- STEP 3: Verify fix applied
SELECT 'AFTER FIX - Function still has bug:' as status,
       prosrc LIKE '%UPDATE internal_accounts SET%' AND prosrc LIKE '%balance = balance -%' as has_bug
FROM pg_proc 
WHERE proname = 'bulk_disburse_loans_secure';
