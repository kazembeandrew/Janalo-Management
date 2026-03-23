import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkBalances() {
  console.log('=== ACCOUNT BALANCE CHECK ===\n');

  const { data: accounts, error } = await supabase
    .from('internal_accounts')
    .select('code, name, balance, type, category')
    .order('code');

  if (error) {
    console.error('Error fetching accounts:', error);
    return;
  }

  console.log('Account Balances:');
  let total = 0;
  accounts.forEach(acc => {
    const balance = Number(acc.balance);
    console.log(`${acc.code}: ${acc.name} - ${balance.toFixed(2)} (${acc.type}/${acc.category})`);
    total += balance;
  });

  console.log(`\nTotal of all account balances: ${total.toFixed(2)}`);
  console.log('In double-entry accounting, this should be 0.00');

  if (Math.abs(total) < 0.01) {
    console.log('✅ Books are balanced!');
  } else {
    console.log('❌ Imbalance detected! Books are not balanced.');
  }

  // Check by type
  console.log('\n=== BALANCE BY TYPE ===');
  const byType = accounts.reduce((acc, account) => {
    const type = account.type;
    acc[type] = (acc[type] || 0) + Number(account.balance);
    return acc;
  }, {});

  Object.entries(byType).forEach(([type, sum]) => {
    console.log(`${type}: ${sum.toFixed(2)}`);
  });
}

checkBalances();