-- Check current schema of officer_expense_claims table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'officer_expense_claims'
ORDER BY ordinal_position;
