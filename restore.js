const { Client } = require('pg');
const fs = require('fs');

async function restorePolicies() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const sql = fs.readFileSync('restore_rls_policies.sql', 'utf8');
    await client.query(sql);
    console.log('RLS policies restored successfully');
  } catch (err) {
    console.error('Error restoring policies:', err);
  } finally {
    await client.end();
  }
}

restorePolicies();
