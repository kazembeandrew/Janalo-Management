const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.tfpzehyrkzbenjobkdsz:Jackliness@1993@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('Adding description column to officer_expense_claims...');
    await client.query(`
      ALTER TABLE public.officer_expense_claims 
      ADD COLUMN IF NOT EXISTS description TEXT;
    `);
    console.log('Column added successfully!');
    
    // Update existing records
    const result = await client.query(`
      UPDATE public.officer_expense_claims 
      SET description = 'Expense claim'
      WHERE description IS NULL;
    `);
    console.log(`Updated ${result.rowCount} existing records.`);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();