-- Backdating Restrictions and Approval Workflow
-- Prevents accounting manipulation and ensures proper audit trail

-- 1. Add backdate_approval table for tracking
CREATE TABLE IF NOT EXISTS public.backdate_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_type TEXT NOT NULL,
    requested_date DATE NOT NULL,
    actual_date DATE NOT NULL,
    days_backdated INTEGER NOT NULL,
    requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending',  -- pending, approved, rejected
    reason TEXT NOT NULL,
    rejection_reason TEXT,
    transaction_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.backdate_approvals ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Users can view their own requests" ON public.backdate_approvals
FOR SELECT TO authenticated USING (requested_by = auth.uid() OR approved_by = auth.uid());

CREATE POLICY "Executives can view all requests" ON public.backdate_approvals
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo'));

CREATE POLICY "Users can create requests" ON public.backdate_approvals
FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Executives can approve requests" ON public.backdate_approvals
FOR UPDATE TO authenticated USING (get_auth_role() IN ('admin', 'ceo'));

-- 4. Function to check if backdating is allowed
CREATE OR REPLACE FUNCTION check_backdate_permission(
    p_transaction_date DATE,
    p_max_backdate_days INTEGER DEFAULT 3,
    p_requires_approval_after INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_days_diff INTEGER;
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Calculate days backdated
    v_days_diff := v_today - p_transaction_date;
    
    -- Future dates not allowed
    IF p_transaction_date > v_today THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'Future dates are not allowed',
            'days_diff', v_days_diff
        );
    END IF;
    
    -- Check if within allowed window
    IF v_days_diff <= p_max_backdate_days THEN
        RETURN jsonb_build_object(
            'allowed', true,
            'requires_approval', false,
            'days_diff', v_days_diff,
            'max_days', p_max_backdate_days
        );
    END IF;
    
    -- Requires approval if beyond window
    IF v_days_diff > p_requires_approval_after THEN
        RETURN jsonb_build_object(
            'allowed', true,
            'requires_approval', true,
            'days_diff', v_days_diff,
            'approval_threshold', p_requires_approval_after,
            'reason', format('Backdating beyond %s days requires executive approval', p_requires_approval_after)
        );
    END IF;
    
    -- Not allowed beyond max
    RETURN jsonb_build_object(
        'allowed', false,
        'reason', format('Backdating beyond %s days is not permitted', p_max_backdate_days),
        'days_diff', v_days_diff,
        'max_days', p_max_backdate_days
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function to request backdate approval
CREATE OR REPLACE FUNCTION request_backdate_approval(
    p_transaction_type TEXT,
    p_requested_date DATE,
    p_actual_date DATE,
    p_reason TEXT,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_check JSONB;
    v_approval_id UUID;
    v_days_diff INTEGER;
BEGIN
    -- Check permission
    v_check := check_backdate_permission(p_actual_date, 3, 0);
    
    IF NOT (v_check->>'allowed')::boolean THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', v_check->>'reason'
        );
    END IF;
    
    v_days_diff := CURRENT_DATE - p_actual_date;
    
    -- Create approval request
    INSERT INTO backdate_approvals (
        transaction_type,
        requested_date,
        actual_date,
        days_backdated,
        requested_by,
        reason,
        status
    ) VALUES (
        p_transaction_type,
        p_requested_date,
        p_actual_date,
        v_days_diff,
        p_user_id,
        p_reason,
        'pending'
    )
    RETURNING id INTO v_approval_id;
    
    -- Create notification for executives
    INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        link
    )
    SELECT 
        id,
        'Backdate Approval Required',
        format('User %s requests backdating %s transaction by %s days', 
               (SELECT full_name FROM users WHERE id = p_user_id),
               p_transaction_type,
               v_days_diff
        ),
        'warning',
        '/settings'
    FROM users 
    WHERE role IN ('admin', 'ceo');
    
    RETURN jsonb_build_object(
        'success', true,
        'approval_id', v_approval_id,
        'status', 'pending',
        'requires_approval', true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function to approve/reject backdate request
CREATE OR REPLACE FUNCTION process_backdate_approval(
    p_approval_id UUID,
    p_approver_id UUID,
    p_approve BOOLEAN,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_approval RECORD;
BEGIN
    SELECT * INTO v_approval FROM backdate_approvals WHERE id = p_approval_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Approval request not found');
    END IF;
    
    IF v_approval.status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Request already processed');
    END IF;
    
    UPDATE backdate_approvals SET
        status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        approved_by = p_approver_id,
        rejection_reason = p_rejection_reason,
        updated_at = NOW()
    WHERE id = p_approval_id;
    
    -- Notify requester
    INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        link
    ) VALUES (
        v_approval.requested_by,
        CASE WHEN p_approve THEN 'Backdate Approved' ELSE 'Backdate Rejected' END,
        CASE 
            WHEN p_approve THEN format('Your backdate request for %s has been approved', v_approval.transaction_type)
            ELSE format('Your backdate request was rejected: %s', COALESCE(p_rejection_reason, 'No reason provided'))
        END,
        CASE WHEN p_approve THEN 'success' ELSE 'error' END,
        '/settings'
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'status', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        'approval_id', p_approval_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Enhanced post_journal_entry with backdate checking
CREATE OR REPLACE FUNCTION post_journal_entry_with_backdate_check(
    p_reference_type TEXT,
    p_reference_id UUID,
    p_description TEXT,
    p_lines JSONB,
    p_user_id UUID,
    p_entry_date DATE DEFAULT CURRENT_DATE,
    p_max_backdate_days INTEGER DEFAULT 3
)
RETURNS JSONB AS $$
DECLARE
    v_backdate_check JSONB;
    v_approval_required BOOLEAN;
    v_journal_entry_id UUID;
    v_total_debit DECIMAL(15,2);
    v_total_credit DECIMAL(15,2);
    v_line RECORD;
BEGIN
    -- Check backdate permission
    v_backdate_check := check_backdate_permission(p_entry_date, p_max_backdate_days, 0);
    
    IF NOT (v_backdate_check->>'allowed')::boolean THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', v_backdate_check->>'reason',
            'requires_approval', false
        );
    END IF;
    
    v_approval_required := COALESCE((v_backdate_check->>'requires_approval')::boolean, false);
    
    -- If approval required, create request and return
    IF v_approval_required THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Backdate approval required',
            'requires_approval', true,
            'check_result', v_backdate_check
        );
    END IF;
    
    -- Validate closed period
    IF EXISTS (SELECT 1 FROM closed_periods WHERE month = to_char(p_entry_date, 'YYYY-MM')) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Period %s is closed', to_char(p_entry_date, 'YYYY-MM'))
        );
    END IF;
    
    -- Calculate totals
    SELECT 
        COALESCE(SUM((l->>'debit')::decimal), 0),
        COALESCE(SUM((l->>'credit')::decimal), 0)
    INTO v_total_debit, v_total_credit
    FROM jsonb_array_elements(p_lines) l;
    
    -- Validate balance
    IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Journal not balanced: Debits %s, Credits %s', v_total_debit, v_total_credit)
        );
    END IF;
    
    -- Create journal entry
    INSERT INTO journal_entries (reference_type, reference_id, description, created_by, date)
    VALUES (p_reference_type, p_reference_id, p_description, p_user_id, p_entry_date)
    RETURNING id INTO v_journal_entry_id;
    
    -- Create journal lines
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit)
        VALUES (
            v_journal_entry_id,
            (v_line->>'account_id')::UUID,
            COALESCE((v_line->>'debit')::decimal, 0),
            COALESCE((v_line->>'credit')::decimal, 0)
        );
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'journal_entry_id', v_journal_entry_id,
        'debits', v_total_debit,
        'credits', v_total_credit
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Add index for performance
CREATE INDEX IF NOT EXISTS idx_backdate_approvals_status ON backdate_approvals(status);
CREATE INDEX IF NOT EXISTS idx_backdate_approvals_requester ON backdate_approvals(requested_by);

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_backdate_permission(DATE, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION request_backdate_approval(TEXT, DATE, DATE, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_backdate_approval(UUID, UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION post_journal_entry_with_backdate_check(TEXT, UUID, TEXT, JSONB, UUID, DATE, INTEGER) TO authenticated;
