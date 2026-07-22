import { Voucher, VoucherType, Account, Currency } from '../types';

export interface ValidationResult {
  errors: string[];       // 🔴 Critical errors that block saving
  warnings: string[];     // 🟡 Warnings that alert user but don't block
  validations: string[];  // 🟢 Validation checks that passed successfully
}

// Known Makkah and Madinah hotel keywords for mismatch detection
const MAKKAH_HOTEL_KEYWORDS = [
  'MAKKAH', 'MECCA', 'CLOCK TOWER', 'FAIRMONT', 'SWISSOTEL', 'SWISS OTELL', 
  'ZAMZAM MAKKAH', 'PULLMAN ZAMZAM MAKKAH', 'HILTON MAKKAH', 'DAR AL EIMAN', 
  'ANJUM', 'JABAL OMAR', 'ELAF KINDA', 'LE MERIDIEN MAKKAH', 'KISWAH', 'VOX'
];

const MADINAH_HOTEL_KEYWORDS = [
  'MADINAH', 'MADINA', 'MEDINA', 'OBEROI', 'ANWAR AL MADINAH', 'DEAFAH', 
  'DAR AL TAQWA', 'PULLMAN ZAMZAM MADINA', 'ZAMZAM MADINA', 'MADINAH HILTON', 
  'TAIBA', 'CORAL', 'DALLAH TAIBA', 'ELAF GRAND MAJEDI', 'RAWDA', 'AQEEL'
];

