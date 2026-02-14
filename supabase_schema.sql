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

-- 3. Ensure App Config has font_size for UI scaling
ALTER TABLE public.app_config 
ADD COLUMN IF NOT EXISTS font_size INTEGER DEFAULT 16;

-- 4. Re-establish the Dashboard View (depends on currency/balance)
DROP VIEW IF EXISTS public.dashboard_stats;
CREATE VIEW public.dashboard_stats AS
SELECT 
    COALESCE(SUM(CASE WHEN type = 'CUSTOMER' AND balance > 0 THEN balance ELSE 0 END), 0) as total_receivables,
    COALESCE(SUM(CASE WHEN type = 'VENDOR' AND balance < 0 THEN ABS(balance) ELSE 0 END), 0) as total_payables,
    (SELECT COALESCE(SUM(total_amount_pkr), 0) FROM public.vouchers WHERE type IN ('HV', 'TV', 'VV', 'TK')) as total_revenue,
    COALESCE(SUM(CASE WHEN type = 'CASH_BANK' THEN balance ELSE 0 END), 0) as total_cash_bank
FROM public.accounts;

-- 5. CRITICAL: FORCE SCHEMA CACHE RELOAD
-- This tells Supabase/PostgREST to refresh its column list
NOTIFY pgrst, 'reload schema';