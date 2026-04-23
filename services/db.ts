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
    details: v.details,
    createdAt: v.created_at
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
      balanceAfter: Number(l.balance_after),
      createdAt: l.created_at
    }))
  });

  export const getAccounts = async (): Promise<Account[]> => {
    try {
      const { data, error } = await retryFetch(() => supabase
        .from('accounts')
        .select('*, ledger:ledger_entries(*)')
        .order('code', { ascending: true }));
      
      if (error) {
        console.error("Error fetching accounts:", error);
        return [];
      }
      return ((data as any) || []).map(mapAccount);
    } catch (err) {
      console.error("System error fetching accounts:", err);
      return [];
    }
  };

  const retryFetch = async (fn: () => PromiseLike<any>, retries = 3, delay = 1000): Promise<any> => {
    let lastError: any;
    for (let i = 0; i < retries; i++) {
      try {
        const result = await fn();
        if (!result.error) return result;
        lastError = result.error;
        if (result.error.message !== 'TypeError: Failed to fetch') return result; // Don't retry auth errors
      } catch (err) {
        lastError = err;
      }
      if (i < retries - 1) await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
    }
    return { data: null, error: lastError };
  };

  export const getVouchers = async (): Promise<Voucher[]> => {
    try {
      const { data, error } = await retryFetch(() => supabase
        .from('vouchers')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }));
      
      if (error) {
        console.error("Error fetching vouchers:", error);
        return [];
      }
      return ((data as any) || []).map(mapVoucher);
    } catch (err) {
      console.error("System error fetching vouchers:", err);
      return [];
    }
  };

  export const getConfig = async (): Promise<AppConfig & { fontSize?: number }> => {
    try {
      const { data, error } = await retryFetch(() => supabase
        .from('app_config')
        .select('*')
        .limit(1)
        .maybeSingle());

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

      const d = data as any;
      return {
        companyName: d.company_name,
        appSubtitle: d.app_subtitle,
        companyAddress: d.company_address,
        companyPhone: d.company_phone,
        companyCell: d.company_cell,
        companyEmail: d.company_email,
        companyLogo: d.company_logo,
        logoSize: d.logo_size,
        fontSize: d.font_size || 16,
        defaultROE: Number(d.default_roe),
        accountNameCase: d.account_name_case || 'Sentence Case',
        banks: d.banks || [],
        autoBackupEnabled: d.auto_backup_enabled || false,
        autoBackupIntervalEnabled: d.auto_backup_interval_enabled || false,
        autoBackupIntervalHours: d.auto_backup_interval_hours || 6,
        showHotelsList: d.show_hotels_list !== false,
        autoRefreshEnabled: d.auto_refresh_enabled || false,
        autoRefreshIntervalMinutes: d.auto_refresh_interval_minutes || 5
      };
    } catch (err) {
      return {
        companyName: "Hashmi Travel Solutions",
        appSubtitle: "Travel Solutions by Shuja Anwar",
        companyAddress: "Karachi, Pakistan",
        companyPhone: "0313-2710182",
        companyCell: "0313-2710182",
        companyEmail: "Shujaanwaar@gmail.com",
        defaultROE: 74.5,
        logoSize: 80,
        fontSize: 16,
        accountNameCase: 'Sentence Case',
        banks: [],
        autoBackupEnabled: false,
        autoBackupIntervalEnabled: false,
        autoBackupIntervalHours: 6,
        showHotelsList: true,
        autoRefreshEnabled: false,
        autoRefreshIntervalMinutes: 5
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
      banks: config.banks,
      auto_backup_enabled: config.autoBackupEnabled,
      auto_backup_interval_enabled: config.autoBackupIntervalEnabled,
      auto_backup_interval_hours: config.autoBackupIntervalHours,
      show_hotels_list: config.showHotelsList !== false,
      auto_refresh_enabled: config.autoRefreshEnabled,
      auto_refresh_interval_minutes: config.autoRefreshIntervalMinutes
    };

    const { error } = await retryFetch(() => supabase
      .from('app_config')
      .upsert(payload));
    
    if (error) {
      console.warn("Config save failed, attempting fallback (Database schema might be outdated)...", error);
      const fallbackPayload = { ...payload };
      delete fallbackPayload.account_name_case;
      delete fallbackPayload.banks;
      delete fallbackPayload.font_size;
      delete fallbackPayload.auto_backup_enabled;
      delete fallbackPayload.auto_backup_interval_enabled;
      delete fallbackPayload.auto_backup_interval_hours;
      delete fallbackPayload.show_hotels_list;
      delete fallbackPayload.auto_refresh_enabled;
      delete fallbackPayload.auto_refresh_interval_minutes;
      
      const { error: fallbackError } = await supabase
        .from('app_config')
        .upsert(fallbackPayload);
        
      if (fallbackError) {
        console.error("Critical config save failure:", fallbackError);
      } else {
        // Fallback succeeded, but new columns were skipped
        throw new Error("SCHEMA_OUT_OF_SYNC");
      }
    }
  };

  export const getDashboardMetrics = async (): Promise<DashboardStats> => {
    try {
      const { data, error } = await retryFetch(() => supabase.from('dashboard_stats').select('*').maybeSingle());
      if (error || !data) return { totalReceivables: 0, totalPayables: 0, totalIncome: 0, totalCash: 0 };
      const d = data as any;
      return {
        totalReceivables: Number(d.total_receivables),
        totalPayables: Number(d.total_payables),
        totalIncome: Number(d.total_revenue),
        totalCash: Number(d.total_cash_bank)
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
        if (accErr) {
          console.warn("Account restoration failed, attempting fallback without currency column...", accErr);
          const fallbackAccounts = accountsToInsert.map((a: any) => {
            const { currency, ...rest } = a;
            return rest;
          });
          const { error: accFallbackErr } = await supabase.from('accounts').insert(fallbackAccounts);
          if (accFallbackErr) throw new Error(`Failed to restore accounts: ${accFallbackErr.message}`);
        }
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
          if (ledgErr) {
            console.warn(`Ledger batch ${Math.floor(i/chunkSize) + 1} failed, attempting fallback without voucher_num...`, ledgErr);
            const fallbackChunk = chunk.map((l: any) => {
              const { voucher_num, ...rest } = l;
              return rest;
            });
            const { error: ledgFallbackErr } = await supabase.from('ledger_entries').insert(fallbackChunk);
            if (ledgFallbackErr) throw new Error(`Failed to restore ledger entries (batch ${Math.floor(i/chunkSize) + 1}): ${ledgFallbackErr.message}`);
          }
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
