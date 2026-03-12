import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.tfpzehyrkzbenjobkdsz:Jackliness@1993@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function findSystemDocuments() {
  try {
    // Check all schemas
    const schemas = await pool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
    `);
    
    console.log('Available schemas:');
    schemas.rows.forEach(row => {
      console.log(`  - ${row.schema_name}`);
    });
    
    // Check for system_documents in all schemas
    const result = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name = 'system_documents'
    `);
    
    console.log('\nTables named "system_documents":');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_schema}.${row.table_name}`);
    });
    
    // Check for any tables that contain 'system'
    const systemTables = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name LIKE '%system%'
      ORDER BY table_schema, table_name
    `);
    
    console.log('\nTables with "system" in name:');
    systemTables.rows.forEach(row => {
      console.log(`  - ${row.table_schema}.${row.table_name}`);
    });
    
    // Check for RLS on all tables
    const rlsTables = await pool.query(`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relkind = 'r' AND relrowsecurity = true
      ORDER BY relname
    `);
    
    console.log('\nTables with RLS enabled:');
    rlsTables.rows.forEach(row => {
      console.log(`  - ${row.relname}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

findSystemDocuments();
