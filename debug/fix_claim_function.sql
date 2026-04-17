-- Fix claim function to include claim_date
CREATE OR REPLACE FUNCTION public.claim_expense_against_allocation(
    p_expense_id UUID,
    p_allocation_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_claim_id UUID;
    v_officer_id UUID;
    v_claim_amount DECIMAL(15,2);
    v_remaining DECIMAL(15,2);
BEGIN
    -- Get expense details
    SELECT e.recorded_by, e.amount INTO v_officer_id, v_claim_amount
    FROM public.expenses e
    WHERE e.id = p_expense_id;

    IF v_officer_id IS NULL THEN
        RAISE EXCEPTION 'Expense not found';
    END IF;

    -- Check the officer owns the allocation
    IF NOT EXISTS (
        SELECT 1 FROM public.officer_fund_allocations
        WHERE id = p_allocation_id AND officer_id = v_officer_id
    ) THEN
        RAISE EXCEPTION 'Allocation does not belong to this officer';
    END IF;

    -- Check remaining balance
    SELECT remaining_balance INTO v_remaining
    FROM public.get_officer_allocation_balance(v_officer_id, 
        (SELECT allocated_period FROM public.officer_fund_allocations WHERE id = p_allocation_id)
    )
    WHERE allocation_id = p_allocation_id;

    IF v_claim_amount > v_remaining THEN
        RAISE EXCEPTION 'Claim amount exceeds remaining allocation balance';
    END IF;

    -- Create the claim with claim_date
    INSERT INTO public.officer_expense_claims (
        officer_id, 
        allocation_id, 
        expense_id, 
        claim_amount, 
        status,
        claim_date,  -- Include claim_date
        created_at,
        updated_at
    ) VALUES (
        v_officer_id, 
        p_allocation_id, 
        p_expense_id, 
        v_claim_amount, 
        'pending',
        CURRENT_DATE,  -- Set claim_date to current date
        NOW(),
        NOW()
    )
    RETURNING id INTO v_claim_id;

    RETURN v_claim_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
