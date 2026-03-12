import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.tfpzehyrkzbenjobkdsz:Jackliness@1993@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkAuthFunctions() {
  try {
    console.log('🔍 Checking authentication functions...\n');
    
    // 1. Check if get_auth_role function exists
    console.log('1. Checking get_auth_role function:');
    try {
      const funcResult = await pool.query(`
        SELECT routine_name, routine_definition
        FROM information_schema.routines
        WHERE routine_name = 'get_auth_role' AND routine_schema = 'public'
      `);
      
      if (funcResult.rows.length > 0) {
        console.log('   ✅ get_auth_role function exists');
        console.log(`   Definition: ${funcResult.rows[0].routine_definition}`);
      } else {
        console.log('   ❌ get_auth_role function NOT found');
      }
    } catch (err) {
      console.log(`   ❌ Error checking function: ${err.message}`);
    }
    
    // 2. Test the function directly
    console.log('\n2. Testing get_auth_role function:');
    try {
      const testResult = await pool.query('SELECT get_auth_role() as role');
      console.log(`   Result: ${testResult.rows[0].role}`);
    } catch (err) {
      console.log(`   ❌ Error calling function: ${err.message}`);
    }
    
    // 3. Check if RLS is actually being enforced
    console.log('\n3. Testing RLS enforcement:');
    
    // First, let's manually set auth context and test
    console.log('   Testing with simulated admin user...');
    try {
      await pool.query(`SET LOCAL auth.uid = 'dcd97e7c-3f44-47c2-a6c1-9f40d1bfd6d0'`);
      await pool.query(`SET LOCAL auth.jwt = '{"role":"admin","email":"andrew@janalo.com"}'`);
      
      const testWithAuth = await pool.query(`
        SELECT 
          auth.uid() as user_id,
          auth.jwt() ->> 'role' as jwt_role,
          get_auth_role() as auth_role
      `);
      
      console.log(`   With simulated auth - User ID: ${testWithAuth.rows[0].user_id}`);
      console.log(`   With simulated auth - JWT Role: ${testWithAuth.rows[0].jwt_role}`);
      console.log(`   With simulated auth - Auth Role: ${testWithAuth.rows[0].auth_role}`);
      
      // Now test INSERT with simulated auth
      await pool.query(`
        INSERT INTO system_documents 
        (name, storage_path, category, file_type, file_size, uploaded_by, created_at)
        VALUES 
        ('Test Simulated Auth.pdf', '/test.pdf', 'general', 'application/pdf', 1024, 'dcd97e7c-3f44-47c2-a6c1-9f40d1bfd6d0', NOW())
      `);
      console.log('   ✅ INSERT succeeded with simulated auth');
      
      // Clean up
      await pool.query('DELETE FROM system_documents WHERE name = \'Test Simulated Auth.pdf\'');
      
    } catch (err) {
      console.log(`   ❌ Error with simulated auth: ${err.message}`);
    }
    
    // 4. Check if there's a bypass happening
    console.log('\n4. Checking for RLS bypass:');
    try {
      const rlsBypass = await pool.query(`
        SELECT usename, usesuper, usebypassrls
        FROM pg_user 
        WHERE usename = current_user
      `);
      
      console.log(`   Current user: ${rlsBypass.rows[0].usename}`);
      console.log(`   Superuser: ${rlsBypass.rows[0].usesuper}`);
      console.log(`   Bypass RLS: ${rlsBypass.rows[0].usebypassrls}`);
      
      if (rlsBypass.rows[0].usebypassrls) {
        console.log('   ⚠️  RLS is being bypassed because user has bypass privileges!');
      }
    } catch (err) {
      console.log(`   ❌ Error checking RLS bypass: ${err.message}`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkAuthFunctions();
