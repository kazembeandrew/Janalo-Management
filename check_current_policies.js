import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.tfpzehyrkzbenjobkdsz:Jackliness@1993@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkPolicies() {
  try {
    console.log('Checking current RLS policies for system_documents...');
    
    const result = await pool.query(`
      SELECT policyname, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename = 'system_documents'
      ORDER BY cmd, policyname
    `);
    
    if (result.rows.length === 0) {
      console.log('No policies found for system_documents table');
    } else {
      console.log(`\nFound ${result.rows.length} policies:`);
      result.rows.forEach(row => {
        console.log(`  - ${row.policyname}: ${row.cmd}`);
        if (row.qual) console.log(`    USING: ${row.qual}`);
        if (row.with_check) console.log(`    WITH CHECK: ${row.with_check}`);
      });
    }
    
    // Check if RLS is enabled
    const rlsStatus = await pool.query(`
      SELECT rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = 'system_documents'
    `);
    
    console.log(`\nRLS enabled: ${rlsStatus.rows[0].rowsecurity}`);
    
    process.exit(0);
  } catch (err) {
    console.error('Error checking policies:', err.message);
    process.exit(1);
  }
}

checkPolicies();
