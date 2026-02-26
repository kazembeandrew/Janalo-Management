-- Write-Off Recovery Mechanism
-- Properly handles loan write-offs and subsequent recoveries
-- Tracks written-off amounts separately from active portfolio

-- 1. Create write-offs table
CREATE TABLE IF NOT EXISTS public.loan_write_offs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    written_off_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    written_off_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    
    -- Amounts written off
    principal_written_off DECIMAL(15,2) NOT NULL DEFAULT 0,
    interest_written_off DECIMAL(15,2) NOT NULL DEFAULT 0,
    penalty_written_off DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_written_off DECIMAL(15,2) GENERATED ALWAYS AS (
        principal_written_off + interest_written_off + penalty_written_off
    ) STORED,
    
    -- Write-off reason and approval
    reason TEXT NOT NULL,
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Recovery tracking
    recovery_status TEXT DEFAULT 'none',  -- none, partial, full
    total_recovered DECIMAL(15,2) DEFAULT 0,
    principal_recovered DECIMAL(15,2) DEFAULT 0,
    interest_recovered DECIMAL(15,2) DEFAULT 0,
    penalty_recovered DECIMAL(15,2) DEFAULT 0,
    
    -- Recovery accounting
    recovery_provision_reversal DECIMAL(15,2) DEFAULT 0,
    recovery_income_recognition DECIMAL(15,2) DEFAULT 0,
    
    -- Metadata
    journal_entry_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.loan_write_offs ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Loan officers can view their own write-offs" ON public.loan_write_offs
FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM loans l 
        WHERE l.id = loan_write_offs.loan_id 
        AND l.officer_id = auth.uid()
    )
);

CREATE POLICY "Executives can view all write-offs" ON public.loan_write_offs
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

CREATE POLICY "Executives can create write-offs" ON public.loan_write_offs
FOR INSERT TO authenticated WITH CHECK (get_auth_role() IN ('admin', 'ceo'));

CREATE POLICY "Executives can update write-offs" ON public.loan_write_offs
FOR UPDATE TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

-- 4. Create recovery tracking table
CREATE TABLE IF NOT EXISTS public.loan_recovery_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    write_off_id UUID NOT NULL REFERENCES public.loan_write_offs(id) ON DELETE CASCADE,
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    
    -- Recovery amounts
    amount_recovered DECIMAL(15,2) NOT NULL,
    principal_recovered DECIMAL(15,2) NOT NULL DEFAULT 0,
    interest_recovered DECIMAL(15,2) NOT NULL DEFAULT 0,
    penalty_recovered DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    -- Recovery type
    recovery_type TEXT DEFAULT 'payment',  -- payment, collateral_sale, insurance, other
    description TEXT,
    
    -- Accounting
    journal_entry_id UUID,
    target_account_id UUID REFERENCES public.internal_accounts(id),
    
    -- Metadata
    recovered_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    recovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Enable RLS on recovery payments
ALTER TABLE public.loan_recovery_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view recovery payments" ON public.loan_recovery_payments
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Accountants can record recoveries" ON public.loan_recovery_payments
FOR ALL TO authenticated USING (get_auth_role() IN ('admin', 'ceo', 'accountant'));

-- 6. Function to write off a loan
CREATE OR REPLACE FUNCTION write_off_loan(
    p_loan_id UUID,
    p_user_id UUID,
    p_reason TEXT,
    p_approved_by UUID
)
RETURNS JSONB AS $$
DECLARE
    v_loan RECORD;
    v_write_off_id UUID;
    v_journal_entry_id UUID;
    v_portfolio_acc_id UUID;
    v_provision_acc_id UUID;
