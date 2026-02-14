import { supabase } from './supabase';
import { Account, AccountType, Voucher, VoucherType, Currency, VoucherStatus } from '../types';

export class AccountingService {
  
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
    const vNum = vData.voucherNum || `${vData.type}-${Date.now().toString().slice(-6)}`;
    
    // First insert the voucher
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
        customer_id: vData.customerId || null,
        vendor_id: vData.vendorId || null,
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

    // Posting logic for different voucher types - ensuring correct ledger impact
    if (voucher.type === 'RV') {
      const bankId = vData.details?.bankId;
      const customerId = vData.customerId;
      
      if (bankId) entries.push({ account_id: bankId, voucher_id: voucher.id, date: voucher.date, debit: amount, credit: 0, description: voucher.description, voucher_num: vNum });
      if (customerId) entries.push({ account_id: customerId, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: amount, description: voucher.description, voucher_num: vNum });
      
    } else if (voucher.type === 'TV' || voucher.type === 'HV') {
      const customerId = vData.customerId;
      const vendorId = vData.vendorId;
      const vendorAmount = Number(vData.details?.vendorAmountPKR) || amount;
      const incomeAmount = Number(vData.details?.incomeAmountPKR) || 0;
      const incomeAccountId = vData.details?.incomeAccountId;
      
      if (customerId) entries.push({ account_id: customerId, voucher_id: voucher.id, date: voucher.date, debit: amount, credit: 0, description: voucher.description, voucher_num: vNum });
      if (vendorId) entries.push({ account_id: vendorId, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: vendorAmount, description: voucher.description, voucher_num: vNum });
      
      if (incomeAmount > 0 && incomeAccountId) {
        entries.push({ account_id: incomeAccountId, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: incomeAmount, description: `Service Revenue: ${voucher.description}`, voucher_num: vNum });
      }
      
    } else if (voucher.type === 'VV' || voucher.type === 'TK') {
      const customerId = vData.customerId;
      const vendorId = vData.vendorId;
      
      if (customerId) entries.push({ account_id: customerId, voucher_id: voucher.id, date: voucher.date, debit: amount, credit: 0, description: voucher.description, voucher_num: vNum });
      if (vendorId) entries.push({ account_id: vendorId, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: amount, description: voucher.description, voucher_num: vNum });
      
    } else if (voucher.type === 'PV') {
      const bankId = vData.details?.bankId;
      const expenseAccountId = vData.details?.expenseId || vData.details?.items?.[0]?.accountId;
      
      if (expenseAccountId) entries.push({ account_id: expenseAccountId, voucher_id: voucher.id, date: voucher.date, debit: amount, credit: 0, description: voucher.description, voucher_num: vNum });
      if (bankId) entries.push({ account_id: bankId, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: amount, description: voucher.description, voucher_num: vNum });
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