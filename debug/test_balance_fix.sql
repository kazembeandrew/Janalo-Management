-- Test Balance Update Fix
-- Run this AFTER applying fix_balance_update_trigger.sql

-- Test 1: Check trigger exists
SELECT 
    'Trigger Status' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_trigger 
            WHERE tgname = 'trg_update_account_balance_all'
        ) THEN 'PASS - Trigger exists'
        ELSE 'FAIL - Trigger missing'
    END as result;

-- Test 2: Check function exists
SELECT 
    'Function Status' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'update_account_balance_from_journal'
        ) THEN 'PASS - Function exists'
        ELSE 'FAIL - Function missing'
    END as result;

-- Test 3: Create a test journal entry and verify balance updates
DO $$
DECLARE
    v_test_account_id uuid;
    v_capital_account_id uuid;
    v_journal_entry_id uuid;
    v_before_balance numeric;
    v_after_balance numeric;
    v_test_amount numeric := 1000.00;
BEGIN
    -- Get test account (BANK)
    SELECT id INTO v_test_account_id 
    FROM internal_accounts 
    WHERE account_code = 'BANK' OR code = 'BANK'
    LIMIT 1;
    
    -- Get capital account
    SELECT id INTO v_capital_account_id 
    FROM internal_accounts 
    WHERE account_code = 'CAPITAL' OR code = 'CAPITAL'
    LIMIT 1;
    
    IF v_test_account_id IS NULL OR v_capital_account_id IS NULL THEN
        RAISE NOTICE 'TEST FAILED: Missing required accounts';
        RETURN;
    END IF;
    
    -- Record balance before
    SELECT balance INTO v_before_balance 
    FROM internal_accounts 
    WHERE id = v_test_account_id;
    
    RAISE NOTICE 'Balance before: %', v_before_balance;
    
    -- Create test journal entry manually
    INSERT INTO journal_entries (
        id, entry_number, entry_date, description,
        reference_type, status, created_by, created_at
    ) VALUES (
        gen_random_uuid(),
        (SELECT COALESCE(MAX(entry_number), 0) + 1 FROM journal_entries),
        CURRENT_DATE,
        'TEST - Capital Injection Verification',
        'test',
        'posted',
        auth.uid(),
        NOW()
    ) RETURNING id INTO v_journal_entry_id;
    
    -- Add journal lines
    INSERT INTO journal_lines (
        id, journal_entry_id, account_id, debit, credit, created_at
    ) VALUES
    (gen_random_uuid(), v_journal_entry_id, v_test_account_id, v_test_amount, 0, NOW()),
    (gen_random_uuid(), v_journal_entry_id, v_capital_account_id, 0, v_test_amount, NOW());
    
    -- Check balance after
    SELECT balance INTO v_after_balance 
    FROM internal_accounts 
    WHERE id = v_test_account_id;
    
    RAISE NOTICE 'Balance after: %', v_after_balance;
    
    -- Verify
    IF v_after_balance = v_before_balance + v_test_amount THEN
        RAISE NOTICE 'TEST PASSED: Balance updated correctly by %', v_test_amount;
    ELSE
        RAISE NOTICE 'TEST FAILED: Expected %, got %', v_before_balance + v_test_amount, v_after_balance;
    END IF;
    
    -- Clean up test data
    DELETE FROM journal_lines WHERE journal_entry_id = v_journal_entry_id;
    DELETE FROM journal_entries WHERE id = v_journal_entry_id;
    
END $$;

-- Test 4: Verify trial balance is balanced
SELECT 
    'Trial Balance Test' as test_name,
    CASE 
        WHEN is_balanced THEN 'PASS - Trial balance is balanced'
        ELSE 'FAIL - Trial balance has errors'
    END as result,
    total_debits,
    total_credits,
    difference
FROM verify_trial_balance(CURRENT_DATE);

-- Test 5: Show current account balances
SELECT 
    'Current Balances' as info,
    name as account_name,
    account_code,
    account_category,
    balance as current_balance,
    CASE 
        WHEN balance > 0 THEN 'Positive'
        WHEN balance < 0 THEN 'Negative'
        ELSE 'Zero'
    END as status
FROM internal_accounts
ORDER BY account_category, name;
