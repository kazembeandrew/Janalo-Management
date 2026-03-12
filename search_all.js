import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.tfpzehyrkzbenjobkdsz:Jackliness@1993@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function searchAll() {
  try {
    // Try to query system_documents directly
    try {
      const test = await pool.query('SELECT * FROM system_documents LIMIT 1');
      console.log('system_documents EXISTS and has data!');
      console.log('Columns:', test.fields.map(f => f.name));
    } catch (e) {
      console.log('Direct query error:', e.message);
    }
    
    // Check if there's a view
    const views = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.views 
      WHERE table_name = 'system_documents'
    `);
    console.log('\nViews named system_documents:', views.rows);
    
    // Check if maybe it's using a different schema prefix (storage, auth, etc)
    const storage = await pool.query(`
      SELECT * FROM storage.tables WHERE name = 'system_documents'
    `);
    console.log('\nStorage tables:', storage.rows);
    
    // Check actual tables that might be close
    const similar = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE LOWER(table_name) LIKE '%doc%' OR LOWER(table_name) LIKE '%system%'
      ORDER BY table_name
    `);
    console.log('\nAll tables with doc/system in name:');
    similar.rows.forEach(r => console.log(`  ${r.table_schema}.${r.table_name}`));
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

searchAll();
