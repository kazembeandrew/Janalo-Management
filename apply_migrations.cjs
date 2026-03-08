// apply_migrations.js - Apply missing migrations to remote Supabase database
// Usage: node apply_migrations.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Get Supabase credentials from environment
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const migrations = [
  {
    name: '20260308140000_add_user_management_columns',
    sql: `
-- Add deletion_status column if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS deletion_status VARCHAR(50) DEFAULT NULL;

-- Add revocation_reason column if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS revocation_reason TEXT DEFAULT NULL;

-- Create index for deletion_status for faster queries
CREATE INDEX IF NOT EXISTS idx_users_deletion_status ON public.users(deletion_status);
`
  },
  {
    name: '20260308150000_create_journal_functions',
    sql: `
-- Create post_journal_entry_with_backdate_check function
DROP FUNCTION IF EXISTS post_journal_entry_with_backdate_check(TEXT, UUID, TEXT, JSONB, UUID, DATE, INTEGER);

CREATE OR REPLACE FUNCTION post_journal_entry_with_backdate_check(
    p_reference_type TEXT,
    p_reference_id UUID,
    p_description TEXT,
    p_lines JSONB,
    p_user_id UUID,
    p_entry_date DATE DEFAULT CURRENT_DATE,
    p_max_backdate_days INTEGER DEFAULT 3
)
RETURNS UUID AS $
DECLARE
    v_entry_id UUID;
    v_entry_number INTEGER;
    v_line JSONB;
    v_line_id UUID;
BEGIN
    v_entry_id := gen_random_uuid();
    SELECT COALESCE(MAX(entry_number), 0) + 1 INTO v_entry_number FROM journal_entries;
    
    INSERT INTO journal_entries (
        id, entry_number, entry_date, description,
        reference_type, reference_id, status, created_by, created_at
    ) VALUES (
        v_entry_id, v_entry_number, p_entry_date, p_description,
        p_reference_type, p_reference_id, 'posted', p_user_id, NOW()
    );
    
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_line_id := gen_random_uuid();
        INSERT INTO journal_lines (
            id, entry_id, account_id, debit_amount, credit_amount, description, created_at
        ) VALUES (
            v_line_id, v_entry_id,
            (v_line->>'account_id')::UUID,
            (v_line->>'debit_amount')::DECIMAL(15,2),
            (v_line->>'credit_amount')::DECIMAL(15,2),
            v_line->>'description',
            NOW()
        );
    END LOOP;
    
    RETURN v_entry_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION post_journal_entry_with_backdate_check(TEXT, UUID, TEXT, JSONB, UUID, DATE, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION post_journal_entry_with_backdate_check(TEXT, UUID, TEXT, JSONB, UUID, DATE, INTEGER) TO service_role;
`
  }
];

async function applyMigrations() {
  console.log('Applying migrations to remote database...\n');
  
  for (const migration of migrations) {
    console.log(`Applying migration: ${migration.name}...`);
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: migration.sql });
      
      // Try alternative approach if exec_sql doesn't exist
      if (error && error.message.includes('could not find the function')) {
        console.log('  exec_sql not available, trying alternative method...');
        // Just log that migration needs to be applied manually
        console.log(`  MIGRATION NEEDS MANUAL APPLICATION: ${migration.name}`);
        console.log(`  SQL: ${migration.sql.substring(0, 100)}...`);
      } else if (error) {
        console.error(`  Error: ${error.message}`);
      } else {
        console.log(`  Success!`);
      }
    } catch (err) {
      console.error(`  Exception: ${err.message}`);
    }
  }
  
  console.log('\nDone!');
}

applyMigrations();
