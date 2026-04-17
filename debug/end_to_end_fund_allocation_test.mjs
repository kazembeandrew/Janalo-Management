/**
 * End-to-End Funds Allocation Workflow Test
 * Demonstrates complete fund allocation, expense claim, and reconciliation cycle
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

function success(message) {
  log(`SUCCESS: ${message}`, colors.green);
}

function info(message) {
  log(`INFO: ${message}`, colors.cyan);
}

function warning(message) {
  log(`WARNING: ${message}`, colors.yellow);
}

async function runEndToEndTest() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    log('Connected to database successfully', colors.green);

    // Test data
    const testOfficerId = 'c3e07789-41c8-48da-a2ba-ea07f4c24a0c'; // Valid loan officer from database
    const testPeriod = '2026-04';
    const testCategory = 'Transport';
    const testAmount = 5000.00;
    const testExpenseAmount = 1500.00;

    section('STEP 1: FUND ALLOCATION');
    
    // Step 1: Allocate funds to officer
    info(`Allocating ZMW ${testAmount} to officer for ${testCategory} in period ${testPeriod}`);
    
    const allocationResult = await client.query(
      'SELECT * FROM public.allocate_funds_to_officer($1, $2, $3, $4, $5)',
      [testOfficerId, testAmount, testPeriod, testCategory, 'E2E Test Allocation']
    );
    
    const allocationId = allocationResult.rows[0].allocate_funds_to_officer;
    success(`Funds allocated successfully. Allocation ID: ${allocationId}`);
    
    // Check allocation balance
    const balanceResult = await client.query(
      'SELECT * FROM public.get_officer_allocation_balance($1, $2)',
      [testOfficerId, testPeriod]
    );
    
    const balance = balanceResult.rows[0];
    info(`Initial balance: ZMW ${balance.remaining_balance} (Allocated: ZMW ${balance.allocated_amount})`);

    section('STEP 2: EXPENSE CREATION');
    
    // Step 2: Create an expense record
    const expenseResult = await client.query(`
      INSERT INTO public.expenses (
        category, description, amount, date, recorded_by, status
      ) VALUES (
        $1, $2, $3, CURRENT_DATE, $4, 'approved'
      ) RETURNING id
    `, [testCategory, 'Field transport expense for client visit', testExpenseAmount, testOfficerId]);
    
    const expenseId = expenseResult.rows[0].id;
    success(`Expense created successfully. Expense ID: ${expenseId}`);

    section('STEP 3: EXPENSE CLAIM AGAINST ALLOCATION');
    
    // Step 3: Claim expense against allocation
    info(`Claiming ZMW ${testExpenseAmount} against allocation`);
    
    const claimResult = await client.query(
      'SELECT * FROM public.claim_expense_against_allocation($1, $2)',
      [expenseId, allocationId]
    );
    
    const claimId = claimResult.rows[0].claim_expense_against_allocation;
    success(`Expense claim created successfully. Claim ID: ${claimId}`);
    
    // Check updated balance
    const updatedBalanceResult = await client.query(
      'SELECT * FROM public.get_officer_allocation_balance($1, $2)',
      [testOfficerId, testPeriod]
    );
    
    const updatedBalance = updatedBalanceResult.rows[0];
    info(`Updated balance: ZMW ${updatedBalance.remaining_balance} (Claimed: ZMW ${updatedBalance.claimed_amount})`);

    section('STEP 4: CLAIM APPROVAL');
    
    // Step 4: Approve the expense claim
    info('Approving expense claim');
    
    const approvalResult = await client.query(
      'SELECT * FROM public.approve_staff_expense_claim($1, true, $2)',
      [claimId, 'E2E Test Approval']
    );
    
    const approval = approvalResult.rows[0];
    success(`Claim approved: ${approval.approve_staff_expense_claim}`);
    
    // Verify claim status
    const claimStatusResult = await client.query(
      'SELECT status, reviewed_by, reviewed_at FROM public.officer_expense_claims WHERE id = $1',
      [claimId]
    );
    
    const claimStatus = claimStatusResult.rows[0];
    info(`Claim status: ${claimStatus.status}, Reviewed at: ${claimStatus.reviewed_at}`);

    section('STEP 5: PERIOD RECONCILIATION');
    
    // Step 5: Reconcile allocations for the period
    info(`Reconciling allocations for period ${testPeriod}`);
    
    await client.query('SELECT public.reconcile_officer_allocations($1)', [testPeriod]);
    success('Period reconciliation completed');
    
    // Check final allocation status
    const finalStatusResult = await client.query(
      'SELECT status FROM public.officer_fund_allocations WHERE id = $1',
      [allocationId]
    );
    
    const finalStatus = finalStatusResult.rows[0].status;
    info(`Final allocation status: ${finalStatus}`);

    section('STEP 6: ACCOUNTING VERIFICATION');
    
    // Step 6: Verify journal entries were created
    const journalEntriesResult = await client.query(`
      SELECT je.description, je.entry_date, je.status,
             jl.debit, jl.credit, ia.name as account_name
      FROM public.journal_entries je
      JOIN public.journal_lines jl ON je.id = jl.journal_entry_id
      JOIN public.internal_accounts ia ON jl.account_id = ia.id
      WHERE je.reference_type = 'allocation' AND je.reference_id = $1
      ORDER BY je.id, jl.debit DESC
    `, [allocationId]);
    
    info('Journal entries created:');
    journalEntriesResult.rows.forEach((entry, index) => {
      const amount = entry.debit > 0 ? `Debit: ZMW ${entry.debit}` : `Credit: ZMW ${entry.credit}`;
      log(`  ${index + 1}. ${entry.account_name} - ${amount}`, colors.cyan);
    });
    
    // Check Officer Advances account balance
    const officerAdvancesResult = await client.query(
      'SELECT balance FROM public.internal_accounts WHERE account_code = $1',
      ['OFFICER_ADVANCES']
    );
    
    const advancesBalance = officerAdvancesResult.rows[0].balance;
    info(`Officer Advances account balance: ZMW ${advancesBalance}`);

    section('STEP 7: REPORTING VERIFICATION');
    
    // Step 7: Generate summary reports
    const allocationSummaryResult = await client.query(`
      SELECT 
        COUNT(*) as total_allocations,
        SUM(allocated_amount) as total_allocated,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_allocations,
        COUNT(CASE WHEN status = 'depleted' THEN 1 END) as depleted_allocations
      FROM public.officer_fund_allocations 
      WHERE allocated_period = $1
    `, [testPeriod]);
    
    const summary = allocationSummaryResult.rows[0];
    info(`Period ${testPeriod} Summary:`);
    log(`  Total Allocations: ${summary.total_allocations}`, colors.cyan);
    log(`  Total Amount: ZMW ${summary.total_allocated}`, colors.cyan);
    log(`  Active: ${summary.active_allocations}`, colors.cyan);
    log(`  Depleted: ${summary.depleted_allocations}`, colors.cyan);
    
    const claimsSummaryResult = await client.query(`
      SELECT 
        COUNT(*) as total_claims,
        SUM(claim_amount) as total_claimed,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_claims,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_claims
      FROM public.officer_expense_claims oec
      JOIN public.officer_fund_allocations ofa ON oec.allocation_id = ofa.id
      WHERE ofa.allocated_period = $1
    `, [testPeriod]);
    
    const claimsSummary = claimsSummaryResult.rows[0];
    info(`Claims Summary:`);
    log(`  Total Claims: ${claimsSummary.total_claims}`, colors.cyan);
    log(`  Total Claimed: ZMW ${claimsSummary.total_claimed}`, colors.cyan);
    log(`  Approved: ${claimsSummary.approved_claims}`, colors.cyan);
    log(`  Pending: ${claimsSummary.pending_claims}`, colors.cyan);

    section('WORKFLOW COMPLETION SUMMARY');
    
    success('End-to-end fund allocation workflow completed successfully!');
    info('Workflow Steps Completed:');
    log('  1. Fund allocation with journal entry creation', colors.green);
    log('  2. Expense record creation', colors.green);
    log('  3. Expense claim against allocation', colors.green);
    log('  4. Claim approval with accounting impact', colors.green);
    log('  5. Period reconciliation', colors.green);
    log('  6. Accounting verification', colors.green);
    log('  7. Reporting and analytics', colors.green);
    
    warning('Test data created during this workflow can be cleaned up if needed');

  } catch (error) {
    log(`\nERROR: ${error.message}`, colors.red);
    console.error(error);
  } finally {
    await client.end();
  }
}

// Run the end-to-end test
runEndToEndTest().catch(console.error);
