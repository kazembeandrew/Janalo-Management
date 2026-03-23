-- PAR (Portfolio at Risk) and Provisioning Calculation
-- Critical for regulatory compliance and risk management
-- Runs daily to classify overdue loans and create provisioning entries

CREATE OR REPLACE FUNCTION calculate_par_and_provision()
RETURNS JSONB AS $$
DECLARE
    v_loan RECORD;
    v_days_overdue INT;
    v_provision_rate DECIMAL(5,4) := 0;
    v_provision_amount DECIMAL(15,2);
    v_current_provision DECIMAL(15,2);
    v_provision_difference DECIMAL(15,2);
    v_provision_acc_id UUID;
    v_loss_acc_id UUID;
    v_journal_entry_id UUID;
    v_processed_count INT := 0;
    v_provisioned_count INT := 0;
    v_total_provision DECIMAL(15,2) := 0;
BEGIN
    -- Get system accounts
    SELECT id INTO v_provision_acc_id FROM internal_accounts WHERE account_code = 'PROVISION';
    SELECT id INTO v_loss_acc_id FROM internal_accounts WHERE account_code = 'LOSS_PROVISION';

    -- If provision account doesn't exist, create it
    IF v_provision_acc_id IS NULL THEN
        INSERT INTO internal_accounts (
            name, account_code, account_category, description, is_system_account
        ) VALUES (
            'Loan Loss Provision', 'PROVISION', 'liability', 'Accumulated provision for loan losses', true
        ) RETURNING id INTO v_provision_acc_id;
    END IF;

    -- Process each active loan
    FOR v_loan IN
        SELECT
            l.id,
            l.principal_outstanding,
            l.reference_no,
            l.status,
            -- Calculate days since last repayment
            CASE
                WHEN r.last_payment IS NOT NULL THEN CURRENT_DATE - r.last_payment::DATE
                ELSE CURRENT_DATE - l.disbursement_date::DATE
            END as days_overdue
        FROM loans l
        LEFT JOIN (
            SELECT loan_id, MAX(payment_date) as last_payment
            FROM repayments
            GROUP BY loan_id
        ) r ON r.loan_id = l.id
        WHERE l.status IN ('active', 'defaulted')
        AND l.principal_outstanding > 0
    LOOP
        v_processed_count := v_processed_count + 1;

        -- Determine provision rate based on PAR classification
        -- Malawi Banking regulations require provisioning based on overdue days
        CASE
            WHEN v_loan.days_overdue >= 180 THEN v_provision_rate := 1.0;    -- 100% - Write-off
            WHEN v_loan.days_overdue >= 90 THEN v_provision_rate := 0.75;    -- 75% - Doubtful
            WHEN v_loan.days_overdue >= 60 THEN v_provision_rate := 0.5;     -- 50% - Substandard
            WHEN v_loan.days_overdue >= 30 THEN v_provision_rate := 0.25;    -- 25% - Special mention
            ELSE v_provision_rate := 0;  -- Current
        END CASE;

        v_provision_amount := v_loan.principal_outstanding * v_provision_rate;

        -- Get current provision for this loan
        SELECT COALESCE(SUM(amount), 0) INTO v_current_provision
        FROM loan_provisions
        WHERE loan_id = v_loan.id AND status = 'active';

        v_provision_difference := v_provision_amount - v_current_provision;

        -- Only create journal entry if provision amount changed significantly
        IF ABS(v_provision_difference) > 0.01 THEN
            -- Create journal entry for provision adjustment
            INSERT INTO journal_entries (
                reference_type,
                reference_id,
                description,
                created_by,
                date
            ) VALUES (
                'provision_adjustment',
                v_loan.id,
                format('PAR Provision adjustment for %s (%s days overdue)',
                       v_loan.reference_no, v_loan.days_overdue),
                (SELECT id FROM users WHERE role = 'admin' LIMIT 1), -- System user
                CURRENT_DATE
            ) RETURNING id INTO v_journal_entry_id;

            -- Create journal lines
            IF v_provision_difference > 0 THEN
                -- Increase provision (debit expense, credit provision liability)
                INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES
                    (v_journal_entry_id, v_loss_acc_id, v_provision_difference, 0),  -- Debit loss provision expense
                    (v_journal_entry_id, v_provision_acc_id, 0, v_provision_difference); -- Credit provision liability
            ELSE
                -- Decrease provision (debit provision liability, credit recovery income)
                INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit) VALUES
                    (v_journal_entry_id, v_provision_acc_id, ABS(v_provision_difference), 0), -- Debit provision liability
                    (v_journal_entry_id, v_loss_acc_id, 0, ABS(v_provision_difference)); -- Credit loss provision expense (recovery)
            END IF;

            -- Update or insert loan provision record
            INSERT INTO loan_provisions (
                loan_id,
                amount,
                provision_rate,
                days_overdue,
                par_classification,
                status,
                calculated_at
            ) VALUES (
                v_loan.id,
                v_provision_amount,
                v_provision_rate,
                v_loan.days_overdue,
                CASE
                    WHEN v_provision_rate = 1.0 THEN 'write_off'
                    WHEN v_provision_rate = 0.75 THEN 'doubtful'
                    WHEN v_provision_rate = 0.5 THEN 'substandard'
                    WHEN v_provision_rate = 0.25 THEN 'special_mention'
                    ELSE 'current'
                END,
                'active',
                CURRENT_TIMESTAMP
            )
            ON CONFLICT (loan_id)
            DO UPDATE SET
                amount = EXCLUDED.amount,
                provision_rate = EXCLUDED.provision_rate,
                days_overdue = EXCLUDED.days_overdue,
                par_classification = EXCLUDED.par_classification,
                calculated_at = EXCLUDED.calculated_at;

            v_provisioned_count := v_provisioned_count + 1;
            v_total_provision := v_total_provision + v_provision_amount;
        END IF;
    END LOOP;

    -- Log completion
    INSERT INTO system_logs (
        level,
        message,
        details,
        created_by
    ) VALUES (
        'info',
        'PAR and Provisioning Calculation Completed',
        jsonb_build_object(
            'processed_loans', v_processed_count,
            'provisioned_loans', v_provisioned_count,
            'total_provision_amount', v_total_provision,
            'calculation_date', CURRENT_DATE
        ),
        (SELECT id FROM users WHERE role = 'admin' LIMIT 1)
    );

    RETURN jsonb_build_object(
        'success', true,
        'processed_loans', v_processed_count,
        'provisioned_loans', v_provisioned_count,
        'total_provision_amount', v_total_provision,
        'calculation_date', CURRENT_DATE
    );
