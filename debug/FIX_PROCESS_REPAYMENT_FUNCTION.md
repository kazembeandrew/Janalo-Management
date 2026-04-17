# Fix Missing process_repayment_with_idempotency Function

## Problem
Error: `Could not find the function public.process_repayment_with_idempotency(p_account_id, p_amount, p_idempotency_key, p_loan_id, p_notes, p_payment_date, p_payment_method, p_reference, p_user_id)`

## Root Cause
The function signature in the migration file doesn't match what the frontend is calling. The frontend uses named parameters in a different order than defined.

## Solution Applied

### Option 1: Apply Direct SQL Fix (RECOMMENDED - FASTEST)

Run the fix script directly against your database:

```bash
# Using psql command line
psql -h <your-db-host> -U postgres -d postgres -f debug/fix_process_repayment_function.sql
```

Or via Supabase Dashboard:
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents from `debug/fix_process_repayment_function.sql`
3. Execute the script

### Option 2: Re-apply Migration

If you prefer to re-apply the entire migration:

```bash
# Check if migration was applied
psql -h <host> -U postgres -d postgres -c "SELECT * FROM supabase_migrations.schema_migrations WHERE version = '20260402120000';"
```

If not applied, apply it manually or wait for automatic migration.

## Verification

After applying the fix, verify the function exists:

```sql
-- Check function exists
SELECT 
    proname as function_name,
    pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc
WHERE proname = 'process_repayment_with_idempotency'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
```

Expected output:
```
function_name                | arguments
-----------------------------+----------------------------------------------------
process_repayment_with_idempotency | uuid, numeric, uuid, uuid, text, date, text, text, uuid
```

## Test the Fix

Test the function works correctly:

```sql
-- Test basic execution (without actual data)
SELECT public.process_repayment_with_idempotency(
    p_account_id := '00000000-0000-0000-0000-000000000000'::uuid,
    p_amount := 100.00,
    p_idempotency_key := '00000000-0000-0000-0000-000000000000'::uuid,
    p_loan_id := '00000000-0000-0000-0000-000000000000'::uuid,
    p_notes := 'test',
    p_payment_date := CURRENT_DATE,
    p_payment_method := 'cash',
    p_reference := 'test-ref',
    p_user_id := auth.uid()
);
-- Should return error about invalid loan/account (but function EXISTS)
```

## Related Functions

This fix also requires these functions to exist:
- ✅ `process_repayment_atomic()` - Core atomic repayment processing
- ✅ `bulk_disburse_loans_secure()` - Bulk loan disbursement
- ✅ `recalculate_all_arrears()` - Arrears calculation

If any of these are missing, they're defined in:
- `supabase/migrations/20260402120000_critical_loan_lifecycle_fixes.sql`

## Frontend Integration

The frontend calls this function from:
- `src/services/repayments.ts` line 129

No frontend changes needed - the fix aligns the database function with existing frontend code.

## Next Steps

1. Apply the SQL fix script
2. Verify function exists
3. Test repayment processing in the UI
4. Monitor for any remaining errors
