import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.tfpzehyrkzbenjobkdsz:Jackliness@1993@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkTables() {
  try {
    // Check all tables with 'system_documents' in the name
    const result = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name LIKE '%system_doc%' OR table_name LIKE '%document%'
      ORDER BY table_schema, table_name
    `);
    
    console.log('Tables with "document" in name:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_schema}.${row.table_name}`);
    });
    
    // Also check all tables in public schema
    const allTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\nAll tables in public schema:');
    allTables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Check for any policies
    const policies = await pool.query(`
      SELECT tablename, policyname, cmd 
      FROM pg_policies 
      WHERE tablename LIKE '%document%'
    `);
    
    console.log('\nDocument-related policies:');
    policies.rows.forEach(row => {
      console.log(`  - ${row.tablename}.${row.policyname}: ${row.cmd}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkTables();
