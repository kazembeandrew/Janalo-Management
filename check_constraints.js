import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.tfpzehyrkzbenjobkdsz:Jackliness@1993@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkConstraints() {
  try {
    console.log('Checking constraints for system_documents table...');
    
    const result = await pool.query(`
      SELECT 
        conname as constraint_name,
        contype as constraint_type,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'public.system_documents'::regclass
      ORDER BY conname
    `);
    
    console.log('\nTable constraints:');
    result.rows.forEach(constraint => {
      console.log(`  - ${constraint.constraint_name} (${constraint.constraint_type}):`);
      console.log(`    ${constraint.definition}`);
    });
    
    // Check existing categories
    const categoriesResult = await pool.query(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM system_documents 
      GROUP BY category
      ORDER BY category
    `);
    
    console.log('\nExisting categories:');
    if (categoriesResult.rows.length === 0) {
      console.log('  (no documents yet)');
    } else {
      categoriesResult.rows.forEach(cat => {
        console.log(`  - ${cat.category}: ${cat.count} documents`);
      });
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkConstraints();
