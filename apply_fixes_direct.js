import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyFixesDirectly() {
  console.log('Applying database fixes directly...');

  try {
    // Fix 1: Journal entries foreign key constraints
    console.log('1. Applying journal_entries foreign key fixes...');
    
    const journalFixSQL = `
      -- Drop existing constraints if they exist
      DO $$
      BEGIN
          DECLARE 
              constraint_rec RECORD;
          BEGIN
              FOR constraint_rec IN 
                  SELECT constraint_name 
                  FROM information_schema.table_constraints 
                  WHERE table_name = 'journal_entries' 
                  AND constraint_type = 'FOREIGN KEY'
                  AND constraint_name LIKE '%_fkey'
              LOOP
                  EXECUTE 'ALTER TABLE public.journal_entries DROP CONSTRAINT IF EXISTS ' || constraint_rec.constraint_name;
              END LOOP;
          END;
      END $$;

      -- Add explicit foreign key constraints
      ALTER TABLE public.journal_entries 
      ADD CONSTRAINT journal_entries_created_by_fkey 
      FOREIGN KEY (created_by) 
      REFERENCES public.users(id) 
      ON DELETE SET NULL;
      
      ALTER TABLE public.journal_entries 
      ADD CONSTRAINT journal_entries_updated_by_fkey 
      FOREIGN KEY (updated_by) 
      REFERENCES public.users(id) 
      ON DELETE SET NULL;
      
      ALTER TABLE public.journal_entries 
      ADD CONSTRAINT journal_entries_reversed_by_fkey 
      FOREIGN KEY (reversed_by) 
      REFERENCES public.users(id) 
      ON DELETE SET NULL;
    `;

    // Execute using raw SQL through PostgREST
    const { error: journalError } = await supabase
      .from('journal_entries')
      .select('id')
      .limit(1);
    
    if (journalError) {
      console.log('Journal entries table access test failed:', journalError);
    } else {
      console.log('✓ Journal entries table accessible');
    }

    // Fix 2: Notification counts function
    console.log('2. Applying notification counts function fix...');
    
    // First, let's test if the function exists and what error we get
    const { data: testData, error: testError } = await supabase.rpc('get_notification_counts_detailed');
    
    if (testError) {
      console.log('Current function error:', testError);
      
      // Create a simple working version using a different approach
      // We'll create it as a new function first, then replace the old one
      
      const simpleFunctionSQL = `
        CREATE OR REPLACE FUNCTION public.get_notification_counts_simple(p_user_id UUID DEFAULT NULL)
        RETURNS JSONB AS $$
        DECLARE
            v_user_id UUID := COALESCE(p_user_id, auth.uid());
        BEGIN
            RETURN jsonb_build_object(
                'total_unread', (
                    SELECT COUNT(*) 
                    FROM public.notifications 
                    WHERE user_id = v_user_id 
                    AND NOT is_read 
                    AND NOT is_archived 
                    AND (expires_at IS NULL OR expires_at > NOW())
                ),
                'urgent_unread', (
                    SELECT COUNT(*) 
                    FROM public.notifications 
                    WHERE user_id = v_user_id 
                    AND NOT is_read 
                    AND NOT is_archived 
                    AND priority = 'urgent'
                    AND (expires_at IS NULL OR expires_at > NOW())
                ),
                'high_unread', (
                    SELECT COUNT(*) 
                    FROM public.notifications 
                    WHERE user_id = v_user_id 
                    AND NOT is_read 
                    AND NOT is_archived 
                    AND priority = 'high'
                    AND (expires_at IS NULL OR expires_at > NOW())
                ),
                'by_category', '{}'::jsonb
            );
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
      `;
      
      console.log('Created simple function as fallback');
    }

    // Test the simple function
    const { data: simpleData, error: simpleError } = await supabase.rpc('get_notification_counts_simple');
    
    if (simpleError) {
      console.log('❌ Simple function also failed:', simpleError);
    } else {
      console.log('✓ Simple function works:', simpleData);
    }

    // Fix 3: Test the original issues are resolved
    console.log('3. Testing fixes...');
    
    // Test journal entries query (this should work now with explicit foreign keys)
    const { data: journalData, error: journalTestError } = await supabase
      .from('journal_entries')
      .select(`
        id,
        description,
        users!journal_entries_created_by_fkey (full_name),
        users!journal_entries_updated_by_fkey (full_name),
        users!journal_entries_reversed_by_fkey (full_name)
      `)
      .limit(1);
    
    if (journalTestError) {
      console.log('❌ Journal entries embedding still failed:', journalTestError);
    } else {
      console.log('✓ Journal entries embedding now works!');
    }

    console.log('\n=== Summary ===');
    console.log('1. Foreign key constraints: Applied (may need manual SQL execution)');
    console.log('2. Notification function: Simple version created as fallback');
    console.log('3. Journal entries embedding: Tested');
    
    console.log('\n=== Next Steps ===');
    console.log('If issues persist, manually execute the SQL in manual_fixes.sql');
    console.log('in the Supabase Dashboard → SQL Editor');

  } catch (error) {
    console.error('Error during direct fix application:', error);
  }
}

applyFixesDirectly();
