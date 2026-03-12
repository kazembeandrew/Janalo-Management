import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.tfpzehyrkzbenjobkdsz:Jackliness@1993@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function createAppUser() {
  try {
    console.log('🔧 Creating restricted application user...\n');
    
    // Create a new user that cannot bypass RLS
    await pool.query(`
      CREATE ROLE app_user WITH LOGIN PASSWORD 'secure_app_password_2024';
    `);
    console.log('✅ Created app_user role');
    
    // Grant necessary permissions
    await pool.query(`
      GRANT USAGE ON SCHEMA public TO app_user;
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_user;
      GRANT INSERT ON public.system_documents TO app_user;
      GRANT UPDATE ON public.system_documents TO app_user;
      GRANT DELETE ON public.system_documents TO app_user;
      GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;
    `);
    console.log('✅ Granted necessary permissions');
    
    // Ensure future tables also get permissions
    await pool.query(`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO app_user;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT, UPDATE, DELETE ON TABLES TO app_user;
    `);
    console.log('✅ Set default privileges');
    
    // Test the new user
    console.log('\n🧪 Testing app_user...');
    
    const appPool = new Pool({
      connectionString: 'postgresql://app_user:secure_app_password_2024@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
      ssl: { rejectUnauthorized: false }
    });
    
    // Check if app_user bypasses RLS
    const bypassCheck = await appPool.query(`
      SELECT usebypassrls 
      FROM pg_user 
      WHERE usename = 'app_user'
    `);
    
    console.log(`RLS Bypass for app_user: ${bypassCheck.rows[0].usebypassrls}`);
    
    // Test INSERT without authentication (should fail)
    try {
      await appPool.query(`
        INSERT INTO system_documents 
        (name, storage_path, category, file_type, file_size, created_at)
        VALUES 
        ('Test App User.pdf', '/test.pdf', 'general', 'application/pdf', 1024, NOW())
      `);
      console.log('❌ INSERT succeeded without auth (RLS not working!)');
    } catch (err) {
      console.log('✅ INSERT failed without auth (RLS working correctly)');
    }
    
    await appPool.end();
    
    console.log('\n🎉 Setup complete!');
    console.log('Use this connection string for your application:');
    console.log('postgresql://app_user:secure_app_password_2024@aws-1-eu-west-1.pooler.supabase.com:6543/postgres');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

createAppUser();