export function validateVoucher(data: Partial<Voucher>, accounts: Account[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const validations: string[] = [];

  const customerAcc = accounts.find(a => a.id === data.customerId);
  const vendorAcc = accounts.find(a => a.id === data.vendorId);
  const bankAcc = accounts.find(a => a.id === data.details?.bankId);

  // -------------------------------------------------------------
  // 1. BASIC & ACCOUNT SELECTION CHECKS
  // -------------------------------------------------------------
  if (!data.date) {
    errors.push('Voucher date is required.');
  } else {
    validations.push(`Voucher Date: ${data.date}`);
  }

  // Account checks based on voucher type
  if (data.type === VoucherType.RECEIPT) {
    if (!data.customerId) {
      errors.push('Credit Account (Paid From) must be selected.');
    } else {
      validations.push(`Credit Account: ${customerAcc?.name || 'Selected'}`);
    }
    if (!data.details?.bankId) {
      errors.push('Debit Account (Received In) must be selected.');
    } else {
      validations.push(`Debit Account: ${bankAcc?.name || 'Selected'}`);
    }
  } else if (data.type === VoucherType.PAYMENT) {
    if (!data.details?.bankId) {
      errors.push('Credit Source Account (Paid From) must be selected.');
    } else {
      validations.push(`Paid From Account: ${bankAcc?.name || 'Selected'}`);
    }
    const items = data.details?.items || [];
    if (items.length === 0) {
      errors.push('At least one payment item must be added.');
    } else if (items.some((it: any) => !it.accountId)) {
      errors.push('All payment expense items must have a selected Debit Account.');
    } else {
      validations.push(`Itemized Payment Accounts: ${items.length} item(s) selected`);
    }
  } else {
    // Hotel, Visa, Transport, Ticket, Package, All-In-One
    if (!data.customerId) {
      errors.push('Customer Account must be selected.');
    } else {
      validations.push(`Customer Account: ${customerAcc?.name || 'Selected'}`);
    }

    if (!data.vendorId) {
      warnings.push('Vendor Account is not selected (Vendor credit will not be automatically tracked).');
    } else {
      validations.push(`Vendor Account: ${vendorAcc?.name || 'Selected'}`);
    }
  }

  // -------------------------------------------------------------
  // 2. CURRENCY & EXCHANGE RATE (ROE) CHECKS
  // -------------------------------------------------------------
  const currency = data.currency || Currency.PKR;
  const roe = Number(data.roe) || 1;

  if (currency === Currency.SAR) {
    if (roe <= 0) {
      errors.push('SAR Exchange Rate (ROE) must be greater than 0.');
    } else if (roe < 40 || roe > 150) {
      warnings.push(`ROE value (${roe}) is outside typical range (40 - 150 PKR/SAR). Please double check.`);
    } else {
      validations.push(`Exchange Rate (ROE): ${roe} PKR/SAR`);
    }
  } else {
    validations.push('Currency: PKR (Domestic Ledger)');
  }

  // Total amount check
  const totalPKR = Number(data.totalAmountPKR) || 0;
  if (totalPKR <= 0) {
    errors.push('Total Voucher Amount must be greater than 0 PKR.');
  } else {
    validations.push(`Total Amount: PKR ${totalPKR.toLocaleString()}`);
  }

  // -------------------------------------------------------------
  // 3. HOTEL VOUCHER SPECIFIC CHECKS
  // -------------------------------------------------------------
  if (data.type === VoucherType.HOTEL) {
    const items = data.details?.items || [];
    const mainHotel = data.details?.hotelName;
    const mainCity = data.details?.city;
    const mainCheckIn = data.details?.fromDate || data.details?.checkInDate;
    const mainCheckOut = data.details?.toDate || data.details?.checkOutDate;

    if (items.length > 0) {
      items.forEach((item: any, idx: number) => {
        const itemHotel = item.hotelName || `Hotel #${idx + 1}`;
        const itemCity = (item.city || '').trim();
        const checkIn = item.fromDate || item.checkInDate;
        const checkOut = item.toDate || item.checkOutDate;

        if (!item.hotelName) {
          errors.push(`Hotel #${idx + 1}: Hotel Name is required.`);
        }

        // Date check: Check-out cannot be before Check-in
        if (checkIn && checkOut) {
          const inDate = new Date(checkIn);
          const outDate = new Date(checkOut);
          if (outDate < inDate) {
            errors.push(`Hotel "${itemHotel}": Check-out date (${checkOut}) cannot be earlier than Check-in date (${checkIn}).`);
          } else if (outDate.getTime() === inDate.getTime()) {
            warnings.push(`Hotel "${itemHotel}": Check-in and Check-out are on the same date (${checkIn}).`);
          } else {
            validations.push(`Hotel "${itemHotel}": Valid dates (${checkIn} to ${checkOut})`);
          }
        } else {
          errors.push(`Hotel "${itemHotel}": Both Check-in and Check-out dates are required.`);
        }

        // Rate checks
        if ((item.sellingRate ?? item.unitRate) <= 0) {
          warnings.push(`Hotel "${itemHotel}": Rate per night is set to 0 or missing.`);
        }

        // Makkah / Madinah Mismatch Detection
        const upperHotel = (item.hotelName || '').toUpperCase();
        const upperCity = itemCity.toUpperCase();

        if (upperCity.includes('MADINAH') || upperCity.includes('MEDINA')) {
          if (MAKKAH_HOTEL_KEYWORDS.some(kw => upperHotel.includes(kw))) {
            warnings.push(`Makkah/Madinah Mismatch: Hotel "${item.hotelName}" appears to be in Makkah, but selected city is "${itemCity}".`);
          }
        } else if (upperCity.includes('MAKKAH') || upperCity.includes('MECCA')) {
          if (MADINAH_HOTEL_KEYWORDS.some(kw => upperHotel.includes(kw))) {
            warnings.push(`Makkah/Madinah Mismatch: Hotel "${item.hotelName}" appears to be in Madinah, but selected city is "${itemCity}".`);
          }
        }
      });
    } else {
      // Single item hotel
      if (!mainHotel) {
        errors.push('Hotel Name is required.');
      }
      if (mainCheckIn && mainCheckOut) {
        if (new Date(mainCheckOut) < new Date(mainCheckIn)) {
          errors.push(`Check-out date (${mainCheckOut}) cannot be earlier than Check-in date (${mainCheckIn}).`);
        } else {
          validations.push(`Check-in: ${mainCheckIn}, Check-out: ${mainCheckOut}`);
        }
      } else {
        errors.push('Both Check-in and Check-out dates are required.');
      }

      const upperHotel = (mainHotel || '').toUpperCase();
      const upperCity = (mainCity || '').toUpperCase();
      if (upperCity.includes('MADINAH') && MAKKAH_HOTEL_KEYWORDS.some(kw => upperHotel.includes(kw))) {
        warnings.push(`Makkah/Madinah Mismatch: Hotel "${mainHotel}" appears to be in Makkah, but selected city is "${mainCity}".`);
      } else if (upperCity.includes('MAKKAH') && MADINAH_HOTEL_KEYWORDS.some(kw => upperHotel.includes(kw))) {
        warnings.push(`Makkah/Madinah Mismatch: Hotel "${mainHotel}" appears to be in Madinah, but selected city is "${mainCity}".`);
      }
    }
  }

  // -------------------------------------------------------------
  // 4. VISA VOUCHER SPECIFIC CHECKS
  // -------------------------------------------------------------
  if (data.type === VoucherType.VISA) {
    const items = data.details?.items || [];
    let visaQuantity = Number(data.details?.quantity || 0);
    let visaRate = Number(data.details?.unitRate || data.details?.rate || 0);

    if (items.length > 0) {
      if (!visaQuantity || visaQuantity <= 0) {
        visaQuantity = items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0);
      }
      if (!visaRate || visaRate <= 0) {
        const itemRates = items.map((it: any) => Number(it.rate || it.unitRate || 0)).filter((r: number) => r > 0);
        if (itemRates.length > 0) {
          visaRate = Math.max(...itemRates);
        }
      }
    }

    // Fallback if visaRate is still 0 but totalPKR > 0
    if (visaRate <= 0 && totalPKR > 0) {
      const effectiveQty = visaQuantity > 0 ? visaQuantity : 1;
      const effectiveRoe = roe > 0 ? roe : 1;
      visaRate = (totalPKR / effectiveRoe) / effectiveQty;
    }

    if (visaQuantity <= 0) {
      errors.push('Visa Quantity must be at least 1.');
    } else {
      validations.push(`Visa Quantity: ${visaQuantity} Pax`);
    }

    if (visaRate <= 0) {
      errors.push('Visa Rate per Pax must be greater than 0.');
    } else {
      validations.push(`Visa Rate: ${visaRate.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`);
    }

    const sentToEmbassy = Boolean(data.details?.sentToEmbassy || data.details?.sendToEmbassy);
    if (!sentToEmbassy) {
      warnings.push('Visa Status: ⚠️ Not Sent to Embassy yet.');
    } else {
      validations.push('Visa Status: ✅ Sent to Embassy.');
    }

    // Passport duplicate check
    const passportsStr = items.map((it: any) => it.passportNumber).filter(Boolean).join(',') || data.details?.passports || data.details?.passportNumber || '';
    if (passportsStr) {
      const pList = passportsStr.split(/[\n,;]+/).map((s: string) => s.trim().toUpperCase()).filter(Boolean);
      const uniquePs = new Set(pList);
      if (uniquePs.size < pList.length) {
        warnings.push('Duplicate Passport Numbers detected in passenger list.');
      }
    }
  }

  // -------------------------------------------------------------
  // 5. TRANSPORT VOUCHER SPECIFIC CHECKS
  // -------------------------------------------------------------
  if (data.type === VoucherType.TRANSPORT) {
    const isBooked = Boolean(data.details?.transportBooked);
    const ksaVendorId = data.details?.ksaVendorId;

    if (!isBooked) {
      warnings.push('Transport Status: ⚠️ Transport Recorded Only (Not Yet Booked with Vendor).');
    } else {
      validations.push('Transport Status: ✅ Confirmed & Booked with Vendor.');
      if (!ksaVendorId) {
        warnings.push('Transport marked as booked, but Confirmed KSA Vendor is not selected.');
      }
    }

    const items = data.details?.items || [];
    if (items.length > 0) {
      items.forEach((item: any, idx: number) => {
        const depDate = item.departureDate;
        const arrDate = item.arrivalDate;
        if (depDate && arrDate) {
          if (new Date(arrDate) < new Date(depDate)) {
            errors.push(`Transport #${idx + 1} (${item.sector || 'Route'}): Arrival Date (${arrDate}) cannot be earlier than Departure Date (${depDate}).`);
          } else {
            validations.push(`Transport #${idx + 1}: Valid route dates (${depDate} to ${arrDate})`);
          }
        }
      });
    }
  }

  // -------------------------------------------------------------
  // 6. TICKET VOUCHER SPECIFIC CHECKS
  // -------------------------------------------------------------
  if (data.type === VoucherType.TICKET) {
    if (!data.reference) {
      warnings.push('PNR / Ticket Number is missing.');
    } else {
      validations.push(`PNR / Ticket #: ${data.reference}`);
    }

    if (!data.details?.paxName) {
      warnings.push('Passenger Name is missing.');
    }
  }

  return { errors, warnings, validations };
}
