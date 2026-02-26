-- Atomic Financial Transaction Functions
-- These functions ensure ACID compliance for all financial operations
-- Prevent partial failures, race conditions, and data corruption

-- 1. Process Repayment Atomically
CREATE OR REPLACE FUNCTION process_repayment(
    p_loan_id UUID,
    p_amount DECIMAL(15,2),
    p_account_id UUID,
    p_user_id UUID,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_loan RECORD;
    v_distribution JSONB;
    v_repayment_id UUID;
    v_journal_entry_id UUID;
    v_portfolio_acc_id UUID;
    v_interest_acc_id UUID;
    v_is_fully_paid BOOLEAN;
    v_remaining_principal DECIMAL(15,2);
    v_remaining_interest DECIMAL(15,2);
    v_remaining_penalty DECIMAL(15,2);
BEGIN
    -- Check idempotency if key provided
    IF p_idempotency_key IS NOT NULL THEN
        PERFORM 1 FROM repayments WHERE idempotency_key = p_idempotency_key;
        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Duplicate transaction - idempotency key already used',
                'repayment_id', (SELECT id FROM repayments WHERE idempotency_key = p_idempotency_key LIMIT 1)
            );
        END IF;
    END IF;

    -- Lock loan record for update (prevents concurrent modifications)
    SELECT * INTO v_loan 
    FROM loans 
    WHERE id = p_loan_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
    END IF;

    -- Verify loan is active
    IF v_loan.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Loan is not active');
    END IF;

    -- Lock source account (funds verification)
    PERFORM 1 FROM internal_accounts WHERE id = p_account_id FOR UPDATE;

    -- Calculate repayment distribution
    v_remaining_penalty := GREATEST(0, COALESCE(v_loan.penalty_outstanding, 0));
    v_remaining_interest := GREATEST(0, v_loan.interest_outstanding);
    v_remaining_principal := GREATEST(0, v_loan.principal_outstanding);

    DECLARE
        v_amount_remaining DECIMAL(15,2) := p_amount;
        v_penalty_paid DECIMAL(15,2) := 0;
        v_interest_paid DECIMAL(15,2) := 0;
        v_principal_paid DECIMAL(15,2) := 0;
        v_overpayment DECIMAL(15,2) := 0;
    BEGIN
        -- Pay penalty first
        IF v_remaining_penalty > 0 THEN
            v_penalty_paid := LEAST(v_amount_remaining, v_remaining_penalty);
            v_amount_remaining := v_amount_remaining - v_penalty_paid;
        END IF;

        -- Pay interest second
        IF v_amount_remaining > 0 AND v_remaining_interest > 0 THEN
            v_interest_paid := LEAST(v_amount_remaining, v_remaining_interest);
            v_amount_remaining := v_amount_remaining - v_interest_paid;
        END IF;

        -- Pay principal last
        IF v_amount_remaining > 0 AND v_remaining_principal > 0 THEN
            v_principal_paid := LEAST(v_amount_remaining, v_remaining_principal);
            v_amount_remaining := v_amount_remaining - v_principal_paid;
        END IF;

        -- Overpayment
        v_overpayment := v_amount_remaining;

        -- Determine if fully paid
        v_is_fully_paid := (v_remaining_principal - v_principal_paid) <= 0.01;

        -- Store distribution for return
        v_distribution := jsonb_build_object(
            'principal_paid', v_principal_paid,
            'interest_paid', v_interest_paid,
            'penalty_paid', v_penalty_paid,
            'overpayment', v_overpayment,
            'is_fully_paid', v_is_fully_paid,
            'remaining_principal', GREATEST(0, v_remaining_principal - v_principal_paid),
            'remaining_interest', GREATEST(0, v_remaining_interest - v_interest_paid),
            'remaining_penalty', GREATEST(0, v_remaining_penalty - v_penalty_paid)
        );

        -- 1. Create repayment record
        INSERT INTO repayments (
            loan_id, amount_paid, principal_paid, interest_paid, penalty_paid, 
            overpayment, payment_date, recorded_by, idempotency_key
        ) VALUES (
            p_loan_id, p_amount, v_principal_paid, v_interest_paid, v_penalty_paid,
            v_overpayment, CURRENT_DATE, p_user_id, p_idempotency_key
        )
        RETURNING id INTO v_repayment_id;

        -- 2. Get system accounts for journal entry
        SELECT id INTO v_portfolio_acc_id FROM internal_accounts WHERE account_code = 'PORTFOLIO';
        SELECT id INTO v_interest_acc_id FROM internal_accounts WHERE account_code = 'EQUITY';

        IF v_portfolio_acc_id IS NULL OR v_interest_acc_id IS NULL THEN
            RAISE EXCEPTION 'System accounts not found';
        END IF;

        -- 3. Create journal entry header
        INSERT INTO journal_entries (reference_type, reference_id, description, created_by, date)
        VALUES ('repayment', v_repayment_id, 'Repayment from ' || v_loan.reference_no, p_user_id, CURRENT_DATE)
        RETURNING id INTO v_journal_entry_id;

        -- 4. Create journal lines (balanced entry)
        INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES
            (v_journal_entry_id, p_account_id, p_amount, 0),  -- Debit cash/bank
            (v_journal_entry_id, v_portfolio_acc_id, 0, v_principal_paid),  -- Credit portfolio
            (v_journal_entry_id, v_interest_acc_id, 0, v_interest_paid + v_penalty_paid);  -- Credit interest revenue

        -- 5. Update loan balances
        UPDATE loans SET
            principal_outstanding = GREATEST(0, v_remaining_principal - v_principal_paid),
            interest_outstanding = GREATEST(0, v_remaining_interest - v_interest_paid),
            penalty_outstanding = GREATEST(0, v_remaining_penalty - v_penalty_paid),
            status = CASE WHEN v_is_fully_paid THEN 'completed' ELSE 'active' END,
            updated_at = NOW(),
            updated_by = p_user_id
        WHERE id = p_loan_id;

        -- 6. Add system note
        INSERT INTO loan_notes (loan_id, user_id, content, is_system)
        VALUES (
            p_loan_id, 
            p_user_id, 
            format('Repayment of MK %s recorded. Principal: MK %s, Interest: MK %s, Penalty: MK %s%s',
                p_amount, v_principal_paid, v_interest_paid, v_penalty_paid,
                CASE WHEN v_overpayment > 0 THEN format(', Overpayment: MK %s', v_overpayment) ELSE '' END
            ),
            true
        );

        -- 7. Log audit
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (
            p_user_id, 'Repayment Recorded', 'repayment', v_repayment_id,
            jsonb_build_object('amount', p_amount, 'distribution', v_distribution)
        );

        RETURN jsonb_build_object(
            'success', true,
            'repayment_id', v_repayment_id,
            'journal_entry_id', v_journal_entry_id,
            'distribution', v_distribution
        );
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Atomic Bulk Loan Disbursement
CREATE OR REPLACE FUNCTION bulk_disburse_loans(
    p_loan_ids UUID[],
    p_source_account_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_loan RECORD;
    v_total_amount DECIMAL(15,2) := 0;
    v_source_balance DECIMAL(15,2);
    v_journal_entry_id UUID;
    v_portfolio_acc_id UUID;
    v_disbursed_ids UUID[] := ARRAY[]::UUID[];
    v_failed_ids UUID[] := ARRAY[]::UUID[];
BEGIN
    -- Lock source account and verify liquidity
    SELECT balance INTO v_source_balance 
    FROM internal_accounts 
    WHERE id = p_source_account_id 
    FOR UPDATE;

    IF v_source_balance IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Source account not found');
    END IF;

    -- Calculate total disbursement needed
    SELECT COALESCE(SUM(principal_amount), 0) INTO v_total_amount
    FROM loans 
    WHERE id = ANY(p_loan_ids) AND status = 'pending';

    IF v_total_amount > v_source_balance THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', format('Insufficient funds. Required: %s, Available: %s', v_total_amount, v_source_balance)
        );
    END IF;

    -- Get portfolio account
    SELECT id INTO v_portfolio_acc_id FROM internal_accounts WHERE account_code = 'PORTFOLIO';
    IF v_portfolio_acc_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Portfolio account not found');
    END IF;

    -- Create journal entry header for bulk disbursement
    INSERT INTO journal_entries (reference_type, reference_id, description, created_by, date)
    VALUES ('bulk_disbursement', NULL, format('Bulk disbursement of %s loans', array_length(p_loan_ids, 1)), p_user_id, CURRENT_DATE)
    RETURNING id INTO v_journal_entry_id;

    -- Process each loan
    FOREACH v_loan IN ARRAY (
        SELECT ARRAY_AGG(l) FROM loans l 
        WHERE l.id = ANY(p_loan_ids) AND l.status = 'pending' 
        FOR UPDATE
    )
    LOOP
        BEGIN
            -- Update loan status
            UPDATE loans SET
                status = 'active',
                updated_at = NOW(),
                updated_by = p_user_id
            WHERE id = v_loan.id;

            -- Create journal line
            INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES
                (v_journal_entry_id, v_portfolio_acc_id, v_loan.principal_amount, 0),  -- Debit portfolio
                (v_journal_entry_id, p_source_account_id, 0, v_loan.principal_amount);  -- Credit source

            -- Add note
            INSERT INTO loan_notes (loan_id, user_id, content, is_system)
            VALUES (v_loan.id, p_user_id, 'Loan disbursed via bulk action', true);

            v_disbursed_ids := array_append(v_disbursed_ids, v_loan.id);

        EXCEPTION WHEN OTHERS THEN
            v_failed_ids := array_append(v_failed_ids, v_loan.id);
        END;
    END LOOP;

    -- Log audit
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
        p_user_id, 'Bulk Disbursement', 'bulk_operation', v_journal_entry_id,
        jsonb_build_object('success_count', array_length(v_disbursed_ids, 1), 'failed_count', array_length(v_failed_ids, 1))
    );

    RETURN jsonb_build_object(
        'success', array_length(v_failed_ids, 1) = 0,
        'disbursed_count', array_length(v_disbursed_ids, 1),
        'failed_count', array_length(v_failed_ids, 1),
        'disbursed_ids', v_disbursed_ids,
        'failed_ids', v_failed_ids,
        'journal_entry_id', v_journal_entry_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Reverse Repayment Atomically
CREATE OR REPLACE FUNCTION reverse_repayment(
    p_repayment_id UUID,
    p_user_id UUID,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_repayment RECORD;
    v_loan RECORD;
    v_journal_entry_id UUID;
    v_portfolio_acc_id UUID;
    v_interest_acc_id UUID;
BEGIN
    -- Lock repayment and loan
    SELECT * INTO v_repayment FROM repayments WHERE id = p_repayment_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Repayment not found');
    END IF;

    SELECT * INTO v_loan FROM loans WHERE id = v_repayment.loan_id FOR UPDATE;

    -- Check if already reversed
    IF EXISTS (SELECT 1 FROM journal_entries WHERE reference_type = 'reversal' AND reference_id = p_repayment_id::TEXT) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Repayment already reversed');
    END IF;

    -- Get system accounts
    SELECT id INTO v_portfolio_acc_id FROM internal_accounts WHERE account_code = 'PORTFOLIO';
    SELECT id INTO v_interest_acc_id FROM internal_accounts WHERE account_code = 'EQUITY';

    -- Create reversal journal entry
    INSERT INTO journal_entries (reference_type, reference_id, description, created_by, date)
    VALUES ('reversal', p_repayment_id, format('Reversal of repayment %s: %s', p_repayment_id, p_reason), p_user_id, CURRENT_DATE)
    RETURNING id INTO v_journal_entry_id;

    -- Create reversal journal lines (swap debits/credits)
    -- Original: Debit Cash, Credit Portfolio, Credit Interest
    -- Reversal: Credit Cash, Debit Portfolio, Debit Interest
    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES
        (v_journal_entry_id, v_repayment.recorded_by, 0, v_repayment.amount_paid),  -- Credit cash back
        (v_journal_entry_id, v_portfolio_acc_id, v_repayment.principal_paid, 0),  -- Debit portfolio
        (v_journal_entry_id, v_interest_acc_id, v_repayment.interest_paid + v_repayment.penalty_paid, 0);  -- Debit interest

    -- Restore loan balances
    UPDATE loans SET
        principal_outstanding = principal_outstanding + v_repayment.principal_paid,
        interest_outstanding = interest_outstanding + v_repayment.interest_paid,
        penalty_outstanding = COALESCE(penalty_outstanding, 0) + v_repayment.penalty_paid,
        status = 'active',  -- Always set back to active
        updated_at = NOW(),
        updated_by = p_user_id
    WHERE id = v_repayment.loan_id;

    -- Add note
    INSERT INTO loan_notes (loan_id, user_id, content, is_system)
    VALUES (v_repayment.loan_id, p_user_id, format('Repayment reversed: %s', p_reason), true);

    -- Log audit
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (p_user_id, 'Repayment Reversed', 'repayment', p_repayment_id, jsonb_build_object('reason', p_reason));

    RETURN jsonb_build_object(
        'success', true,
        'reversal_journal_entry_id', v_journal_entry_id,
        'loan_id', v_repayment.loan_id,
        'amount_reversed', v_repayment.amount_paid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trial Balance Verification Function
CREATE OR REPLACE FUNCTION verify_trial_balance(
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    is_balanced BOOLEAN,
    total_debits DECIMAL(15,2),
    total_credits DECIMAL(15,2),
    difference DECIMAL(15,2),
    unbalanced_entries UUID[]
) AS $$
DECLARE
    v_total_debits DECIMAL(15,2);
    v_total_credits DECIMAL(15,2);
    v_difference DECIMAL(15,2);
BEGIN
    -- Calculate totals for the date
    SELECT 
        COALESCE(SUM(jl.debit), 0),
        COALESCE(SUM(jl.credit), 0)
    INTO v_total_debits, v_total_credits
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    WHERE je.date = p_date;

    v_difference := ABS(v_total_debits - v_total_credits);

    -- Find unbalanced entries if any
    RETURN QUERY
    SELECT 
        v_difference < 0.01,
        v_total_debits,
        v_total_credits,
        v_difference,
        ARRAY(
            SELECT je.id 
            FROM journal_entries je
            JOIN journal_lines jl ON jl.journal_entry_id = je.id
            WHERE je.date = p_date
            GROUP BY je.id
            HAVING ABS(SUM(jl.debit) - SUM(jl.credit)) > 0.01
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Idempotency Check Function
CREATE OR REPLACE FUNCTION check_idempotency(
    p_key TEXT,
    p_entity_type TEXT
)
RETURNS TABLE (
    is_duplicate BOOLEAN,
    existing_id UUID,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        true,
        id,
        created_at
    FROM audit_logs
    WHERE details->>'idempotency_key' = p_key
    AND entity_type = p_entity_type
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TIMESTAMP WITH TIME ZONE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. Lock Account for Update (Prevent Race Conditions)
CREATE OR REPLACE FUNCTION lock_account(
    p_account_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_account RECORD;
BEGIN
    SELECT * INTO v_account FROM internal_accounts WHERE id = p_account_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Account not found');
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'account_id', v_account.id,
        'balance', v_account.balance,
        'locked', true
    );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION process_repayment(UUID, DECIMAL, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_disburse_loans(UUID[], UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reverse_repayment(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_trial_balance(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION check_idempotency(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION lock_account(UUID) TO authenticated;
