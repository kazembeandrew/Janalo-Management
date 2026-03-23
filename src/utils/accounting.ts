import { supabase } from '@/lib/supabase';

interface JournalLineInput {
    account_id: string;
    debit: number;
    credit: number;
}

/**
 * Checks rate limiting for financial operations
 */
export const checkRateLimit = async (
    action: 'financial_operation' | 'api_call' | 'login',
    maxRequests: number = 10,
    windowMinutes: number = 1
): Promise<{ allowed: boolean; reason?: string }> => {
    try {
        const { data, error } = await supabase.rpc('check_rate_limit', {
            p_identifier: 'user_' + (await supabase.auth.getUser()).data.user?.id,
            p_action: action,
            p_max_requests: maxRequests,
            p_window_minutes: windowMinutes
        });

        if (error) throw error;

        return {
            allowed: data.allowed,
            reason: data.reason
        };
    } catch (error) {
        console.error('Rate limit check failed:', error);
        // Allow operation if rate limiting fails (fail open for UX)
        return { allowed: true };
    }
};

/**
 * Checks if user has permission for financial operation
 */
export const checkFinancialPermission = async (
    operation: 'disburse' | 'repay' | 'reverse' | 'adjust',
    amount: number
): Promise<{ allowed: boolean; requiresApproval?: boolean; reason?: string }> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase.rpc('check_financial_operation_permission', {
            p_user_id: user.id,
            p_operation: operation,
            p_amount: amount
        });

        if (error) throw error;

        return {
            allowed: data.allowed,
            requiresApproval: data.requires_approval,
            reason: data.reason
        };
    } catch (error) {
        console.error('Permission check failed:', error);
        return { allowed: false, reason: 'Permission check failed' };
    }
};

/**
 * Validates financial amount
 */
export const validateFinancialAmount = (amount: number): boolean => {
    return amount > 0 && amount <= 10000000 && Number.isFinite(amount);
};

/**
 * Sanitizes text input
 */
export const sanitizeInput = (text: string): string => {
    return text.replace(/[<>&"'\x00-\x1F\x7F-\x9F]/g, '').trim();
};

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
 * Enhanced journal entry posting with security checks, backdate checking and atomic operations.
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
    // Security checks
    const rateLimitCheck = await checkRateLimit('financial_operation');
    if (!rateLimitCheck.allowed) {
        throw new Error(`Rate limit exceeded: ${rateLimitCheck.reason}`);
    }

    // Validate inputs
    if (!description || description.trim().length === 0) {
        throw new Error('Description is required');
    }

    const sanitizedDescription = sanitizeInput(description);
    if (sanitizedDescription.length > 500) {
        throw new Error('Description too long (max 500 characters)');
    }

    // Validate journal lines
    if (!lines || lines.length === 0) {
        throw new Error('At least one journal line is required');
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
        if (!line.account_id) {
            throw new Error('Account ID is required for all journal lines');
        }

        const debit = Number(line.debit) || 0;
        const credit = Number(line.credit) || 0;

        if (debit < 0 || credit < 0) {
            throw new Error('Debit and credit amounts cannot be negative');
        }

        if (!validateFinancialAmount(debit) && !validateFinancialAmount(credit)) {
            throw new Error('Invalid amount in journal line');
        }

        totalDebit += debit;
        totalCredit += credit;
    }

    // Check if debits equal credits (basic balance check)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(`Journal entry is not balanced. Debits: ${totalDebit}, Credits: ${totalCredit}`);
    }

    const date = entryDate || new Date().toISOString().split('T')[0];

    // Use RPC function with backdate checking
    const { data, error } = await supabase.rpc('post_journal_entry_with_backdate_check', {
        p_description: sanitizedDescription,
        p_lines: lines, // Pass as array, not JSON string
        p_entry_date: date,
        p_max_backdate_days: 3,
        p_reference_id: reference_id,
        p_reference_type: reference_type,
        p_user_id: userId
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