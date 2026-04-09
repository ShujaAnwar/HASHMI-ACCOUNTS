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

-- 6. CRITICAL: Account Balance Trigger
-- This ensures the 'balance' column in 'accounts' stays in sync with 'ledger_entries'
CREATE OR REPLACE FUNCTION public.update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.accounts
        SET balance = balance + (NEW.debit - NEW.credit)
        WHERE id = NEW.account_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.accounts
        SET balance = balance - (OLD.debit - OLD.credit)
        WHERE id = OLD.account_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Subtract old values
        UPDATE public.accounts
        SET balance = balance - (OLD.debit - OLD.credit)
        WHERE id = OLD.account_id;
        -- Add new values
        UPDATE public.accounts
        SET balance = balance + (NEW.debit - NEW.credit)
        WHERE id = NEW.account_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_account_balance ON public.ledger_entries;
CREATE TRIGGER trg_update_account_balance
AFTER INSERT OR UPDATE OR DELETE ON public.ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.update_account_balance();

-- 7. RECALCULATE ALL BALANCES (Run this to fix existing discrepancies)
UPDATE public.accounts a
SET balance = (
    SELECT COALESCE(SUM(debit - credit), 0)
    FROM public.ledger_entries
    WHERE account_id = a.id
);

-- 8. RPC Function for Application-side recalculation
CREATE OR REPLACE FUNCTION public.recalculate_all_balances()
RETURNS void AS $$
BEGIN
    UPDATE public.accounts a
    SET balance = (
        SELECT COALESCE(SUM(debit - credit), 0)
        FROM public.ledger_entries
        WHERE account_id = a.id
    );
END;
$$ LANGUAGE plpgsql;

-- 9. CRITICAL: FORCE SCHEMA CACHE RELOAD
-- This tells Supabase/PostgREST to refresh its column list
NOTIFY pgrst, 'reload schema';
