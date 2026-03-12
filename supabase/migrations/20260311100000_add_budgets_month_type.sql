-- Add month/type columns for UI compatibility
-- Fixes PostgREST errors like: "Could not find the 'month' column of 'budgets' in the schema cache"

ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS month TEXT,
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'expense';

-- Backfill month from existing period_start for existing rows.
UPDATE public.budgets
SET month = to_char(period_start, 'YYYY-MM')
WHERE month IS NULL AND period_start IS NOT NULL;

-- Basic validation constraints (kept permissive: month can be NULL for legacy rows).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'budgets_month_format_chk'
  ) THEN
    ALTER TABLE public.budgets
      ADD CONSTRAINT budgets_month_format_chk
      CHECK (month IS NULL OR month ~ '^[0-9]{4}-[0-9]{2}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'budgets_type_chk'
  ) THEN
    ALTER TABLE public.budgets
      ADD CONSTRAINT budgets_type_chk
      CHECK (type IN ('income', 'expense'));
  END IF;
END $$;

-- Keep month <-> period_start/period_end in sync for inserts/updates.
CREATE OR REPLACE FUNCTION public.budgets_sync_month_period()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.month IS NOT NULL AND (NEW.period_start IS NULL OR NEW.period_end IS NULL) THEN
    NEW.period_start := to_date(NEW.month || '-01', 'YYYY-MM-DD');
    NEW.period_end := (NEW.period_start + INTERVAL '1 month' - INTERVAL '1 day')::date;
  ELSIF NEW.month IS NULL AND NEW.period_start IS NOT NULL THEN
    NEW.month := to_char(NEW.period_start, 'YYYY-MM');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_budgets_sync_month_period ON public.budgets;
CREATE TRIGGER trg_budgets_sync_month_period
BEFORE INSERT OR UPDATE ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.budgets_sync_month_period();

-- Supports frontend upserts: { onConflict: 'category,month' }
CREATE UNIQUE INDEX IF NOT EXISTS budgets_category_month_uniq
ON public.budgets (category, month);

-- Nudge PostgREST to reload its schema cache.
NOTIFY pgrst, 'reload schema';

