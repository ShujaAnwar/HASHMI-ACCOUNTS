-- TRAVELLEDGER PRO: ENTERPRISE ACCOUNTING SCHEMA (HASHMI BOOKS)
-- Compliance: IFRS / IAS Double-Entry Bookkeeping

-- 1. CLEANUP
DROP VIEW IF EXISTS public.dashboard_stats;
DROP VIEW IF EXISTS public.trial_balance;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ledger_entries') THEN
        DROP TRIGGER IF EXISTS trg_sync_account_balance ON public.ledger_entries;
    END IF;
END $$;

DROP FUNCTION IF EXISTS public.sync_account_balance();
DROP TABLE IF EXISTS public.ledger_entries CASCADE;
DROP TABLE IF EXISTS public.vouchers CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;
DROP TABLE IF EXISTS public.app_config CASCADE;

-- 2. ENUMS
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_category') THEN
        CREATE TYPE public.account_category AS ENUM ('CUSTOMER', 'VENDOR', 'CASH_BANK', 'EXPENSE', 'EQUITY', 'REVENUE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'currency_enum') THEN
        CREATE TYPE public.currency_enum AS ENUM ('SAR', 'PKR');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voucher_type_enum') THEN
        CREATE TYPE public.voucher_type_enum AS ENUM ('RV', 'HV', 'TV', 'VV', 'TK', 'PV');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_enum') THEN
        CREATE TYPE public.status_enum AS ENUM ('POSTED', 'VOID');
    END IF;
END $$;

-- 3. TABLES
CREATE TABLE public.app_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL DEFAULT 'HASHMI BOOKS',
    app_subtitle TEXT DEFAULT 'Travels Services',
    company_address TEXT,
    company_phone TEXT,
    company_cell TEXT,
    company_email TEXT,
    company_logo TEXT,
    logo_size INTEGER DEFAULT 80,
    default_roe NUMERIC(15,4) DEFAULT 74.5000,
    banks JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE,
    name TEXT NOT NULL,
    type public.account_category NOT NULL,
    cell TEXT,
    location TEXT,
    currency public.currency_enum NOT NULL DEFAULT 'PKR',
    balance NUMERIC(15,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type public.voucher_type_enum NOT NULL,
    voucher_num VARCHAR(50) UNIQUE NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    currency public.currency_enum NOT NULL DEFAULT 'PKR',
    roe NUMERIC(15,4) NOT NULL DEFAULT 1.0000,
    total_amount_pkr NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    status public.status_enum DEFAULT 'POSTED',
    description TEXT,
    reference TEXT,
    customer_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    vendor_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    voucher_id UUID REFERENCES public.vouchers(id) ON DELETE CASCADE,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    debit NUMERIC(15,2) DEFAULT 0.00,
    credit NUMERIC(15,2) DEFAULT 0.00,
    description TEXT,
    balance_after NUMERIC(15,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TRIGGERS
CREATE OR REPLACE FUNCTION public.sync_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.accounts 
        SET balance = balance + (NEW.debit - NEW.credit) 
        WHERE id = NEW.account_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE public.accounts 
        SET balance = balance + (NEW.debit - NEW.credit) - (OLD.debit - OLD.credit) 
        WHERE id = NEW.account_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.accounts 
        SET balance = balance - (OLD.debit - OLD.credit) 
        WHERE id = OLD.account_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_account_balance
AFTER INSERT OR UPDATE OR DELETE ON public.ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.sync_account_balance();

-- 5. VIEWS
CREATE VIEW public.dashboard_stats AS
SELECT 
    COALESCE(SUM(CASE WHEN type = 'CUSTOMER' AND balance > 0 THEN balance ELSE 0 END), 0) as total_receivables,
    COALESCE(SUM(CASE WHEN type = 'VENDOR' AND balance < 0 THEN ABS(balance) ELSE 0 END), 0) as total_payables,
    (SELECT COALESCE(SUM(total_amount_pkr), 0) FROM public.vouchers WHERE type IN ('HV', 'TV', 'VV', 'TK')) as total_revenue,
    COALESCE(SUM(CASE WHEN type = 'CASH_BANK' THEN balance ELSE 0 END), 0) as total_cash_bank
FROM public.accounts;

-- 6. PERMISSIONS & RLS
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', tbl);
    END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- 7. SEED
INSERT INTO public.app_config (id, company_name, app_subtitle) 
VALUES ('00000000-0000-0000-0000-000000000001', 'HASHMI BOOKS', 'Travels Services') ON CONFLICT DO NOTHING;

INSERT INTO public.accounts (code, name, type, currency) VALUES
('1001', 'Cash in Hand', 'CASH_BANK', 'PKR'),
('1010', 'Accounts Receivable Control', 'CUSTOMER', 'PKR'),
('1020', 'Bank Al-Habib (Main)', 'CASH_BANK', 'PKR'),
('2001', 'Accounts Payable Control', 'VENDOR', 'PKR'),
('3001', 'General Reserve Fund', 'EQUITY', 'PKR'),
('4001', 'Travel Service Revenue', 'REVENUE', 'PKR'),
('5001', 'General Operating Expenses', 'EXPENSE', 'PKR')
ON CONFLICT (code) DO NOTHING;