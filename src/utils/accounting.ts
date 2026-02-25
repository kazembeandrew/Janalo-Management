import { supabase } from '@/lib/supabase';

interface JournalLineInput {
    account_id: string;
    debit: number;
    credit: number;
}

/**
 * Verifies if a specific date falls within a closed financial period.
 */
export const isPeriodClosed = async (date: string): Promise<boolean> => {
    const month = date.substring(0, 7); // YYYY-MM
    const { data, error } = await supabase
        .from('closed_periods')
        .select('id')
        .eq('month', month)
        .maybeSingle();
    
    if (error) return false;
    return !!data;
};

/**
 * Centralized engine to post balanced journal entries.
 * Now includes a mandatory check for closed periods.
 */
export const postJournalEntry = async (
    reference_type: 'loan_disbursement' | 'repayment' | 'expense' | 'transfer' | 'injection' | 'adjustment' | 'reversal' | 'write_off',
    reference_id: string | null,
    description: string,
    lines: JournalLineInput[],
    userId: string,
    entryDate?: string
) => {
    const date = entryDate || new Date().toISOString().split('T')[0];

    // 1. Security Check: Prevent posting to closed periods
    const closed = await isPeriodClosed(date);
    if (closed) {
        throw new Error(`Cannot post transaction. The financial period for ${date.substring(0, 7)} is closed and locked.`);
    }

    // 2. Balance Check
    const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(`Journal entry is not balanced. Debits (${totalDebit}) must equal Credits (${totalCredit}).`);
    }

    // 3. Create Header
    const { data: entry, error: entryError } = await supabase
        .from('journal_entries')
        .insert([{
            reference_type,
            reference_id,
            description,
            created_by: userId,
            date: date
        }])
        .select()
        .single();

    if (entryError) throw entryError;

    // 4. Create Lines
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
 * Reverses an existing journal entry by creating a new entry with swapped debits and credits.
 */
export const reverseJournalEntry = async (originalEntryId: string, userId: string, reason: string) => {
    const { data: original, error: fetchError } = await supabase
        .from('journal_entries')
        .select('*, journal_lines(*)')
        .eq('id', originalEntryId)
        .single();
    
    if (fetchError || !original) throw new Error("Original entry not found");

    const reversalLines = original.journal_lines.map((l: any) => ({
        account_id: l.account_id,
        debit: l.credit,
        credit: l.debit
    }));

    return await postJournalEntry(
        'reversal',
        original.id,
        `REVERSAL of Entry #${original.id.slice(0,8)}: ${reason}`,
        reversalLines,
        userId
    );
};

export const getAccountByCode = async (code: string) => {
    const { data, error } = await supabase
        .from('internal_accounts')
        .select('id, name, balance')
        .eq('account_code', code)
        .single();
    
    if (error) throw new Error(`System account with code ${code} not found.`);
    return data;
};