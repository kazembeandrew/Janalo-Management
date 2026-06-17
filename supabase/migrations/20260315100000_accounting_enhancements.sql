-- =====================================================
-- ACCOUNTING SYSTEM ENHANCEMENTS MIGRATION
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Ensure PAR calculation function exists with proper provisioning
CREATE OR REPLACE FUNCTION calculate_par_and_provision()
RETURNS void AS $$
DECLARE
  loan_record RECORD;
  days_overdue INTEGER;
  provision_rate NUMERIC;
  required_provision NUMERIC;
  existing_provision NUMERIC;
  adjustment_amount NUMERIC;
BEGIN
  -- Loop through all active and defaulted loans
  FOR loan_record IN 
    SELECT 
      l.id,
      l.principal_outstanding,
      l.next_payment_date,
      COALESCE(SUM(lp.provision_amount), 0) as current_provision
    FROM loans l
    LEFT JOIN loan_provisions lp ON l.id = lp.loan_id
    WHERE l.status IN ('active', 'defaulted')
    GROUP BY l.id, l.principal_outstanding, l.next_payment_date
  LOOP
    -- Calculate days overdue
    IF loan_record.next_payment_date IS NOT NULL THEN
      days_overdue := GREATEST(0, CURRENT_DATE - loan_record.next_payment_date);
    ELSE
      days_overdue := 0;
    END IF;

    -- Determine provision rate based on Malawi banking regulations
    IF days_overdue >= 180 THEN
      provision_rate := 1.00;  -- 100%
    ELSIF days_overdue >= 90 THEN
      provision_rate := 0.75;  -- 75%
    ELSIF days_overdue >= 60 THEN
      provision_rate := 0.50;  -- 50%
    ELSIF days_overdue >= 30 THEN
      provision_rate := 0.25;  -- 25%
    ELSE
      provision_rate := 0.01;  -- 1% for current loans
    END IF;

    -- Calculate required provision
    required_provision := loan_record.principal_outstanding * provision_rate;
    existing_provision := loan_record.current_provision;
    adjustment_amount := required_provision - existing_provision;

    -- Create provision adjustment if needed
    IF ABS(adjustment_amount) > 0.01 THEN
      INSERT INTO loan_provisions (
        loan_id,
        provision_amount,
        provision_date,
        provision_rate,
        days_overdue,
        created_by
      ) VALUES (
        loan_record.id,
        adjustment_amount,
        CURRENT_DATE,
        provision_rate,
        days_overdue,
        auth.uid()
      );

      -- Create corresponding journal entry
      IF adjustment_amount > 0 THEN
        -- Increase provision (expense)
        INSERT INTO journal_entries (
          date,
          description,
          reference_type,
          reference_id,
          created_by
        ) VALUES (
          CURRENT_DATE,
          FORMAT('Loan loss provision adjustment for loan %s', loan_record.id),
          'loan',
          loan_record.id,
          auth.uid()
        );
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 2. Enhanced trial balance verification
CREATE OR REPLACE FUNCTION verify_trial_balance(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  is_balanced BOOLEAN,
  difference NUMERIC,
  total_debits NUMERIC,
  total_credits NUMERIC,
  entry_count BIGINT,
  details JSONB
) AS $$
DECLARE
  v_total_debits NUMERIC;
  v_total_credits NUMERIC;
  v_difference NUMERIC;
  v_entry_count BIGINT;
BEGIN
  -- Calculate totals for all journal entries up to the specified date
  SELECT 
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0),
    COUNT(*)
  INTO v_total_debits, v_total_credits, v_entry_count
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.journal_entry_id = je.id
  WHERE je.date <= p_date;

  v_difference := v_total_debits - v_total_credits;

  RETURN QUERY SELECT 
    ABS(v_difference) < 0.01 AS is_balanced,
    v_difference AS difference,
    v_total_debits AS total_debits,
    v_total_credits AS total_credits,
    v_entry_count AS entry_count,
    jsonb_build_object(
      'date', p_date,
      'debits', v_total_debits,
      'credits', v_total_credits,
      'difference', v_difference,
      'entries', v_entry_count
    ) AS details;
END;
$$ LANGUAGE plpgsql;

-- 3. Create loan_portfolios view for PAR metrics
CREATE OR REPLACE VIEW loan_portfolios AS
SELECT
  COUNT(CASE WHEN l.status IN ('active', 'defaulted') THEN 1 END) as total_loans,
  SUM(CASE WHEN l.status IN ('active', 'defaulted') THEN l.principal_outstanding ELSE 0 END) as total_outstanding,
  
  -- PAR calculations
  SUM(CASE 
    WHEN l.status IN ('active', 'defaulted') 
      AND l.next_payment_date < CURRENT_DATE - INTERVAL '30 days'
    THEN l.principal_outstanding ELSE 0 
  END) / NULLIF(SUM(CASE WHEN l.status IN ('active', 'defaulted') THEN l.principal_outstanding ELSE 0 END), 0) * 100 as par_30,
  
  SUM(CASE 
    WHEN l.status IN ('active', 'defaulted') 
      AND l.next_payment_date < CURRENT_DATE - INTERVAL '60 days'
    THEN l.principal_outstanding ELSE 0 
  END) / NULLIF(SUM(CASE WHEN l.status IN ('active', 'defaulted') THEN l.principal_outstanding ELSE 0 END), 0) * 100 as par_60,
  
  SUM(CASE 
    WHEN l.status IN ('active', 'defaulted') 
      AND l.next_payment_date < CURRENT_DATE - INTERVAL '90 days'
    THEN l.principal_outstanding ELSE 0 
  END) / NULLIF(SUM(CASE WHEN l.status IN ('active', 'defaulted') THEN l.principal_outstanding ELSE 0 END), 0) * 100 as par_90,
  
  SUM(CASE 
    WHEN l.status IN ('active', 'defaulted') 
      AND l.next_payment_date < CURRENT_DATE - INTERVAL '180 days'
    THEN l.principal_outstanding ELSE 0 
  END) / NULLIF(SUM(CASE WHEN l.status IN ('active', 'defaulted') THEN l.principal_outstanding ELSE 0 END), 0) * 100 as par_180,
  
  -- Provision totals
  COALESCE(SUM(lp.total_provision), 0) as total_provision,
  
  -- Coverage ratio
  COALESCE(SUM(lp.total_provision), 0) / 
    NULLIF(SUM(CASE WHEN l.status IN ('active', 'defaulted') THEN l.principal_outstanding ELSE 0 END), 0) as coverage_ratio

FROM loans l
LEFT JOIN (
  SELECT loan_id, SUM(provision_amount) as total_provision
  FROM loan_provisions
  GROUP BY loan_id
) lp ON l.id = lp.loan_id;

-- 4. Add indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loans_next_payment_status 
ON loans(next_payment_date, status) 
WHERE status IN ('active', 'defaulted');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loan_provisions_loan_date 
ON loan_provisions(loan_id, provision_date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_journal_entries_date_range 
ON journal_entries(date) 
WHERE date >= CURRENT_DATE - INTERVAL '1 year';

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION calculate_par_and_provision() TO authenticated;
GRANT EXECUTE ON FUNCTION verify_trial_balance(DATE) TO authenticated;
GRANT SELECT ON loan_portfolios TO authenticated;

-- =====================================================
-- VERIFICATION QUERIES (Run these after migration)
-- =====================================================

-- Test PAR calculation
-- SELECT calculate_par_and_provision();
-- SELECT * FROM loan_portfolios;

-- Test trial balance
-- SELECT * FROM verify_trial_balance(CURRENT_DATE);
