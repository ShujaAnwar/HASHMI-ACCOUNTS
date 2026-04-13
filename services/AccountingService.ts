import { supabase } from './supabase';
import { Account, AccountType, Voucher, VoucherType, Currency, VoucherStatus } from '../types';

export class AccountingService {
  
  private static async formatAccountName(name: string): Promise<string> {
    if (!name) return '';
    const trimmed = name.trim();
    
    // Fetch current system case setting
    const { data: config } = await supabase.from('app_config').select('account_name_case').limit(1).maybeSingle();
    const caseType = config?.account_name_case || 'Sentence Case';

    switch (caseType) {
      case 'UPPERCASE':
        return trimmed.toUpperCase();
      case 'lowercase':
        return trimmed.toLowerCase();
      case 'camelCase':
        return trimmed.toLowerCase()
          .replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
      case 'Sentence Case':
      default:
        const s = trimmed.toLowerCase();
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
  }

  static generateUniqueVNum(type: string): string {
    const year = new Date().getFullYear();
    const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${type}-${year}-${randomStr}`;
  }

  static async createAccount(name: string, type: AccountType, cell: string, location: string, openingBalance: number, isDr: boolean, code?: string, currency: Currency = Currency.PKR) {
    const sanitizedCode = (code && code.trim() !== '') ? code.trim() : null;
    const formattedName = await this.formatAccountName(name);

    const { data: account, error: accError } = await supabase
      .from('accounts')
      .insert({
        name: formattedName,
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
      const obDate = new Date();
      obDate.setHours(0, 0, 0, 0);
      
      await supabase.from('ledger_entries').insert({
        account_id: account.id,
        date: obDate.toISOString(),
        description: description,
        debit: isDr ? openingBalance : 0,
        credit: isDr ? 0 : openingBalance,
      });

      const { data: reserve } = await supabase.from('accounts').select('id').eq('code', '3001').single();
      if (reserve) {
        await supabase.from('ledger_entries').insert({
          account_id: reserve.id,
          date: new Date().toISOString(),
          description: `Contra Opening Balance: ${formattedName}`,
          debit: isDr ? 0 : openingBalance,
          credit: isDr ? openingBalance : 0,
        });
      }
    }
    return account;
  }

  static async updateAccount(id: string, updates: any) {
    const { data: currentAcc, error: fetchErr } = await supabase
      .from('accounts')
      .select('name')
      .eq('id', id)
      .single();
    
    if (fetchErr || !currentAcc) throw new Error("Account resolution failed");

    const sanitizedCode = (updates.code && updates.code.trim() !== '') ? updates.code.trim() : null;
    const formattedName = updates.name ? await this.formatAccountName(updates.name) : currentAcc.name;
    
    const { error: updateErr } = await supabase
      .from('accounts')
      .update({
        name: formattedName,
        cell: updates.cell,
        location: updates.location,
        code: sanitizedCode,
        currency: updates.currency
      })
      .eq('id', id);

    if (updateErr) throw updateErr;

    const obDesc = 'Opening Balance (Initial Measurement)';
    const contraPrefix = 'Contra Opening Balance:';
    
    await supabase.from('ledger_entries').delete().eq('account_id', id).eq('description', obDesc);
    
    const { data: reserve } = await supabase.from('accounts').select('id').eq('code', '3001').single();
    if (reserve) {
      await supabase.from('ledger_entries')
        .delete()
        .eq('account_id', reserve.id)
        .like('description', `${contraPrefix}%${currentAcc.name}%`);
    }

    if (updates.openingBalance > 0) {
      const isDr = updates.balanceType === 'dr';
      const obDate = new Date();
      obDate.setHours(0, 0, 0, 0);
      
      await supabase.from('ledger_entries').insert({
        account_id: id,
        date: obDate.toISOString(),
        description: obDesc,
        debit: isDr ? updates.openingBalance : 0,
        credit: isDr ? 0 : updates.openingBalance,
      });

      if (reserve) {
        await supabase.from('ledger_entries').insert({
          account_id: reserve.id,
          date: new Date().toISOString(),
          description: `${contraPrefix} ${formattedName}`,
          debit: isDr ? 0 : updates.openingBalance,
          credit: isDr ? updates.openingBalance : 0,
        });
      }
    }
  }

  static async deleteAccount(id: string) {
    const { error } = await supabase.from('accounts').delete().eq('id', id);
    if (error) throw error;
  }

  static async deleteVoucher(id: string) {
    // Manually delete ledger entries first to ensure no orphans
    await supabase.from('ledger_entries').delete().eq('voucher_id', id);
    const { error } = await supabase.from('vouchers').delete().eq('id', id);
    if (error) throw error;
  }

  static async postVoucher(vData: Partial<Voucher>) {
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
    const entries: any[] = [];
    
    const customerId = voucher.customer_id;
    const vendorId = voucher.vendor_id;

    if (voucher.type === 'RV') {
      const bankId = voucher.details?.bankId;
      if (bankId) entries.push({ account_id: bankId, voucher_id: voucher.id, date: voucher.date, debit: amount, credit: 0, description: voucher.description, voucher_num: voucher.voucher_num });
      if (customerId) entries.push({ account_id: customerId, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: amount, description: voucher.description, voucher_num: voucher.voucher_num });
      
    } else if (voucher.type === 'TV' || voucher.type === 'TRANSPORT') {
      const items = voucher.details?.items || [];
      const rate = voucher.currency === Currency.SAR ? voucher.roe : 1;
      const incomeAccountId = voucher.details?.incomeAccountId;
      const incomeAmountPKR = Number(voucher.details?.incomeAmountPKR) || 0;

      // 1. Post each transport item separately
      items.forEach((item: any) => {
        const itemRatePKR = Number(item.rate) * rate;
        const sectorName = item.sector === 'CUSTOM' ? (item.customLabel || 'Custom Route') : item.sector;
        const itemDesc = `${sectorName} (${item.vehicle}) - ${voucher.description || ''}`;
        
        if (customerId) {
          entries.push({ 
            account_id: customerId, 
            voucher_id: voucher.id, 
            date: voucher.date, 
            debit: itemRatePKR, 
            credit: 0, 
            description: itemDesc, 
            voucher_num: voucher.voucher_num 
          });
        }
        if (vendorId) {
          entries.push({ 
            account_id: vendorId, 
            voucher_id: voucher.id, 
            date: voucher.date, 
            debit: 0, 
            credit: itemRatePKR, 
            description: itemDesc, 
            voucher_num: voucher.voucher_num 
          });
        }
      });

      // 2. Post Service Fee (Income) separately
      if (incomeAmountPKR !== 0) {
        let targetIncomeId = incomeAccountId;
        if (!targetIncomeId) {
          const { data: incomeAcc } = await supabase.from('accounts').select('id').eq('type', 'REVENUE').limit(1).maybeSingle();
          targetIncomeId = incomeAcc?.id;
        }
        
        const incomeDesc = `Service Fee: ${voucher.description || voucher.voucher_num}`;
        
        if (customerId) {
          entries.push({ 
            account_id: customerId, 
            voucher_id: voucher.id, 
            date: voucher.date, 
            debit: incomeAmountPKR, 
            credit: 0, 
            description: incomeDesc, 
            voucher_num: voucher.voucher_num 
          });
        }
        if (targetIncomeId) {
          entries.push({ 
            account_id: targetIncomeId, 
            voucher_id: voucher.id, 
            date: voucher.date, 
            debit: 0, 
            credit: incomeAmountPKR, 
            description: incomeDesc, 
            voucher_num: voucher.voucher_num 
          });
        }
      }
      
    } else if (voucher.type === 'HV' || voucher.type === 'HOTEL') {
      const vendorAmount = Number(voucher.details?.vendorAmountPKR) || amount;
      const incomeAmount = Number(voucher.details?.incomeAmountPKR) || 0;
      const incomeAccountId = voucher.details?.incomeAccountId;
      
      if (customerId) entries.push({ account_id: customerId, voucher_id: voucher.id, date: voucher.date, debit: amount, credit: 0, description: voucher.description, voucher_num: voucher.voucher_num });
      if (vendorId) entries.push({ account_id: vendorId, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: vendorAmount, description: voucher.description, voucher_num: voucher.voucher_num });
      
      if (incomeAmount !== 0) {
        let targetIncomeId = incomeAccountId;
        if (!targetIncomeId) {
          const { data: incomeAcc } = await supabase.from('accounts').select('id').eq('type', 'REVENUE').limit(1).maybeSingle();
          targetIncomeId = incomeAcc?.id;
        }
        if (targetIncomeId) {
          entries.push({ account_id: targetIncomeId, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: incomeAmount, description: `Income from ${voucher.voucher_num}`, voucher_num: voucher.voucher_num });
        }
      }
      
    } else if (voucher.type === 'VV' || voucher.type === 'VISA') {
      const items = voucher.details?.items || [];
      const rate = voucher.currency === Currency.SAR ? voucher.roe : 1;

      if (items.length > 0) {
        items.forEach((item: any) => {
          const itemAmountPKR = (Number(item.quantity) * Number(item.rate)) * rate;
          const itemPassport = item.passportNumber || 'N/A';
          const itemPax = item.paxName || 'N/A';
          const itemDesc = `Visa Voucher – ${itemPax} – Passport No: ${itemPassport}`;
          
          if (customerId) {
            entries.push({ 
              account_id: customerId, 
              voucher_id: voucher.id, 
              date: voucher.date, 
              debit: itemAmountPKR, 
              credit: 0, 
              description: itemDesc, 
              voucher_num: voucher.voucher_num 
            });
          }
          if (vendorId) {
            entries.push({ 
              account_id: vendorId, 
              voucher_id: voucher.id, 
              date: voucher.date, 
              debit: 0, 
              credit: itemAmountPKR, 
              description: itemDesc, 
              voucher_num: voucher.voucher_num 
            });
          }
        });
      } else {
        // Fallback for legacy vouchers
        const passportNum = voucher.details?.passportNumber || 'N/A';
        const legacyDesc = `Visa Voucher – ${voucher.description || 'Visa Processing'} – Passport No: ${passportNum}`;
        if (customerId) entries.push({ account_id: customerId, voucher_id: voucher.id, date: voucher.date, debit: amount, credit: 0, description: legacyDesc, voucher_num: voucher.voucher_num });
        if (vendorId) entries.push({ account_id: vendorId, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: amount, description: legacyDesc, voucher_num: voucher.voucher_num });
      }
      
    } else if (voucher.type === 'TK' || voucher.type === 'TICKET') {
      if (customerId) entries.push({ account_id: customerId, voucher_id: voucher.id, date: voucher.date, debit: amount, credit: 0, description: voucher.description, voucher_num: voucher.voucher_num });
      if (vendorId) entries.push({ account_id: vendorId, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: amount, description: voucher.description, voucher_num: voucher.voucher_num });
    } else if (voucher.type === 'PV') {
      const bankId = voucher.details?.bankId;
      const items = voucher.details?.items || [];
      
      // Handle multiple expense line items if they exist
      if (items.length > 0) {
        items.forEach((item: any) => {
          const itemAmount = Number(item.amount) * (voucher.currency === Currency.SAR ? voucher.roe : 1);
          const itemDesc = item.description || voucher.description;
          
          if (item.accountId) {
            // Debit entry for the expense/vendor account
            entries.push({ 
              account_id: item.accountId, 
              voucher_id: voucher.id, 
              date: voucher.date, 
              debit: itemAmount, 
              credit: 0, 
              description: itemDesc, 
              voucher_num: voucher.voucher_num 
            });

            // Corresponding Credit entry for the bank/cash account (Split mode)
            if (bankId) {
              entries.push({ 
                account_id: bankId, 
                voucher_id: voucher.id, 
                date: voucher.date, 
                debit: 0, 
                credit: itemAmount, 
                description: itemDesc, 
                voucher_num: voucher.voucher_num 
              });
            }
          }
        });
      } else {
        // Fallback for legacy or single-item PVs
        const expenseAccountId = voucher.details?.expenseId || voucher.details?.expenseAccountId;
        if (expenseAccountId) {
          entries.push({ 
            account_id: expenseAccountId, 
            voucher_id: voucher.id, 
            date: voucher.date, 
            debit: amount, 
            credit: 0, 
            description: voucher.description, 
            voucher_num: voucher.voucher_num 
          });
        }
        if (bankId) {
          entries.push({ 
            account_id: bankId, 
            voucher_id: voucher.id, 
            date: voucher.date, 
            debit: 0, 
            credit: amount, 
            description: voucher.description, 
            voucher_num: voucher.voucher_num 
          });
        }
      }
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