-- Complete fix for missing RPC function and balance triggers
-- Execute this in Supabase SQL Editor

-- 1. Create the missing post_journal_entry_with_backdate_check function
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

-- 2. Create the missing balance update trigger
CREATE TRIGGER trg_update_account_balance
AFTER INSERT OR UPDATE ON public.journal_lines
FOR EACH ROW EXECUTE FUNCTION public.update_account_balance_from_journal();

-- 3. Create reverse balance function and trigger
CREATE OR REPLACE FUNCTION public.reverse_account_balance_from_journal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category text;
BEGIN
  SELECT account_category INTO v_category FROM public.internal_accounts WHERE id = OLD.account_id;
  
  -- Assets and Expenses decrease with Debits when deleted
  IF v_category IN ('asset', 'expense') THEN
    UPDATE public.internal_accounts 
    SET balance = balance - (OLD.debit - OLD.credit), 
        updated_at = NOW() 
    WHERE id = OLD.account_id;
    
  -- Liabilities, Equity, and Income decrease with Credits when deleted
  ELSIF v_category IN ('liability', 'equity', 'income') THEN
    UPDATE public.internal_accounts 
    SET balance = balance - (OLD.credit - OLD.debit), 
        updated_at = NOW() 
    WHERE id = OLD.account_id;
  END IF;
  
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_reverse_account_balance
AFTER DELETE ON public.journal_lines
FOR EACH ROW EXECUTE FUNCTION public.reverse_account_balance_from_journal();

-- 4. Grant all necessary permissions
GRANT EXECUTE ON FUNCTION post_journal_entry_with_backdate_check(TEXT, UUID, TEXT, JSONB, UUID, DATE, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION reverse_account_balance_from_journal() TO authenticated;
