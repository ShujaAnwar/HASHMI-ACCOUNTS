
import { supabase } from './supabase';
import { Account, AccountType, Voucher, VoucherType, Currency, VoucherStatus } from '../types';

export class AccountingService {
  
  static async createAccount(name: string, type: AccountType, cell: string, location: string, openingBalance: number, isDr: boolean, code?: string) {
    const sanitizedCode = (code && code.trim() !== '') ? code.trim() : null;

    const { data: account, error: accError } = await supabase
      .from('accounts')
      .insert({
        name,
        type,
        cell,
        location,
        code: sanitizedCode,
        balance: 0
      })
      .select()
      .single();

    if (accError) throw accError;

    if (openingBalance > 0) {
      await supabase.from('ledger_entries').insert({
        account_id: account.id,
        date: new Date().toISOString(),
        description: 'Opening Balance (Initial Measurement)',
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
        code: sanitizedCode
      })
      .eq('id', id);
    if (error) throw error;

    if (updates.openingBalance !== undefined) {
      const isDr = updates.balanceType === 'dr';
      const amount = updates.openingBalance;

      const { data: entries } = await supabase
        .from('ledger_entries')
        .select('id')
        .eq('account_id', id)
        .eq('description', 'Opening Balance (Initial Measurement)')
        .limit(1);

      if (entries && entries.length > 0) {
        await supabase
          .from('ledger_entries')
          .update({
            debit: isDr ? amount : 0,
            credit: isDr ? 0 : amount,
          })
          .eq('id', entries[0].id);

        const { data: reserve } = await supabase.from('accounts').select('id').eq('code', '3001').single();
        if (reserve) {
          const { data: contraEntries } = await supabase
            .from('ledger_entries')
            .select('id')
            .eq('account_id', reserve.id)
            .or(`description.ilike.%Contra Opening Balance: ${updates.oldName}%,description.ilike.%Contra Opening Balance: ${updates.name}%`)
            .limit(1);

          if (contraEntries && contraEntries.length > 0) {
            await supabase
              .from('ledger_entries')
              .update({
                debit: isDr ? 0 : amount,
                credit: isDr ? amount : 0,
                description: `Contra Opening Balance: ${updates.name}`
              })
              .eq('id', contraEntries[0].id);
          }
        }
      } else if (amount > 0) {
        await this.createOpeningBalanceEntries(id, updates.name, amount, isDr);
      }
    }
  }

  // Added deleteAccount to fix ReferenceError in Ledger.tsx
  static async deleteAccount(id: string) {
    const { error } = await supabase.from('accounts').delete().eq('id', id);
    if (error) throw error;
  }

  private static async createOpeningBalanceEntries(accountId: string, name: string, amount: number, isDr: boolean) {
    await supabase.from('ledger_entries').insert({
      account_id: accountId,
      date: new Date().toISOString(),
      description: 'Opening Balance (Initial Measurement)',
      debit: isDr ? amount : 0,
      credit: isDr ? 0 : amount,
    });

    const { data: reserve } = await supabase.from('accounts').select('id').eq('code', '3001').single();
    if (reserve) {
      await supabase.from('ledger_entries').insert({
        account_id: reserve.id,
        date: new Date().toISOString(),
        description: `Contra Opening Balance: ${name}`,
        debit: isDr ? 0 : amount,
        credit: isDr ? amount : 0,
      });
    }
  }

  static async deleteVoucher(id: string) {
    const { error } = await supabase.from('vouchers').delete().eq('id', id);
    if (error) throw error;
  }

  static async postVoucher(vData: Partial<Voucher>) {
    const { data: voucher, error: vError } = await supabase
      .from('vouchers')
      .insert({
        type: vData.type,
        voucher_num: vData.voucherNum || `${vData.type}-${Date.now().toString().slice(-6)}`,
        date: vData.date || new Date().toISOString(),
        currency: vData.currency,
        roe: vData.roe,
        total_amount_pkr: vData.totalAmountPKR,
        description: vData.description,
        reference: vData.reference,
        status: VoucherStatus.POSTED,
        customer_id: vData.customerId,
        vendor_id: vData.vendorId,
        details: vData.details
      })
      .select()
      .single();

    if (vError) throw vError;

    const amount = Number(voucher.total_amount_pkr);
    const entries = [];

    if (voucher.type === 'RV') {
      entries.push({ account_id: vData.details.bankId, voucher_id: voucher.id, date: voucher.date, debit: amount, credit: 0, description: voucher.description });
      entries.push({ account_id: voucher.customer_id, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: amount, description: voucher.description });
    } else if (voucher.type === 'TV' || voucher.type === 'HV') {
      const vendorAmount = Number(vData.details?.vendorAmountPKR) || amount;
      const incomeAmount = Number(vData.details?.incomeAmountPKR) || 0;
      
      // Dr Customer (Total Selling Price)
      entries.push({ account_id: voucher.customer_id, voucher_id: voucher.id, date: voucher.date, debit: amount, credit: 0, description: voucher.description });
      
      // Cr Vendor (Actual Cost)
      entries.push({ account_id: voucher.vendor_id, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: vendorAmount, description: voucher.description });
      
      // Cr Income (Service Fee / Margin)
      if (incomeAmount > 0 && vData.details?.incomeAccountId) {
        entries.push({ 
          account_id: vData.details.incomeAccountId, 
          voucher_id: voucher.id, 
          date: voucher.date, 
          debit: 0, 
          credit: incomeAmount, 
          description: `Service Revenue: ${voucher.description}` 
        });
      }
    } else if (['VV', 'TK'].includes(voucher.type)) {
      entries.push({ account_id: voucher.customer_id, voucher_id: voucher.id, date: voucher.date, debit: amount, credit: 0, description: voucher.description });
      entries.push({ account_id: voucher.vendor_id, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: amount, description: voucher.description });
    } else if (voucher.type === 'PV') {
      if (vData.details?.items && Array.isArray(vData.details.items)) {
        vData.details.items.forEach((item: any) => {
          const itemAmountPKR = item.amount * (voucher.currency === Currency.SAR ? voucher.roe : 1);
          entries.push({ 
            account_id: item.accountId, 
            voucher_id: voucher.id, 
            date: voucher.date, 
            debit: itemAmountPKR, 
            credit: 0, 
            description: item.description || voucher.description 
          });
        });
      } else {
        entries.push({ account_id: vData.details.expenseId, voucher_id: voucher.id, date: voucher.date, debit: amount, credit: 0, description: voucher.description });
      }
      entries.push({ account_id: vData.details.bankId, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: amount, description: voucher.description });
    }

    if (entries.length > 0) {
      const { error: jError } = await supabase.from('ledger_entries').insert(entries);
      if (jError) throw jError;
    }

    return voucher;
  }

  static async updateVoucher(id: string, vData: Partial<Voucher>) {
    await this.deleteVoucher(id);
    return this.postVoucher(vData);
  }
}
