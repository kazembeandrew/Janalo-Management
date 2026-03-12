import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.tfpzehyrkzbenjobkdsz:Jackliness@1993@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function testConnection() {
  try {
    console.log('🔌 Testing Supabase connection...');
    
    // Test basic connection
    const versionResult = await pool.query('SELECT version()');
    console.log('✅ Database connected successfully');
    console.log(`   PostgreSQL: ${versionResult.rows[0].version.split(',')[0]}`);
    
    // Test if we can access the database
    const dbResult = await pool.query('SELECT current_database(), current_user');
    console.log(`✅ Database: ${dbResult.rows[0].current_database}`);
    console.log(`✅ User: ${dbResult.rows[0].current_user}`);
    
    // Check if system_documents table exists
    const tableResult = await pool.query(`
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'system_documents'
    `);
    
    if (tableResult.rows.length > 0) {
      console.log('✅ system_documents table exists');
      
      // Check table structure
      const columnsResult = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'system_documents'
        ORDER BY ordinal_position
      `);
      
      console.log('\n📋 Table structure:');
      columnsResult.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
      });
      
      // Check RLS status
      const rlsResult = await pool.query(`
        SELECT rowsecurity
        FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'system_documents'
      `);
      
      console.log(`\n🔒 RLS enabled: ${rlsResult.rows[0].rowsecurity}`);
      
      // Check policies
      const policiesResult = await pool.query(`
        SELECT policyname, cmd
        FROM pg_policies 
        WHERE tablename = 'system_documents'
        ORDER BY cmd
      `);
      
      if (policiesResult.rows.length > 0) {
        console.log('\n📜 RLS Policies:');
        policiesResult.rows.forEach(policy => {
          console.log(`   - ${policy.policyname}: ${policy.cmd}`);
        });
      } else {
        console.log('\n⚠️  No RLS policies found');
      }
      
      // Check existing documents
      const docCount = await pool.query('SELECT COUNT(*) as count FROM system_documents');
      console.log(`\n📄 Existing documents: ${docCount.rows[0].count}`);
      
    } else {
      console.log('❌ system_documents table does not exist');
    }
    
    // Check if users table exists (for authentication)
    const usersResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    `);
    
    if (usersResult.rows.length > 0) {
      const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
      console.log(`👥 Users table exists with ${userCount.rows[0].count} users`);
    } else {
      console.log('⚠️  Users table not found');
    }
    
    console.log('\n✅ Supabase connection test completed successfully!');
    process.exit(0);
    
  } catch (err) {
    console.error('❌ Connection test failed:', err.message);
    process.exit(1);
  }
}

testConnection();
