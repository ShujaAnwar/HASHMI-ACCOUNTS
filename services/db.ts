import { supabase } from './supabase';
import { Account, Voucher, AppConfig, AccountType, Currency, VoucherType, VoucherStatus, DashboardStats } from '../types';

const mapVoucher = (v: any): Voucher => ({
  id: v.id,
  type: v.type as VoucherType,
  voucherNum: v.voucher_num,
  date: v.date,
  currency: v.currency as Currency,
  roe: Number(v.roe),
  totalAmountPKR: Number(v.total_amount_pkr),
  description: v.description,
  status: v.status as VoucherStatus,
  reference: v.reference,
  customerId: v.customer_id,
  vendorId: v.vendor_id,
  details: v.details
});

const mapAccount = (a: any): Account => ({
  id: a.id,
  code: a.code,
  name: a.name,
  type: a.type as AccountType,
  cell: a.cell,
  location: a.location,
  // Safety: Fallback to PKR if column is missing or null
  currency: (a.currency as Currency) || Currency.PKR,
  balance: Number(a.balance),
  ledger: (a.ledger || []).map((l: any) => ({
    id: l.id,
    date: l.date,
    voucherId: l.voucher_id,
    voucherNum: l.voucher_num || '-', 
    description: l.description,
    debit: Number(l.debit),
    credit: Number(l.credit),
    balanceAfter: Number(l.balance_after)
  }))
});

export const getAccounts = async (): Promise<Account[]> => {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('*, ledger:ledger_entries(*)')
      .order('code', { ascending: true });
    
    if (error) {
      console.error("Error fetching accounts:", error);
      return [];
    }
    return (data || []).map(mapAccount);
  } catch (err) {
    console.error("System error fetching accounts:", err);
    return [];
  }
};

export const getVouchers = async (): Promise<Voucher[]> => {
  try {
    const { data, error } = await supabase
      .from('vouchers')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) {
      console.error("Error fetching vouchers:", error);
      return [];
    }
    return (data || []).map(mapVoucher);
  } catch (err) {
    console.error("System error fetching vouchers:", err);
    return [];
  }
};

export const getConfig = async (): Promise<AppConfig & { fontSize?: number }> => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return {
        companyName: "TRAVELLDGER",
        appSubtitle: "Travels Services",
        companyAddress: "Karachi, Pakistan",
        companyPhone: "021000000",
        companyCell: "0334 3666777",
        companyEmail: "info@example.com",
        defaultROE: 74.5,
        logoSize: 80,
        fontSize: 16,
        accountNameCase: 'Sentence Case',
        banks: []
      };
    }

    return {
      companyName: data.company_name,
      appSubtitle: data.app_subtitle,
      companyAddress: data.company_address,
      companyPhone: data.company_phone,
      companyCell: data.company_cell,
      companyEmail: data.company_email,
      companyLogo: data.company_logo,
      logoSize: data.logo_size,
      fontSize: data.font_size || 16,
      defaultROE: Number(data.default_roe),
      accountNameCase: data.account_name_case || 'Sentence Case',
      banks: data.banks || []
    };
  } catch (err) {
    return {
      companyName: "TRAVELLDGER",
      appSubtitle: "Travels Services",
      companyAddress: "Karachi, Pakistan",
      companyPhone: "021000000",
      companyCell: "0334 3666777",
      companyEmail: "info@example.com",
      defaultROE: 74.5,
      logoSize: 80,
      fontSize: 16,
      accountNameCase: 'Sentence Case',
      banks: []
    };
  }
};

export const saveConfig = async (config: AppConfig & { fontSize?: number }) => {
  const payload: any = {
    id: '00000000-0000-0000-0000-000000000001',
    company_name: config.companyName,
    app_subtitle: config.appSubtitle,
    company_address: config.companyAddress,
    company_phone: config.companyPhone,
    company_cell: config.companyCell,
    company_email: config.companyEmail,
    company_logo: config.companyLogo,
    logo_size: config.logoSize,
    font_size: (config as any).fontSize || 16,
    default_roe: config.defaultROE,
    account_name_case: config.accountNameCase,
    banks: config.banks
  };

  const { error } = await supabase
    .from('app_config')
    .upsert(payload);
  
  if (error) {
    console.error("Config save failed, attempting fallback without new columns...", error);
    // Fallback: Try saving without the newer columns if they are missing in DB
    const fallbackPayload = { ...payload };
    delete fallbackPayload.account_name_case;
    delete fallbackPayload.banks;
    delete fallbackPayload.font_size;
    
    const { error: fallbackError } = await supabase
      .from('app_config')
      .upsert(fallbackPayload);
      
    if (fallbackError) throw fallbackError;
  }
};

