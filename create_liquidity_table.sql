-- Create missing liquidity_metrics table and functions
-- This fixes the missing table error

-- 1. Create liquidity_metrics table
CREATE TABLE IF NOT EXISTS public.liquidity_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_equivalents DECIMAL(15,2) DEFAULT 0,
    short_term_investments DECIMAL(15,2) DEFAULT 0,
    portfolio_loans DECIMAL(15,2) DEFAULT 0,
    total_liquidity DECIMAL(15,2) DEFAULT 0,
    liquidity_ratio DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.liquidity_metrics ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies
CREATE POLICY "Authenticated users can view liquidity metrics" ON public.liquidity_metrics
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert liquidity metrics" ON public.liquidity_metrics
FOR INSERT TO authenticated WITH CHECK (true);

-- 4. Create function to calculate and store liquidity metrics
CREATE OR REPLACE FUNCTION public.calculate_liquidity_metrics()
RETURNS void AS $$
DECLARE
    v_cash_equivalents DECIMAL(15,2) := 0;
    v_short_term_investments DECIMAL(15,2) := 0;
    v_portfolio_loans DECIMAL(15,2) := 0;
    v_total_liquidity DECIMAL(15,2) := 0;
    v_liquidity_ratio DECIMAL(5,2) := 0;
BEGIN
    -- Calculate cash equivalents (CASH + BANK accounts)
    SELECT COALESCE(SUM(balance), 0)
    INTO v_cash_equivalents
    FROM public.internal_accounts
    WHERE account_code IN ('CASH', 'BANK')
    AND account_category = 'asset';

    -- Calculate short-term investments (if any)
    SELECT COALESCE(SUM(balance), 0)
    INTO v_short_term_investments
    FROM public.internal_accounts
    WHERE account_code LIKE 'INVEST%'
    AND account_category = 'asset';

    -- Calculate portfolio loans (PORTFOLIO account balance)
    SELECT COALESCE(balance, 0)
    INTO v_portfolio_loans
    FROM public.internal_accounts
    WHERE account_code = 'PORTFOLIO'
    AND account_category = 'asset';

    -- Calculate total liquidity
    v_total_liquidity := v_cash_equivalents + v_short_term_investments;

    -- Calculate liquidity ratio (cash + investments / portfolio loans)
    IF v_portfolio_loans > 0 THEN
        v_liquidity_ratio := (v_total_liquidity / v_portfolio_loans) * 100;
    ELSE
        v_liquidity_ratio := 0;
    END IF;

    -- Insert new metrics record
    INSERT INTO public.liquidity_metrics (
        cash_equivalents,
        short_term_investments,
        portfolio_loans,
        total_liquidity,
        liquidity_ratio
    ) VALUES (
        v_cash_equivalents,
        v_short_term_investments,
        v_portfolio_loans,
        v_total_liquidity,
        v_liquidity_ratio
    );

    -- Clean up old records (keep only last 100)
    DELETE FROM public.liquidity_metrics
    WHERE id NOT IN (
        SELECT id FROM public.liquidity_metrics
        ORDER BY created_at DESC
        LIMIT 100
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION public.calculate_liquidity_metrics() TO authenticated;

-- 6. Create trigger to update liquidity metrics after account balance changes
CREATE OR REPLACE FUNCTION public.trigger_liquidity_update()
RETURNS trigger AS $$
BEGIN
    -- Only recalculate if it's a relevant account
    IF NEW.account_code IN ('CASH', 'BANK', 'PORTFOLIO') OR NEW.account_code LIKE 'INVEST%' THEN
        PERFORM public.calculate_liquidity_metrics();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create trigger on internal_accounts
DROP TRIGGER IF EXISTS trg_update_liquidity_metrics ON public.internal_accounts;
CREATE TRIGGER trg_update_liquidity_metrics
AFTER UPDATE ON public.internal_accounts
FOR EACH ROW
WHEN (OLD.balance IS DISTINCT FROM NEW.balance)
EXECUTE FUNCTION public.trigger_liquidity_update();

-- 8. Grant permissions for the trigger function
GRANT EXECUTE ON FUNCTION public.trigger_liquidity_update() TO authenticated;

-- 9. Initialize liquidity metrics with current data
SELECT public.calculate_liquidity_metrics();

-- 10. Verify the table was created and populated
SELECT * FROM public.liquidity_metrics ORDER BY created_at DESC LIMIT 1;
