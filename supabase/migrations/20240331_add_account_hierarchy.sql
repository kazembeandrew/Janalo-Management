-- Add account hierarchy support for tree view
-- This enables parent-child relationships in chart of accounts

-- 1. Add parent_id column to internal_accounts
ALTER TABLE public.internal_accounts 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.internal_accounts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS account_number_display TEXT,  -- For formatted display like "1000", "1100"
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Create index for parent lookups
CREATE INDEX IF NOT EXISTS idx_internal_accounts_parent_id ON public.internal_accounts(parent_id);

-- 3. Create view for account tree with full paths
CREATE OR REPLACE VIEW public.account_tree AS
WITH RECURSIVE account_hierarchy AS (
    -- Base case: root accounts (no parent)
    SELECT 
        id,
        name,
        category,
        code,
        parent_id,
        balance,
        account_number_display,
        0 as level,
        name as full_path,
        ARRAY[id] as path_ids
    FROM public.internal_accounts
    WHERE parent_id IS NULL OR parent_id = id  -- Self-reference protection
    
    UNION ALL
    
    -- Recursive case: child accounts
    SELECT 
        ia.id,
        ia.name,
        ia.category,
        ia.code,
        ia.parent_id,
        ia.balance,
        ia.account_number_display,
        ah.level + 1,
        ah.full_path || ' > ' || ia.name,
        ah.path_ids || ia.id
    FROM public.internal_accounts ia
    INNER JOIN account_hierarchy ah ON ia.parent_id = ah.id
    WHERE NOT ia.id = ANY(ah.path_ids)  -- Prevent infinite loops
)
SELECT 
    id,
    name,
    category,
    code,
    parent_id,
    balance,
    account_number_display,
    level,
    full_path,
    path_ids
FROM account_hierarchy
ORDER BY path_ids;

-- 4. Create function to get account children
CREATE OR REPLACE FUNCTION get_account_children(parent_uuid UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    category TEXT,
    balance DECIMAL(15,2),
    level INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE children AS (
        SELECT ia.*, 0 as lvl
        FROM public.internal_accounts ia
        WHERE ia.parent_id = parent_uuid
        
        UNION ALL
        
        SELECT ia.*, c.lvl + 1
        FROM public.internal_accounts ia
        INNER JOIN children c ON ia.parent_id = c.id
        WHERE c.lvl < 10  -- Max depth protection
    )
    SELECT c.id, c.name, c.category, c.balance, c.lvl
    FROM children c;
END;
$$ LANGUAGE plpgsql;

-- 5. Create function to calculate account subtree balance
CREATE OR REPLACE FUNCTION get_account_subtree_balance(root_id UUID)
RETURNS DECIMAL(15,2) AS $$
DECLARE
    total_balance DECIMAL(15,2);
BEGIN
    SELECT COALESCE(SUM(balance), 0)
    INTO total_balance
    FROM (
        SELECT balance FROM public.internal_accounts WHERE id = root_id
        UNION ALL
        SELECT balance FROM get_account_children(root_id)
    ) all_accounts;
    
    RETURN total_balance;
END;
$$ LANGUAGE plpgsql;

-- 6. Sample data creation skipped