END;
$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant permissions
GRANT EXECUTE ON FUNCTION calculate_par_and_provision() TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_par_and_provision() TO service_role;

-- Create loan_provisions table if it doesn't exist
CREATE TABLE IF NOT EXISTS loan_provisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    provision_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
    days_overdue INTEGER NOT NULL DEFAULT 0,
    par_classification TEXT NOT NULL CHECK (par_classification IN ('current', 'special_mention', 'substandard', 'doubtful', 'write_off')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reversed')),
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_loan_provisions_loan_id ON loan_provisions(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_provisions_status ON loan_provisions(status);
CREATE INDEX IF NOT EXISTS idx_loan_provisions_classification ON loan_provisions(par_classification);

-- Enable RLS
ALTER TABLE loan_provisions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "loan_provisions_select" ON loan_provisions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'ceo', 'accountant', 'loan_officer', 'hr')
        )
    );

CREATE POLICY "loan_provisions_insert" ON loan_provisions
    FOR INSERT WITH CHECK (false); -- Only system can insert

CREATE POLICY "loan_provisions_update" ON loan_provisions
    FOR UPDATE USING (false); -- Only system can update

-- Create system_logs table if it doesn't exist (for audit trail)
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warning', 'error')),
    message TEXT NOT NULL,
    details JSONB,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on system_logs
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for system_logs
CREATE POLICY "system_logs_select" ON system_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'ceo', 'accountant')
        )
    );

-- Add LOSS_PROVISION account if it doesn't exist
INSERT INTO internal_accounts (
    name, account_code, account_category, description, is_system_account, balance
) VALUES (
    'Loan Loss Provision Expense', 'LOSS_PROVISION', 'expense',
    'Expense account for loan loss provisions', true, 0
) ON CONFLICT (account_code) DO NOTHING;
