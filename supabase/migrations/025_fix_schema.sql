-- Ensure procedures are in the public schema and accessible via RPC

-- Drop from all possible schemas
DROP FUNCTION IF EXISTS public.deduct_balance_for_bet(TEXT, NUMERIC, TEXT) CASCADE;
DROP FUNCTION IF EXISTS deduct_balance_for_bet(TEXT, NUMERIC, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.apply_balance_for_payout(TEXT, NUMERIC, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS apply_balance_for_payout(TEXT, NUMERIC, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.update_balance_for_deposit(TEXT, NUMERIC, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_balance_for_deposit(TEXT, NUMERIC, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.update_balance_for_withdrawal(TEXT, NUMERIC, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_balance_for_withdrawal(TEXT, NUMERIC, TEXT, TEXT) CASCADE;

-- 1. deduct_balance_for_bet
CREATE OR REPLACE FUNCTION public.deduct_balance_for_bet(
    p_user_address TEXT,
    p_bet_amount NUMERIC,
    p_currency TEXT DEFAULT 'BNB'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    IF p_bet_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Bet amount must be greater than zero', 'new_balance', NULL);
    END IF;

    SELECT balance INTO v_current_balance
    FROM public.user_balances
    WHERE LOWER(user_address) = LOWER(p_user_address) AND currency = p_currency
    FOR UPDATE;
    
    IF v_current_balance IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User balance not found for this currency', 'new_balance', NULL);
    END IF;
    
    IF v_current_balance < p_bet_amount THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient balance', 'new_balance', v_current_balance);
    END IF;
    
    v_new_balance := v_current_balance - p_bet_amount;
    
    UPDATE public.user_balances
    SET balance = v_new_balance, updated_at = NOW()
    WHERE LOWER(user_address) = LOWER(p_user_address) AND currency = p_currency;
    
    INSERT INTO public.balance_audit_log (user_address, currency, operation, amount, balance_before, balance_after)
    VALUES (LOWER(p_user_address), p_currency, 'bet_placed', p_bet_amount, v_current_balance, v_new_balance);
    
    RETURN json_build_object('success', true, 'error', NULL, 'new_balance', v_new_balance);
END;
$$;

-- 2. apply_balance_for_payout
CREATE OR REPLACE FUNCTION public.apply_balance_for_payout(
    p_user_address TEXT,
    p_payout_amount NUMERIC,
    p_currency TEXT DEFAULT 'BNB',
    p_bet_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    IF p_payout_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Payout amount must be greater than zero', 'new_balance', NULL);
    END IF;

    SELECT balance INTO v_current_balance
    FROM public.user_balances
    WHERE LOWER(user_address) = LOWER(p_user_address) AND currency = p_currency
    FOR UPDATE;
    
    IF v_current_balance IS NULL THEN
        INSERT INTO public.user_balances (user_address, currency, balance, updated_at, created_at)
        VALUES (LOWER(p_user_address), p_currency, p_payout_amount, NOW(), NOW());
        v_current_balance := 0;
        v_new_balance := p_payout_amount;
    ELSE
        v_new_balance := v_current_balance + p_payout_amount;
        UPDATE public.user_balances
        SET balance = v_new_balance, updated_at = NOW()
        WHERE LOWER(user_address) = LOWER(p_user_address) AND currency = p_currency;
    END IF;
    
    INSERT INTO public.balance_audit_log (user_address, currency, operation, amount, balance_before, balance_after)
    VALUES (LOWER(p_user_address), p_currency, 'bet_won', p_payout_amount, v_current_balance, v_new_balance);
    
    RETURN json_build_object('success', true, 'error', NULL, 'new_balance', v_new_balance);
END;
$$;

-- 3. update_balance_for_deposit
CREATE OR REPLACE FUNCTION public.update_balance_for_deposit(
    p_user_address TEXT,
    p_deposit_amount NUMERIC,
    p_currency TEXT DEFAULT 'BNB',
    p_transaction_hash TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    IF p_deposit_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Deposit amount must be greater than zero', 'new_balance', NULL);
    END IF;

    SELECT balance INTO v_current_balance
    FROM public.user_balances
    WHERE LOWER(user_address) = LOWER(p_user_address) AND currency = p_currency
    FOR UPDATE;
    
    IF v_current_balance IS NULL THEN
        INSERT INTO public.user_balances (user_address, currency, balance, updated_at, created_at)
        VALUES (LOWER(p_user_address), p_currency, p_deposit_amount, NOW(), NOW());
        v_current_balance := 0;
        v_new_balance := p_deposit_amount;
    ELSE
        v_new_balance := v_current_balance + p_deposit_amount;
        UPDATE public.user_balances
        SET balance = v_new_balance, updated_at = NOW()
        WHERE LOWER(user_address) = LOWER(p_user_address) AND currency = p_currency;
    END IF;
    
    INSERT INTO public.balance_audit_log (user_address, currency, operation, amount, balance_before, balance_after, tx_hash)
    VALUES (LOWER(p_user_address), p_currency, 'deposit', p_deposit_amount, v_current_balance, v_new_balance, p_transaction_hash);
    
    RETURN json_build_object('success', true, 'error', NULL, 'new_balance', v_new_balance);
END;
$$;

-- 4. update_balance_for_withdrawal
CREATE OR REPLACE FUNCTION public.update_balance_for_withdrawal(
    p_user_address TEXT,
    p_withdrawal_amount NUMERIC,
    p_currency TEXT DEFAULT 'BNB',
    p_transaction_hash TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    IF p_withdrawal_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Withdrawal amount must be greater than zero', 'new_balance', NULL);
    END IF;

    SELECT balance INTO v_current_balance
    FROM public.user_balances
    WHERE LOWER(user_address) = LOWER(p_user_address) AND currency = p_currency
    FOR UPDATE;
    
    IF v_current_balance IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not found for this currency', 'new_balance', NULL);
    END IF;
    
    IF v_current_balance < p_withdrawal_amount THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient balance', 'new_balance', v_current_balance);
    END IF;
    
    v_new_balance := v_current_balance - p_withdrawal_amount;
    
    UPDATE public.user_balances
    SET balance = v_new_balance, updated_at = NOW()
    WHERE LOWER(user_address) = LOWER(p_user_address) AND currency = p_currency;
    
    INSERT INTO public.balance_audit_log (user_address, currency, operation, amount, balance_before, balance_after, tx_hash)
    VALUES (LOWER(p_user_address), p_currency, 'withdrawal', p_withdrawal_amount, v_current_balance, v_new_balance, p_transaction_hash);
    
    RETURN json_build_object('success', true, 'error', NULL, 'new_balance', v_new_balance);
END;
$$;

-- Grant execute permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.deduct_balance_for_bet(TEXT, NUMERIC, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_balance_for_payout(TEXT, NUMERIC, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_balance_for_deposit(TEXT, NUMERIC, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_balance_for_withdrawal(TEXT, NUMERIC, TEXT, TEXT) TO anon, authenticated;
