-- Complete Audit Trail Implementation for All Tables
-- Adds missing audit fields and triggers to ensure complete auditability

-- Ensure update_audit_fields function exists (needed for triggers)
CREATE OR REPLACE FUNCTION update_audit_fields()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 1. Add audit fields to loans table
ALTER TABLE public.loans
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- 2. Add audit fields to repayments table
ALTER TABLE public.repayments
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reversal_reason TEXT,
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Create unique index on idempotency_key (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'repayments' AND indexname = 'idx_repayments_idempotency') THEN
        CREATE UNIQUE INDEX idx_repayments_idempotency ON public.repayments(idempotency_key) WHERE idempotency_key IS NOT NULL;
    END IF;
END $$;

-- 3. Add audit fields to borrowers table
ALTER TABLE public.borrowers
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 4. Add audit fields to expenses table
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- 5. Add audit fields to tasks table
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- 6. Add audit fields to notifications table
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 7. Update existing audit_trail table structure if needed
ALTER TABLE public.audit_trail
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS transaction_id TEXT;

-- 8. Create triggers for automatic audit logging on all tables
DROP TRIGGER IF EXISTS trg_loans_audit ON public.loans;
CREATE TRIGGER trg_loans_audit
AFTER INSERT OR UPDATE OR DELETE ON public.loans
FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

DROP TRIGGER IF EXISTS trg_repayments_audit ON public.repayments;
CREATE TRIGGER trg_repayments_audit
AFTER INSERT OR UPDATE OR DELETE ON public.repayments
FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

DROP TRIGGER IF EXISTS trg_borrowers_audit ON public.borrowers;
CREATE TRIGGER trg_borrowers_audit
AFTER INSERT OR UPDATE OR DELETE ON public.borrowers
FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

DROP TRIGGER IF EXISTS trg_expenses_audit ON public.expenses;
CREATE TRIGGER trg_expenses_audit
AFTER INSERT OR UPDATE OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

DROP TRIGGER IF EXISTS trg_tasks_audit ON public.tasks;
CREATE TRIGGER trg_tasks_audit
AFTER INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

DROP TRIGGER IF EXISTS trg_notifications_audit ON public.notifications;
CREATE TRIGGER trg_notifications_audit
AFTER INSERT OR UPDATE OR DELETE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

-- 9. Create timestamp update triggers
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

DROP TRIGGER IF EXISTS trg_tasks_timestamp ON public.tasks;
CREATE TRIGGER trg_tasks_timestamp
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION update_audit_fields();

DROP TRIGGER IF EXISTS trg_notifications_timestamp ON public.notifications;
CREATE TRIGGER trg_notifications_timestamp
BEFORE UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION update_audit_fields();

-- 10. Enhanced audit trail function with better error handling
CREATE OR REPLACE FUNCTION log_audit_trail()
RETURNS TRIGGER AS $$
DECLARE
    v_new_data JSONB := to_jsonb(NEW);
    v_old_data JSONB := to_jsonb(OLD);
    v_changed_by UUID;
    v_session_id TEXT;
    v_transaction_id TEXT;
BEGIN
    -- Get session and transaction info
    v_session_id := COALESCE(current_setting('app.session_id', true), gen_random_uuid()::TEXT);
    v_transaction_id := txid_current()::TEXT;

    IF TG_OP = 'INSERT' THEN
        -- Try created_by, recorded_by, updated_by, fall back to auth.uid()
        v_changed_by := COALESCE(
            (v_new_data->>'created_by')::UUID,
            (v_new_data->>'recorded_by')::UUID,
            (v_new_data->>'updated_by')::UUID,
            auth.uid()
        );

        BEGIN
            INSERT INTO audit_trail (
                table_name, record_id, action, new_data, changed_by,
                changed_at, session_id, transaction_id
            )
            VALUES (
                TG_TABLE_NAME, NEW.id, 'INSERT', v_new_data, v_changed_by,
                NOW(), v_session_id, v_transaction_id
            );
        EXCEPTION WHEN OTHERS THEN
            -- Log error but don't fail the transaction
            RAISE WARNING 'Failed to log audit trail for INSERT on %: %', TG_TABLE_NAME, SQLERRM;
        END;

        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        -- Try updated_by, fall back to auth.uid()
        v_changed_by := COALESCE(
            (v_new_data->>'updated_by')::UUID,
            auth.uid()
        );

        BEGIN
            INSERT INTO audit_trail (
                table_name, record_id, action, old_data, new_data, changed_by,
                changed_at, session_id, transaction_id
            )
            VALUES (
                TG_TABLE_NAME, NEW.id, 'UPDATE', v_old_data, v_new_data, v_changed_by,
                NOW(), v_session_id, v_transaction_id
            );
        EXCEPTION WHEN OTHERS THEN
            -- Log error but don't fail the transaction
            RAISE WARNING 'Failed to log audit trail for UPDATE on %: %', TG_TABLE_NAME, SQLERRM;
        END;

        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        BEGIN
            INSERT INTO audit_trail (
                table_name, record_id, action, old_data, changed_by,
                changed_at, session_id, transaction_id
            )
            VALUES (
                TG_TABLE_NAME, OLD.id, 'DELETE', v_old_data, auth.uid(),
                NOW(), v_session_id, v_transaction_id
            );
        EXCEPTION WHEN OTHERS THEN
            -- Log error but don't fail the transaction
            RAISE WARNING 'Failed to log audit trail for DELETE on %: %', TG_TABLE_NAME, SQLERRM;
        END;

        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Function to get complete audit trail for compliance reporting
CREATE OR REPLACE FUNCTION get_compliance_audit_trail(
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '90 days',
    p_end_date DATE DEFAULT CURRENT_DATE,
    p_table_name TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    audit_id UUID,
    table_name TEXT,
    record_id UUID,
    action TEXT,
    changed_by UUID,
    changed_by_name TEXT,
    changed_at TIMESTAMP WITH TIME ZONE,
    old_data JSONB,
    new_data JSONB,
    session_id TEXT,
    transaction_id TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        at.id,
        at.table_name,
        at.record_id,
        at.action,
        at.changed_by,
        u.full_name as changed_by_name,
        at.changed_at,
        at.old_data,
        at.new_data,
        at.session_id,
        at.transaction_id
    FROM audit_trail at
    LEFT JOIN users u ON at.changed_by = u.id
    WHERE at.changed_at >= p_start_date
    AND at.changed_at <= p_end_date + INTERVAL '1 day'
    AND (p_table_name IS NULL OR at.table_name = p_table_name)
    AND (p_user_id IS NULL OR at.changed_by = p_user_id)
    ORDER BY at.changed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_compliance_audit_trail(DATE, DATE, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_compliance_audit_trail(DATE, DATE, TEXT, UUID) TO service_role;
