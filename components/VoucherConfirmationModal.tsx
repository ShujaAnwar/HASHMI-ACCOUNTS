import React, { useState, useMemo } from 'react';
import { Voucher, VoucherType, Account, Currency } from '../types';
import { validateVoucher, ValidationResult } from '../utils/voucherValidator';

interface VoucherConfirmationModalProps {
  voucherData: Partial<Voucher>;
  accounts: Account[];
  onConfirm: () => void;
  onEdit: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export const VoucherConfirmationModal: React.FC<VoucherConfirmationModalProps> = ({
  voucherData,
  accounts,
  onConfirm,
  onEdit,
  onCancel,
  isSaving = false
}) => {
  const [showValidationDetails, setShowValidationDetails] = useState(true);

  // Perform automatic smart validation
  const validationResult: ValidationResult = useMemo(() => {
    return validateVoucher(voucherData, accounts);
  }, [voucherData, accounts]);

  const customerAccount = useMemo(() => {
    return accounts.find(a => a.id === voucherData.customerId);
  }, [accounts, voucherData.customerId]);

  const vendorAccount = useMemo(() => {
    return accounts.find(a => a.id === voucherData.vendorId || a.id === voucherData.details?.ksaVendorId);
  }, [accounts, voucherData.vendorId, voucherData.details?.ksaVendorId]);

  const bankAccount = useMemo(() => {
    return accounts.find(a => a.id === voucherData.details?.bankId);
  }, [accounts, voucherData.details?.bankId]);

  const hasCriticalErrors = validationResult.errors.length > 0;
  const currency = voucherData.currency || Currency.PKR;
  const roe = Number(voucherData.roe) || 1;
  const totalPKR = Number(voucherData.totalAmountPKR) || 0;
  const originalTotal = currency === Currency.SAR ? totalPKR / roe : totalPKR;

  // Calculate totals for Hotel/Transport/Visa items
  const items = voucherData.details?.items || [];
  
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 md:p-6 overflow-y-auto no-print animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl md:max-w-5xl rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-white/10 flex flex-col overflow-hidden max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 md:p-8 flex justify-between items-center border-b border-white/10">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-2xl shadow-inner">
              🔍
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-3 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-black uppercase tracking-widest border border-blue-500/30">
                  Smart Validation System
                </span>
                <span className="px-3 py-0.5 rounded-full bg-white/10 text-white/80 text-[10px] font-bold uppercase tracking-widest font-mono">
                  {voucherData.voucherNum || 'NEW VOUCHER'}
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-orbitron font-extrabold text-white mt-1">
                Review & Confirm Before Save
              </h2>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">
                Verify voucher details and smart audit report before permanent database entry
              </p>
            </div>
          </div>
          <button 
            onClick={onCancel}
            className="p-3 text-slate-400 hover:text-white rounded-2xl hover:bg-white/10 transition-colors"
            title="Cancel"
          >
            ✕
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-50/50 dark:bg-slate-950/50">

          {/* 1. Smart Validation Alert Banners */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                Automated Audit & Validation Summary
              </h3>
              <button 
                onClick={() => setShowValidationDetails(!showValidationDetails)}
                className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider hover:underline"
              >
                {showValidationDetails ? 'Hide Audit Details' : 'Show Audit Details'}
              </button>
            </div>

            {/* Critical Errors Alert Box */}
            {hasCriticalErrors && (
              <div className="p-5 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-500/50 rounded-2xl text-rose-800 dark:text-rose-200 animate-in shake duration-300">
                <div className="flex items-start space-x-3">
                  <span className="text-2xl">🔴</span>
                  <div className="flex-1">
                    <h4 className="font-bold text-sm uppercase tracking-wide text-rose-700 dark:text-rose-300">
                      Save Blocked ({validationResult.errors.length} Critical Issue{validationResult.errors.length > 1 ? 's' : ''})
                    </h4>
                    <p className="text-xs mt-1 text-rose-600 dark:text-rose-300/80">
                      Please correct the following critical errors by clicking <strong>"Edit Voucher"</strong> below:
                    </p>
                    <ul className="mt-2 space-y-1 text-xs list-disc pl-5 font-semibold">
                      {validationResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Warnings Alert Box */}
            {validationResult.warnings.length > 0 && (
              <div className="p-5 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400/50 rounded-2xl text-amber-800 dark:text-amber-200">
                <div className="flex items-start space-x-3">
                  <span className="text-2xl">⚠️</span>
                  <div className="flex-1">
                    <h4 className="font-bold text-sm uppercase tracking-wide text-amber-700 dark:text-amber-300">
                      Notice / Warnings ({validationResult.warnings.length})
                    </h4>
                    <ul className="mt-2 space-y-1 text-xs list-disc pl-5 font-medium">
                      {validationResult.warnings.map((warn, i) => (
                        <li key={i}>{warn}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Clean Entry Green Banner */}
            {!hasCriticalErrors && validationResult.warnings.length === 0 && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-emerald-800 dark:text-emerald-200 flex items-center space-x-3">
                <span className="text-2xl">🟢</span>
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Smart Validation Passed (100% Clean Entry)
                  </h4>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400/80 mt-0.5">
                    All date logic, exchange rates, account selections, and amount checks verified successfully.
                  </p>
                </div>
              </div>
            )}

            {/* Valid Checks Pill Details */}
            {showValidationDetails && validationResult.validations.length > 0 && (
              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Verified Checks ({validationResult.validations.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {validationResult.validations.map((vCheck, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 border dark:border-slate-700">
                      <span className="text-emerald-500">✓</span> {vCheck}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Customer & Basic Voucher Metadata */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center">
              <span>Customer & Core Information</span>
              <span className="text-slate-400 font-mono text-[10px]">{voucherData.type}</span>
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Customer Name</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white uppercase mt-0.5">
                  {customerAccount?.name || 'N/A'}
                </p>
              </div>

              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Vendor Name</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white uppercase mt-0.5">
                  {vendorAccount?.name || (voucherData.type === VoucherType.RECEIPT || voucherData.type === VoucherType.PAYMENT ? (bankAccount?.name || 'N/A') : 'N/A')}
                </p>
              </div>

              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Voucher Number</p>
                <p className="text-sm font-orbitron font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                  {voucherData.voucherNum || 'N/A'}
                </p>
              </div>

              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Booking / Voucher Date</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {formatDate(voucherData.date)}
                </p>
              </div>
            </div>

            {voucherData.reference && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center space-x-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reference / PNR / Booking Ref:</span>
                <span className="text-xs font-orbitron font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                  {voucherData.reference}
                </span>
              </div>
            )}
          </div>

          {/* 3. Service Details Section according to Voucher Type */}
          
          {/* HOTEL VOUCHER SUMMARY */}
          {voucherData.type === VoucherType.HOTEL && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center">
                <span>Hotel Reservation Details</span>
                <span className="text-xs font-bold text-slate-500">{items.length || 1} Hotel Line(s)</span>
              </h3>

              {items.length > 0 ? (
                <div className="space-y-4">
                  {items.map((item: any, idx: number) => {
                    const itemVendor = accounts.find(a => a.id === item.vendorId);
                    return (
                      <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold uppercase tracking-wider">
                              Hotel #{idx + 1} ({item.city || 'KSA'})
                            </span>
                            <h4 className="text-lg font-bold text-slate-900 dark:text-white uppercase mt-1">
                              {item.hotelName || 'N/A'}
                            </h4>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Vendor</span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                              {itemVendor?.name || vendorAccount?.name || 'N/A'}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Check-in</p>
                            <p className="font-bold text-slate-800 dark:text-slate-200">{formatDate(item.fromDate)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Check-out</p>
                            <p className="font-bold text-slate-800 dark:text-slate-200">{formatDate(item.toDate)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Nights</p>
                            <p className="font-bold text-slate-800 dark:text-slate-200">{item.numNights || 1} Night(s)</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Rooms / Pax</p>
                            <p className="font-bold text-slate-800 dark:text-slate-200">
                              {item.numRooms || 1} Room(s) | {item.adults || 0} A, {item.children || 0} C
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Room Type</p>
                            <p className="font-bold text-slate-800 dark:text-slate-200 uppercase">{item.roomType || 'TRIPLE'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Meal Plan</p>
                            <p className="font-bold text-slate-800 dark:text-slate-200 uppercase">{item.meals || 'RO'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Rate per Night</p>
                            <p className="font-orbitron font-bold text-emerald-600 dark:text-emerald-400">
                              {currency} {Number(item.sellingRate || item.unitRate || 0).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Line Total</p>
                            <p className="font-orbitron font-bold text-slate-900 dark:text-white">
                              {currency} {(Number(item.sellingRate || item.unitRate || 0) * Number(item.numNights || 1) * Number(item.numRooms || 1)).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Hotel Name</p>
                    <p className="font-bold text-slate-900 dark:text-white uppercase">{voucherData.details?.hotelName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">City</p>
                    <p className="font-bold text-slate-900 dark:text-white uppercase">{voucherData.details?.city || 'Makkah'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Check-in / Check-out</p>
                    <p className="font-bold text-slate-900 dark:text-white">{formatDate(voucherData.details?.fromDate)} - {formatDate(voucherData.details?.toDate)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Nights & Rooms</p>
                    <p className="font-bold text-slate-900 dark:text-white">{voucherData.details?.numNights || 1} Nts | {voucherData.details?.numRooms || 1} Rooms</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VISA VOUCHER SUMMARY */}
          {voucherData.type === VoucherType.VISA && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center">
                <span>Visa Processing Details</span>
                {voucherData.details?.sentToEmbassy ? (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-emerald-300">
                    ✅ Sent to Embassy
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-amber-300 animate-pulse">
                    ⚠️ Not Sent to Embassy
                  </span>
                )}
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Visa Type</p>
                  <p className="font-bold text-slate-900 dark:text-white uppercase">{voucherData.details?.visaType || 'UMRAH VISA'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Visa Quantity</p>
                  <p className="font-bold text-slate-900 dark:text-white font-orbitron">{voucherData.details?.quantity || 1} Pax</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Visa Rate per Pax</p>
                  <p className="font-bold text-amber-600 dark:text-amber-400 font-orbitron">
                    {currency} {Number(voucherData.details?.unitRate || voucherData.details?.rate || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Travel Date</p>
                  <p className="font-bold text-slate-900 dark:text-white">{formatDate(voucherData.details?.travelDate)}</p>
                </div>
              </div>

              {(voucherData.details?.paxName || voucherData.details?.passports) && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1 text-xs">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Passenger & Passport Numbers</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    {voucherData.details?.paxName ? `Pax Name: ${voucherData.details.paxName}` : ''}
                  </p>
                  {voucherData.details?.passports && (
                    <p className="font-mono text-slate-600 dark:text-slate-400 text-[11px] whitespace-pre-wrap">
                      {voucherData.details.passports}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TRANSPORT VOUCHER SUMMARY */}
          {voucherData.type === VoucherType.TRANSPORT && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center">
                <span>Transport Route & Fleet Details</span>
                {voucherData.details?.transportBooked ? (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-emerald-300">
                    ✅ Booked with Vendor
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-amber-300 animate-pulse">
                    ⚠️ Transport Recorded Only (Not Yet Booked)
                  </span>
                )}
              </h3>

              {items.length > 0 ? (
                <div className="space-y-3">
                  {items.map((item: any, idx: number) => (
                    <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase text-sm">
                          Route #{idx + 1}: {item.sector === 'CUSTOM' ? item.customLabel : item.sector}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold uppercase text-[9px]">
                          {item.vehicle || 'BUS'} ({item.vehicleCount || 1} Vehicle)
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Departure Date / Time</p>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{formatDate(item.departureDate)} {item.departureTime ? `@ ${item.departureTime}` : ''}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Arrival Date / Time</p>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{formatDate(item.arrivalDate)} {item.arrivalTime ? `@ ${item.arrivalTime}` : ''}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Flight Number</p>
                          <p className="font-bold text-slate-800 dark:text-slate-200 uppercase">{item.flightNumber || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Rate per Vehicle</p>
                          <p className="font-bold text-indigo-600 font-orbitron">{currency} {Number(item.sellingRate || 0).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Passenger / Group Name</p>
                    <p className="font-bold text-slate-900 dark:text-white uppercase">{voucherData.details?.paxName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Confirmed Vendor</p>
                    <p className="font-bold text-slate-900 dark:text-white uppercase">{vendorAccount?.name || 'N/A'}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RECEIPT VOUCHER SUMMARY */}
          {voucherData.type === VoucherType.RECEIPT && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800 pb-3">
                Receipt Transaction Inflow
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Paid From (Credit Account)</p>
                  <p className="font-bold text-slate-900 dark:text-white uppercase">{customerAccount?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Received In (Debit Account)</p>
                  <p className="font-bold text-blue-600 dark:text-blue-400 uppercase">{bankAccount?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Cheque / TT Reference</p>
                  <p className="font-bold text-slate-900 dark:text-white">{voucherData.reference || 'N/A'}</p>
                </div>
              </div>
            </div>
          )}

          {/* PAYMENT VOUCHER SUMMARY */}
          {voucherData.type === VoucherType.PAYMENT && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center">
                <span>Payment Disbursal Breakdown</span>
                <span>{items.length} Debit Head(s)</span>
              </h3>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl mb-2 text-xs">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Disbursed From (Cash / Bank Source): </span>
                <span className="font-bold text-rose-600 dark:text-rose-400 uppercase">{bankAccount?.name || 'N/A'}</span>
              </div>
              {items.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b dark:border-slate-800 text-[9px] font-bold text-slate-400 uppercase">
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Debit Account (Paid To)</th>
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-3 text-right">Amount ({currency})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-800">
                      {items.map((it: any, i: number) => {
                        const debAcc = accounts.find(a => a.id === it.accountId);
                        return (
                          <tr key={i}>
                            <td className="py-2.5 px-3 font-mono text-slate-400">{i + 1}</td>
                            <td className="py-2.5 px-3 font-bold uppercase">{debAcc?.name || 'N/A'}</td>
                            <td className="py-2.5 px-3 italic text-slate-500">{it.description || '-'}</td>
                            <td className="py-2.5 px-3 text-right font-orbitron font-bold text-rose-600">
                              {Number(it.amount || 0).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TICKET / PACKAGE / ALL-IN-ONE VOUCHERS SUMMARY */}
          {(voucherData.type === VoucherType.TICKET || voucherData.type === VoucherType.PACKAGE || voucherData.type === VoucherType.ALL_IN_ONE) && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800 pb-3">
                Service Breakdown & Travel Particulars
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                {voucherData.details?.paxName && (
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Passenger Name</p>
                    <p className="font-bold text-slate-900 dark:text-white uppercase">{voucherData.details.paxName}</p>
                  </div>
                )}
                {voucherData.details?.passportNumber && (
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Passport Number</p>
                    <p className="font-bold text-slate-900 dark:text-white uppercase font-mono">{voucherData.details.passportNumber}</p>
                  </div>
                )}
                {voucherData.details?.airline && (
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Airline / Sector</p>
                    <p className="font-bold text-slate-900 dark:text-white uppercase">{voucherData.details.airline} ({voucherData.details.sector || '-'})</p>
                  </div>
                )}
                {voucherData.reference && (
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">PNR / Ticket Ref</p>
                    <p className="font-bold text-cyan-600 dark:text-cyan-400 font-orbitron uppercase">{voucherData.reference}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Master Narrative */}
          {voucherData.description && (
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Transaction Narrative / Remarks</p>
              <p className="font-medium italic text-slate-700 dark:text-slate-300">"{voucherData.description}"</p>
            </div>
          )}

          {/* 4. Financial Accounting Summary Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white p-6 md:p-8 rounded-[2rem] border border-white/10 shadow-xl space-y-6">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em]">Financial Audit Summary</span>
                <h4 className="text-xl font-orbitron font-bold mt-0.5">Grand Ledger Balance Posting</h4>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Currency Engine</span>
                <span className="text-sm font-bold font-mono px-3 py-1 bg-white/10 rounded-xl">
                  {currency} {currency === Currency.SAR ? `@ ROE ${roe}` : '(Domestic)'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer Debit Amount</p>
                <p className="text-2xl font-orbitron font-extrabold text-blue-400 mt-1">
                  PKR {totalPKR.toLocaleString()}
                </p>
                {currency === Currency.SAR && (
                  <p className="text-xs text-slate-400 font-mono mt-1">
                    ({currency} {originalTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })})
                  </p>
                )}
              </div>

              <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vendor Credit / Disbursal</p>
                <p className="text-2xl font-orbitron font-extrabold text-amber-400 mt-1">
                  PKR {totalPKR.toLocaleString()}
                </p>
                {currency === Currency.SAR && (
                  <p className="text-xs text-slate-400 font-mono mt-1">
                    ({currency} {originalTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })})
                  </p>
                )}
              </div>

              <div className="bg-emerald-500/10 p-5 rounded-2xl border border-emerald-500/20 text-right">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Posting Balance (PKR)</p>
                <p className="text-3xl font-orbitron font-black text-emerald-400 mt-1">
                  Rs {totalPKR.toLocaleString()}
                </p>
                <p className="text-[9px] font-bold text-emerald-300/60 uppercase mt-1">Balanced Double-Entry</p>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Action Bar */}
        <div className="bg-white dark:bg-slate-900 px-6 md:px-8 py-5 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-left hidden sm:block">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status Checklist</p>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {hasCriticalErrors ? (
                <span className="text-rose-600 flex items-center gap-1 font-bold">🚫 Save Blocked — Fix Errors First</span>
              ) : validationResult.warnings.length > 0 ? (
                <span className="text-amber-600 flex items-center gap-1 font-bold">⚠️ Notice Active — Ready to Confirm</span>
              ) : (
                <span className="text-emerald-600 flex items-center gap-1 font-bold">🟢 100% Clean — Ready to Save</span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center space-x-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-2xl uppercase text-[11px] tracking-wider transition-all"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onEdit}
              className="px-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl uppercase text-[11px] tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <span>✏️</span> Edit Voucher
            </button>

            <button
              type="button"
              disabled={hasCriticalErrors || isSaving}
              onClick={onConfirm}
              className={`px-8 py-3.5 font-orbitron font-bold rounded-2xl uppercase text-[11px] tracking-[0.15em] shadow-xl transition-all flex items-center gap-2 ${
                hasCriticalErrors || isSaving
                  ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 active:scale-95'
              }`}
            >
              <span>{isSaving ? '⏳' : '✅'}</span>
              <span>{isSaving ? 'Saving...' : 'Confirm & Save'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
