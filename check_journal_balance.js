import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkJournalBalance() {
  console.log('=== JOURNAL ENTRIES BALANCE CHECK ===\n');

  const { data: entries, error } = await supabase
    .from('journal_lines')
    .select('journal_entry_id, account_id, debit, credit, description')
    .order('journal_entry_id');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${entries.length} journal lines`);

  // Group by journal
  const journals = {};

  entries.forEach(line => {
    if (!journals[line.journal_entry_id]) {
      journals[line.journal_entry_id] = { debits: 0, credits: 0, lines: [] };
    }
    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);
    journals[line.journal_entry_id].debits += debit;
    journals[line.journal_entry_id].credits += credit;
    journals[line.journal_entry_id].lines.push(line);
  });

  let totalDebits = 0;
  let totalCredits = 0;
  let unbalanced = [];

  console.log('\nChecking each journal entry:');
  Object.entries(journals).forEach(([id, data]) => {
    totalDebits += data.debits;
    totalCredits += data.credits;
    const diff = Math.abs(data.debits - data.credits);
    if (diff > 0.01) {
      unbalanced.push({ id, debits: data.debits, credits: data.credits, diff });
      console.log(`Journal ${id}: Debits ${data.debits.toFixed(2)}, Credits ${data.credits.toFixed(2)}, Diff ${diff.toFixed(2)}`);
    }
  });

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total Debits: ${totalDebits.toFixed(2)}`);
  console.log(`Total Credits: ${totalCredits.toFixed(2)}`);
  console.log(`Overall Difference: ${Math.abs(totalDebits - totalCredits).toFixed(2)}`);

  if (unbalanced.length > 0) {
    console.log(`\n❌ ${unbalanced.length} unbalanced journal entries found`);
  } else {
    console.log('\n✅ All journal entries are balanced');
  }

  // Check if the total matches the account balance total
  const accountTotal = 46951339.48; // from previous check
  const journalDiff = totalDebits - totalCredits;
  console.log(`\nAccount balance total: ${accountTotal.toFixed(2)}`);
  console.log(`Journal debits - credits: ${journalDiff.toFixed(2)}`);
  console.log(`Difference: ${Math.abs(accountTotal - journalDiff).toFixed(2)}`);
}

checkJournalBalance();