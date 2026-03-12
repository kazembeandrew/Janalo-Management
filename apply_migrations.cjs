// apply_migrations.js - Apply missing migrations to remote Supabase database
// Usage: node apply_migrations.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Get Supabase credentials from environment
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseDbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
const supabaseDbHost = process.env.SUPABASE_DB_HOST;
const supabaseDbPort = process.env.SUPABASE_DB_PORT;
const supabaseDbUser = process.env.SUPABASE_DB_USER;
const supabaseDbPassword = process.env.SUPABASE_DB_PASSWORD;
const supabaseDbName = process.env.SUPABASE_DB_NAME;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function readMigrationSql(relativePath) {
  const fullPath = path.join(__dirname, relativePath);
  return fs.readFileSync(fullPath, 'utf8');
}

const migrations = [
  {
    name: '20260308140000_add_user_management_columns',
    sql: readMigrationSql('supabase/migrations/20260308140000_add_user_management_columns.sql')
  },
  {
    name: '20260308150000_create_journal_functions',
    sql: readMigrationSql('supabase/migrations/20260308150000_create_journal_functions.sql')
  },
  {
    name: '20260311100000_add_budgets_month_type',
    sql: readMigrationSql('supabase/migrations/20260311100000_add_budgets_month_type.sql')
  },
  {
    name: '20260311103000_notifications_alignment',
    sql: readMigrationSql('supabase/migrations/20260311103000_notifications_alignment.sql')
  }
];

async function applyViaDatabaseUrl(sql) {
  const hasDiscreteConfig = Boolean(supabaseDbHost && supabaseDbUser && supabaseDbPassword && supabaseDbName);
  if (!hasDiscreteConfig && !supabaseDbUrl) {
    throw new Error('SUPABASE_DB_URL (or DATABASE_URL) not set; cannot apply SQL without exec_sql RPC');
  }

  const client = hasDiscreteConfig
    ? new Client({
        host: supabaseDbHost,
        port: supabaseDbPort ? parseInt(supabaseDbPort, 10) : 5432,
        user: supabaseDbUser,
        password: supabaseDbPassword,
        database: supabaseDbName,
        ssl: { rejectUnauthorized: false }
      })
    : new Client({
        connectionString: supabaseDbUrl,
        ssl: { rejectUnauthorized: false }
      });

  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    if (err && err.code === 'ENOTFOUND') {
      throw err;
    }
    if (err && err.code === 'ENOENT' && typeof err.message === 'string' && err.message.includes('getaddrinfo')) {
      throw new Error(
        `${err.message}\n` +
        `Hint: your SUPABASE_DB_URL host may not be resolvable from Node in this environment (often due to IPv6-only records).\n` +
        `Try using the Supabase "Connection pooling" (transaction pooler) connection string, which typically has IPv4.`
      );
    }
    throw err;
  } finally {
    await client.end();
  }
}

async function applyMigrations() {
  console.log('Applying migrations to remote database...\n');
  
  for (const migration of migrations) {
    console.log(`Applying migration: ${migration.name}...`);
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: migration.sql });
      
      // Try alternative approach if exec_sql doesn't exist
      const missingExecSql =
        error &&
        typeof error.message === 'string' &&
        /could not find the function/i.test(error.message) &&
        /exec_sql/i.test(error.message);

      if (missingExecSql) {
        console.log('  exec_sql not available. Trying direct DB connection...');
        await applyViaDatabaseUrl(migration.sql);
        console.log('  Success (via SUPABASE_DB_URL)!');
      } else if (error) {
        console.error(`  Error: ${error.message}`);
      } else {
        console.log(`  Success!`);
      }
    } catch (err) {
      console.error(`  Exception: ${err.message}`);
    }
  }
  
  console.log('\nDone!');
}

applyMigrations();
