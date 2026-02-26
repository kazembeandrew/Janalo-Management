-- Complete Audit Trail Implementation
-- Adds updated_by, updated_at, and automatic audit logging to all financial tables

-- 1. Add audit fields to loans table
ALTER TABLE public.loans 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- 2. Add audit fields to repayments table
ALTER TABLE public.repayments 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reversal_reason TEXT,
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_repayments_idempotency ON public.repayments(idempotency_key);

-- 3. Add audit fields to internal_accounts table
ALTER TABLE public.internal_accounts 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS last_transaction_at TIMESTAMP WITH TIME ZONE;

-- 4. Add audit fields to journal_entries table
ALTER TABLE public.journal_entries 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reversed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reversal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL;

-- 5. Add audit fields to borrowers table
ALTER TABLE public.borrowers 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 6. Add audit fields to expenses table
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- 7. Create comprehensive audit log table
CREATE TABLE IF NOT EXISTS public.audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL,  -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    session_id TEXT
);

-- 8. Enable RLS on audit trail
ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Executives can view all audit trails" ON public.audit_trail
FOR SELECT TO authenticated USING (get_auth_role() IN ('admin', 'ceo'));

CREATE POLICY "Users can view audit trails for their own actions" ON public.audit_trail
FOR SELECT TO authenticated USING (changed_by = auth.uid());

CREATE POLICY "System can insert audit trails" ON public.audit_trail
FOR INSERT TO authenticated WITH CHECK (true);

-- 9. Function to automatically log changes
CREATE OR REPLACE FUNCTION log_audit_trail()
RETURNS TRIGGER AS $$
DECLARE
    v_new_data JSONB := to_jsonb(NEW);
    v_old_data JSONB := to_jsonb(OLD);
    v_changed_by UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Try created_by, then recorded_by, fall back to auth.uid()
        v_changed_by := COALESCE(
            (v_new_data->>'created_by')::UUID,
            (v_new_data->>'recorded_by')::UUID,
            auth.uid()
        );
        INSERT INTO audit_trail (table_name, record_id, action, new_data, changed_by, changed_at)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', v_new_data, v_changed_by, NOW());
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Try updated_by, fall back to auth.uid()
        v_changed_by := COALESCE(
            (v_new_data->>'updated_by')::UUID,
            auth.uid()
        );
        INSERT INTO audit_trail (table_name, record_id, action, old_data, new_data, changed_by, changed_at)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', v_old_data, v_new_data, v_changed_by, NOW());
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_trail (table_name, record_id, action, old_data, changed_by, changed_at)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', v_old_data, auth.uid(), NOW());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create triggers for automatic audit logging
-- Loans audit trigger
DROP TRIGGER IF EXISTS trg_loans_audit ON public.loans;
CREATE TRIGGER trg_loans_audit
AFTER INSERT OR UPDATE OR DELETE ON public.loans
FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

-- Repayments audit trigger
DROP TRIGGER IF EXISTS trg_repayments_audit ON public.repayments;
CREATE TRIGGER trg_repayments_audit
AFTER INSERT OR UPDATE OR DELETE ON public.repayments
FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

-- Borrowers audit trigger
DROP TRIGGER IF EXISTS trg_borrowers_audit ON public.borrowers;
CREATE TRIGGER trg_borrowers_audit
AFTER INSERT OR UPDATE OR DELETE ON public.borrowers
FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

-- Expenses audit trigger
DROP TRIGGER IF EXISTS trg_expenses_audit ON public.expenses;
CREATE TRIGGER trg_expenses_audit
AFTER INSERT OR UPDATE OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

-- Internal accounts audit trigger
DROP TRIGGER IF EXISTS trg_accounts_audit ON public.internal_accounts;
CREATE TRIGGER trg_accounts_audit
AFTER INSERT OR UPDATE OR DELETE ON public.internal_accounts
FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

-- 11. Function to update audit timestamps automatically
CREATE OR REPLACE FUNCTION update_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_at = NOW();
        -- updated_by should be set by application layer
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. Create timestamp update triggers
DROP TRIGGER IF EXISTS trg_loans_timestamp ON public.loans;
CREATE TRIGGER trg_loans_timestamp
BEFORE UPDATE ON public.loans
FOR EACH ROW EXECUTE FUNCTION update_audit_fields();

