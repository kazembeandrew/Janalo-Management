/**
 * Test script for bulk disburse functionality
 * Run this in browser console or Node.js with proper Supabase credentials
 */

// Test configuration
const TEST_CONFIG = {
  // Replace with actual values from your system
  testLoanIds: [], // Will be populated with pending loan IDs
  testAccountId: null, // Will be populated with cash/bank account ID
};

// Helper to log with timestamp
const log = (msg, data = null) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}]`;
  if (data) {
    console.log(prefix, msg, data);
  } else {
    console.log(prefix, msg);
  }
};

// Test 1: Verify function state via direct SQL
async function checkFunctionState(supabase) {
  log('=== TEST 1: Checking function state ===');
  
  const { data, error } = await supabase.rpc('check_bulk_disburse_state');
  
  if (error) {
    log('ERROR: Could not check function state:', error);
    return false;
  }
  
  log('Function state:', data);
  return data;
}

// Test 2: Get pending loans for testing
async function getPendingLoans(supabase) {
  log('=== TEST 2: Getting pending loans ===');
  
  const { data, error } = await supabase
    .from('loans')
    .select('id, reference_no, principal_amount, status')
    .eq('status', 'pending')
    .limit(5);
  
  if (error) {
    log('ERROR fetching pending loans:', error);
    return [];
  }
  
  log(`Found ${data?.length || 0} pending loans:`, data);
  return data || [];
}

// Test 3: Get available cash/bank accounts
async function getCashAccounts(supabase) {
  log('=== TEST 3: Getting cash/bank accounts ===');
  
  const { data, error } = await supabase
    .from('internal_accounts')
    .select('id, name, balance, is_active')
    .or('name.ilike.%cash%,name.ilike.%main bank%')
    .eq('is_active', true)
    .limit(5);
  
  if (error) {
    log('ERROR fetching accounts:', error);
    return [];
  }
  
  log(`Found ${data?.length || 0} cash/bank accounts:`, data);
  return data || [];
}

// Test 4: Attempt single loan disburse (safer test)
async function testSingleDisburse(supabase, loanId, accountId, userId) {
  log('=== TEST 4: Testing single loan disburse ===');
  log(`Loan: ${loanId}, Account: ${accountId}, User: ${userId}`);
  
  try {
    const { data, error } = await supabase.rpc('bulk_disburse_loans_secure', {
      p_loan_ids: [loanId],
      p_account_id: accountId,
      p_user_id: userId,
      p_disbursement_date: new Date().toISOString().split('T')[0],
      p_note: 'Test disbursement'
    });
    
    if (error) {
      log('SINGLE DISBURSE ERROR:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return { success: false, error };
    }
    
    log('SINGLE DISBURSE RESULT:', data);
    return { success: true, data };
  } catch (e) {
    log('EXCEPTION during single disburse:', e);
    return { success: false, error: e };
  }
}

// Test 5: Attempt bulk disburse
async function testBulkDisburse(supabase, loanIds, accountId, userId) {
  log('=== TEST 5: Testing bulk disburse ===');
  log(`Loans: ${loanIds.length}, Account: ${accountId}`);
  
  try {
    const { data, error } = await supabase.rpc('bulk_disburse_loans_secure', {
      p_loan_ids: loanIds,
      p_account_id: accountId,
      p_user_id: userId,
      p_disbursement_date: new Date().toISOString().split('T')[0],
      p_note: 'Bulk test disbursement'
    });
    
    if (error) {
      log('BULK DISBURSE ERROR:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return { success: false, error };
    }
    
    log('BULK DISBURSE RESULT:', data);
    return { success: true, data };
  } catch (e) {
    log('EXCEPTION during bulk disburse:', e);
    return { success: false, error: e };
  }
}

// Main test runner
async function runTests(supabase, userId) {
  log('========================================');
  log('STARTING BULK DISBURSE TESTS');
  log('========================================');
  
  // Step 1: Get pending loans
  const pendingLoans = await getPendingLoans(supabase);
  if (pendingLoans.length === 0) {
    log('ERROR: No pending loans found for testing');
    return;
  }
  
  // Step 2: Get cash accounts
  const cashAccounts = await getCashAccounts(supabase);
  if (cashAccounts.length === 0) {
    log('ERROR: No cash/bank accounts found');
    return;
  }
  
  const testLoan = pendingLoans[0];
  const testAccount = cashAccounts[0];
  
  log('\n--- TEST CONFIGURATION ---');
  log(`Test Loan ID: ${testLoan.id}`);
  log(`Test Loan Amount: ${testLoan.principal_amount}`);
  log(`Test Account ID: ${testAccount.id}`);
  log(`Test Account Balance: ${testAccount.balance}`);
  log(`Test Account Name: ${testAccount.name}`);
  
  // Step 3: Test single disburse first
  const singleResult = await testSingleDisburse(
    supabase, 
    testLoan.id, 
    testAccount.id, 
    userId
  );
  
  if (!singleResult.success) {
    log('\n!!! SINGLE DISBURSE FAILED - Investigate before bulk test !!!');
    return;
  }
  
  // Step 4: Test bulk disburse (if we have multiple loans)
  if (pendingLoans.length >= 2) {
    const loanIds = pendingLoans.slice(0, 2).map(l => l.id);
    const bulkResult = await testBulkDisburse(
      supabase,
      loanIds,
      testAccount.id,
      userId
    );
    
    if (!bulkResult.success) {
      log('\n!!! BULK DISBURSE FAILED !!!');
    } else {
      log('\n✓ BULK DISBURSE SUCCESS');
    }
  } else {
    log('\nOnly 1 pending loan - skipping bulk test');
  }
  
  log('\n========================================');
  log('TESTS COMPLETE');
  log('========================================');
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runTests, testSingleDisburse, testBulkDisburse };
}

// Instructions for use
log(`
========================================
USAGE INSTRUCTIONS:
========================================

1. In browser console (logged into app):
   
   // Get supabase client
   const supabase = window.supabase; // or however you access it
   const userId = (await supabase.auth.getUser()).data.user.id;
   
   // Run tests
   await runTests(supabase, userId);

2. Check console output for errors

3. If you see the "Manual update of account balance is forbidden" error,
   the function still has the old code.

========================================
`);
