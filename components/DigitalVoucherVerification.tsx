import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Voucher, VoucherType, Currency, AppConfig, Account } from '../types';
import { decodeVoucherData, VerifiedVoucherPayload, getVoucherVerificationUrl } from '../utils/voucherQrHelper';
import { formatCurrency, formatDate } from '../utils/format';
import VoucherQRCode from './VoucherQRCode';

interface DigitalVoucherVerificationProps {
  voucherNumFromUrl?: string;
  voucherIdFromUrl?: string;
  encodedDataFromUrl?: string;
  voucherObj?: Voucher | null;
  config: AppConfig;
  accounts?: Account[];
  onClose?: () => void;
  isStandalonePage?: boolean;
}

export const DigitalVoucherVerification: React.FC<DigitalVoucherVerificationProps> = ({
  voucherNumFromUrl,
  voucherIdFromUrl,
  encodedDataFromUrl,
  voucherObj,
  config,
  accounts = [],
  onClose,
  isStandalonePage = false
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Decode data if provided via URL
  const decodedPayload: VerifiedVoucherPayload | null = useMemo(() => {
    if (encodedDataFromUrl) {
      return decodeVoucherData(encodedDataFromUrl);
    }
    return null;
  }, [encodedDataFromUrl]);

  // Consolidate voucher details
  const displayData = useMemo(() => {
    if (voucherObj) {
      const cust = accounts.find(a => a.id === voucherObj.customerId);
      return {
        voucherNum: voucherObj.voucherNum,
        type: voucherObj.type,
        date: voucherObj.date,
        paxName: voucherObj.details?.paxName || voucherObj.details?.headName || 'N/A',
        customerName: cust?.name || 'N/A',
        amountPKR: voucherObj.totalAmountPKR || 0,
        currency: voucherObj.currency || Currency.PKR,
        roe: voucherObj.roe || 1,
        reference: voucherObj.reference || voucherObj.details?.bookingRef || 'N/A',
        details: voucherObj.details || {},
        isOriginal: true,
        voucherInstance: voucherObj
      };
    }

    if (decodedPayload) {
      return {
        voucherNum: decodedPayload.vNum || voucherNumFromUrl || 'VERIFIED-VOUCHER',
        type: (decodedPayload.type as VoucherType) || VoucherType.HOTEL,
        date: decodedPayload.date,
        paxName: decodedPayload.pax || 'N/A',
        customerName: decodedPayload.cust || 'Valued Guest',
        amountPKR: decodedPayload.amt || 0,
        currency: (decodedPayload.curr as Currency) || Currency.PKR,
        roe: decodedPayload.roe || 1,
        reference: decodedPayload.ref || 'N/A',
        details: decodedPayload.details || {},
        isOriginal: false,
        voucherInstance: {
          id: voucherIdFromUrl || 'qr-v',
          voucherNum: decodedPayload.vNum,
          type: decodedPayload.type as VoucherType,
          date: decodedPayload.date,
          totalAmountPKR: decodedPayload.amt || 0,
          currency: (decodedPayload.curr as Currency) || Currency.PKR,
          roe: decodedPayload.roe || 1,
          reference: decodedPayload.ref,
          details: decodedPayload.details,
          customerId: '',
          description: 'Verified via QR Code'
        } as Voucher
      };
    }

    return null;
  }, [voucherObj, decodedPayload, voucherNumFromUrl, voucherIdFromUrl, accounts]);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const currentUrl = window.location.href;
      navigator.clipboard.writeText(currentUrl).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      });
    }
  };

  const handleWhatsAppShare = () => {
    if (!displayData) return;
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const msg = `*Assalam-o-Alaikum,*\n\n` +
      `*${config.companyName || 'Travel Solutions'}* Official E-Voucher Verification:\n\n` +
      `📄 *Voucher No:* ${displayData.voucherNum}\n` +
      `👤 *Passenger:* ${displayData.paxName}\n` +
      `📅 *Date:* ${formatDate(displayData.date)}\n` +
      `🏷️ *Type:* ${displayData.type}\n` +
      (displayData.amountPKR ? `💰 *Amount:* PKR ${displayData.amountPKR.toLocaleString()}\n` : '') +
      `\n🔗 *Verify Online & View E-Voucher:* ${currentUrl}\n\n` +
      `_Issued & Authenticated by ${config.companyName || 'Travel Solutions'}_`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const handlePrintPDF = async () => {
    if (typeof window === 'undefined') return;
    setIsExportingPDF(true);
    try {
      // @ts-ignore
      if (window.html2pdf && printRef.current) {
        const opt = {
          margin: [8, 8, 8, 8],
          filename: `Verified_Voucher_${displayData?.voucherNum || 'EVoucher'}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2.5, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        // @ts-ignore
        await window.html2pdf().set(opt).from(printRef.current).save();
      } else {
        window.print();
      }
    } catch (e) {
      console.error(e);
      window.print();
    } finally {
      setIsExportingPDF(false);
    }
  };

  if (!displayData) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-3xl mb-4">
          ⚠️
        </div>
        <h1 className="text-2xl font-bold font-orbitron">Voucher Record Not Found</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-md">
          Unable to locate or verify this voucher from the QR payload. Please verify that the link or QR code scanned is correct.
        </p>
        {onClose && (
          <button
            onClick={onClose}
            className="mt-6 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  const { details } = displayData;
  const hotelItems = details.hotelItems || (details.hotelName ? [details] : (details.items?.filter((i: any) => i.hotelName) || []));
  const transportItems = details.transportItems || (details.sector ? [details] : (details.items?.filter((i: any) => i.sector || i.vehicle) || []));
  const visaItems = details.visaItems || (details.visaType || details.passportNumber ? [details] : (details.items?.filter((i: any) => i.passportNumber || i.quantity) || []));

  return (
    <div className={`min-h-screen bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-start p-3 sm:p-6 overflow-y-auto ${isStandalonePage ? 'py-8' : 'fixed inset-0 z-[200]'}`}>
      
      {/* Top Action Bar (No-Print) */}
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-3 sm:p-4 mb-4 flex flex-wrap items-center justify-between gap-3 border border-slate-100 dark:border-slate-800 no-print">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-lg shadow-inner font-black">
            ✓
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Official E-Voucher Verification
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <p className="text-xs font-bold text-slate-800 dark:text-white font-mono">
              {displayData.voucherNum}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopyLink}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            title="Copy Verification Link"
          >
            <span>{copiedLink ? '✅' : '🔗'}</span>
            <span className="hidden sm:inline">{copiedLink ? 'Copied!' : 'Copy Link'}</span>
          </button>

          <button
            onClick={handleWhatsAppShare}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            title="Share via WhatsApp"
          >
            <span>💬</span>
            <span className="hidden sm:inline">WhatsApp</span>
          </button>

          <button
            onClick={handlePrintPDF}
            disabled={isExportingPDF}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
            title="Download / Print PDF"
          >
            <span>{isExportingPDF ? '⏳' : '📥'}</span>
            <span>{isExportingPDF ? 'Saving...' : 'PDF'}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors text-sm"
              title="Close"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Printable Verification Card */}
      <div 
        ref={printRef}
        className="w-full max-w-3xl bg-white text-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden print:shadow-none print:border-none print:m-0"
      >
        {/* Certificate Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center pr-6 select-none pointer-events-none text-9xl">
            ✈️
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500 text-white shadow-sm flex items-center gap-1">
                  <span>✓</span> AUTHENTICATED
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-white/10 text-slate-300 font-mono">
                  {displayData.type}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black font-orbitron text-white tracking-tight uppercase">
                {config.companyName || 'Hashmi Travel Solutions'}
              </h1>
              <p className="text-xs text-indigo-200 mt-0.5">
                {config.companyAddress || 'Official Travel & Umrah Services System'}
              </p>
              <p className="text-[10px] text-slate-400 mt-1 font-mono">
                Cell: {config.companyCell || '0334 3666777'} • Phone: {config.companyPhone || '-'} • Email: {config.companyEmail || '-'}
              </p>
            </div>

            {/* Live QR Code Box */}
            <div className="shrink-0 bg-white p-2 rounded-2xl shadow-lg border border-slate-100 flex flex-col items-center">
              <VoucherQRCode
                voucher={displayData.voucherInstance}
                config={config}
                size={70}
                showLabel={true}
              />
            </div>
          </div>
        </div>

        {/* Status & Key Overview Bar */}
        <div className="bg-emerald-50 border-y border-emerald-100 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-emerald-600 font-black text-sm">🛡️</span>
            <div>
              <span className="font-black text-emerald-900 uppercase tracking-wide text-[11px] block">
                Digital Voucher Authenticated
              </span>
              <span className="text-[10px] text-emerald-700">
                This document is verified and officially logged in the system.
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Issue Date</span>
            <span className="font-bold text-slate-800">{formatDate(displayData.date)}</span>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 sm:p-8 space-y-6">

          {/* Primary Reference & Passenger Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                Passenger / Haji Name
              </span>
              <p className="text-base font-black text-slate-900 uppercase mt-0.5">
                {displayData.paxName}
              </p>
              {details.contactNumber && (
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  Contact: {details.contactNumber}
                </p>
              )}
            </div>

            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                Voucher & Reference
              </span>
              <p className="text-sm font-black text-blue-600 font-mono mt-0.5">
                Voucher #: {displayData.voucherNum}
              </p>
              <p className="text-xs text-slate-600 font-bold mt-0.5">
                Booking Ref / PNR: <span className="font-mono text-slate-900">{displayData.reference}</span>
              </p>
            </div>
          </div>

          {/* Hotel Accommodations Breakdown */}
          {hotelItems && hotelItems.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 pb-2 mb-3 border-b border-slate-200">
                <span className="text-base">🏨</span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Hotel Accommodations ({hotelItems.length})
                </h3>
              </div>
              <div className="space-y-3">
                {hotelItems.map((h: any, idx: number) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Hotel Name</span>
                        {(h.confirmationNo || h.hotelConfirmationNo) && (
                          <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 uppercase font-mono">
                            Conf #: {h.confirmationNo || h.hotelConfirmationNo}
                          </span>
                        )}
                      </div>
                      <h4 className="font-black text-slate-900 text-sm uppercase mt-0.5">{h.hotelName || 'Hotel Accommodation'}</h4>
                      <p className="text-[11px] text-slate-500 font-bold mt-0.5 uppercase">
                        {h.city || 'Makkah / Madinah'} • {h.roomType || 'Standard Room'} {h.meals ? `• Meals: ${h.meals}` : ''}
                      </p>
                    </div>
                    <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Duration</span>
                      <p className="font-bold text-slate-800">
                        {formatDate(h.fromDate)} &rarr; {formatDate(h.toDate)}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                        {h.numRooms || 1} Room(s) • {h.numNights || 1} Night(s)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transport & Sectors Breakdown */}
          {transportItems && transportItems.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 pb-2 mb-3 border-b border-slate-200">
                <span className="text-base">🚐</span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Transport Itinerary & Movements
                </h3>
              </div>
              <div className="space-y-2">
                {transportItems.map((t: any, idx: number) => (
                  <div key={idx} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                    <div>
                      <span className="font-black text-slate-900 uppercase">
                        {t.isMultiSector && t.subSectors?.length > 0 
                          ? t.subSectors.map((s: any) => s.route).join(' ➔ ')
                          : (t.sector === 'CUSTOM' ? t.customLabel : t.sector || 'Transfer Service')}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Vehicle: <strong className="text-slate-700 uppercase">{t.vehicle || 'Standard'}</strong> • Vehicles: <strong>{t.numVehicles || 1}</strong>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                        Date: {formatDate(t.date || displayData.date)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visa Services Breakdown */}
          {visaItems && visaItems.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 pb-2 mb-3 border-b border-slate-200">
                <span className="text-base">🛂</span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Visa & Pilgrim Details
                </h3>
              </div>
              <div className="space-y-2">
                {visaItems.map((v: any, idx: number) => (
                  <div key={idx} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-black text-slate-900 uppercase">{v.paxName || displayData.paxName}</span>
                      {v.passportNumber && (
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">Passport: {v.passportNumber}</p>
                      )}
                    </div>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                      Qty: {v.quantity || 1} Pax
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Financial / Payment Summary (If Financial / Invoice Voucher) */}
          {displayData.amountPKR > 0 && (
            <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300 block">
                  Total Settlement Amount
                </span>
                <p className="text-xl sm:text-2xl font-black font-orbitron text-white mt-0.5">
                  PKR {displayData.amountPKR.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                </p>
                {displayData.currency === Currency.SAR && (
                  <p className="text-xs text-indigo-200 font-mono">
                    Approx SAR {(displayData.amountPKR / (displayData.roe || 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })} (ROE: {displayData.roe})
                  </p>
                )}
              </div>
              <div className="px-3.5 py-1.5 bg-white/10 rounded-xl text-[10px] font-mono text-indigo-200">
                Status: Settled / Logged
              </div>
            </div>
          )}

          {/* Important Notice & Terms */}
          <div className="border-t border-slate-200 pt-4 text-[9px] text-slate-500 space-y-1">
            <p className="font-bold text-slate-700 uppercase">Verification Notice:</p>
            <p>1. This digital certificate is authenticated electronically against the agency records.</p>
            <p>2. Please present this QR code or printed e-voucher to the service provider (hotel/transport representative) upon check-in.</p>
            <p>3. For 24/7 passenger assistance, please contact {config.companyCell || config.companyPhone || 'your tour coordinator'}.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          {config.companyName || 'Hashmi Travel Solutions'} • Enterprise E-Voucher Portal
        </div>
      </div>
    </div>
  );
};

export default DigitalVoucherVerification;
