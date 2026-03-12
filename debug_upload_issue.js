import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.tfpzehyrkzbenjobkdsz:Jackliness@1993@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function debugUploadIssue() {
  try {
    console.log('🔍 Debugging upload RLS issue...\n');
    
    // 1. Check current authentication context (as seen by database)
    console.log('1. Current authentication context:');
    try {
      const authResult = await pool.query(`
        SELECT 
          auth.uid() as user_id,
          auth.jwt() ->> 'role' as jwt_role,
          auth.jwt() ->> 'email' as jwt_email,
          get_auth_role() as auth_role
      `);
      
      const auth = authResult.rows[0];
      console.log(`   User ID: ${auth.user_id}`);
      console.log(`   JWT Role: ${auth.jwt_role}`);
      console.log(`   JWT Email: ${auth.jwt_email}`);
      console.log(`   Auth Role: ${auth.auth_role}`);
      
      if (!auth.user_id) {
        console.log('   ⚠️  No user authenticated - this is the problem!');
      }
    } catch (err) {
      console.log(`   ❌ Error getting auth context: ${err.message}`);
    }
    
    // 2. Test what happens with no authentication
    console.log('\n2. Testing INSERT without authentication:');
    try {
      await pool.query(`
        INSERT INTO system_documents 
        (name, storage_path, category, file_type, file_size, created_at)
        VALUES 
        ('Test No Auth.pdf', '/test.pdf', 'general', 'application/pdf', 1024, NOW())
      `);
      console.log('   ✅ INSERT succeeded (unexpected!)');
      await pool.query('DELETE FROM system_documents WHERE name = \'Test No Auth.pdf\'');
    } catch (err) {
      console.log(`   ❌ INSERT failed (expected): ${err.message}`);
    }
    
    // 3. Show exactly what RLS policies are checking
    console.log('\n3. RLS Policy details for INSERT:');
    const policies = await pool.query(`
      SELECT policyname, cmd, with_check
      FROM pg_policies 
      WHERE tablename = 'system_documents' AND cmd = 'INSERT'
    `);
    
    policies.rows.forEach(policy => {
      console.log(`   Policy: ${policy.policyname}`);
      console.log(`   WITH CHECK: ${policy.with_check}`);
    });
    
    // 4. Show available users and their roles
    console.log('\n4. Available users:');
    const users = await pool.query(`
      SELECT id, email, role, created_at
      FROM users 
      ORDER BY role, email
    `);
    
    users.rows.forEach(user => {
      console.log(`   - ${user.email} (${user.role}) - ID: ${user.id}`);
    });
    
    console.log('\n🔧 SOLUTION:');
    console.log('Your application needs to:');
    console.log('1. Authenticate the user before making the upload request');
    console.log('2. Include a valid JWT token in the request headers');
    console.log('3. Ensure the user has one of these roles: admin, ceo, hr, accountant, loan_officer');
    console.log('4. Use the Supabase client with proper authentication, not direct PostgreSQL connection');
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

debugUploadIssue();
