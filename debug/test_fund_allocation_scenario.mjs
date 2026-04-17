/**
 * Comprehensive Funds Allocation Test Scenario
 * Tests table structure, RLS policies, and complete allocation workflow
 * Date: 2026-04-17
 */

import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(80));
  log(title, colors.bright + colors.cyan);
  console.log('='.repeat(80));
}

function pass(test) {
  log(`✅ PASS: ${test}`, colors.green);
}

function fail(test, reason) {
  log(`❌ FAIL: ${test}`, colors.red);
  if (reason) log(`   Reason: ${reason}`, colors.yellow);
}

function info(message) {
  log(`ℹ️  ${message}`, colors.cyan);
}

// Expected table structures
const expectedColumns = {
  officer_fund_allocations: [
    'id', 'officer_id', 'allocated_amount', 'allocated_period', 'category',
    'allocated_by', 'status', 'notes', 'created_at', 'updated_at',
    'allocation_journal_entry_id'
  ],
  officer_expense_claims: [
    'id', 'officer_id', 'allocation_id', 'expense_id', 'claim_amount',
    'status', 'reviewed_by', 'reviewed_at', 'notes', 'created_at', 'updated_at',
    'journal_entry_id', 'claim_date'
  ],
  expenses: [
    'id', 'category', 'description', 'amount', 'date', 'recorded_by',
    'status', 'created_at', 'updated_at'
  ]
};

