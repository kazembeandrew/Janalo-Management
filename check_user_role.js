import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.tfpzehyrkzbenjobkdsz:Jackliness@1993@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkUserRole() {
  try {
    console.log('Testing RLS policies with current user...');
    
    // Test if we can query the system_documents table
    const testQuery = await pool.query(`
      SELECT 
        auth.uid() as user_id,
        auth.jwt() ->> 'role' as jwt_role,
        get_auth_role() as auth_role,
        COUNT(*) as document_count
      FROM system_documents 
      LIMIT 1
    `);
    
    console.log('\nCurrent user info:');
    console.log(`  User ID: ${testQuery.rows[0].user_id}`);
    console.log(`  JWT Role: ${testQuery.rows[0].jwt_role}`);
    console.log(`  Auth Role: ${testQuery.rows[0].auth_role}`);
    console.log(`  Documents visible: ${testQuery.rows[0].document_count}`);
    
    // Test INSERT permission
    console.log('\nTesting INSERT permission...');
    try {
      await pool.query(`
        INSERT INTO system_documents (title, content, uploaded_by, created_at, updated_at)
        VALUES ('Test Document', 'Test content', auth.uid(), NOW(), NOW())
      `);
      console.log('✓ INSERT: SUCCESS');
      
      // Clean up
      await pool.query(`
        DELETE FROM system_documents 
        WHERE title = 'Test Document' AND uploaded_by = auth.uid()
      `);
    } catch (err) {
      console.log(`✗ INSERT: FAILED - ${err.message}`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkUserRole();
