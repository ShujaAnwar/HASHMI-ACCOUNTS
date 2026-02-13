import { Account, Voucher, AppConfig, AccountType, Currency, LedgerEntry } from '../types';

const DB_KEYS = {
  ACCOUNTS: 'tlp_accounts',
  VOUCHERS: 'tlp_vouchers',
  CONFIG: 'tlp_config'
};

const DEFAULT_CONFIG: AppConfig = {
  companyName: "NEEM TREE",
  appSubtitle: "Travels Services",
  companyAddress: "Shah Faisal Town Malir Halt Karachi",
  companyPhone: "021000000",
  companyCell: "0334 3666777",
  companyEmail: "neemtreetravel@gmail.com",
  defaultROE: 74.5,
  logoSize: 80,
  banks: [
    { id: 'bank1', name: 'Al Rajhi Bank', accountNumber: 'SA123456789' },
    { id: 'bank2', name: 'Meezan Bank', accountNumber: 'PK987654321' }
  ]
};

// Full standard COA seeding
const INITIAL_ACCOUNTS: Account[] = [
  { id: 'cash-hand', code: '1001', name: 'Cash in Hand', type: AccountType.CASH_BANK, balance: 0, ledger: [] },
  { id: 'bank1', code: '1002', name: 'Al Rajhi Bank', type: AccountType.CASH_BANK, balance: 0, ledger: [] },
  { id: 'bank2', code: '1003', name: 'Meezan Bank', type: AccountType.CASH_BANK, balance: 0, ledger: [] },
  { id: 'ar-customers', code: '1010', name: 'Accounts Receivable (Customers)', type: AccountType.CUSTOMER, balance: 0, ledger: [] },
  { id: 'adv-vendors', code: '1015', name: 'Advance to Vendors', type: AccountType.VENDOR, balance: 0, ledger: [] },
  { id: 'ap-vendors', code: '2001', name: 'Accounts Payable (Vendors)', type: AccountType.VENDOR, balance: 0, ledger: [] },
  { id: 'adv-customers', code: '2010', name: 'Advance from Customers', type: AccountType.CUSTOMER, balance: 0, ledger: [] },
  { id: 'reserve-fund', code: '3001', name: 'General Reserve Fund', type: AccountType.EQUITY, balance: 0, ledger: [] },
  { id: 'owners-capital', code: '3005', name: "Owner's Capital", type: AccountType.EQUITY, balance: 0, ledger: [] },
  { id: 'rev-hotels', code: '4001', name: 'Revenue from Hotel Services', type: AccountType.REVENUE, balance: 0, ledger: [] },
  { id: 'exp-petty', code: '5001', name: 'Petty Cash Expenses', type: AccountType.EXPENSE, balance: 0, ledger: [] }
];

export const getAccounts = (): Account[] => {
  const data = localStorage.getItem(DB_KEYS.ACCOUNTS);
  if (!data) {
    saveAccounts(INITIAL_ACCOUNTS);
    return INITIAL_ACCOUNTS;
  }
  return JSON.parse(data);
};

export const saveAccounts = (accounts: Account[]) => {
  localStorage.setItem(DB_KEYS.ACCOUNTS, JSON.stringify(accounts));
};

export const getVouchers = (): Voucher[] => {
  const data = localStorage.getItem(DB_KEYS.VOUCHERS);
  return data ? JSON.parse(data) : [];
};

export const saveVouchers = (vouchers: Voucher[]) => {
  localStorage.setItem(DB_KEYS.VOUCHERS, JSON.stringify(vouchers));
};

export const getConfig = (): AppConfig => {
  const data = localStorage.getItem(DB_KEYS.CONFIG);
  if (!data) {
    saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
  return JSON.parse(data);
};

export const saveConfig = (config: AppConfig) => {
  localStorage.setItem(DB_KEYS.CONFIG, JSON.stringify(config));
};

export const exportFullDatabase = () => {
  return {
    accounts: getAccounts(),
    vouchers: getVouchers(),
    config: getConfig(),
    exportDate: new Date().toISOString(),
    version: "4.0"
  };
};

export const importFullDatabase = (data: any) => {
  if (data.accounts && Array.isArray(data.accounts)) saveAccounts(data.accounts);
  if (data.vouchers && Array.isArray(data.vouchers)) saveVouchers(data.vouchers);
  if (data.config && typeof data.config === 'object') saveConfig(data.config);
};