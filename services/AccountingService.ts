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

  static async generateVoucherNumber(type: string, dateInput?: string): Promise<string> {
    const d = dateInput ? new Date(dateInput) : new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    
    // Get count of vouchers of this type to determine initial next serial
    let count = 0;
    let queryError: any = null;
    
    if (type === 'PKV' || type === 'PACKAGE') {
      const { data, error } = await supabase
        .from('vouchers')
        .select('id, details')
        .eq('type', 'AV');
      if (error) queryError = error;
      else {
        count = (data || []).filter((v: any) => v.details?.is_package === true).length;
      }
    } else if (type === 'AV' || type === 'ALL_IN_ONE') {
      const { data, error } = await supabase
        .from('vouchers')
        .select('id, details')
        .eq('type', 'AV');
      if (error) queryError = error;
      else {
        count = (data || []).filter((v: any) => !v.details?.is_package).length;
      }
    } else {
      const { count: dbCount, error } = await supabase
        .from('vouchers')
        .select('*', { count: 'exact', head: true })
        .eq('type', type);
      if (error) queryError = error;
      else count = dbCount || 0;
    }
      
    if (queryError) console.error("Error generating voucher number:", queryError);
    
    let nextSerial = (count || 0) + 1;
    let voucherNum = `${type}${String(nextSerial).padStart(2, '0')}${month}${year}`;
    
    // Safety check: ensure the number doesn't already exist. 
    // If it does, keep incrementing until we find a unique one.
    let exists = true;
    let attempts = 0;
    while (exists && attempts < 100) {
      const { data, error: checkError } = await supabase
        .from('vouchers')
        .select('id')
        .eq('voucher_num', voucherNum)
        .maybeSingle();
      
      if (checkError) break;
      if (!data) {
        exists = false;
      } else {
        nextSerial++;
        voucherNum = `${type}${String(nextSerial).padStart(2, '0')}${month}${year}`;
        attempts++;
      }
    }
    
    return voucherNum;
  }

  // Keep for backward compatibility or temporary numbers, but update to the requested format with a random suffix for safety if sync
  static generateUniqueVNum(type: string): string {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    const randomSuffix = Math.floor(Math.random() * 90 + 10); // 2 random digits
    return `${type}${randomSuffix}${month}${year}`;
  }

  private static formatDate(dateStr: string): string {
    if (!dateStr || dateStr === '') return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  private static formatMeals(meals: any): string {
    if (!meals) return 'Room Only';
    if (Array.isArray(meals)) return meals.length > 0 ? meals.join(', ') : 'Room Only';
    return String(meals);
  }

  static async createAccount(name: string, type: AccountType, cell: string, location: string, openingBalance: number, isDr: boolean, code?: string, currency: Currency = Currency.PKR, companyName?: string, contactNumber?: string, logoUrl?: string) {
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
        balance: 0,
        company_name: companyName,
        contact_number: contactNumber,
        logo_url: logoUrl
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
        currency: updates.currency,
        company_name: updates.companyName,
        contact_number: updates.contactNumber,
        logo_url: updates.logoUrl
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

  static async deleteAccounts(ids: string[]) {
    if (!ids || ids.length === 0) return;
    const { error } = await supabase.from('accounts').delete().in('id', ids);
    if (error) throw error;
  }

  static async deleteVoucher(id: string) {
    // Manually delete ledger entries first to ensure no orphans
    await supabase.from('ledger_entries').delete().eq('voucher_id', id);
    const { error } = await supabase.from('vouchers').delete().eq('id', id);
    if (error) throw error;
  }

  static async deleteVouchers(ids: string[]) {
    if (!ids || ids.length === 0) return;
    // Batch delete ledger entries
    await supabase.from('ledger_entries').delete().in('voucher_id', ids);
    const { error } = await supabase.from('vouchers').delete().in('id', ids);
    if (error) throw error;
  }

  static async postVoucher(vData: Partial<Voucher>) {
    const vNum = vData.voucherNum || await this.generateVoucherNumber(vData.type || 'VO' as any, vData.date);
    
    const isPackageVoucher = vData.type === VoucherType.PACKAGE || (vData.type as any) === 'PKV' || (vData.type as any) === 'PACKAGE' || vData.details?.is_package === true || (vData as any).is_package === true;
    // Fallback enum mapping for compatibility with database constraint rules
    const dbType = isPackageVoucher ? 'AV' : vData.type;
    const dbDetails = isPackageVoucher 
      ? { ...(vData.details || {}), is_package: true } 
      : (vData.details || {});

    const { data: voucher, error: vError } = await supabase
      .from('vouchers')
      .insert({
        type: dbType,
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
        details: dbDetails
      })
      .select()
      .single();

    if (vError) {
      console.error("Voucher Insertion Error:", vError);
      throw vError;
    }

    // Map back the type in memory so remaining ledger posting works with original type
    if (voucher && isPackageVoucher) {
      voucher.type = 'PKV';
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
      const paxName = voucher.details?.paxName || 'N/A';

      // 1. Post each transport item separately
      items.forEach((item: any) => {
        const itemRatePKR = Number(item.rate) * rate;
        let sectorName = item.sector === 'CUSTOM' ? (item.customLabel || 'Custom Route') : (item.sector === 'MULTI_SECTOR' ? 'Multi-Sector' : item.sector);
        
        if (item.isMultiSector && item.subSectors?.length > 0) {
          sectorName = item.subSectors.map((s: any) => s.route).join(' -> ');
        }

        const itemDesc = `${paxName} | ${sectorName.toUpperCase()} (${item.vehicle}) | ${voucher.description || ''}`;
        
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
        
        const incomeDesc = `${paxName} | Service Fee | ${voucher.description || voucher.voucher_num}`;
        
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
      const items = voucher.details?.items || [];
      const currency = voucher.currency || Currency.PKR;
      const roe = voucher.roe || 1;
      const rate = currency === Currency.SAR ? roe : 1;

      if (items.length > 0) {
        items.forEach((item: any) => {
          const itemAmountPKR = (Number(item.unitRate) * Number(item.numRooms) * Number(item.numNights)) * rate;
          const paxName = voucher.details?.paxName || item.paxName || 'N/A';
          const checkIn = this.formatDate(item.fromDate);
          const checkOut = this.formatDate(item.toDate);
          const meals = this.formatMeals(item.meals);
          
          const itemDesc = `${paxName} | ${item.hotelName} | Check-in: ${checkIn} | Check-out: ${checkOut} | Nights: ${item.numNights} | Meals: ${meals} | NORs: ${item.numRooms}`;
          
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
        const paxName = voucher.details?.paxName || 'N/A';
        const hotelName = voucher.details?.hotelName || 'N/A';
        const checkIn = this.formatDate(voucher.details?.fromDate);
        const checkOut = this.formatDate(voucher.details?.toDate);
        const meals = this.formatMeals(voucher.details?.meals);
        const nights = voucher.details?.numNights || 1;
        const rooms = voucher.details?.numRooms || 1;
        
        const legacyDesc = `${paxName} | ${hotelName} | Check-in: ${checkIn} | Check-out: ${checkOut} | Nights: ${nights} | Meals: ${meals} | NORs: ${rooms}`;
        
        const vendorAmount = Number(voucher.details?.vendorAmountPKR) || amount;
        if (customerId) entries.push({ account_id: customerId, voucher_id: voucher.id, date: voucher.date, debit: amount, credit: 0, description: legacyDesc, voucher_num: voucher.voucher_num });
        if (vendorId) entries.push({ account_id: vendorId, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: vendorAmount, description: legacyDesc, voucher_num: voucher.voucher_num });
      }
      
      const incomeAmount = Number(voucher.details?.incomeAmountPKR) || 0;
      const incomeAccountId = voucher.details?.incomeAccountId;
      
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
      const paxName = voucher.details?.paxName || 'N/A';
      const airline = voucher.details?.airline || 'N/A';
      const sector = voucher.details?.sector || 'N/A';
      const pnr = voucher.reference || 'N/A';
      const ticketDesc = `${paxName} | ${airline} | ${sector} | PNR: ${pnr} | ${voucher.description || ''}`;

      if (customerId) entries.push({ account_id: customerId, voucher_id: voucher.id, date: voucher.date, debit: amount, credit: 0, description: ticketDesc, voucher_num: voucher.voucher_num });
      if (vendorId) entries.push({ account_id: vendorId, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: amount, description: ticketDesc, voucher_num: voucher.voucher_num });
    } else if ((voucher.type === 'AV' && !voucher.details?.is_package) || voucher.type === 'ALL_IN_ONE') {
      const details = voucher.details || {};
      const roe = voucher.roe || 1;
      const rateMultiplier = voucher.currency === Currency.SAR ? roe : 1;
      const globalPaxName = details.paxName || 'N/A';

      console.log("Processing All-In-One Voucher Ledger Entries:", { voucherId: voucher.id, details });

      // 1. Process Visa Items
      if (details.visaItems && Array.isArray(details.visaItems)) {
        details.visaItems.forEach((item: any, idx: number) => {
          const itemAmountPKR = (Number(item.quantity || 0) * Number(item.rate || 0)) * rateMultiplier;
          const itemPax = item.paxName || globalPaxName;
          const itemDesc = `Visa: ${itemPax} | PP: ${item.passportNumber || details.passportNumber || 'N/A'} | ${voucher.description || ''} (#${idx+1})`;
          const itemVendorId = item.vendorId || voucher.vendor_id;

          if (customerId && itemAmountPKR > 0) {
            entries.push({ account_id: customerId, voucher_id: voucher.id, date: voucher.date, debit: itemAmountPKR, credit: 0, description: itemDesc, voucher_num: voucher.voucher_num });
          }
          if (itemVendorId && itemAmountPKR > 0) {
            entries.push({ account_id: itemVendorId, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: itemAmountPKR, description: itemDesc, voucher_num: voucher.voucher_num });
          }
        });
      }

      // 2. Process Hotel Items
      if (details.hotelItems && Array.isArray(details.hotelItems)) {
        details.hotelItems.forEach((item: any, idx: number) => {
          const itemAmountPKR = (Number(item.unitRate || 0) * Number(item.numRooms || 1) * Number(item.numNights || 1)) * rateMultiplier;
          const itemPax = item.paxName || globalPaxName;
          const hotelDesc = `Hotel: ${itemPax} | ${item.hotelName} (${item.city}) | In: ${this.formatDate(item.fromDate)} | Out: ${this.formatDate(item.toDate)} | ${item.numNights}N | ${item.numRooms}R (#${idx+1})`;
          const itemVendorId = item.vendorId || voucher.vendor_id;

          if (customerId && itemAmountPKR > 0) {
            entries.push({ account_id: customerId, voucher_id: voucher.id, date: voucher.date, debit: itemAmountPKR, credit: 0, description: hotelDesc, voucher_num: voucher.voucher_num });
          }
          if (itemVendorId && itemAmountPKR > 0) {
            entries.push({ account_id: itemVendorId, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: itemAmountPKR, description: hotelDesc, voucher_num: voucher.voucher_num });
          }
        });
      }

      // 3. Process Transport Items
      if (details.transportItems && Array.isArray(details.transportItems)) {
        details.transportItems.forEach((item: any, idx: number) => {
          const itemAmountPKR = Number(item.rate || 0) * rateMultiplier;
          const itemPax = item.paxName || globalPaxName;
          
          let sectorName = '';
          if (item.isMultiSector && item.subSectors && Array.isArray(item.subSectors)) {
            sectorName = item.subSectors.map((ss: any) => ss.route).join(' -> ');
          } else {
            sectorName = item.sector === 'CUSTOM' ? (item.customLabel || 'Custom Route') : item.sector;
          }

          const transportDesc = `Transport: ${itemPax} | ${sectorName} (${item.vehicle}) | Date: ${this.formatDate(item.date)} (#${idx+1})`;
          const itemVendorId = item.vendorId || voucher.vendor_id;

          if (customerId && itemAmountPKR > 0) {
            entries.push({ account_id: customerId, voucher_id: voucher.id, date: voucher.date, debit: itemAmountPKR, credit: 0, description: transportDesc, voucher_num: voucher.voucher_num });
          }
          if (itemVendorId && itemAmountPKR > 0) {
            entries.push({ account_id: itemVendorId, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: itemAmountPKR, description: transportDesc, voucher_num: voucher.voucher_num });
          }
        });
      }

      // 4. Process Extra Income/Fees if any
      const incomeAmountPKR = Number(details.incomeAmountPKR || 0);
      if (incomeAmountPKR !== 0) {
        let incomeAccountId = details.incomeAccountId;
        if (!incomeAccountId) {
          const { data: incomeAcc } = await supabase.from('accounts').select('id').eq('type', 'REVENUE').limit(1).maybeSingle();
          incomeAccountId = incomeAcc?.id;
        }
        const incomeDesc = `${globalPaxName} | All-In-One Service Fee | ${voucher.voucher_num}`;
        if (customerId) {
          entries.push({ account_id: customerId, voucher_id: voucher.id, date: voucher.date, debit: incomeAmountPKR, credit: 0, description: incomeDesc, voucher_num: voucher.voucher_num });
        }
        if (incomeAccountId) {
          entries.push({ account_id: incomeAccountId, voucher_id: voucher.id, date: voucher.date, debit: 0, credit: incomeAmountPKR, description: incomeDesc, voucher_num: voucher.voucher_num });
        }
      }

    } else if (voucher.type === 'PKV' || voucher.type === 'PACKAGE' || (voucher.type === 'AV' && voucher.details?.is_package === true)) {
      const details = voucher.details || {};
      const roe = voucher.roe || 1;
      const rateMultiplier = voucher.currency === Currency.SAR ? roe : 1;
      const hajjisList = details.hajjis || [];
      const totalPilgrims = hajjisList.length || 1;
      const pilgrimNames = hajjisList.map((h: any) => h.fullName).join(', ');
      
      console.log("Processing Package Voucher Ledger Entries:", { voucherId: voucher.id, details });

      // 1. Process Customer Debit (Total Selling Price)
      const customerTotalPKR = Number(details.packagePricePerHaji || 0) * totalPilgrims * rateMultiplier;
      const pricePerHaji = Number(details.packagePricePerHaji || 0);
      const currencySymbol = voucher.currency === Currency.SAR ? 'SAR' : (voucher.currency || 'USD');
      const roeText = voucher.currency === Currency.SAR ? `(ROE: ${roe})` : '';
      const totalInOriginal = pricePerHaji * totalPilgrims;
      const customerDesc = `UMRAH PACKAGE: ${totalPilgrims} Pax @ ${currencySymbol} ${pricePerHaji.toLocaleString()}/Pax = ${currencySymbol} ${totalInOriginal.toLocaleString()} ${roeText} | Pilgrims: ${pilgrimNames} | Note: ${voucher.description || ''}`;
      
      if (customerId && customerTotalPKR > 0) {
        entries.push({ 
          account_id: customerId, 
          voucher_id: voucher.id, 
          date: voucher.date, 
          debit: customerTotalPKR, 
          credit: 0, 
          description: customerDesc, 
          voucher_num: voucher.voucher_num 
        });
      }

      // Track individual service costs for margin calculation
      let totalVendorCostPKR = 0;

      // 2. Makkah Hotel Cost (Credit Vendor)
      const makkahCostPKR = Number(details.makkahCost || 0) * rateMultiplier;
      if (makkahCostPKR > 0) {
        totalVendorCostPKR += makkahCostPKR;
        const mVendorId = details.makkahVendorId || voucher.vendor_id;
        if (mVendorId) {
          const makkahDesc = `Makkah Hotel: ${details.makkahHotelName || 'N/A'} | Stay: ${details.makkahCheckIn || 'N/A'} to ${details.makkahCheckOut || 'N/A'} | ${totalPilgrims} Pilgrims (${pilgrimNames})`;
          entries.push({ 
            account_id: mVendorId, 
            voucher_id: voucher.id, 
            date: voucher.date, 
            debit: 0, 
            credit: makkahCostPKR, 
            description: makkahDesc, 
            voucher_num: voucher.voucher_num 
          });
        }
      }

      // 3. Madinah Hotel Cost (Credit Vendor)
      const madinahCostPKR = Number(details.madinahCost || 0) * rateMultiplier;
      if (madinahCostPKR > 0) {
        totalVendorCostPKR += madinahCostPKR;
        const mdVendorId = details.madinahVendorId || voucher.vendor_id;
        if (mdVendorId) {
          const madinahDesc = `Madinah Hotel: ${details.madinahHotelName || 'N/A'} | Stay: ${details.madinahCheckIn || 'N/A'} to ${details.madinahCheckOut || 'N/A'} | ${totalPilgrims} Pilgrims (${pilgrimNames})`;
          entries.push({ 
            account_id: mdVendorId, 
            voucher_id: voucher.id, 
            date: voucher.date, 
            debit: 0, 
            credit: madinahCostPKR, 
            description: madinahDesc, 
            voucher_num: voucher.voucher_num 
          });
        }
      }

      // 4. Transport Cost (Credit Vendor)
      const transportCostPKR = Number(details.transportCost || 0) * rateMultiplier;
      if (transportCostPKR > 0) {
        totalVendorCostPKR += transportCostPKR;
        const tVendorId = details.transportVendorId || voucher.vendor_id;
        if (tVendorId) {
          const transportDesc = `Transport: ${details.transportRoute || 'N/A'} (${details.transportVehicle || 'N/A'}) | ${totalPilgrims} Pilgrims (${pilgrimNames})`;
          entries.push({ 
            account_id: tVendorId, 
            voucher_id: voucher.id, 
            date: voucher.date, 
            debit: 0, 
            credit: transportCostPKR, 
            description: transportDesc, 
            voucher_num: voucher.voucher_num 
          });
        }
      }

      // 5. Ziyarat Cost (Credit Vendor)
      const ziyaratCostPKR = Number(details.ziyaratCost || 0) * rateMultiplier;
      if (ziyaratCostPKR > 0) {
        totalVendorCostPKR += ziyaratCostPKR;
        const zVendorId = details.ziyaratVendorId || voucher.vendor_id;
        if (zVendorId) {
          const ziyaratDesc = `Ziyarat: ${details.ziyaratDetails || 'N/A'} | ${totalPilgrims} Pilgrims (${pilgrimNames})`;
          entries.push({ 
            account_id: zVendorId, 
            voucher_id: voucher.id, 
            date: voucher.date, 
            debit: 0, 
            credit: ziyaratCostPKR, 
            description: ziyaratDesc, 
            voucher_num: voucher.voucher_num 
          });
        }
      }

      // 6. Other Services Cost (Credit Vendor)
      const otherCostPKR = Number(details.otherCost || 0) * rateMultiplier;
      if (otherCostPKR > 0) {
        totalVendorCostPKR += otherCostPKR;
        const oVendorId = details.otherVendorId || voucher.vendor_id;
        if (oVendorId) {
          const otherDesc = `Other Services: ${details.otherServices || 'N/A'} | ${totalPilgrims} Pilgrims (${pilgrimNames})`;
          entries.push({ 
            account_id: oVendorId, 
            voucher_id: voucher.id, 
            date: voucher.date, 
            debit: 0, 
            credit: otherCostPKR, 
            description: otherDesc, 
            voucher_num: voucher.voucher_num 
          });
        }
      }

      // 7. Net Margin credit (Operating Income)
      const marginPKR = customerTotalPKR - totalVendorCostPKR;
      if (marginPKR !== 0) {
        let revAccountId = details.incomeAccountId;
        if (!revAccountId) {
          const { data: revAcc } = await supabase.from('accounts').select('id').eq('type', 'REVENUE').limit(1).maybeSingle();
          revAccountId = revAcc?.id;
        }
        if (revAccountId) {
          const marginDesc = `Package markup margin for ${totalPilgrims} Pilgrims (${pilgrimNames}) | Voucher: ${voucher.voucher_num}`;
          entries.push({ 
            account_id: revAccountId, 
            voucher_id: voucher.id, 
            date: voucher.date, 
            debit: marginPKR < 0 ? Math.abs(marginPKR) : 0, 
            credit: marginPKR > 0 ? marginPKR : 0, 
            description: marginDesc, 
            voucher_num: voucher.voucher_num 
          });
        }
      }

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