DROP TRIGGER IF EXISTS trg_repayments_timestamp ON public.repayments;
CREATE TRIGGER trg_repayments_timestamp
BEFORE UPDATE ON public.repayments
FOR EACH ROW EXECUTE FUNCTION update_audit_fields();

DROP TRIGGER IF EXISTS trg_borrowers_timestamp ON public.borrowers;
CREATE TRIGGER trg_borrowers_timestamp
BEFORE UPDATE ON public.borrowers
FOR EACH ROW EXECUTE FUNCTION update_audit_fields();

DROP TRIGGER IF EXISTS trg_expenses_timestamp ON public.expenses;
CREATE TRIGGER trg_expenses_timestamp
BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION update_audit_fields();

DROP TRIGGER IF EXISTS trg_accounts_timestamp ON public.internal_accounts;
CREATE TRIGGER trg_accounts_timestamp
BEFORE UPDATE ON public.internal_accounts
FOR EACH ROW EXECUTE FUNCTION update_audit_fields();

-- 13. Function to get audit trail for a record
CREATE OR REPLACE FUNCTION get_record_audit_trail(
    p_table_name TEXT,
    p_record_id UUID
)
RETURNS TABLE (
    audit_id UUID,
    action TEXT,
    old_data JSONB,
    new_data JSONB,
    changed_by UUID,
    changed_by_name TEXT,
    changed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        at.id,
        at.action,
        at.old_data,
        at.new_data,
        at.changed_by,
        u.full_name as changed_by_name,
        at.changed_at
    FROM audit_trail at
    LEFT JOIN users u ON u.id = at.changed_by
    WHERE at.table_name = p_table_name
    AND at.record_id = p_record_id
    ORDER BY at.changed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Function to detect suspicious activity
CREATE OR REPLACE FUNCTION detect_suspicious_activity()
RETURNS TABLE (
    alert_type TEXT,
    description TEXT,
    affected_records INTEGER,
    first_occurrence TIMESTAMP WITH TIME ZONE,
    last_occurrence TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Detect multiple backdated entries
    RETURN QUERY
    SELECT 
        'Backdated Entries'::TEXT,
        format('Found %s backdated journal entries by user %s', COUNT(*), MAX(u.full_name))::TEXT,
        COUNT(*)::INTEGER,
        MIN(je.date)::TIMESTAMP WITH TIME ZONE,
        MAX(je.date)::TIMESTAMP WITH TIME ZONE
    FROM journal_entries je
    JOIN users u ON u.id = je.created_by
    WHERE je.date < CURRENT_DATE - INTERVAL '3 days'
    AND je.created_at > je.date + INTERVAL '1 day'
    GROUP BY je.created_by
    HAVING COUNT(*) > 3;
    
    -- Detect multiple reversals by same user
    RETURN QUERY
    SELECT 
        'Multiple Reversals'::TEXT,
        format('User %s performed %s reversals', MAX(u.full_name), COUNT(*))::TEXT,
        COUNT(*)::INTEGER,
        MIN(je.created_at)::TIMESTAMP WITH TIME ZONE,
        MAX(je.created_at)::TIMESTAMP WITH TIME ZONE
    FROM journal_entries je
    JOIN users u ON u.id = je.created_by
    WHERE je.reference_type = 'reversal'
    GROUP BY je.created_by
    HAVING COUNT(*) > 5;
    
    -- Detect after-hours activity
    RETURN QUERY
    SELECT 
        'After Hours Activity'::TEXT,
        format('Found %s transactions outside business hours', COUNT(*))::TEXT,
        COUNT(*)::INTEGER,
        MIN(created_at)::TIMESTAMP WITH TIME ZONE,
        MAX(created_at)::TIMESTAMP WITH TIME ZONE
    FROM journal_entries
    WHERE EXTRACT(hour FROM created_at) NOT BETWEEN 8 AND 18
    OR EXTRACT(dow FROM created_at) IN (0, 6);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Create index for audit trail queries
CREATE INDEX IF NOT EXISTS idx_audit_trail_table_record ON public.audit_trail(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_changed_at ON public.audit_trail(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_changed_by ON public.audit_trail(changed_by);

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_record_audit_trail(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION detect_suspicious_activity() TO authenticated;
