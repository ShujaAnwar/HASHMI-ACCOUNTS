export enum Currency {
  SAR = 'SAR',
  PKR = 'PKR'
}

export enum AccountType {
  CUSTOMER = 'CUSTOMER',
  VENDOR = 'VENDOR',
  CASH_BANK = 'CASH_BANK',
  EXPENSE = 'EXPENSE',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE'
}

export interface LedgerEntry {
  id: string;
  date: string;
  voucherId: string | null;
  voucherNum: string;
  description: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  currency?: Currency;
  roe?: number;
}

export interface Account {
  id: string;
  code?: string;
  name: string;
  type: AccountType;
  cell?: string;
  location?: string;
  currency: Currency; // Mandatory head currency
  balance: number; // Stored in PKR
  ledger: LedgerEntry[];
}

export enum VoucherType {
  RECEIPT = 'RV',
  HOTEL = 'HV',
  TRANSPORT = 'TV',
  VISA = 'VV',
  TICKET = 'TK',
  PAYMENT = 'PV'
}

export enum VoucherStatus {
  POSTED = 'POSTED',
  VOID = 'VOID'
}

export interface Voucher {
  id: string;
  type: VoucherType;
  voucherNum: string;
  date: string;
  currency: Currency;
  roe: number;
  totalAmountPKR: number;
  description: string;
  status: VoucherStatus;
  reference?: string;
  customerId?: string;
  vendorId?: string;
  details?: any;
}

export interface AppConfig {
  companyName: string;
  appSubtitle: string;
  companyAddress: string;
  companyPhone: string;
  companyCell: string;
  companyEmail: string;
  companyLogo?: string;
  logoSize: number;
  defaultROE: number;
  banks: { id: string; name: string; accountNumber: string, address: string }[];
}

export interface DashboardStats {
  totalReceivables: number;
  totalPayables: number;
  totalIncome: number;
  totalCash: number;
}