    -- TRAVELLEDGER PRO: DATABASE SYNC & REPAIR SCRIPT
    -- RUN THIS IN SUPABASE SQL EDITOR TO FIX "COLUMN NOT FOUND" ERRORS

    -- 1. Ensure the Currency Enum exists
    DO $$ 
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'currency_enum') THEN
            CREATE TYPE public.currency_enum AS ENUM ('SAR', 'PKR');
        END IF;
    END $$;

    -- 2. Ensure the Accounts table has the currency column
    ALTER TABLE public.accounts 
    ADD COLUMN IF NOT EXISTS currency public.currency_enum NOT NULL DEFAULT 'PKR';

    -- 3. Ensure App Config has all necessary columns
    ALTER TABLE public.app_config 
    ADD COLUMN IF NOT EXISTS font_size INTEGER DEFAULT 16,
    ADD COLUMN IF NOT EXISTS account_name_case TEXT DEFAULT 'Sentence Case',
    ADD COLUMN IF NOT EXISTS banks JSONB DEFAULT '[]';

    -- 4. Ensure Ledger Entries has the voucher_num column for better tracking
    ALTER TABLE public.ledger_entries 
    ADD COLUMN IF NOT EXISTS voucher_num TEXT DEFAULT '-';

    -- 5. Re-establish the Dashboard View (depends on currency/balance)
    DROP VIEW IF EXISTS public.dashboard_stats;
    CREATE VIEW public.dashboard_stats AS
    SELECT 
        COALESCE(SUM(CASE WHEN type = 'CUSTOMER' AND balance > 0 THEN balance ELSE 0 END), 0) as total_receivables,
        COALESCE(SUM(CASE WHEN type = 'VENDOR' AND balance < 0 THEN ABS(balance) ELSE 0 END), 0) as total_payables,
        (SELECT COALESCE(SUM(total_amount_pkr), 0) FROM public.vouchers WHERE type IN ('HV', 'TV', 'VV', 'TK')) as total_revenue,
        COALESCE(SUM(CASE WHEN type = 'CASH_BANK' THEN balance ELSE 0 END), 0) as total_cash_bank
    FROM public.accounts;

    -- 6. CRITICAL: Account Balance Sync System
    -- This ensures the 'balance' column in 'accounts' and 'balance_after' in 'ledger_entries' stay in sync.
    
    -- First, drop ALL existing triggers to ensure a clean state and avoid doubling
    DO $$ 
    DECLARE 
        r RECORD;
    BEGIN
        FOR r IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'ledger_entries' AND trigger_schema = 'public') LOOP
            EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.ledger_entries';
        END LOOP;
    END $$;

    -- 7. RECALCULATE ALL BALANCES (The Source of Truth)
    CREATE OR REPLACE FUNCTION public.recalculate_all_balances()
    RETURNS void AS $$
    BEGIN
        -- Update head balances from the sum of ledger entries
        UPDATE public.accounts a
        SET balance = COALESCE((
            SELECT SUM(debit - credit)
            FROM public.ledger_entries
            WHERE account_id = a.id
        ), 0);

        -- Update running balances (balance_after) using window functions
        UPDATE public.ledger_entries le
        SET balance_after = sub.running_bal
        FROM (
            SELECT id, account_id, SUM(debit - credit) OVER (PARTITION BY account_id ORDER BY date ASC, id ASC) as running_bal
            FROM public.ledger_entries
        ) sub
        WHERE le.id = sub.id;
    END;
    $$ LANGUAGE plpgsql;

    -- 8. STATEMENT-LEVEL TRIGGER
    -- This fires ONCE per SQL command, ensuring balances are synced exactly once.
    -- This prevents doubling issues caused by row-level triggers firing multiple times.
    CREATE OR REPLACE FUNCTION public.sync_balances_stmt_fn()
    RETURNS TRIGGER AS $$
    BEGIN
        -- CRITICAL: Prevent infinite recursion
        -- When recalculate_all_balances() updates ledger_entries, it would trigger this again.
        IF pg_trigger_depth() > 1 THEN
            RETURN NULL;
        END IF;

        PERFORM public.recalculate_all_balances();
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_sync_balances_stmt
    AFTER INSERT OR UPDATE OR DELETE ON public.ledger_entries
    FOR EACH STATEMENT EXECUTE FUNCTION public.sync_balances_stmt_fn();

    -- Run it once to fix current data
    SELECT public.recalculate_all_balances();

    -- 9. CRITICAL: FORCE SCHEMA CACHE RELOAD
    NOTIFY pgrst, 'reload schema';
