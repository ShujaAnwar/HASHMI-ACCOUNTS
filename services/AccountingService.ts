
import { Account, AccountType, Voucher, VoucherType, LedgerEntry, Currency, VoucherStatus } from '../types';
import { getAccounts, saveAccounts, getVouchers, saveVouchers } from './db';

export class AccountingService {
  
  static createAccount(name: string, type: AccountType, cell: string, location: string, openingBalance: number, isDr: boolean, code?: string) {
    const accounts = getAccounts();
    const id = crypto.randomUUID();
    const pkrValue = openingBalance || 0; 

    const newAccount: Account = {
      id,
      code,
      name,
      type,
      cell,
      location,
      balance: isDr ? pkrValue : -pkrValue,
      ledger: []
    };

    if (pkrValue !== 0) {
      const entry: LedgerEntry = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        voucherId: 'opening',
        voucherNum: 'OB-000',
        description: 'Opening Balance (IFRS Initial Measurement)',
        debit: isDr ? pkrValue : 0,
        credit: isDr ? 0 : pkrValue,
        balanceAfter: isDr ? pkrValue : -pkrValue,
        currency: Currency.PKR,
        roe: 1
      };
      newAccount.ledger.push(entry);

      const reserve = accounts.find(a => a.id === 'reserve-fund' || a.code === '3001')!;
      const reserveEntry: LedgerEntry = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        voucherId: 'opening',
        voucherNum: 'OB-000',
        description: `Contra Opening Balance: ${name}`,
        debit: isDr ? 0 : pkrValue,
        credit: isDr ? pkrValue : 0,
        balanceAfter: isDr ? reserve.balance - pkrValue : reserve.balance + pkrValue,
        currency: Currency.PKR,
        roe: 1
      };
      reserve.balance = reserveEntry.balanceAfter;
      reserve.ledger.push(reserveEntry);
    }

    accounts.push(newAccount);
    saveAccounts(accounts);
    return newAccount;
  }

  static updateAccount(id: string, updates: Partial<Account>) {
    const accounts = getAccounts();
    const index = accounts.findIndex(a => a.id === id);
    if (index === -1) return;

    accounts[index] = { ...accounts[index], ...updates };
    saveAccounts(accounts);
  }

  static deleteAccount(id: string) {
    const accounts = getAccounts();
    const filtered = accounts.filter(a => a.id !== id);
    saveAccounts(filtered);
  }

  static postVoucher(voucherData: Partial<Voucher>) {
    const vouchers = getVouchers();
    const accounts = getAccounts();
    
    const voucher: Voucher = {
      id: crypto.randomUUID(),
      type: voucherData.type as VoucherType,
      voucherNum: voucherData.voucherNum || `${voucherData.type}-${(vouchers.filter(v => v.type === voucherData.type).length + 1).toString().padStart(3, '0')}`,
      date: voucherData.date || new Date().toISOString(),
      currency: voucherData.currency || Currency.PKR,
      roe: voucherData.roe || 1,
      totalAmountPKR: voucherData.totalAmountPKR || 0,
      description: voucherData.description || '',
      status: voucherData.status || VoucherStatus.POSTED,
      reference: voucherData.reference || '',
      customerId: voucherData.customerId,
      vendorId: voucherData.vendorId,
      details: voucherData.details
    };

    const amount = voucher.totalAmountPKR;
    this.executeLedgerImpact(accounts, voucher, amount);

    vouchers.push(voucher);
    saveVouchers(vouchers);
    saveAccounts(accounts);
    return voucher;
  }

  static deleteVoucher(voucherId: string) {
    const vouchers = getVouchers();
    const accounts = getAccounts();
    const voucher = vouchers.find(v => v.id === voucherId);
    
    if (!voucher) return;

    // Reverse ledger impacts
    this.executeLedgerImpact(accounts, voucher, -voucher.totalAmountPKR, true);

    const updatedVouchers = vouchers.filter(v => v.id !== voucherId);
    saveVouchers(updatedVouchers);
    saveAccounts(accounts);
  }

  static updateVoucher(voucherId: string, voucherData: Partial<Voucher>) {
    this.deleteVoucher(voucherId);
    return this.postVoucher({ ...voucherData, id: voucherId });
  }

  private static executeLedgerImpact(accounts: Account[], voucher: Voucher, amount: number, isDeletion: boolean = false) {
    const desc = isDeletion ? `REVERSAL: ${voucher.description}` : voucher.description;
    
    switch (voucher.type) {
      case VoucherType.RECEIPT:
        this.addLedgerEntry(accounts, voucher.details.bankId, voucher, amount, 0, desc); 
        this.addLedgerEntry(accounts, voucher.customerId!, voucher, 0, amount, desc);
        break;
      
      case VoucherType.HOTEL:
      case VoucherType.TRANSPORT:
      case VoucherType.VISA:
      case VoucherType.TICKET:
        this.addLedgerEntry(accounts, voucher.customerId!, voucher, amount, 0, desc);
        this.addLedgerEntry(accounts, voucher.vendorId!, voucher, 0, amount, desc);
        break;

      case VoucherType.PAYMENT:
        this.addLedgerEntry(accounts, voucher.details.expenseId, voucher, amount, 0, desc);
        this.addLedgerEntry(accounts, voucher.details.bankId, voucher, 0, amount, desc);
        break;
    }
  }

  private static addLedgerEntry(accounts: Account[], accountId: string, voucher: Voucher, dr: number, cr: number, description: string) {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return;

    const lastBalance = acc.balance;
    const newBalance = lastBalance + (dr - cr);
    
    acc.ledger.push({
      id: crypto.randomUUID(),
      date: voucher.date,
      voucherId: voucher.id,
      voucherNum: voucher.voucherNum,
      description: description,
      debit: dr > 0 ? dr : 0,
      credit: cr > 0 ? cr : 0,
      balanceAfter: newBalance,
      currency: voucher.currency,
      roe: voucher.roe
    });
    acc.balance = newBalance;
  }
}
