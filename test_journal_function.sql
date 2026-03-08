-- Test the journal function with minimal data
-- This will help identify what's failing

-- First, let's check if we have any accounts to test with
SELECT id, name FROM accounts LIMIT 3;

-- Test the function with explicit type casts
SELECT post_journal_entry_with_backdate_check(
    'Test journal entry'::TEXT,             -- p_description
    CURRENT_DATE::DATE,                    -- p_entry_date  
    '[{"account_id": "00000000-0000-0000-0000-000000000000", "debit": "100.00", "credit": "0.00", "description": "Test debit line"}]'::JSONB, -- p_lines
    3::INTEGER,                            -- p_max_backdate_days
    NULL::UUID,                            -- p_reference_id
    NULL::TEXT,                            -- p_reference_type
    NULL::UUID                             -- p_user_id
);

-- Check if any journal entries were created
SELECT * FROM journal_entries ORDER BY created_at DESC LIMIT 3;

-- Check if any journal lines were created
SELECT * FROM journal_lines ORDER BY created_at DESC LIMIT 3;
