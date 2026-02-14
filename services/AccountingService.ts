import { supabase } from './supabase';
import { Account, AccountType, Voucher, VoucherType, Currency, VoucherStatus } from '../types';

export class AccountingService {
  
  static generateUniqueVNum(type: string): string {
    const year = new Date().getFullYear();
    const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${type}-${year}-${randomStr}`;
  }

  static async createAccount(name: string, type: AccountType, cell: string, location: string, openingBalance: number, isDr: boolean, code?: string, currency: Currency = Currency.PKR) {
    const sanitizedCode = (code && code.trim() !== '') ? code.trim() : null;

    const { data: account, error: accError } = await supabase
      .from('accounts')
      .insert({
        name,
        type,
        cell,
        location,
        code: sanitizedCode,
        currency: currency,
        balance: 0
      })
      .select()
      .single();

    if (accError) throw accError;

    if (openingBalance > 0) {
      const description = 'Opening Balance (Initial Measurement)';
      
      await supabase.from('ledger_entries').insert({
        account_id: account.id,
        date: new Date().toISOString(),
        description: description,
        debit: isDr ? openingBalance : 0,
        credit: isDr ? 0 : openingBalance,
      });

      const { data: reserve } = await supabase.from('accounts').select('id').eq('code', '3001').single();
      if (reserve) {
        await supabase.from('ledger_entries').insert({
          account_id: reserve.id,
          date: new Date().toISOString(),
          description: `Contra Opening Balance: ${name}`,
          debit: isDr ? 0 : openingBalance,
          credit: isDr ? openingBalance : 0,
        });
      }
    }
    return account;
  }

  static async updateAccount(id: string, updates: any) {
    const sanitizedCode = (updates.code && updates.code.trim() !== '') ? updates.code.trim() : null;
    
    const { error } = await supabase
      .from('accounts')
      .update({
        name: updates.name,
        cell: updates.cell,
        location: updates.location,
        code: sanitizedCode,
        currency: updates.currency
      })
      .eq('id', id);
    if (error) throw error;
  }

  static async deleteAccount(id: string) {
    const { error } = await supabase.from('accounts').delete().eq('id', id);
    if (error) throw error;
  }

  static async deleteVoucher(id: string) {
    const { error } = await supabase.from('vouchers').delete().eq('id', id);
    if (error) throw error;
  }

  static async postVoucher(vData: Partial<Voucher>) {
    // Generate high-entropy unique number if missing to prevent duplicate key errors
    const vNum = vData.voucherNum || this.generateUniqueVNum(vData.type || 'VO');
    
    const { data: voucher, error: vError } = await supabase
      .from('vouchers')
      .insert({
        type: vData.type,
        voucher_num: vNum,
        date: vData.date || new Date().toISOString(),
        currency: vData.currency,
        roe: Number(vData.roe || 1),
        total_amount_pkr: Number(vData.totalAmountPKR || 0),
        description: vData.description || '',
        reference: vData.reference || '',
        status: VoucherStatus.POSTED,
        customer_id: (vData.customerId && vData.customerId !== '') ? vData.customerId : null,
        vendor_id: (vData.vendorId && vData.vendorId !== '') ? vData.vendorId : null,
        details: vData.details || {}
      })
      .select()
      .single();

    if (vError) {
      console.error("Voucher Insertion Error:", vError);
      throw vError;
    }

    const amount = Number(voucher.total_amount_pkr);
    const entries = [];
    
    const customerId = voucher.customer_id;
    const vendorId = voucher.vendor_id;

    // Note: We no longer send 'voucher_num' to ledger_entries to avoid PGRST204 schema errors.
    // The UI now resolves the number via voucher_id.
    if (voucher.type === 'RV') {
      const bankId = voucher.details?.bankId;
      if (bankId) entries.push({ account_id: bankId, voucher_id: voucher.id, date: voucher.date, debit: amount, credit: 0, description: voucher.description });
      if (customerId) entries.push({ account_id: customerId, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: amount, description: voucher.description });
      
    } else if (voucher.type === 'TV' || voucher.type === 'HV') {
      const vendorAmount = Number(voucher.details?.vendorAmountPKR) || amount;
      const incomeAmount = Number(voucher.details?.incomeAmountPKR) || 0;
      const incomeAccountId = voucher.details?.incomeAccountId;
      
      if (customerId) entries.push({ account_id: customerId, voucher_id: voucher.id, date: voucher.date, debit: amount, credit: 0, description: voucher.description });
      if (vendorId) entries.push({ account_id: vendorId, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: vendorAmount, description: voucher.description });
      
      if (incomeAmount > 0 && incomeAccountId) {
        entries.push({ account_id: incomeAccountId, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: incomeAmount, description: `Service Revenue: ${voucher.description}` });
      }
      
    } else if (voucher.type === 'VV' || voucher.type === 'TK') {
      if (customerId) entries.push({ account_id: customerId, voucher_id: voucher.id, date: voucher.date, debit: amount, credit: 0, description: voucher.description });
      if (vendorId) entries.push({ account_id: vendorId, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: amount, description: voucher.description });
      
    } else if (voucher.type === 'PV') {
      const bankId = voucher.details?.bankId;
      const expenseAccountId = voucher.details?.expenseId || voucher.details?.items?.[0]?.accountId;
      
      if (expenseAccountId) entries.push({ account_id: expenseAccountId, voucher_id: voucher.id, date: voucher.date, debit: amount, credit: 0, description: voucher.description });
      if (bankId) entries.push({ account_id: bankId, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: amount, description: voucher.description });
    }

    if (entries.length > 0) {
      const { error: jError } = await supabase.from('ledger_entries').insert(entries);
      if (jError) {
        console.error("Ledger Posting Error:", jError);
        throw jError;
      }
    }

    return voucher;
  }

  static async updateVoucher(id: string, vData: Partial<Voucher>) {
    await this.deleteVoucher(id);
    return this.postVoucher(vData);
  }
}