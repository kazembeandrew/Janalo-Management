-- Check and fix the reference_id column type issue
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'journal_entries' 
  AND column_name = 'reference_id';

-- Fix the function with explicit UUID casting
CREATE OR REPLACE FUNCTION public.fix_existing_allocation_journal_entries()
RETURNS TABLE(
    allocation_id UUID,
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_allocation RECORD;
    v_officer_advances_id UUID;
    v_cash_account_id UUID;
    v_journal_entry_id UUID;
BEGIN
    -- Get Officer Advances account
    SELECT id INTO v_officer_advances_id FROM public.internal_accounts 
    WHERE account_code = 'OFFICER_ADVANCES' AND is_active != false;
    
    -- Get default Cash account
    SELECT id INTO v_cash_account_id FROM public.internal_accounts 
    WHERE account_code = 'CASH' AND is_active != false
    LIMIT 1;
    
    IF v_cash_account_id IS NULL THEN
        -- Fallback to Bank account
        SELECT id INTO v_cash_account_id FROM public.internal_accounts 
        WHERE account_code = 'BANK' AND is_active != false
        LIMIT 1;
    END IF;

    -- Process each allocation without journal entry
    FOR v_allocation IN
        SELECT * FROM public.officer_fund_allocations 
        WHERE allocation_journal_entry_id IS NULL
    LOOP
        BEGIN
            -- Create journal entry with explicit UUID casting
            INSERT INTO public.journal_entries (
                description,
                entry_date,
                reference_type,
                reference_id,
                status
            ) VALUES (
                'Officer field fund allocation: ' || v_allocation.category || 
                ' advance for period ' || v_allocation.allocated_period || ' (retroactive fix)',
                COALESCE(v_allocation.created_at::DATE, CURRENT_DATE),
                'allocation',
                v_allocation.id,  -- Direct UUID assignment, no casting needed
                'posted'
            )
            RETURNING id INTO v_journal_entry_id;

            -- Create debit line (Officer Advances)
            INSERT INTO public.journal_lines (
                journal_entry_id,
                account_id,
                debit,
                credit,
                line_number
            ) VALUES (
                v_journal_entry_id,
                v_officer_advances_id,
                v_allocation.allocated_amount,
                0,
                1
            );

            -- Create credit line (Cash/Bank)
            INSERT INTO public.journal_lines (
                journal_entry_id,
                account_id,
                debit,
                credit,
                line_number
            ) VALUES (
                v_journal_entry_id,
                v_cash_account_id,
                0,
                v_allocation.allocated_amount,
                2
            );

            -- Update allocation with journal entry reference
            UPDATE public.officer_fund_allocations
            SET allocation_journal_entry_id = v_journal_entry_id
            WHERE id = v_allocation.id;

            RETURN QUERY SELECT v_allocation.id, TRUE, 'Journal entry posted successfully'::TEXT;
            
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT v_allocation.id, FALSE, 'Error: ' || SQLERRM::TEXT;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
