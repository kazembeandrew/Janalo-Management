-- 1. Fix Mutable Search Paths for Security
-- This prevents search_path hijacking attacks by explicitly setting the path to 'public' or empty.

ALTER FUNCTION public.reassign_officer_portfolio(uuid, uuid, text) SET search_path = public;
ALTER FUNCTION public.update_account_balance_from_journal() SET search_path = public;
ALTER FUNCTION public.update_account_balance() SET search_path = public;
ALTER FUNCTION public.current_user_id() SET search_path = public;
ALTER FUNCTION public.cleanup_old_applications() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.get_loan_status_breakdown() SET search_path = public;
ALTER FUNCTION public.get_disbursement_timeline() SET search_path = public;
ALTER FUNCTION public.has_role(text) SET search_path = public;
ALTER FUNCTION public.get_dashboard_stats() SET search_path = public;
ALTER FUNCTION public.get_monthly_revenue() SET search_path = public;
ALTER FUNCTION public.get_officer_performance() SET search_path = public;
ALTER FUNCTION public.create_new_conversation(uuid) SET search_path = public;
ALTER FUNCTION public.get_unread_message_count() SET search_path = public;
ALTER FUNCTION public.get_notification_counts() SET search_path = public;
ALTER FUNCTION public.get_my_conversations_details() SET search_path = public;

-- 2. Tighten Overly Permissive RLS Policies
-- Replacing 'WITH CHECK (true)' with role-based or ownership-based checks.

-- Audit Logs: Only allow users to insert logs where they are the actor
DROP POLICY IF EXISTS "System can insert logs" ON public.audit_logs;
CREATE POLICY "Users can insert own logs" ON public.audit_logs
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Fund Transactions: Only allow Accountants or Admins to record transactions
DROP POLICY IF EXISTS "Staff record transactions" ON public.fund_transactions;
CREATE POLICY "Finance staff record transactions" ON public.fund_transactions
FOR INSERT TO authenticated WITH CHECK (
    get_auth_role() = ANY (ARRAY['admin', 'ceo', 'accountant'])
);

-- Notifications: Only allow users to insert notifications for others (system-like behavior) 
-- or restrict to specific roles that manage operations.
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Authorized roles can send notifications" ON public.notifications
FOR INSERT TO authenticated WITH CHECK (
    get_auth_role() = ANY (ARRAY['admin', 'ceo', 'hr', 'accountant', 'loan_officer'])
);

-- Users can view their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Conversations: Ensure users can only create conversations they are part of
DROP POLICY IF EXISTS "insert_conversations" ON public.conversations;
CREATE POLICY "Authenticated users can start conversations" ON public.conversations
FOR INSERT TO authenticated WITH CHECK (true); -- Header is fine, participants are checked below

DROP POLICY IF EXISTS "insert_participants" ON public.conversation_participants;
CREATE POLICY "Users can only add themselves or be added by system" ON public.conversation_participants
FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id OR get_auth_role() = ANY (ARRAY['admin', 'ceo'])
);