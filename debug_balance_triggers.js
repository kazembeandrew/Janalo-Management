import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debugBalanceTriggers() {
  console.log('=== DEBUG BALANCE TRIGGERS ===\n');

  try {
    // Check triggers
    console.log('1. Checking triggers on journal_lines table...');
    const { data: triggers, error: triggerError } = await supabase.rpc('sql', {
      query: `
        SELECT
            tgname as trigger_name,
            tgfoid::regproc as function_name,
            tgenabled as enabled
        FROM pg_trigger
        WHERE tgrelid = 'public.journal_lines'::regclass
        ORDER BY tgname;
      `
    });

    if (triggerError) {
      console.log('   Could not check triggers via RPC, trying direct query...');
      // Try a simpler check
      const { data: accounts, error: accError } = await supabase
        .from('internal_accounts')
        .select('account_code, balance, updated_at')
        .in('account_code', ['PORTFOLIO', 'CASH', 'BANK', 'EQUITY', 'CAPITAL']);

      if (accError) {
        console.error('Error checking accounts:', accError);
      } else {
        console.log('Account balances:');
        accounts.forEach(acc => {
          console.log(`  ${acc.account_code}: ${acc.balance} (updated: ${acc.updated_at})`);
        });
      }
    } else {
      console.log('Triggers found:', triggers);
    }

    // Check recent journal entries
    console.log('\n2. Recent journal entries:');
    const { data: journals, error: journalError } = await supabase
      .from('journal_entries')
      .select(`
        id,
        reference_type,
        reference_id,
        description,
        date,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    if (journalError) {
      console.error('Error fetching journals:', journalError);
    } else {
      journals.forEach(j => {
        console.log(`  ${j.id}: ${j.reference_type} - ${j.description} (${j.date})`);
      });
    }

    // Check if balances match journal totals
    console.log('\n3. Checking if account balances match journal calculations...');

    // Get all journal lines with account info
    const { data: lines, error: linesError } = await supabase
      .from('journal_lines')
      .select(`
        debit,
        credit,
        internal_accounts!inner(account_code, name)
      `);

    if (linesError) {
      console.error('Error fetching journal lines:', linesError);
    } else {
      // Calculate balances from journal
      const calculatedBalances = {};
      lines.forEach(line => {
        const code = line.internal_accounts.account_code;
        if (!calculatedBalances[code]) {
          calculatedBalances[code] = 0;
        }
        calculatedBalances[code] += Number(line.debit || 0) - Number(line.credit || 0);
      });

      console.log('Calculated balances from journal:');
      Object.entries(calculatedBalances).forEach(([code, balance]) => {
        console.log(`  ${code}: ${balance.toFixed(2)}`);
      });

      // Compare with actual account balances
      const { data: accounts, error: accError } = await supabase
        .from('internal_accounts')
        .select('account_code, balance');

      if (!accError) {
        console.log('\nActual account balances:');
        const actualBalances = {};
        accounts.forEach(acc => {
          actualBalances[acc.account_code] = Number(acc.balance);
          console.log(`  ${acc.account_code}: ${acc.balance}`);
        });

        console.log('\nDifferences:');
        Object.keys(calculatedBalances).forEach(code => {
          const calc = calculatedBalances[code];
          const actual = actualBalances[code] || 0;
          const diff = actual - calc;
          if (Math.abs(diff) > 0.01) {
            console.log(`  ${code}: ${diff.toFixed(2)} (actual: ${actual.toFixed(2)}, calculated: ${calc.toFixed(2)})`);
          }
        });
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

debugBalanceTriggers();