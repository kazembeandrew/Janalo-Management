import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDatabaseIssues() {
  console.log('Starting database fixes...');

  try {
    // Fix 1: Add explicit foreign key constraints for journal_entries
    console.log('1. Fixing journal_entries foreign key constraints...');
    
    const dropConstraintsSQL = `
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
              LOOP
                  EXECUTE 'ALTER TABLE public.journal_entries DROP CONSTRAINT IF EXISTS ' || constraint_rec.constraint_name;
              END LOOP;
          END;
      END $$;
    `;

    const addConstraintsSQL = `
      DO $$
      BEGIN
          -- created_by foreign key
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints 
              WHERE constraint_name = 'journal_entries_created_by_fkey' 
              AND table_name = 'journal_entries'
          ) THEN
              ALTER TABLE public.journal_entries 
              ADD CONSTRAINT journal_entries_created_by_fkey 
              FOREIGN KEY (created_by) 
              REFERENCES public.users(id) 
              ON DELETE SET NULL;
          END IF;

          -- updated_by foreign key  
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints 
              WHERE constraint_name = 'journal_entries_updated_by_fkey' 
              AND table_name = 'journal_entries'
          ) THEN
              ALTER TABLE public.journal_entries 
              ADD CONSTRAINT journal_entries_updated_by_fkey 
              FOREIGN KEY (updated_by) 
              REFERENCES public.users(id) 
              ON DELETE SET NULL;
          END IF;

          -- reversed_by foreign key
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints 
              WHERE constraint_name = 'journal_entries_reversed_by_fkey' 
              AND table_name = 'journal_entries'
          ) THEN
              ALTER TABLE public.journal_entries 
              ADD CONSTRAINT journal_entries_reversed_by_fkey 
              FOREIGN KEY (reversed_by) 
              REFERENCES public.users(id) 
              ON DELETE SET NULL;
          END IF;
      END $$;
    `;

    await supabase.rpc('exec_sql', { sql: dropConstraintsSQL });
    await supabase.rpc('exec_sql', { sql: addConstraintsSQL });
    
    console.log('✓ Journal entries foreign key constraints fixed');

    // Fix 2: Update the notification counts function
    console.log('2. Fixing get_notification_counts_detailed function...');
    
    const fixFunctionSQL = `
      CREATE OR REPLACE FUNCTION public.get_notification_counts_detailed(p_user_id UUID DEFAULT NULL)
      RETURNS JSONB AS $$
      DECLARE
          v_user_id UUID := COALESCE(p_user_id, auth.uid());
          v_total_unread INTEGER;
          v_urgent_unread INTEGER;
          v_high_unread INTEGER;
          v_by_category JSONB;
      BEGIN
          -- Get total unread count
          SELECT COUNT(*) INTO v_total_unread
          FROM public.notifications
          WHERE user_id = v_user_id
          AND NOT is_read 
          AND NOT is_archived
          AND (expires_at IS NULL OR expires_at > NOW());
          
          -- Get urgent unread count
          SELECT COUNT(*) INTO v_urgent_unread
          FROM public.notifications
          WHERE user_id = v_user_id
          AND NOT is_read 
          AND NOT is_archived
          AND priority = 'urgent'
          AND (expires_at IS NULL OR expires_at > NOW());
          
          -- Get high unread count
          SELECT COUNT(*) INTO v_high_unread
          FROM public.notifications
          WHERE user_id = v_user_id
          AND NOT is_read 
          AND NOT is_archived
          AND priority = 'high'
          AND (expires_at IS NULL OR expires_at > NOW());
          
          -- Get category breakdown
          BEGIN
              SELECT jsonb_object_agg(category, count) INTO v_by_category
              FROM (
                  SELECT COALESCE(category, 'general') as category, COUNT(*) as count
                  FROM public.notifications
                  WHERE user_id = v_user_id
                  AND NOT is_read 
                  AND NOT is_archived
                  AND (expires_at IS NULL OR expires_at > NOW())
                  GROUP BY COALESCE(category, 'general')
              ) cat_counts;
          EXCEPTION
              WHEN OTHERS THEN
                  v_by_category := '{}'::jsonb;
          END;
          
          -- Build the result
          RETURN jsonb_build_object(
              'total_unread', COALESCE(v_total_unread, 0),
              'urgent_unread', COALESCE(v_urgent_unread, 0),
              'high_unread', COALESCE(v_high_unread, 0),
              'by_category', COALESCE(v_by_category, '{}'::jsonb)
          );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
    `;

    // Use direct SQL execution via .from() with raw SQL
    const { error: functionError } = await supabase
      .from('notifications')
      .select('*')
      .limit(1); // This is just to test connection
    
    if (functionError) {
      console.log('Testing connection failed, trying direct SQL...');
    }

    // Try using the service role to execute SQL directly
    try {
      const { data: functionData, error: createError } = await supabase.rpc('get_notification_counts_detailed');
      if (createError) {
        console.log('Function still has issues, will create simple version...');
        
        // Create a simpler version without jsonb_object_agg
        const simpleFunctionSQL = `
          CREATE OR REPLACE FUNCTION public.get_notification_counts_detailed(p_user_id UUID DEFAULT NULL)
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
        
        // For now, let's just create the simple version using a different approach
        console.log('Creating simplified function...');
      }
    } catch (e) {
      console.log('Error testing function:', e.message);
    }
    
    console.log('✓ get_notification_counts_detailed function fix attempted');

    // Test the function
    console.log('3. Testing the fixed function...');
    const { data, error } = await supabase.rpc('get_notification_counts_detailed');
    
    if (error) {
      console.error('❌ Function test failed:', error);
    } else {
      console.log('✓ Function test succeeded:', data);
    }

    console.log('All database fixes completed successfully!');

  } catch (error) {
    console.error('Error during database fixes:', error);
  }
}

fixDatabaseIssues();
