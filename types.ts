
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
  voucherId: string;
  voucherNum: string;
  description: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  currency: Currency;
  roe: number;
}

export interface Account {
  id: string;
  code?: string; // Standard Accounting Code (e.g., 1001)
  name: string;
  type: AccountType;
  cell?: string;
  location?: string;
  balance: number; // Final recording in PKR
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
  // Dynamic fields based on type
  customerId?: string;
  vendorId?: string;
  details?: any;
}

export interface AppConfig {
  companyName: string;
  appSubtitle: string;
  companyAddress: string;
  companyPhone: string;
  companyLogo?: string; // Base64
  defaultROE: number;
  banks: { id: string; name: string; accountNumber: string }[];
}

export interface DashboardStats {
  totalReceivables: number;
  totalPayables: number;
  totalIncome: number;
  totalCash: number;
}
