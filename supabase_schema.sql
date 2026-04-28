    -- TRAVELLEDGER PRO: DATABASE SYNC & REPAIR SCRIPT
    -- RUN THIS IN SUPABASE SQL EDITOR TO FIX "COLUMN NOT FOUND" ERRORS

    -- 1. Ensure the Currency Enum exists
    DO $$ 
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'currency_enum') THEN
            CREATE TYPE public.currency_enum AS ENUM ('SAR', 'PKR');
        END IF;
    END $$;

    -- 2. Ensure the Accounts table has the branding columns
    ALTER TABLE public.accounts 
    ADD COLUMN IF NOT EXISTS currency public.currency_enum NOT NULL DEFAULT 'PKR',
    ADD COLUMN IF NOT EXISTS company_name TEXT,
    ADD COLUMN IF NOT EXISTS contact_number TEXT,
    ADD COLUMN IF NOT EXISTS logo_url TEXT;

    -- 3. Ensure App Config has all necessary columns
    ALTER TABLE public.app_config 
    ADD COLUMN IF NOT EXISTS font_size INTEGER DEFAULT 16,
    ADD COLUMN IF NOT EXISTS account_name_case TEXT DEFAULT 'Sentence Case',
    ADD COLUMN IF NOT EXISTS banks JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS auto_backup_enabled BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS auto_backup_interval_enabled BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS auto_backup_interval_hours INTEGER DEFAULT 6,
    ADD COLUMN IF NOT EXISTS show_hotels_list BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS auto_refresh_enabled BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS auto_refresh_interval_minutes INTEGER DEFAULT 5;

    -- 4. Ensure Ledger Entries has the voucher_num column for better tracking
    ALTER TABLE public.ledger_entries 
    ADD COLUMN IF NOT EXISTS voucher_num TEXT DEFAULT '-';

    -- 4.1 Update voucher_type_enum to include missing types
    DO $$
    DECLARE
        v_type TEXT;
    BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voucher_type_enum') THEN
            FOR v_type IN SELECT * FROM unnest(ARRAY['AV', 'RV', 'PV'])
            LOOP
                IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'voucher_type_enum' AND e.enumlabel = v_type) THEN
                    EXECUTE 'ALTER TYPE public.voucher_type_enum ADD VALUE ' || quote_literal(v_type);
                END IF;
            END LOOP;
        END IF;
    END $$;

    -- 5. Re-establish the Dashboard View (depends on currency/balance)
    DROP VIEW IF EXISTS public.dashboard_stats;
    CREATE VIEW public.dashboard_stats AS
    SELECT 
        COALESCE(SUM(CASE WHEN type = 'CUSTOMER' AND balance > 0 THEN balance ELSE 0 END), 0) as total_receivables,
        COALESCE(SUM(CASE WHEN type = 'VENDOR' AND balance < 0 THEN ABS(balance) ELSE 0 END), 0) as total_payables,
        (SELECT COALESCE(SUM(total_amount_pkr), 0) FROM public.vouchers WHERE type IN ('HV', 'TV', 'VV', 'TK', 'AV')) as total_revenue,
        COALESCE(SUM(CASE WHEN type = 'CASH_BANK' THEN balance ELSE 0 END), 0) as total_cash_bank
    FROM public.accounts;

    -- 6. Efficient Account Balance Sync System
    -- This ensures the 'balance' column in 'accounts' and 'balance_after' in 'ledger_entries' stay in sync.
    
    -- First, drop ALL existing triggers to ensure a clean state
    DO $$ 
    DECLARE 
        r RECORD;
    BEGIN
        FOR r IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'ledger_entries' AND trigger_schema = 'public') LOOP
            EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.ledger_entries';
        END LOOP;
    END $$;

    -- 7. RECALCULATE ALL BALANCES (The Source of Truth)
    -- Added SECURITY DEFINER to ensure it runs with full permissions
    CREATE OR REPLACE FUNCTION public.recalculate_all_balances()
    RETURNS void AS $$
    BEGIN
        -- Update head balances from the sum of ledger entries
        UPDATE public.accounts a
        SET balance = COALESCE((
            SELECT SUM(debit - credit)
            FROM public.ledger_entries
            WHERE account_id = a.id
        ), 0)
        WHERE true;

        -- Update running balances (balance_after) using window functions
        UPDATE public.ledger_entries le
        SET balance_after = sub.running_bal
        FROM (
            SELECT id, account_id, SUM(debit - credit) OVER (PARTITION BY account_id ORDER BY date ASC, id ASC) as running_bal
            FROM public.ledger_entries
        ) sub
        WHERE le.id = sub.id;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- 8. ROW-LEVEL SYNC TRIGGER
    -- This is more reliable for knowing which account to update.
    -- Added SECURITY DEFINER to fix permission issues.
    CREATE OR REPLACE FUNCTION public.sync_account_balances_fn()
    RETURNS TRIGGER AS $$
    DECLARE
        target_account_id UUID;
    BEGIN
        -- Prevent infinite recursion
        IF pg_trigger_depth() > 1 THEN
            RETURN NULL;
        END IF;

        target_account_id := COALESCE(NEW.account_id, OLD.account_id);

        -- 1. Update the specific account's head balance
        UPDATE public.accounts
        SET balance = (
            SELECT COALESCE(SUM(debit - credit), 0)
            FROM public.ledger_entries
            WHERE account_id = target_account_id
        )
        WHERE id = target_account_id;

        -- 2. Update running balances for ONLY this account
        UPDATE public.ledger_entries le
        SET balance_after = sub.running_bal
        FROM (
            SELECT id, SUM(debit - credit) OVER (ORDER BY date ASC, id ASC) as running_bal
            FROM public.ledger_entries
            WHERE account_id = target_account_id
        ) sub
        WHERE le.id = sub.id AND le.account_id = target_account_id;

        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    CREATE TRIGGER trg_sync_account_balances
    AFTER INSERT OR UPDATE OR DELETE ON public.ledger_entries
    FOR EACH ROW EXECUTE FUNCTION public.sync_account_balances_fn();

    -- Run it once to fix current data
    SELECT public.recalculate_all_balances();

    -- 9. UPDATE BRANDING (Optional, sets new defaults)
    UPDATE public.app_config 
    SET company_name = 'Hashmi Travel Solutions',
        app_subtitle = 'Travel Solutions by Shuja Anwar',
        company_phone = '0313-2710182',
        company_cell = '0313-2710182',
        company_email = 'Shujaanwaar@gmail.com'
    WHERE id = '00000000-0000-0000-0000-000000000001';

    -- 10. CRITICAL: FORCE SCHEMA CACHE RELOAD
    NOTIFY pgrst, 'reload schema';
