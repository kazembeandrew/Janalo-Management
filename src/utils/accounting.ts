import { supabase } from '@/lib/supabase';

interface JournalLineInput {
    account_id: string;
    debit: number;
    credit: number;
}

/**
 * Centralized engine to post balanced journal entries.
 * Ensures Total Debits = Total Credits before saving.
 */
export const postJournalEntry = async (
    reference_type: 'loan_disbursement' | 'repayment' | 'expense' | 'transfer' | 'injection' | 'adjustment',
    reference_id: string | null,
    description: string,
    lines: JournalLineInput[],
    userId: string
) => {
    // 1. Validate Balance
    const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(`Journal entry is not balanced. Debits (${totalDebit}) must equal Credits (${totalCredit}).`);
    }

    // 2. Create Header
    const { data: entry, error: entryError } = await supabase
        .from('journal_entries')
        .insert([{
            reference_type,
            reference_id,
            description,
            created_by: userId,
            date: new Date().toISOString().split('T')[0]
        }])
        .select()
        .single();

    if (entryError) throw entryError;

    // 3. Create Lines
    const linesWithHeader = lines.map(l => ({
        ...l,
        journal_entry_id: entry.id
    }));

    const { error: linesError } = await supabase
        .from('journal_lines')
        .insert(linesWithHeader);

    if (linesError) throw linesError;

    return entry;
};

/**
 * Helper to find a system account by its code.
 */
export const getAccountByCode = async (code: string) => {
    const { data, error } = await supabase
        .from('internal_accounts')
        .select('id, name, balance')
        .eq('account_code', code)
        .single();
    
    if (error) throw new Error(`System account with code ${code} not found.`);
    return data;
};