export const getDashboardMetrics = async (): Promise<DashboardStats> => {
  try {
    const { data, error } = await supabase.from('dashboard_stats').select('*').maybeSingle();
    if (error || !data) return { totalReceivables: 0, totalPayables: 0, totalIncome: 0, totalCash: 0 };
    return {
      totalReceivables: Number(data.total_receivables),
      totalPayables: Number(data.total_payables),
      totalIncome: Number(data.total_revenue),
      totalCash: Number(data.total_cash_bank)
    };
  } catch (err) {
    return { totalReceivables: 0, totalPayables: 0, totalIncome: 0, totalCash: 0 };
  }
};

export const exportFullDatabase = async () => {
  const [accounts, vouchers, config] = await Promise.all([getAccounts(), getVouchers(), getConfig()]);
  
  // Recalculate balances for export to ensure the backup is 100% accurate
  const verifiedAccounts = accounts.map(acc => {
    const calculatedBalance = (acc.ledger || []).reduce((sum, entry) => sum + (entry.debit - entry.credit), 0);
    return { ...acc, balance: calculatedBalance };
  });

  return { accounts: verifiedAccounts, vouchers, config };
};

export const importFullDatabase = async (data: any) => {
  const { accounts, vouchers, config } = data;

  try {
    console.log("Starting database restoration...");

    // 1. Restore Config (Upsert is safe)
    if (config) {
      console.log("Restoring config...");
      await saveConfig(config);
    }

    // 2. Clear existing data (Order matters for foreign keys)
    // We delete ledger entries first as they depend on both accounts and vouchers
    console.log("Clearing ledger entries...");
    await supabase.from('ledger_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log("Clearing vouchers...");
    await supabase.from('vouchers').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log("Clearing accounts...");
    await supabase.from('accounts').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 3. Restore Accounts (Start with 0 balance, ledger will rebuild it)
    if (accounts && accounts.length > 0) {
      console.log(`Restoring ${accounts.length} accounts...`);
      const accountsToInsert = accounts.map((a: any) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        cell: a.cell,
        location: a.location,
        currency: a.currency || 'PKR',
        balance: 0 // Reset to 0, will be recalculated from ledger
      }));
      
      const { error: accErr } = await supabase.from('accounts').insert(accountsToInsert);
      if (accErr) throw new Error(`Failed to restore accounts: ${accErr.message}`);
    }

    // 4. Restore Vouchers
    if (vouchers && vouchers.length > 0) {
      console.log(`Restoring ${vouchers.length} vouchers...`);
      const vouchersToInsert = vouchers.map((v: any) => ({
        id: v.id,
        type: v.type,
        voucher_num: v.voucherNum,
        date: v.date,
        currency: v.currency,
        roe: v.roe,
        total_amount_pkr: v.totalAmountPKR,
        description: v.description,
        status: v.status,
        reference: v.reference,
        customer_id: v.customerId || null,
        vendor_id: v.vendorId || null,
        details: v.details
      }));
      
      const { error: vchErr } = await supabase.from('vouchers').insert(vouchersToInsert);
      if (vchErr) throw new Error(`Failed to restore vouchers: ${vchErr.message}`);
    }

    // 5. Restore Ledger Entries
    const allLedgerEntries: any[] = [];
    if (accounts) {
      accounts.forEach((a: any) => {
        if (a.ledger && a.ledger.length > 0) {
          a.ledger.forEach((l: any) => {
            allLedgerEntries.push({
              id: l.id,
              account_id: a.id,
              date: l.date,
              voucher_id: (l.voucherId && l.voucherId !== '') ? l.voucherId : null,
              voucher_num: l.voucherNum || null,
              description: l.description,
              debit: l.debit || 0,
              credit: l.credit || 0,
              balance_after: l.balanceAfter || 0
            });
          });
        }
      });
    }

    if (allLedgerEntries.length > 0) {
      console.log(`Restoring ${allLedgerEntries.length} ledger entries...`);
      const chunkSize = 40;
      for (let i = 0; i < allLedgerEntries.length; i += chunkSize) {
        const chunk = allLedgerEntries.slice(i, i + chunkSize);
        const { error: ledgErr } = await supabase.from('ledger_entries').insert(chunk);
        if (ledgErr) throw new Error(`Failed to restore ledger entries (batch ${Math.floor(i/chunkSize) + 1}): ${ledgErr.message}`);
      }
    }

    // 6. Final Step: Recalculate all balances in the database to be absolutely sure
    console.log("Recalculating final balances...");
    const { error: finalErr } = await supabase.rpc('recalculate_all_balances');
    if (finalErr) {
      console.warn("RPC recalculate_all_balances failed, attempting manual update...", finalErr);
      // Fallback if RPC is not defined
      const { data: accs } = await supabase.from('accounts').select('id');
      if (accs) {
        for (const acc of accs) {
          const { data: ledger } = await supabase.from('ledger_entries').select('debit, credit').eq('account_id', acc.id);
          const bal = (ledger || []).reduce((s, e) => s + (e.debit - e.credit), 0);
          await supabase.from('accounts').update({ balance: bal }).eq('id', acc.id);
        }
      }
    }

    console.log("Database restoration complete.");
  } catch (err) {
    console.error("Database restoration failed:", err);
    throw err;
  }
};
v
