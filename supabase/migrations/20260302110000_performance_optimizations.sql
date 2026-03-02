-- Phase 3: Performance & Caching Implementation
-- Database optimizations for improved query performance

-- 1. Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_journal_entries_status_date ON public.journal_entries(status, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_created_by ON public.journal_entries(created_by);
CREATE INDEX IF NOT EXISTS idx_journal_entries_entry_number ON public.journal_entries(entry_number);

-- 2. Optimize journal lines queries (most frequent)
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_entry ON public.journal_lines(account_id, journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry_only ON public.journal_lines(journal_entry_id);

-- 3. Add partial indexes for posted entries only (smaller, faster)
CREATE INDEX IF NOT EXISTS idx_journal_entries_posted_date ON public.journal_entries(entry_date DESC)
WHERE status = 'posted';

CREATE INDEX IF NOT EXISTS idx_journal_lines_posted_account ON public.journal_lines(account_id)
WHERE EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.id = journal_lines.journal_entry_id
    AND je.status = 'posted'
);

-- 4. Optimize audit trail queries (frequently accessed)
CREATE INDEX IF NOT EXISTS idx_audit_trail_table_record_action ON public.audit_trail(table_name, record_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_trail_timestamp ON public.audit_trail(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user_timestamp ON public.audit_trail(changed_by, changed_at DESC);

-- 5. Add covering indexes for account balance calculations
CREATE INDEX IF NOT EXISTS idx_journal_lines_composite ON public.journal_lines(
    account_id,
    journal_entry_id,
    debit,
    credit
) WHERE EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.id = journal_lines.journal_entry_id
    AND je.status = 'posted'
);

-- 6. Optimize user permission queries
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_composite ON public.user_roles(user_id, role_id);

-- 7. Add BRIN indexes for large date ranges (more efficient than B-tree for time-series data)
CREATE INDEX IF NOT EXISTS idx_journal_entries_date_brin ON public.journal_entries USING BRIN (entry_date)
WHERE status = 'posted';

-- 8. Create materialized view for account balances (refreshed periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS account_balances AS
SELECT
    a.id as account_id,
    a.code,
    a.name,
    a.type,
    a.category,
    COALESCE(SUM(
        CASE
            WHEN jl.debit > 0 THEN jl.debit
            WHEN jl.credit > 0 THEN -jl.credit
            ELSE 0
        END
    ), 0) as balance,
    COUNT(je.id) as transaction_count,
    MAX(je.entry_date) as last_transaction_date
FROM accounts a
LEFT JOIN journal_lines jl ON jl.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
GROUP BY a.id, a.code, a.name, a.type, a.category;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_balances_id ON account_balances(account_id);

-- 9. Create function to refresh account balances
CREATE OR REPLACE FUNCTION refresh_account_balances()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY account_balances;
END;
$$ LANGUAGE plpgsql;

-- 10. Create partial indexes for active records only
CREATE INDEX IF NOT EXISTS idx_accounts_active_code ON public.accounts(code)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_users_active_email ON public.users(email)
WHERE is_active = true;

-- 11. Optimize foreign key constraints with indexes
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_id ON public.journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_journal_entry_id ON public.journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_changed_by ON public.audit_trail(changed_by);

-- 12. Create index for permission checks
CREATE INDEX IF NOT EXISTS idx_role_permissions_composite ON public.role_permissions(role_id, permission_id);

-- 13. Add table statistics for query planner
ALTER TABLE journal_entries SET (autovacuum_analyze_scale_factor = 0.02);
ALTER TABLE journal_lines SET (autovacuum_analyze_scale_factor = 0.01);
ALTER TABLE audit_trail SET (autovacuum_analyze_scale_factor = 0.05);

-- 14. Create function for bulk balance calculations
CREATE OR REPLACE FUNCTION get_account_balances_bulk(account_ids UUID[])
RETURNS TABLE (
    account_id UUID,
    balance DECIMAL(15,2),
    transaction_count INTEGER,
    last_transaction_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ab.account_id,
        ab.balance,
        ab.transaction_count,
        ab.last_transaction_date
    FROM account_balances ab
    WHERE ab.account_id = ANY(account_ids);
END;
$$ LANGUAGE plpgsql;

-- 15. Create function to analyze slow queries (for monitoring)
CREATE OR REPLACE FUNCTION get_query_performance_stats(hours_back INTEGER DEFAULT 24)
RETURNS TABLE (
    query TEXT,
    calls BIGINT,
    total_time DOUBLE PRECISION,
    mean_time DOUBLE PRECISION,
    rows_affected BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pg_stat_statements.query,
        pg_stat_statements.calls,
        pg_stat_statements.total_time,
        pg_stat_statements.mean_time,
        pg_stat_statements.rows
    FROM pg_stat_statements
    WHERE pg_stat_statements.total_time > 1000  -- More than 1 second total
    AND pg_stat_statements.calls > 10  -- More than 10 calls
    AND pg_stat_statements.query NOT LIKE '%pg_stat_statements%'
    ORDER BY pg_stat_statements.mean_time DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- 16. Grant permissions
GRANT SELECT ON account_balances TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_account_balances() TO authenticated;
GRANT EXECUTE ON FUNCTION get_account_balances_bulk(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_query_performance_stats(INTEGER) TO authenticated;

-- 17. Create maintenance job to refresh materialized view (would be called by cron)
-- This is just an example - in production, use pg_cron or similar
CREATE OR REPLACE FUNCTION schedule_balance_refresh()
RETURNS void AS $$
BEGIN
    -- Refresh balances every 5 minutes during business hours
    -- In production, this would be handled by a job scheduler
    PERFORM refresh_account_balances();
END;
$$ LANGUAGE plpgsql;
