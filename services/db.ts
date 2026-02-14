
import { supabase } from './supabase';
import { Account, Voucher, AppConfig, AccountType, Currency, VoucherType, VoucherStatus, DashboardStats } from '../types';

const mapVoucher = (v: any): Voucher => ({
  id: v.id,
  type: v.type as VoucherType,
  voucherNum: v.voucher_num,
  date: v.date,
  currency: v.currency as Currency,
  roe: Number(v.roe),
  // Fix: Removed property 'total_amount_pkr' which does not exist on type 'Voucher'
  totalAmountPKR: Number(v.total_amount_pkr),
  description: v.description,
  status: v.status as VoucherStatus,
  reference: v.reference,
  customerId: v.customer_id,
  // Fix: Removed property 'vendor_id' which does not exist on type 'Voucher'
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
  currency: a.currency as Currency,
  balance: Number(a.balance),
  ledger: (a.ledger || []).map((l: any) => ({
    id: l.id,
    date: l.date,
    voucherId: l.voucher_id,
    voucherNum: l.voucher_num || '-', // Ensure voucherNum mapping
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

export const getConfig = async (): Promise<AppConfig> => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      if (error) console.error("Error fetching config:", error);
      return {
        companyName: "TRAVELLDGER",
        appSubtitle: "Travels Services",
        companyAddress: "Shah Faisal Town Malir Halt Karachi",
        companyPhone: "021000000",
        companyCell: "0334 3666777",
        companyEmail: "neemtreetravel@gmail.com",
        defaultROE: 74.5,
        logoSize: 80,
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
      // Fix: Removed property 'default_roe' which does not exist on type 'AppConfig'
      defaultROE: Number(data.default_roe),
      banks: data.banks || []
    };
  } catch (err) {
    console.error("System error fetching config:", err);
    return {
      companyName: "TRAVELLDGER",
      appSubtitle: "Travels Services",
      companyAddress: "Shah Faisal Town Malir Halt Karachi",
      companyPhone: "021000000",
      companyCell: "0334 3666777",
      companyEmail: "neemtreetravel@gmail.com",
      defaultROE: 74.5,
      logoSize: 80,
      banks: []
    };
  }
};

export const saveConfig = async (config: AppConfig) => {
  const { error } = await supabase
    .from('app_config')
    .upsert({
      id: '00000000-0000-0000-0000-000000000001',
      company_name: config.companyName,
      app_subtitle: config.appSubtitle,
      company_address: config.companyAddress,
      company_phone: config.companyPhone,
      company_cell: config.companyCell,
      company_email: config.companyEmail,
      company_logo: config.companyLogo,
      logo_size: config.logoSize,
      default_roe: config.defaultROE,
      banks: config.banks
    });
  
  if (error) throw error;
};

export const getDashboardMetrics = async (): Promise<DashboardStats> => {
  try {
    const { data, error } = await supabase.from('dashboard_stats').select('*').maybeSingle();
    if (error || !data) {
      if (error) console.error("Error fetching dashboard metrics:", error);
      return { totalReceivables: 0, totalPayables: 0, totalIncome: 0, totalCash: 0 };
    }
    return {
      totalReceivables: Number(data.total_receivables),
      totalPayables: Number(data.total_payables),
      totalIncome: Number(data.total_revenue),
      totalCash: Number(data.total_cash_bank)
    };
  } catch (err) {
    console.error("System error fetching dashboard metrics:", err);
    return { totalReceivables: 0, totalPayables: 0, totalIncome: 0, totalCash: 0 };
  }
};

export const exportFullDatabase = async () => {
  const [accounts, vouchers, config] = await Promise.all([
    getAccounts(),
    getVouchers(),
    getConfig()
  ]);
  return { accounts, vouchers, config };
};

export const importFullDatabase = async (data: any) => {
  console.warn("Import not implemented for Supabase mode.");
};