BEGIN
    -- Lock loan record
    SELECT * INTO v_loan FROM loans WHERE id = p_loan_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
    END IF;
    
    IF v_loan.status = 'written_off' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Loan already written off');
    END IF;
    
    -- Get system accounts
    SELECT id INTO v_portfolio_acc_id FROM internal_accounts WHERE account_code = 'PORTFOLIO';
    SELECT id INTO v_provision_acc_id FROM internal_accounts WHERE account_code = 'PROVISION';
    
    IF v_portfolio_acc_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Portfolio account not found');
    END IF;
    
    -- Create write-off record
    INSERT INTO loan_write_offs (
        loan_id,
        written_off_by,
        principal_written_off,
        interest_written_off,
        penalty_written_off,
        reason,
        approved_by,
        approved_at
    ) VALUES (
        p_loan_id,
        p_user_id,
        v_loan.principal_outstanding,
        v_loan.interest_outstanding,
        COALESCE(v_loan.penalty_outstanding, 0),
        p_reason,
        p_approved_by,
        NOW()
    )
    RETURNING id INTO v_write_off_id;
    
    -- Create journal entry for write-off
    INSERT INTO journal_entries (
        reference_type, 
        reference_id, 
        description, 
        created_by, 
        date
    )
    VALUES (
        'write_off',
        v_write_off_id,
        format('Write-off of loan %s: %s', v_loan.reference_no, p_reason),
        p_user_id,
        CURRENT_DATE
    )
    RETURNING id INTO v_journal_entry_id;
    
    -- Journal lines: Remove from portfolio, record loss
    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES
        -- Credit portfolio to remove asset
        (v_journal_entry_id, v_portfolio_acc_id, 0, v_loan.principal_outstanding);
    
    -- If provision account exists, reverse provision
    IF v_provision_acc_id IS NOT NULL THEN
        INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit)
        VALUES (v_journal_entry_id, v_provision_acc_id, v_loan.principal_outstanding, 0);
    END IF;
    
    -- Update loan - preserve original amounts but mark as written off
    UPDATE loans SET
        status = 'written_off',
        principal_outstanding = 0,  -- Cleared from active portfolio
        interest_outstanding = 0,
        penalty_outstanding = 0,
        written_off_at = NOW(),
        write_off_id = v_write_off_id,
        updated_at = NOW(),
        updated_by = p_user_id
    WHERE id = p_loan_id;
    
    -- Add note
    INSERT INTO loan_notes (loan_id, user_id, content, is_system)
    VALUES (
        p_loan_id,
        p_user_id,
        format('Loan written off. Principal: %s, Interest: %s, Penalty: %s. Reason: %s',
               v_loan.principal_outstanding,
               v_loan.interest_outstanding,
               COALESCE(v_loan.penalty_outstanding, 0),
               p_reason
        ),
        true
    );
    
    -- Log audit
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
        p_user_id,
        'Loan Written Off',
        'loan',
        p_loan_id,
        jsonb_build_object(
            'principal', v_loan.principal_outstanding,
            'interest', v_loan.interest_outstanding,
            'penalty', v_loan.penalty_outstanding,
            'reason', p_reason
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'write_off_id', v_write_off_id,
        'journal_entry_id', v_journal_entry_id,
        'principal_written_off', v_loan.principal_outstanding,
        'interest_written_off', v_loan.interest_outstanding,
        'penalty_written_off', COALESCE(v_loan.penalty_outstanding, 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to record recovery payment
CREATE OR REPLACE FUNCTION record_recovery_payment(
    p_write_off_id UUID,
    p_loan_id UUID,
    p_amount DECIMAL(15,2),
    p_target_account_id UUID,
    p_recovery_type TEXT,
    p_description TEXT,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_write_off RECORD;
    v_loan RECORD;
    v_recovery_id UUID;
    v_journal_entry_id UUID;
    v_portfolio_acc_id UUID;
    v_income_acc_id UUID;
    v_remaining_principal DECIMAL(15,2);
    v_remaining_interest DECIMAL(15,2);
    v_remaining_penalty DECIMAL(15,2);
    v_principal_recovered DECIMAL(15,2);
    v_interest_recovered DECIMAL(15,2);
    v_penalty_recovered DECIMAL(15,2);
BEGIN
    -- Lock write-off record
    SELECT * INTO v_write_off FROM loan_write_offs WHERE id = p_write_off_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Write-off record not found');
    END IF;
    
    -- Calculate remaining recoverable amounts
    v_remaining_principal := v_write_off.principal_written_off - v_write_off.principal_recovered;
    v_remaining_interest := v_write_off.interest_written_off - v_write_off.interest_recovered;
    v_remaining_penalty := v_write_off.penalty_written_off - v_write_off.penalty_recovered;
    
    -- Allocate recovery: Principal first, then interest, then penalty
    v_principal_recovered := LEAST(p_amount, v_remaining_principal);
    v_interest_recovered := LEAST(p_amount - v_principal_recovered, v_remaining_interest);
    v_penalty_recovered := LEAST(
        p_amount - v_principal_recovered - v_interest_recovered, 
        v_remaining_penalty
    );
    
    -- Get system accounts
    SELECT id INTO v_portfolio_acc_id FROM internal_accounts WHERE account_code = 'PORTFOLIO';
    SELECT id INTO v_income_acc_id FROM internal_accounts WHERE account_code = 'RECOVERY_INCOME';
    
    -- Create recovery payment record
    INSERT INTO loan_recovery_payments (
        write_off_id,
        loan_id,
        amount_recovered,
        principal_recovered,
        interest_recovered,
        penalty_recovered,
        recovery_type,
        description,
        target_account_id,
        recovered_by
    ) VALUES (
        p_write_off_id,
        p_loan_id,
        p_amount,
        v_principal_recovered,
        v_interest_recovered,
        v_penalty_recovered,
        p_recovery_type,
        p_description,
        p_target_account_id,
        p_user_id
    )
    RETURNING id INTO v_recovery_id;
    
    -- Create journal entry
    INSERT INTO journal_entries (
        reference_type,
        reference_id,
        description,
        created_by,
        date
    )
    VALUES (
        'recovery',
        v_recovery_id,
        format('Recovery payment for written-off loan: %s', p_description),
        p_user_id,
        CURRENT_DATE
    )
    RETURNING id INTO v_journal_entry_id;
    
    -- Journal lines
    INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES
        -- Debit cash/bank account
        (v_journal_entry_id, p_target_account_id, p_amount, 0);
    
    -- Credit portfolio if principal recovered
    IF v_principal_recovered > 0 AND v_portfolio_acc_id IS NOT NULL THEN
        INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit)
        VALUES (v_journal_entry_id, v_portfolio_acc_id, 0, v_principal_recovered);
    END IF;
    
    -- Credit income for interest/penalty recovered
    IF (v_interest_recovered + v_penalty_recovered) > 0 AND v_income_acc_id IS NOT NULL THEN
        INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit)
        VALUES (v_journal_entry_id, v_income_acc_id, 0, v_interest_recovered + v_penalty_recovered);
    END IF;
    
    -- Update write-off record
    UPDATE loan_write_offs SET
        total_recovered = total_recovered + p_amount,
        principal_recovered = principal_recovered + v_principal_recovered,
        interest_recovered = interest_recovered + v_interest_recovered,
        penalty_recovered = penalty_recovered + v_penalty_recovered,
        recovery_status = CASE 
            WHEN (total_recovered + p_amount) >= total_written_off THEN 'full'
            ELSE 'partial'
        END,
        updated_at = NOW()
    WHERE id = p_write_off_id;
    
    -- Add note to loan
    INSERT INTO loan_notes (loan_id, user_id, content, is_system)
    VALUES (
        p_loan_id,
        p_user_id,
        format('Recovery recorded: %s (Principal: %s, Interest: %s, Penalty: %s). Type: %s',
               p_amount,
               v_principal_recovered,
               v_interest_recovered,
               v_penalty_recovered,
               p_recovery_type
        ),
        true
    );
    
    -- Log audit
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
        p_user_id,
        'Recovery Recorded',
        'recovery',
        v_recovery_id,
        jsonb_build_object(
            'amount', p_amount,
            'principal', v_principal_recovered,
            'interest', v_interest_recovered,
            'penalty', v_penalty_recovered,
            'type', p_recovery_type
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'recovery_id', v_recovery_id,
        'journal_entry_id', v_journal_entry_id,
        'principal_recovered', v_principal_recovered,
        'interest_recovered', v_interest_recovered,
        'penalty_recovered', v_penalty_recovered,
        'total_written_off', v_write_off.total_written_off,
        'total_recovered', v_write_off.total_recovered + p_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function to get write-off details with recovery summary
CREATE OR REPLACE FUNCTION get_write_off_details(p_loan_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_write_off RECORD;
    v_recoveries JSONB;
BEGIN
    SELECT * INTO v_write_off FROM loan_write_offs WHERE loan_id = p_loan_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('found', false);
    END IF;
    
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'amount', amount_recovered,
            'type', recovery_type,
            'date', recovered_at
        )
    )
    INTO v_recoveries
    FROM loan_recovery_payments
    WHERE write_off_id = v_write_off.id;
    
    RETURN jsonb_build_object(
        'found', true,
        'write_off', to_jsonb(v_write_off),
        'recoveries', COALESCE(v_recoveries, '[]'::jsonb),
        'recovery_rate', CASE 
            WHEN v_write_off.total_written_off > 0 
            THEN (v_write_off.total_recovered / v_write_off.total_written_off) * 100
            ELSE 0
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Indexes
CREATE INDEX IF NOT EXISTS idx_write_offs_loan ON public.loan_write_offs(loan_id);
CREATE INDEX IF NOT EXISTS idx_write_offs_status ON public.loan_write_offs(recovery_status);
CREATE INDEX IF NOT EXISTS idx_recovery_payments_write_off ON public.loan_recovery_payments(write_off_id);
CREATE INDEX IF NOT EXISTS idx_recovery_payments_loan ON public.loan_recovery_payments(loan_id);

-- 10. Add write_off_id to loans table
ALTER TABLE public.loans 
ADD COLUMN IF NOT EXISTS write_off_id UUID REFERENCES public.loan_write_offs(id) ON DELETE SET NULL;

-- Grant permissions
GRANT EXECUTE ON FUNCTION write_off_loan(UUID, UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_recovery_payment(UUID, UUID, DECIMAL, UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_write_off_details(UUID) TO authenticated;
