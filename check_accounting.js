import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAccountingSystem() {
  console.log('=== SYSTEM VERIFICATION ===\n');

  try {
    // 1. Check internal_accounts table
    console.log('1. Checking internal_accounts (Chart of Accounts)...');
    const { data: accounts, error: accountsError } = await supabase
      .from('internal_accounts')
      .select('*')
      .order('code');
    
    if (accountsError) {
      console.error('   Error:', accountsError.message);
    } else {
      console.log(`   Found ${accounts.length} accounts:`);
      accounts.forEach(acc => {
        console.log(`   - ${acc.code}: ${acc.name} (${acc.category})`);
      });
    }

    // 2. Check system accounts
    console.log('\n2. Checking required system accounts...');
    const requiredAccounts = ['CAPITAL', 'EQUITY', 'PORTFOLIO', 'BANK', 'CASH', 'MOBILE'];
    const missingAccounts = [];
    
    for (const code of requiredAccounts) {
      const exists = accounts?.find(a => a.code === code);
      if (exists) {
        console.log(`   ✓ ${code} exists`);
      } else {
        console.log(`   ✗ ${code} MISSING`);
        missingAccounts.push(code);
      }
    }

    // 3. Check users table
    console.log('\n3. Checking users table...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (usersError) {
      console.error('   Error:', usersError.message);
    } else {
      console.log(`   Found ${users?.length || 0} users:`);
      users?.forEach(user => {
        console.log(`   - ${user.email}: ${user.full_name} (${user.role}) - Active: ${user.is_active}`);
      });
    }

    // 4. Check auth.users
    console.log('\n4. Checking auth.users...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('   Error:', authError.message);
    } else {
      console.log(`   Found ${authUsers.users.length} auth users:`);
      authUsers.users.forEach(user => {
        console.log(`   - ${user.email} (ID: ${user.id})`);
      });
    }

    // 5. Summary
    console.log('\n=== SUMMARY ===');
    if (missingAccounts.length > 0) {
      console.log(`⚠️  Missing system accounts: ${missingAccounts.join(', ')}`);
    } else {
      console.log('✓ All required system accounts exist');
    }
    
    console.log(`✓ Found ${users?.length || 0} users in public.users`);
    console.log(`✓ Found ${authUsers.users.length} users in auth.users`);

  } catch (error) {
    console.error('Error checking system:', error.message);
  }
}

checkAccountingSystem();
