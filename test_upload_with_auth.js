import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.tfpzehyrkzbenjobkdsz:Jackliness@1993@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function testUploadWithAuth() {
  try {
    console.log('Testing upload with simulated authentication...');
    
    // First, let's check what users exist in the system
    const usersResult = await pool.query(`
      SELECT id, email, role, created_at
      FROM users 
      LIMIT 5
    `);
    
    console.log('\nAvailable users:');
    usersResult.rows.forEach(user => {
      console.log(`  - ${user.email} (${user.role}) - ID: ${user.id}`);
    });
    
    if (usersResult.rows.length === 0) {
      console.log('No users found. You need to create a user first.');
      process.exit(1);
    }
    
    // Test with the first user (simulate their authentication)
    const testUser = usersResult.rows[0];
    console.log(`\nTesting upload as: ${testUser.email} (${testUser.role})`);
    
    // Set the auth context manually for testing
    await pool.query(`SET LOCAL auth.uid = '${testUser.id}'`);
    
    // Test INSERT with correct column names
    console.log('\nTesting INSERT with correct schema...');
    try {
      const insertResult = await pool.query(`
        INSERT INTO system_documents 
        (name, storage_path, category, file_type, file_size, uploaded_by, created_at)
        VALUES 
        ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id, name, uploaded_by
      `, [
        'Test Document.pdf',
        '/uploads/test-document.pdf',
        'general',
        'application/pdf',
        1024,
        testUser.id
      ]);
      
      console.log('✓ INSERT: SUCCESS');
      console.log(`  Document ID: ${insertResult.rows[0].id}`);
      console.log(`  Document name: ${insertResult.rows[0].name}`);
      
      // Clean up
      await pool.query('DELETE FROM system_documents WHERE id = $1', [insertResult.rows[0].id]);
      console.log('✓ Cleanup: SUCCESS');
      
    } catch (err) {
      console.log(`✗ INSERT: FAILED - ${err.message}`);
      
      // Check if it's an RLS issue
      if (err.message.includes('row-level security')) {
        console.log('\n🔍 This is an RLS policy issue. The user role may not be allowed to insert.');
        console.log('User role:', testUser.role);
        console.log('Allowed roles: admin, ceo, hr, accountant, loan_officer');
      }
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

testUploadWithAuth();
