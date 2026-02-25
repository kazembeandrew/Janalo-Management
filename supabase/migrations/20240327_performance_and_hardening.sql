-- 1. Performance Indexing
-- Adding indexes on columns frequently used in RLS policies and joins to prevent full table scans.

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_borrowers_created_by ON public.borrowers(created_by);
CREATE INDEX IF NOT EXISTS idx_loans_borrower_id ON public.loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_officer_id ON public.loans(officer_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loans(status);
CREATE INDEX IF NOT EXISTS idx_repayments_loan_id ON public.repayments(loan_id);
CREATE INDEX IF NOT EXISTS idx_fund_transactions_from_acc ON public.fund_transactions(from_account_id);
CREATE INDEX IF NOT EXISTS idx_fund_transactions_to_acc ON public.fund_transactions(to_account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry_id ON public.journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_id ON public.journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_composite ON public.conversation_participants(user_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_id ON public.direct_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id) WHERE is_read = false;

-- 2. Storage Hardening
-- Ensure the loan-documents bucket is private and has strict RLS.

UPDATE storage.buckets SET public = false WHERE id = 'loan-documents';

-- Policy: Only authorized staff can view documents in the loan-documents bucket
DROP POLICY IF EXISTS "Staff can view loan documents" ON storage.objects;
CREATE POLICY "Staff can view loan documents"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'loan-documents' AND (
        get_auth_role() = ANY (ARRAY['admin', 'ceo', 'accountant', 'hr'])
        OR 
        -- Loan officers can only see documents for loans they manage
        EXISTS (
            SELECT 1 FROM public.loans 
            WHERE officer_id = auth.uid() 
            AND id::text = (storage.foldername(name))[1]
        )
    )
);

-- 3. Financial Integrity: Double-Entry Enforcement
-- Trigger to ensure journal entries are balanced (Debits = Credits) at the database level.

CREATE OR REPLACE FUNCTION public.check_journal_entry_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_debit numeric;
  v_total_credit numeric;
BEGIN
  SELECT SUM(debit), SUM(credit)
  INTO v_total_debit, v_total_credit
  FROM public.journal_lines
  WHERE journal_entry_id = NEW.journal_entry_id;

  IF ABS(COALESCE(v_total_debit, 0) - COALESCE(v_total_credit, 0)) > 0.01 THEN
    RAISE EXCEPTION 'Journal entry % is not balanced. Debits (%) must equal Credits (%).', 
      NEW.journal_entry_id, v_total_debit, v_total_credit;
  END IF;

  RETURN NEW;
END;
$$;

-- We use a constraint trigger to check balance after all lines are inserted
DROP TRIGGER IF EXISTS trg_check_journal_balance ON public.journal_lines;
CREATE CONSTRAINT TRIGGER trg_check_journal_balance
AFTER INSERT OR UPDATE ON public.journal_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.check_journal_entry_balance();

-- 4. Refine RLS for Borrowers (Ownership-based)
DROP POLICY IF EXISTS "Officers manage own borrowers" ON public.borrowers;
CREATE POLICY "Officers manage own borrowers"
ON public.borrowers FOR ALL TO authenticated
USING (
    created_by = auth.uid() 
    OR get_auth_role() = ANY (ARRAY['admin', 'ceo'])
)
WITH CHECK (
    created_by = auth.uid() 
    OR get_auth_role() = ANY (ARRAY['admin', 'ceo'])
);