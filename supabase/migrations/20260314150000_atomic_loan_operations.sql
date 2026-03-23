-- =============================================================================
-- Atomic Loan Operations Migration
-- Creates atomic functions for loan operations that handle multi-step 
-- transactions in a single database call with row-level locking
-- =============================================================================

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS reverse_repayment(UUID, UUID, UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS write_off_loan(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS disburse_loan(UUID, UUID, UUID, TEXT);

-- -----------------------------------------------------------------------------
-- 1. reverse_repayment
--    Atomically: posts reversal journal entry + restores loan balances
--                + deletes repayment record + inserts audit note
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reverse_repayment(
    p_loan_id        UUID,
    p_repayment_id   UUID,
    p_user_id        UUID,
    p_reason         TEXT,
    p_account_id     UUID  -- the cash/bank account that originally received the payment
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
    v_loan        RECORD;
    v_repayment   RECORD;
    v_portfolio   UUID;
    v_interest    UUID;
    v_entry_id    UUID;
    v_note_text   TEXT;
    v_user_role   TEXT;
BEGIN
    -- Authorization check: verify user has permission to reverse repayments
    SELECT COALESCE(role, 'user') INTO v_user_role
    FROM users WHERE id = p_user_id;
    
    IF v_user_role NOT IN ('admin', 'ceo', 'accountant') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only admin, CEO, or accountant can reverse repayments');
    END IF;

    -- Lock loan (prevents concurrent balance edits)
    SELECT * INTO v_loan
    FROM loans
    WHERE id = p_loan_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
    END IF;

    -- Fetch repayment (verify it belongs to this loan)
    SELECT * INTO v_repayment
    FROM repayments
    WHERE id = p_repayment_id
      AND loan_id = p_loan_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false,
            'error', 'Repayment not found or does not belong to this loan');
    END IF;

    -- Resolve system accounts
    SELECT id INTO v_portfolio FROM internal_accounts WHERE account_code = 'PORTFOLIO' LIMIT 1;
    SELECT id INTO v_interest  FROM internal_accounts WHERE account_code = 'EQUITY'    LIMIT 1;

    IF v_portfolio IS NULL OR v_interest IS NULL THEN
        RETURN jsonb_build_object('success', false,
            'error', 'System accounts PORTFOLIO or EQUITY not found');
    END IF;

    -- 1. Post reversal journal entry
    INSERT INTO journal_entries
        (reference_type, reference_id, entry_date, description, created_by)
    VALUES
        ('reversal', p_loan_id, CURRENT_DATE,
         'REVERSAL of repayment from ' || to_char(v_repayment.payment_date, 'DD Mon YYYY')
         || ' — ' || p_reason,
         p_user_id)
    RETURNING id INTO v_entry_id;

    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit)
    VALUES
        (v_entry_id, v_portfolio, v_repayment.principal_paid, 0),
        (v_entry_id, v_interest,
         v_repayment.interest_paid + COALESCE(v_repayment.penalty_paid, 0), 0),
        (v_entry_id, p_account_id, 0, v_repayment.amount_paid);

    -- 2. Restore loan balances
    UPDATE loans SET
        principal_outstanding = principal_outstanding + v_repayment.principal_paid,
        interest_outstanding  = interest_outstanding  + v_repayment.interest_paid,
        penalty_outstanding   = COALESCE(penalty_outstanding, 0)
                                + COALESCE(v_repayment.penalty_paid, 0),
        status                = 'active'
    WHERE id = p_loan_id;

    -- 3. Delete the repayment record
    DELETE FROM repayments WHERE id = p_repayment_id;

    -- 4. Audit note
    v_note_text := 'REVERSED repayment of MK ' || v_repayment.amount_paid::TEXT
        || ' from ' || to_char(v_repayment.payment_date, 'DD Mon YYYY')
        || '. Reason: ' || p_reason;

    INSERT INTO loan_notes (loan_id, user_id, content, is_system)
    VALUES (p_loan_id, p_user_id, v_note_text, true);

    RETURN jsonb_build_object(
        'success',          true,
        'journal_entry_id', v_entry_id,
        'amount_reversed',  v_repayment.amount_paid
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- -----------------------------------------------------------------------------
-- 2. write_off_loan
--    Atomically: posts write-off journal entry + zeroes balances + marks
--                loan defaulted + inserts audit note
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION write_off_loan(
    p_loan_id UUID,
    p_user_id UUID,
    p_reason  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
    v_loan       RECORD;
    v_expense    UUID;
    v_portfolio  UUID;
    v_entry_id   UUID;
    v_total_loss DECIMAL(15, 2);
    v_user_role  TEXT;
BEGIN
    -- Authorization check: verify user has permission to write off loans
    SELECT COALESCE(role, 'user') INTO v_user_role
    FROM users WHERE id = p_user_id;
    
    IF v_user_role NOT IN ('admin', 'ceo') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only admin or CEO can write off loans');
    END IF;

    -- Lock loan
    SELECT * INTO v_loan
    FROM loans
    WHERE id = p_loan_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
    END IF;

    IF v_loan.status = 'defaulted' THEN
        RETURN jsonb_build_object('success', false,
            'error', 'Loan is already written off');
    END IF;

    -- Resolve system accounts
    SELECT id INTO v_expense   FROM internal_accounts WHERE account_code = 'OPERATIONAL' LIMIT 1;
    SELECT id INTO v_portfolio FROM internal_accounts WHERE account_code = 'PORTFOLIO'   LIMIT 1;

    IF v_expense IS NULL OR v_portfolio IS NULL THEN
        RETURN jsonb_build_object('success', false,
            'error', 'System accounts OPERATIONAL or PORTFOLIO not found');
    END IF;

    v_total_loss := v_loan.principal_outstanding
                  + v_loan.interest_outstanding
                  + COALESCE(v_loan.penalty_outstanding, 0);

    IF v_total_loss <= 0 THEN
        RETURN jsonb_build_object('success', false,
            'error', 'No outstanding balance to write off');
    END IF;

    -- 1. Post write-off journal entry
    INSERT INTO journal_entries
        (reference_type, reference_id, entry_date, description, created_by)
    VALUES
        ('write_off', p_loan_id, CURRENT_DATE,
         'Write-off for loan ' || COALESCE(v_loan.reference_no, p_loan_id::TEXT),
         p_user_id)
    RETURNING id INTO v_entry_id;

    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit)
    VALUES
        (v_entry_id, v_expense,   v_total_loss, 0),
        (v_entry_id, v_portfolio, 0, v_total_loss);

    -- 2. Zero out loan balances and mark defaulted
    UPDATE loans SET
        status                = 'defaulted',
        principal_outstanding = 0,
        interest_outstanding  = 0,
        penalty_outstanding   = 0
    WHERE id = p_loan_id;

    -- 3. Audit note
    INSERT INTO loan_notes (loan_id, user_id, content, is_system)
    VALUES (
        p_loan_id, p_user_id,
        'LOAN WRITTEN OFF. Total loss of MK ' || v_total_loss::TEXT
        || ' recognized. Reason: ' || p_reason,
        true
    );

    RETURN jsonb_build_object(
        'success',          true,
        'journal_entry_id', v_entry_id,
        'total_loss',       v_total_loss
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- -----------------------------------------------------------------------------
-- 3. disburse_loan
--    Atomically: updates loan status + generates reference number + posts
--                disbursement journal entry + deducts from fund account
--                + inserts audit note
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION disburse_loan(
    p_loan_id    UUID,
    p_account_id UUID,   -- fund account to debit
    p_user_id    UUID,
    p_note       TEXT    -- approval/disbursement note
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
    v_loan          RECORD;
    v_fund_account  RECORD;
    v_portfolio     UUID;
    v_entry_id      UUID;
    v_ref_no        TEXT;
    v_seq           INT;
    v_user_role     TEXT;
BEGIN
    -- Authorization check: verify user has permission to disburse loans
    SELECT COALESCE(role, 'user') INTO v_user_role
    FROM users WHERE id = p_user_id;
    
    IF v_user_role NOT IN ('admin', 'ceo', 'accountant', 'loan_officer') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only admin, CEO, accountant, or loan officer can disburse loans');
    END IF;

    -- Lock loan
    SELECT * INTO v_loan
    FROM loans
    WHERE id = p_loan_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
    END IF;

    IF v_loan.status NOT IN ('pending', 'pending_approval') THEN
        RETURN jsonb_build_object('success', false,
            'error', 'Only pending loans can be disbursed (status: ' || v_loan.status || ')');
    END IF;

    -- Lock fund account and check balance
    SELECT * INTO v_fund_account
    FROM internal_accounts
    WHERE id = p_account_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Fund account not found');
    END IF;

    IF v_fund_account.balance < v_loan.principal_amount THEN
        RETURN jsonb_build_object('success', false,
            'error', 'Insufficient funds. Available: MK '
            || v_fund_account.balance::TEXT
            || ', Required: MK ' || v_loan.principal_amount::TEXT);
    END IF;

    -- Resolve portfolio account
    SELECT id INTO v_portfolio
    FROM internal_accounts
    WHERE account_code = 'PORTFOLIO'
    LIMIT 1;

    IF v_portfolio IS NULL THEN
        RETURN jsonb_build_object('success', false,
            'error', 'System account PORTFOLIO not found');
    END IF;

    -- Generate unique reference number (format: JN-YYMM-NNNN)
    SELECT COALESCE(MAX(CAST(
        REGEXP_REPLACE(reference_no, '[^0-9]', '', 'g') AS INT)), 0) + 1
    INTO v_seq
    FROM loans
    WHERE reference_no IS NOT NULL
      AND reference_no ~ '^JN-\d{4}-\d{4}$';

    v_ref_no := 'JN-' || TO_CHAR(CURRENT_DATE, 'YYMM') || '-' || LPAD(v_seq::TEXT, 4, '0');

    -- 1. Update loan to active
    UPDATE loans SET
        status       = 'active',
        reference_no = v_ref_no
    WHERE id = p_loan_id;

    -- 2. Post disbursement journal entry
    INSERT INTO journal_entries
        (reference_type, reference_id, entry_date, description, created_by)
    VALUES
        ('loan_disbursement', p_loan_id, CURRENT_DATE,
         'Disbursement — ' || COALESCE(v_ref_no, p_loan_id::TEXT),
         p_user_id)
    RETURNING id INTO v_entry_id;

    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit)
    VALUES
        (v_entry_id, v_portfolio,   v_loan.principal_amount, 0),
        (v_entry_id, p_account_id,  0, v_loan.principal_amount);

    -- 3. Update fund account balance (deduct disbursed amount)
    UPDATE internal_accounts
    SET balance = balance - v_loan.principal_amount
    WHERE id = p_account_id;

    -- 4. Audit note
    INSERT INTO loan_notes (loan_id, user_id, content, is_system)
    VALUES (
        p_loan_id, p_user_id,
        'Active: ' || p_note || ' (Ref: ' || v_ref_no || ')',
        true
    );

    RETURN jsonb_build_object(
        'success',          true,
        'journal_entry_id', v_entry_id,
        'reference_no',     v_ref_no,
        'amount_disbursed', v_loan.principal_amount
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;\n$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Grant execution rights to authenticated users
-- (RLS on underlying tables still applies for row-level access control)
GRANT EXECUTE ON FUNCTION reverse_repayment(UUID, UUID, UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION write_off_loan(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION disburse_loan(UUID, UUID, UUID, TEXT) TO authenticated;