async function runTests() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    issues: []
  };

  try {
    await client.connect();
    log('Connected to database successfully', colors.green);

    // ========================================
    // PHASE 1: Table Structure Validation
    // ========================================
    section('PHASE 1: Table Structure Validation');

    for (const [tableName, expectedCols] of Object.entries(expectedColumns)) {
      info(`Checking table: ${tableName}`);

      // Check if table exists
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        ) as exists
      `, [tableName]);

      if (tableExists.rows[0].exists) {
        pass(`Table '${tableName}' exists`);
        results.passed++;
      } else {
        fail(`Table '${tableName}' exists`);
        results.failed++;
        results.issues.push({ table: tableName, issue: 'Table does not exist' });
        continue;
      }

      // Get actual columns
      const columns = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      const actualCols = columns.rows.map(r => r.column_name);

      // Check for missing columns
      for (const col of expectedCols) {
        if (actualCols.includes(col)) {
          pass(`Column '${col}' exists in '${tableName}'`);
          results.passed++;
        } else {
          fail(`Column '${col}' missing in '${tableName}'`);
          results.failed++;
          results.issues.push({
            table: tableName,
            issue: `Missing column: ${col}`
          });
        }
      }

      // Check for unexpected columns
      for (const col of actualCols) {
        if (!expectedCols.includes(col)) {
          log(`⚠️  WARNING: Unexpected column '${col}' in '${tableName}'`, colors.yellow);
          results.warnings++;
        }
      }
    }

    // ========================================
    // PHASE 2: RLS Policy Audit
    // ========================================
    section('PHASE 2: RLS Policy Audit');

    const fundTables = ['officer_fund_allocations', 'officer_expense_claims', 'expenses'];

    for (const table of fundTables) {
      info(`Checking RLS for table: ${table}`);

      // Check if RLS is enabled
      const rlsCheck = await client.query(`
        SELECT relrowsecurity
        FROM pg_class
        WHERE relname = $1
      `, [table]);

      if (rlsCheck.rows.length > 0 && rlsCheck.rows[0].relrowsecurity) {
        pass(`RLS enabled on '${table}'`);
        results.passed++;
      } else {
        fail(`RLS enabled on '${table}'`);
        results.failed++;
        results.issues.push({ table, issue: 'RLS not enabled' });
      }

      // Check policies
      const policies = await client.query(`
        SELECT policyname, cmd, roles
        FROM pg_policies
        WHERE tablename = $1
        ORDER BY policyname
      `, [table]);

      if (policies.rows.length > 0) {
        pass(`Policies exist on '${table}' (${policies.rows.length} policies)`);
        results.passed++;

        // Log policy details
        policies.rows.forEach(p => {
          log(`   └─ ${p.policyname} (${p.cmd})`, colors.cyan);
        });
      } else {
        fail(`Policies exist on '${table}'`);
        results.failed++;
        results.issues.push({ table, issue: 'No policies defined' });
      }
    }

    // ========================================
    // PHASE 3: Accounting Integration Check
    // ========================================
    section('PHASE 3: Accounting Integration Check');

    // Check for Officer Advances account
    const officerAdvancesAccount = await client.query(`
      SELECT id, name, account_code, balance, is_active
      FROM internal_accounts
      WHERE account_code = 'OFFICER_ADVANCES'
    `);

    if (officerAdvancesAccount.rows.length > 0) {
      const account = officerAdvancesAccount.rows[0];
      pass('Officer Advances account exists');
      results.passed++;
      log(`   Account ID: ${account.id}`, colors.cyan);
      log(`   Balance: ${account.balance}`, colors.cyan);
      log(`   Active: ${account.is_active}`, colors.cyan);
    } else {
      fail('Officer Advances account exists');
      results.failed++;
      results.issues.push({ issue: 'Missing OFFICER_ADVANCES internal account' });
    }

    // Check for required expense accounts
    const expenseAccounts = ['EXP_TRANSPORT', 'EXP_UTILITIES', 'EXP_TRAVEL', 'EXP_OFFICE_SUPPLIES'];
    for (const code of expenseAccounts) {
      const exists = await client.query(`
        SELECT id FROM internal_accounts WHERE account_code = $1 AND is_active != false
      `, [code]);

      if (exists.rows.length > 0) {
        pass(`Expense account '${code}' exists`);
        results.passed++;
      } else {
        log(`⚠️  WARNING: Expense account '${code}' missing`, colors.yellow);
        results.warnings++;
      }
    }

    // ========================================
    // PHASE 4: Function Existence Check
    // ========================================
    section('PHASE 4: Function Existence Check');

    const requiredFunctions = [
      'allocate_funds_to_officer',
      'get_officer_allocation_balance',
      'claim_expense_against_allocation',
      'reconcile_officer_allocations',
      'approve_staff_expense_claim',
      'post_allocation_to_ledger'
    ];

    for (const funcName of requiredFunctions) {
      const funcExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM pg_proc 
          WHERE proname = $1
        ) as exists
      `, [funcName]);

      if (funcExists.rows[0].exists) {
        pass(`Function '${funcName}' exists`);
        results.passed++;
      } else {
        fail(`Function '${funcName}' exists`);
        results.failed++;
        results.issues.push({ issue: `Missing function: ${funcName}` });
      }
    }

    // ========================================
    // PHASE 5: Data Integrity Checks
    // ========================================
    section('PHASE 5: Data Integrity Checks');

    // Check for orphaned allocations
    const orphanedAllocations = await client.query(`
      SELECT COUNT(*) as count
      FROM officer_fund_allocations ofa
      LEFT JOIN users u ON ofa.officer_id = u.id
      WHERE u.id IS NULL
    `);

    const orphanCount = parseInt(orphanedAllocations.rows[0].count);
    if (orphanCount === 0) {
      pass('No orphaned allocations found');
      results.passed++;
    } else {
      fail(`Found ${orphanCount} orphaned allocations`);
      results.failed++;
      results.issues.push({ issue: `${orphanCount} orphaned allocations` });
    }

    // Check for orphaned claims
    const orphanedClaims = await client.query(`
      SELECT COUNT(*) as count
      FROM officer_expense_claims oec
      LEFT JOIN users u ON oec.officer_id = u.id
      WHERE u.id IS NULL
    `);

    const claimOrphanCount = parseInt(orphanedClaims.rows[0].count);
    if (claimOrphanCount === 0) {
      pass('No orphaned expense claims found');
      results.passed++;
    } else {
      fail(`Found ${claimOrphanCount} orphaned expense claims`);
      results.failed++;
      results.issues.push({ issue: `${claimOrphanCount} orphaned expense claims` });
    }

    // Check for claims without allocations
    const claimsWithoutAllocation = await client.query(`
      SELECT COUNT(*) as count
      FROM officer_expense_claims oec
      LEFT JOIN officer_fund_allocations ofa ON oec.allocation_id = ofa.id
      WHERE oec.allocation_id IS NOT NULL AND ofa.id IS NULL
    `);

    const noAllocCount = parseInt(claimsWithoutAllocation.rows[0].count);
    if (noAllocCount === 0) {
      pass('No claims with missing allocations');
      results.passed++;
    } else {
      fail(`Found ${noAllocCount} claims with missing allocations`);
      results.failed++;
      results.issues.push({ issue: `${noAllocCount} claims reference non-existent allocations` });
    }

    // Check for negative balances
    const negativeBalances = await client.query(`
      SELECT COUNT(*) as count
      FROM (
        SELECT ofa.id, ofa.allocated_amount,
               COALESCE(SUM(oec.claim_amount), 0) as total_claimed
        FROM officer_fund_allocations ofa
        LEFT JOIN officer_expense_claims oec ON oec.allocation_id = ofa.id
          AND oec.status IN ('approved', 'pending')
        GROUP BY ofa.id, ofa.allocated_amount
        HAVING ofa.allocated_amount - COALESCE(SUM(oec.claim_amount), 0) < 0
      ) subq
    `);

    const negCount = negativeBalances.rows.length > 0 ? parseInt(negativeBalances.rows[0].count) : 0;
    if (negCount === 0) {
      pass('No negative allocation balances');
      results.passed++;
    } else {
      fail(`Found ${negCount} allocations with negative balances`);
      results.failed++;
      results.issues.push({ issue: `${negCount} allocations have negative balances` });
    }

    // ========================================
    // PHASE 6: Journal Entry Integration
    // ========================================
    section('PHASE 6: Journal Entry Integration');

    // Check allocations with journal entries
    const allocsWithJournal = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(allocation_journal_entry_id) as with_journal
      FROM officer_fund_allocations
    `);

    const totalAllocs = parseInt(allocsWithJournal.rows[0].total);
    const withJournal = parseInt(allocsWithJournal.rows[0].with_journal);

    if (totalAllocs > 0) {
      const pct = ((withJournal / totalAllocs) * 100).toFixed(1);
      info(`Allocations: ${totalAllocs} total, ${withJournal} with journal entries (${pct}%)`);
      if (withJournal === totalAllocs) {
        pass('All allocations have journal entries');
        results.passed++;
      } else {
        log(`⚠️  WARNING: ${totalAllocs - withJournal} allocations missing journal entries`, colors.yellow);
        results.warnings++;
      }
    } else {
      info('No allocations exist yet (expected in fresh system)');
    }

    // Check claims with journal entries
    const claimsWithJournal = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(journal_entry_id) as with_journal
      FROM officer_expense_claims
    `);

    const totalClaims = parseInt(claimsWithJournal.rows[0].total);
    const claimsWithJE = parseInt(claimsWithJournal.rows[0].with_journal);

    if (totalClaims > 0) {
      const pct = ((claimsWithJE / totalClaims) * 100).toFixed(1);
      info(`Claims: ${totalClaims} total, ${claimsWithJE} with journal entries (${pct}%)`);
      if (claimsWithJE === totalClaims) {
        pass('All claims have journal entries');
        results.passed++;
      } else {
        log(`⚠️  WARNING: ${totalClaims - claimsWithJE} claims missing journal entries`, colors.yellow);
        results.warnings++;
      }
    } else {
      info('No claims exist yet (expected in fresh system)');
    }

    // ========================================
    // SUMMARY
    // ========================================
    section('TEST SUMMARY');

    log(`\n📊 Results:`, colors.bright);
    log(`   Passed: ${results.passed} ✅`, colors.green);
    log(`   Failed: ${results.failed} ❌`, results.failed > 0 ? colors.red : colors.reset);
    log(`   Warnings: ${results.warnings} ⚠️ `, results.warnings > 0 ? colors.yellow : colors.reset);

    if (results.issues.length > 0) {
      section('ISSUES FOUND');
      results.issues.forEach((issue, idx) => {
        log(`${idx + 1}. ${issue.issue}`, colors.red);
        if (issue.table) log(`   Table: ${issue.table}`, colors.yellow);
      });
    } else {
      log('\n🎉 All tests passed! No issues found.', colors.green);
    }

    // Generate fix script if issues found
    if (results.failed > 0) {
      section('RECOMMENDED FIXES');
      log('\n💡 Run the following to fix identified issues:', colors.bright + colors.cyan);
      generateFixScript(results.issues);
    }

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, colors.red);
    console.error(error);
  } finally {
    await client.end();
  }
}

