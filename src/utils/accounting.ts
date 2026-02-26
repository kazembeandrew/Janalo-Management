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
 * Enhanced journal entry posting with backdate checking and atomic operations.
 * Uses database RPC for ACID compliance.
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

    // Use RPC function with backdate checking
    const { data, error } = await supabase.rpc('post_journal_entry_with_backdate_check', {
        p_reference_type: reference_type,
        p_reference_id: reference_id,
        p_description: description,
        p_lines: JSON.stringify(lines),
        p_user_id: userId,
        p_entry_date: date,
        p_max_backdate_days: 3
    });

    if (error) throw error;
    
    const result = data as any;
    
    if (!result.success) {
        // Check if backdate approval required
        if (result.requires_approval) {
            throw new Error(
                `Backdate approval required: ${result.error}. ` +
                `Please request approval from an executive.`
            );
        }
        throw new Error(result.error || 'Failed to post journal entry');
    }

    return {
        id: result.journal_entry_id,
        date: date,
        debits: result.debits,
        credits: result.credits
    };
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