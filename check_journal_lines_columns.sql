-- Check what columns exist in journal_lines table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'journal_lines' 
ORDER BY ordinal_position;