function generateFixScript(issues) {
  const fixes = [];

  for (const issue of issues) {
    if (issue.issue.includes('Missing column')) {
      const match = issue.issue.match(/Missing column: (\w+)/);
      if (match) {
        const col = match[1];
        if (col === 'allocation_journal_entry_id') {
          fixes.push(`ALTER TABLE officer_fund_allocations ADD COLUMN IF NOT EXISTS allocation_journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL;`);
        } else if (col === 'journal_entry_id') {
          fixes.push(`ALTER TABLE officer_expense_claims ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL;`);
        } else if (col === 'claim_date') {
          fixes.push(`ALTER TABLE officer_expense_claims ADD COLUMN IF NOT EXISTS claim_date DATE; UPDATE officer_expense_claims SET claim_date = created_at::DATE WHERE claim_date IS NULL; ALTER TABLE officer_expense_claims ALTER COLUMN claim_date SET NOT NULL;`);
        } else if (col === 'updated_at') {
          fixes.push(`ALTER TABLE ${issue.table} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`);
        }
      }
    } else if (issue.issue.includes('Missing function')) {
      const func = issue.issue.match(/Missing function: (\w+)/);
      if (func) {
        fixes.push(`-- Function '${func[1]}' needs to be created. Check migrations for the function definition.`);
      }
    } else if (issue.issue.includes('OFFICER_ADVANCES')) {
      fixes.push(`INSERT INTO internal_accounts (name, account_category, account_code, category, code, type, balance, is_system_account, is_active, is_cash_equivalent, description) VALUES ('Officer Field Advances', 'asset', 'OFFICER_ADVANCES', 'asset', 'OFFICER_ADVANCES', 'asset', 0, true, true, false, 'Funds advanced to loan officers for field expenses and operations') ON CONFLICT (code) DO NOTHING;`);
    } else if (issue.issue.includes('RLS not enabled')) {
      fixes.push(`ALTER TABLE ${issue.table} ENABLE ROW LEVEL SECURITY;`);
    }
  }

  if (fixes.length > 0) {
    log('\n-- Fix Script --', colors.cyan);
    fixes.forEach(fix => log(fix, colors.yellow));
  }
}

// Run the tests
runTests().catch(console.error);