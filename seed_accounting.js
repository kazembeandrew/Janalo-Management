import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedSystemAccounts() {
  console.log('Seeding accounting system accounts...');

  const systemAccounts = [
    { code: 'BANK', name: 'Bank Account', type: 'asset', category: 'bank' },
    { code: 'CASH', name: 'Cash Account', type: 'asset', category: 'cash' },
    { code: 'MOBILE', name: 'Mobile Money Account', type: 'asset', category: 'mobile' }
  ];

  try {
    for (const account of systemAccounts) {
      // Check if already exists
      const { data: existing } = await supabase
        .from('internal_accounts')
        .select('id')
        .eq('code', account.code)
        .single();

      if (existing) {
        console.log(`  ✓ ${account.code} already exists`);
        continue;
      }

      // Insert new account
      const { error } = await supabase
        .from('internal_accounts')
        .insert({
          code: account.code,
          name: account.name,
          type: account.type,
          category: account.category,
          is_active: true
        });

      if (error) {
        console.error(`  ✗ Error creating ${account.code}:`, error.message);
      } else {
        console.log(`  ✓ Created ${account.code}`);
      }
    }

    // Verify all accounts now exist
    console.log('\nVerifying all system accounts...');
    const { data: accounts } = await supabase
      .from('internal_accounts')
      .select('code, name, type, category')
      .order('code');

    console.log('\nAll accounts:');
    accounts.forEach(acc => {
      console.log(`  - ${acc.code}: ${acc.name} (${acc.type}/${acc.category})`);
    });

    console.log('\n=== ACCOUNTING SYSTEM READY ===');

  } catch (error) {
    console.error('Error seeding accounts:', error.message);
  }
}

seedSystemAccounts();
