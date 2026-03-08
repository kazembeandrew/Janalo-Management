import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function enableRealtimeForAllTables() {
  console.log('Enabling realtime for all tables that require it...');

  try {
    // Read the migration file
    const migrationSQL = fs.readFileSync('./supabase/migrations/20260301140000_enable_realtime_all_tables.sql', 'utf8');

    console.log('Applying realtime migration...');

    // Split the SQL into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);

        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });

          if (error) {
            console.error(`Error in statement ${i + 1}:`, error);
            // Continue with other statements
          } else {
            console.log(`✓ Statement ${i + 1} executed successfully`);
          }
        } catch (err) {
          console.error(`Failed to execute statement ${i + 1}:`, err.message);
          // Continue with other statements
        }
      }
    }

    console.log('Realtime migration completed!');
    console.log('Note: You may need to enable realtime subscriptions in the Supabase dashboard for each table.');

  } catch (error) {
    console.error('Error applying realtime migration:', error);
  }
}

enableRealtimeForAllTables();
