-- Find valid loan officers for testing
SELECT id, email, role, created_at 
FROM public.users 
WHERE role = 'loan_officer' 
ORDER BY created_at 
LIMIT 5;
