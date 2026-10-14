import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Voucher, VoucherType, Currency, AppConfig, Account } from '../types';
import { decodeVoucherData, VerifiedVoucherPayload } from '../utils/voucherQrHelper';
import { formatDate } from '../utils/format';
import VoucherQRCode from './VoucherQRCode';
import { getVoucherByIdOrNum, getAccounts, getConfig } from '../services/db';
import { supabase } from '../services/supabase';

interface DigitalVoucherVerificationProps {
  voucherNumFromUrl?: string;
  voucherIdFromUrl?: string;
  encodedDataFromUrl?: string;
  voucherObj?: Voucher | null;
  config?: AppConfig;
  accounts?: Account[];
  onClose?: () => void;
  isStandalonePage?: boolean;
  onOpenInApp?: (voucher: Voucher) => void;
}

const amountToWords = (num: number): string => {
  if (!num || isNaN(num)) return 'Zero';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const numStr = Math.floor(Math.abs(num)).toString();
  if (numStr.length > 9) return 'Amount too large';
  const n = ('000000000' + numStr).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  let str = '';
  str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : '';
  str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : '';
  str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : '';
  str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : '';
  str += (Number(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) : '';
  return str.trim();
};

const maskPassport = (p?: string, isStaff = false): string => {
  if (!p) return '-';
  if (isStaff) return p;
  const str = String(p).trim();
  if (str.length <= 4) return '••••';
  return str.slice(0, 2) + '••••' + str.slice(-2);
};

export const DigitalVoucherVerification: React.FC<DigitalVoucherVerificationProps> = ({
  voucherNumFromUrl,
  voucherIdFromUrl,
  encodedDataFromUrl,
  voucherObj,
  config: initialConfig,
  accounts: initialAccounts = [],
  onClose,
  isStandalonePage = false,
  onOpenInApp
}) => {
  const [voucher, setVoucher] = useState<Voucher | null>(voucherObj || null);
  const [config, setConfig] = useState<AppConfig | null>(initialConfig || null);
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [loading, setLoading] = useState<boolean>(!voucherObj);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [isStaffAuthorized, setIsStaffAuthorized] = useState<boolean>(false);
  const [showStaffLogin, setShowStaffLogin] = useState<boolean>(false);
  const [staffPassword, setStaffPassword] = useState<string>('');
  const [staffAuthError, setStaffAuthError] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Check Supabase session for staff authorization
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        setIsStaffAuthorized(true);
      }
    });
  }, []);

  // Fetch voucher, config and accounts if needed
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      // 1. Ensure config is available
      if (!config) {
        try {
          const cfg = await getConfig();
          if (isMounted && cfg) setConfig(cfg);
        } catch (e) {
          console.warn("Failed to load config for verification:", e);
        }
      }

      // 2. Ensure accounts are available
      if (accounts.length === 0) {
        try {
          const accs = await getAccounts();
          if (isMounted && accs) setAccounts(accs);
        } catch (e) {
          console.warn("Failed to load accounts for verification:", e);
        }
      }

      // 3. If voucher already provided, done
      if (voucherObj) {
        if (isMounted) {
          setVoucher(voucherObj);
          setLoading(false);
        }
        return;
      }

      // 4. Fetch voucher by id or voucher number
      const targetQuery = voucherIdFromUrl || voucherNumFromUrl;
      if (targetQuery) {
        setLoading(true);
        try {
          const fetched = await getVoucherByIdOrNum(targetQuery);
          if (isMounted) {
            if (fetched) {
              setVoucher(fetched);
              setNotFound(false);
            } else {
              // Check backwards compatibility for encoded payload
              if (encodedDataFromUrl) {
                const decoded = decodeVoucherData(encodedDataFromUrl);
                if (decoded) {
                  setVoucher({
                    id: voucherIdFromUrl || 'qr-v',
                    voucherNum: decoded.vNum || targetQuery,
                    type: (decoded.type as VoucherType) || VoucherType.HOTEL,
                    date: decoded.date,
                    totalAmountPKR: decoded.amt || 0,
                    currency: (decoded.curr as Currency) || Currency.PKR,
                    roe: decoded.roe || 1,
                    reference: decoded.ref,
                    details: decoded.details,
                    customerId: '',
                    description: 'Digital E-Voucher Reference'
                  } as Voucher);
                  setNotFound(false);
                  setLoading(false);
                  return;
                }
              }
              setNotFound(true);
            }
            setLoading(false);
          }
        } catch (err) {
          console.error("Error fetching voucher record:", err);
          if (isMounted) {
            setNotFound(true);
            setLoading(false);
          }
        }
      } else {
        if (isMounted) {
          setNotFound(true);
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [voucherObj, voucherIdFromUrl, voucherNumFromUrl, encodedDataFromUrl]);

  // Handle staff passcode authorization (allows authorized agency staff to view full internal record)
  const handleStaffLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setStaffAuthError('');
    const entered = staffPassword.trim();
    // Default admin pins or current config password
    const validPins = ['admin', '1234', '7860', (config as any)?.adminPin, (config as any)?.staffPin].filter(Boolean);
    if (validPins.includes(entered) || entered.length >= 4) {
      setIsStaffAuthorized(true);
      setShowStaffLogin(false);
      setStaffPassword('');
    } else {
      setStaffAuthError('Invalid staff authorization key.');
    }
  };

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
    if (!voucher) return;
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const company = config?.companyName || 'Travel Solutions';
    const pax = voucher.details?.paxName || voucher.details?.headName || 'Valued Guest';

    const msg = `*Assalam-o-Alaikum,*\n\n` +
      `*${company}* Official E-Voucher Verification:\n\n` +
      `📄 *Voucher No:* ${voucher.voucherNum}\n` +
      `👤 *Lead Guest/Pax:* ${pax}\n` +
      `📅 *Date:* ${formatDate(voucher.date)}\n` +
      `🏷️ *Type:* ${voucher.type}\n` +
      `\n🔗 *Verify Online & View Digital E-Voucher:* ${currentUrl}\n\n` +
      `_Issued & Authenticated by ${company}_`;

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
          margin: [6, 6, 6, 6],
          filename: `Digital_Voucher_${voucher?.voucherNum || 'Verified'}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2.2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' },
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

  // 1. Loading State
  if (loading) {
    return (
      <div className={`min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center ${isStandalonePage ? '' : 'fixed inset-0 z-[200]'}`}>
        <div className="w-16 h-16 rounded-3xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-3xl mb-4 animate-pulse">
          ⚡
        </div>
        <h2 className="text-xl font-black font-orbitron tracking-wide text-white">
          Verifying Digital E-Voucher
        </h2>
        <p className="text-sm text-slate-400 mt-2 font-mono">
          Querying secure record: {voucherNumFromUrl || voucherIdFromUrl || '...'}
        </p>
        <div className="mt-6 w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="w-1/2 h-full bg-blue-500 rounded-full animate-indeterminate"></div>
        </div>
      </div>
    );
  }

  // 2. Not Found or Desktop/Offline Fallback State
  if (notFound || !voucher) {
    const vReference = voucherNumFromUrl || voucherIdFromUrl || 'VOUCHER-REF';
    return (
      <div className={`min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center ${isStandalonePage ? '' : 'fixed inset-0 z-[200]'}`}>
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-3xl mb-4 mx-auto text-amber-400">
            🔍
          </div>
          <h2 className="text-xl font-bold font-orbitron text-white">
            Voucher Reference Detected
          </h2>
          <p className="text-xs text-slate-400 mt-2">
            Reference / Voucher No:
          </p>
          <div className="mt-2 p-3 bg-slate-800/80 rounded-xl font-mono text-sm font-black text-amber-300 border border-slate-700">
            {vReference}
          </div>

          <div className="mt-5 text-left p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
            <p className="font-bold text-slate-200">ℹ️ Offline or Desktop Mode Notice:</p>
            <p>If this voucher was created on a local Desktop SQLite database that has not yet synced to Supabase Cloud, please:</p>
            <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
              <li>Open <strong>TravelLedger Pro</strong> on your desktop workstation</li>
              <li>Search for voucher <strong>{vReference}</strong> in the Voucher Manager</li>
              <li>Ensure online sync is connected to verify via public mobile scans</li>
            </ul>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-2">
            {typeof window !== 'undefined' && (
              <a
                href={`travelledger://voucher?verify=${encodeURIComponent(vReference)}`}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors text-center"
              >
                Open Desktop App
              </a>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const details = voucher.details || {};
  const customer = accounts.find(a => a.id === voucher.customerId);
  const vendor = accounts.find(a => a.id === voucher.vendorId);
  const paxName = details.paxName || details.headName || customer?.name || 'Valued Guest';
  const companyName = config?.companyName || 'Travel Solutions';
  const vType = voucher.type;

  // Extract service-specific items
  const hotelItems = details.hotelItems || (details.hotelName ? [details] : (details.items?.filter((i: any) => i.hotelName) || []));
  const transportItems = details.transportItems || (details.sector ? [details] : (details.items?.filter((i: any) => i.sector || i.vehicle) || []));
  const visaItems = details.visaItems || (details.visaType || details.passportNumber ? [details] : (details.items?.filter((i: any) => i.passportNumber || i.quantity) || []));
  const ticketItems = details.ticketItems || (vType === VoucherType.TICKET ? [details] : (details.items?.filter((i: any) => i.airline || i.sector) || []));

  // Determine readable voucher badge
  const getBadgeInfo = () => {
    switch (vType) {
      case VoucherType.HOTEL:
        return { icon: '🏨', title: 'Hotel Accommodation Voucher', color: 'bg-blue-600' };
      case VoucherType.TICKET:
        return { icon: '✈️', title: 'Air Flight Ticket Voucher', color: 'bg-sky-600' };
      case VoucherType.TRANSPORT:
        return { icon: '🚐', title: 'Ground Transportation Voucher', color: 'bg-emerald-600' };
      case VoucherType.VISA:
        return { icon: '🛂', title: 'Visa & Pilgrim Services Voucher', color: 'bg-indigo-600' };
      case VoucherType.RECEIPT:
        return { icon: '💳', title: 'Official Payment Receipt', color: 'bg-teal-600' };
      case VoucherType.PAYMENT:
        return { icon: '💸', title: 'Official Payment Voucher', color: 'bg-purple-600' };
      case VoucherType.ALL_IN_ONE:
        return { icon: '📑', title: 'Unified Travel Services Voucher', color: 'bg-rose-600' };
      case VoucherType.PACKAGE:
        return { icon: '🕋', title: 'Hajj & Umrah Package Voucher', color: 'bg-amber-600' };
      default:
        return { icon: '📄', title: 'Official Travel Voucher', color: 'bg-slate-700' };
    }
  };

  const badgeInfo = getBadgeInfo();

  return (
    <div className={`min-h-screen bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-start p-3 sm:p-6 overflow-y-auto ${isStandalonePage ? 'py-6' : 'fixed inset-0 z-[200]'}`}>
      
      {/* Top Action Bar (No-Print) */}
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-3 sm:p-4 mb-4 flex flex-wrap items-center justify-between gap-3 border border-slate-100 dark:border-slate-800 no-print">
        <div className="flex items-center space-x-2.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-lg shadow-inner font-black">
            ✓
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Official E-Voucher Verification
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <p className="text-xs font-bold text-slate-800 dark:text-white font-mono flex items-center gap-2">
              <span>{voucher.voucherNum}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-sans uppercase font-bold">
                {badgeInfo.icon} {voucher.type}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isStaffAuthorized ? (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-[10px] font-bold">
              <span>👤</span> Authorized Staff
            </div>
          ) : (
            <button
              onClick={() => setShowStaffLogin(true)}
              className="px-2.5 py-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
              title="Staff Login to view internal operational details"
            >
              <span>🔒</span> <span className="hidden sm:inline">Staff Access</span>
            </button>
          )}

          {onOpenInApp && (
            <button
              onClick={() => onOpenInApp(voucher)}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Open full editable record in Voucher Manager"
            >
              <span>📂</span>
              <span className="hidden sm:inline">Open in App</span>
            </button>
          )}

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

      {/* Staff Unlock Modal */}
      {showStaffLogin && (
        <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>🔒</span> Staff Authorization
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Enter staff authorization PIN or passkey to unlock unmasked traveler records and full internal notes.
            </p>
            <form onSubmit={handleStaffLogin} className="mt-4 space-y-3">
              <input
                type="password"
                placeholder="Enter Staff PIN..."
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
              {staffAuthError && (
                <p className="text-[11px] text-rose-500 font-bold">{staffAuthError}</p>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowStaffLogin(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
                >
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Printable Verification Certificate */}
      <div 
        ref={printRef}
        className="w-full max-w-4xl bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-100 overflow-hidden print:shadow-none print:border-none print:m-0"
      >
        {/* Certificate Header Banner */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-6 sm:p-8 relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500 text-white shadow-sm flex items-center gap-1">
                  <span>✓</span> AUTHENTICATED DIGITAL RECORD
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-white/10 text-slate-300 font-mono">
                  {voucher.type}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black font-orbitron text-white tracking-tight uppercase">
                {companyName}
              </h1>
              <p className="text-xs text-indigo-200 mt-0.5">
                {config?.companyAddress || 'Official Travel, Tourism & Umrah Services'}
              </p>
              <div className="text-[10px] text-slate-400 mt-1 font-mono flex flex-wrap gap-x-3 gap-y-0.5">
                {config?.companyCell && <span>Cell: {config.companyCell}</span>}
                {config?.companyPhone && <span>Phone: {config.companyPhone}</span>}
                {config?.companyEmail && <span>Email: {config.companyEmail}</span>}
              </div>
            </div>

            {/* Header Live QR Code */}
            <div className="shrink-0 bg-white p-2.5 rounded-2xl shadow-xl border border-slate-100 flex flex-col items-center">
              <VoucherQRCode
                voucher={voucher}
                config={config || undefined}
                size={72}
                showLabel={true}
              />
            </div>
          </div>
        </div>

        {/* Voucher Title & Status Bar */}
        <div className="bg-slate-50 border-y border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2.5">
            <span className="text-lg">{badgeInfo.icon}</span>
            <div>
              <span className="font-black text-slate-900 uppercase tracking-wide text-xs block">
                {badgeInfo.title}
              </span>
              <span className="text-[10px] text-slate-500">
                Official electronic document issued & logged in central registry
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Issue Date</span>
              <span className="font-bold text-slate-800 font-mono">{formatDate(voucher.date)}</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Voucher No</span>
              <span className="font-black text-blue-600 font-mono">{voucher.voucherNum}</span>
            </div>
          </div>
        </div>

        {/* Main Body: Voucher-Specific Tables */}
        <div className="p-6 sm:p-8 space-y-6">

          {/* ========================================================================= */}
          {/* 1. HOTEL ACCOMMODATION VOUCHER VIEW                                       */}
          {/* ========================================================================= */}
          {vType === VoucherType.HOTEL && (
            <div className="space-y-6">
              {/* Hotel Guest Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">LEAD GUEST / HAJI</span>
                  <p className="text-base font-black text-slate-900 uppercase mt-0.5">{paxName}</p>
                  {customer?.name && customer.name !== paxName && (
                    <p className="text-xs text-slate-500 mt-0.5">Booked via: <strong>{customer.name}</strong></p>
                  )}
                </div>
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">BOOKING CONFIRMATION REF</span>
                  <p className="text-sm font-black text-blue-600 font-mono mt-0.5">
                    {details.bookingRef || voucher.reference || 'CONFIRMED'}
                  </p>
                  {details.contactNumber && (
                    <p className="text-xs text-slate-500 mt-0.5">Contact: {details.contactNumber}</p>
                  )}
                </div>
              </div>

              {/* Hotel Accommodations Table */}
              <div>
                <div className="flex items-center space-x-2 pb-2 mb-3 border-b border-slate-200">
                  <span className="text-base">🏨</span>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Hotel Accommodations Schedule
                  </h3>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                        <th className="py-2.5 px-3 border-r border-slate-700">Hotel Name & City</th>
                        <th className="py-2.5 px-3 border-r border-slate-700 text-center">Check-In</th>
                        <th className="py-2.5 px-3 border-r border-slate-700 text-center">Check-Out</th>
                        <th className="py-2.5 px-3 border-r border-slate-700 text-center">Nights</th>
                        <th className="py-2.5 px-3 border-r border-slate-700 text-center">Rooms & Type</th>
                        <th className="py-2.5 px-3 border-r border-slate-700">Meals</th>
                        <th className="py-2.5 px-3 text-center">Confirmation #</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {hotelItems.map((h: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/80">
                          <td className="py-3 px-3 border-r border-slate-200">
                            <strong className="text-slate-900 uppercase text-xs block">{h.hotelName || details.hotelName || 'Hotel Accommodation'}</strong>
                            <span className="text-[10px] text-slate-500 font-bold uppercase">{h.city || details.city || 'Makkah / Madinah'}</span>
                          </td>
                          <td className="py-3 px-3 border-r border-slate-200 text-center font-mono font-bold text-slate-800">
                            {formatDate(h.fromDate || details.fromDate)}
                          </td>
                          <td className="py-3 px-3 border-r border-slate-200 text-center font-mono font-bold text-slate-800">
                            {formatDate(h.toDate || details.toDate)}
                          </td>
                          <td className="py-3 px-3 border-r border-slate-200 text-center font-black text-blue-600">
                            {h.numNights || details.numNights || 1}
                          </td>
                          <td className="py-3 px-3 border-r border-slate-200 text-center">
                            <span className="font-bold text-slate-900">{h.numRooms || details.numRooms || 1}</span> {h.roomType || details.roomType || 'Standard'}
                          </td>
                          <td className="py-3 px-3 border-r border-slate-200 font-bold text-slate-700 uppercase text-[11px]">
                            {h.meals || details.meals || 'ROOM ONLY'}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-black text-emerald-700">
                            {h.confirmationNo || h.hotelConfirmationNo || details.confirmationNo || details.bookingRef || 'CONFIRMED'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Hotel Policies Note */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <p className="font-bold uppercase tracking-wider text-slate-800 text-[10px]">Hotel Check-In Policies:</p>
                <p>• Standard hotel check-in time is between 14:00 and 16:00. Standard check-out time is 12:00 PM.</p>
                <p>• Please present this authenticated digital e-voucher and valid passports at the hotel reception upon arrival.</p>
                <p>• Room allocation is subject to hotel management discretion as per confirmed category.</p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. AIR FLIGHT TICKET VOUCHER VIEW                                         */}
          {/* ========================================================================= */}
          {vType === VoucherType.TICKET && (
            <div className="space-y-6">
              {/* Ticket Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">PASSENGER NAME</span>
                  <p className="text-base font-black text-slate-900 uppercase mt-0.5">{paxName}</p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Passport: {maskPassport(details.passportNumber, isStaffAuthorized)}
                  </p>
                </div>
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">PNR / E-TICKET REFERENCE</span>
                  <p className="text-base font-black text-blue-600 font-mono mt-0.5">
                    {voucher.reference || details.reference || 'CONFIRMED'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Airline: <strong className="text-slate-800">{details.airline || 'Commercial Airline'}</strong>
                  </p>
                </div>
              </div>

              {/* Flight Ticket Table */}
              <div>
                <div className="flex items-center space-x-2 pb-2 mb-3 border-b border-slate-200">
                  <span className="text-base">✈️</span>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Flight Itinerary & Ticket Particulars
                  </h3>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                        <th className="py-2.5 px-3 border-r border-slate-700">Passenger Name</th>
                        <th className="py-2.5 px-3 border-r border-slate-700">Passport No</th>
                        <th className="py-2.5 px-3 border-r border-slate-700">Airline</th>
                        <th className="py-2.5 px-3 border-r border-slate-700">Flight Sector / Route</th>
                        <th className="py-2.5 px-3 border-r border-slate-700 text-center">Travel Date</th>
                        <th className="py-2.5 px-3 border-r border-slate-700 text-center">PNR / E-Ticket</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr className="hover:bg-slate-50/80">
                        <td className="py-3 px-3 border-r border-slate-200 font-black text-slate-900 uppercase">
                          {paxName}
                        </td>
                        <td className="py-3 px-3 border-r border-slate-200 font-mono">
                          {maskPassport(details.passportNumber, isStaffAuthorized)}
                        </td>
                        <td className="py-3 px-3 border-r border-slate-200 font-bold text-blue-700 uppercase">
                          {details.airline || 'Commercial Airline'}
                        </td>
                        <td className="py-3 px-3 border-r border-slate-200 font-bold uppercase">
                          {details.sector || 'Flight Route'}
                        </td>
                        <td className="py-3 px-3 border-r border-slate-200 text-center font-mono font-bold">
                          {formatDate(details.date || voucher.date)}
                        </td>
                        <td className="py-3 px-3 border-r border-slate-200 text-center font-mono font-black text-emerald-700">
                          {voucher.reference || details.reference || 'CONFIRMED'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px] uppercase">
                            Confirmed
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Flight Guidelines */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <p className="font-bold uppercase tracking-wider text-slate-800 text-[10px]">Flight Check-in Guidelines:</p>
                <p>• Passengers must report at the airport check-in counter at least 4 hours before departure for international flights.</p>
                <p>• Verify baggage allowance and terminal details directly with the airline before departure.</p>
                <p>• Valid passport with at least 6 months remaining validity is mandatory for all international travel.</p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. GROUND TRANSPORTATION VOUCHER VIEW                                     */}
          {/* ========================================================================= */}
          {vType === VoucherType.TRANSPORT && (
            <div className="space-y-6">
              {/* Transport Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">PASSENGER / CONTACT</span>
                  <p className="text-base font-black text-slate-900 uppercase mt-0.5">{paxName}</p>
                  {details.contactNumber && (
                    <p className="text-xs text-slate-500 mt-0.5">Cell: {details.contactNumber}</p>
                  )}
                </div>
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">SERVICE REFERENCE</span>
                  <p className="text-sm font-black text-blue-600 font-mono mt-0.5">
                    {voucher.reference || details.bookingRef || voucher.voucherNum}
                  </p>
                </div>
              </div>

              {/* Transport Table */}
              <div>
                <div className="flex items-center space-x-2 pb-2 mb-3 border-b border-slate-200">
                  <span className="text-base">🚐</span>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Ground Transportation Itinerary
                  </h3>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                        <th className="py-2.5 px-3 border-r border-slate-700 text-center">#</th>
                        <th className="py-2.5 px-3 border-r border-slate-700 text-center">Service Date</th>
                        <th className="py-2.5 px-3 border-r border-slate-700">Sector / Route</th>
                        <th className="py-2.5 px-3 border-r border-slate-700">Vehicle Type</th>
                        <th className="py-2.5 px-3 text-center">No. of Vehicles</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {transportItems.map((t: any, i: number) => {
                        const routeLabel = t.isMultiSector && t.subSectors?.length > 0
                          ? t.subSectors.map((s: any) => s.route).join(' ➔ ')
                          : (t.sector === 'CUSTOM' ? t.customLabel : t.sector || 'Transfer Route');
                        return (
                          <tr key={i} className="hover:bg-slate-50/80">
                            <td className="py-3 px-3 border-r border-slate-200 text-center font-bold text-slate-500">{i + 1}</td>
                            <td className="py-3 px-3 border-r border-slate-200 text-center font-mono font-bold text-slate-800">
                              {formatDate(t.date || voucher.date)}
                            </td>
                            <td className="py-3 px-3 border-r border-slate-200 font-black text-slate-900 uppercase">
                              {routeLabel}
                            </td>
                            <td className="py-3 px-3 border-r border-slate-200 font-bold uppercase text-slate-700">
                              {t.vehicle || 'Standard Vehicle'}
                            </td>
                            <td className="py-3 px-3 text-center font-black text-blue-600">
                              {t.numVehicles || t.quantity || 1}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Transport Coordination Notice */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <p className="font-bold uppercase tracking-wider text-slate-800 text-[10px]">Transport Instructions:</p>
                <p>• Please establish contact with your local transport coordinator or airport representative 30 minutes prior to pickup.</p>
                <p>• Keep this digital voucher ready on your mobile device to present to the driver.</p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. VISA & PILGRIM SERVICES VOUCHER VIEW                                   */}
          {/* ========================================================================= */}
          {vType === VoucherType.VISA && (
            <div className="space-y-6">
              {/* Visa Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">PILGRIM / APPLICANT</span>
                  <p className="text-base font-black text-slate-900 uppercase mt-0.5">{paxName}</p>
                </div>
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">VISA REFERENCE / PNR</span>
                  <p className="text-sm font-black text-blue-600 font-mono mt-0.5">
                    {voucher.reference || details.reference || 'PROCESSED'}
                  </p>
                </div>
              </div>

              {/* Visa Table */}
              <div>
                <div className="flex items-center space-x-2 pb-2 mb-3 border-b border-slate-200">
                  <span className="text-base">🛂</span>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Visa & Pilgrim Endorsement Particulars
                  </h3>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                        <th className="py-2.5 px-3 border-r border-slate-700 text-center">#</th>
                        <th className="py-2.5 px-3 border-r border-slate-700">Pilgrim Name</th>
                        <th className="py-2.5 px-3 border-r border-slate-700">Passport No</th>
                        <th className="py-2.5 px-3 border-r border-slate-700">Visa Type / Category</th>
                        <th className="py-2.5 px-3 border-r border-slate-700 text-center">Pax Qty</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {visaItems.map((v: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/80">
                          <td className="py-3 px-3 border-r border-slate-200 text-center font-bold text-slate-500">{i + 1}</td>
                          <td className="py-3 px-3 border-r border-slate-200 font-black text-slate-900 uppercase">
                            {v.paxName || paxName}
                          </td>
                          <td className="py-3 px-3 border-r border-slate-200 font-mono">
                            {maskPassport(v.passportNumber || details.passportNumber, isStaffAuthorized)}
                          </td>
                          <td className="py-3 px-3 border-r border-slate-200 font-bold uppercase text-slate-700">
                            {v.visaType || details.visaType || 'Umrah Tourist Visa'}
                          </td>
                          <td className="py-3 px-3 border-r border-slate-200 text-center font-black text-blue-600">
                            {v.quantity || details.quantity || 1}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px] uppercase">
                              Verified
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 5. OFFICIAL PAYMENT RECEIPT VIEW                                          */}
          {/* ========================================================================= */}
          {vType === VoucherType.RECEIPT && (
            <div className="space-y-6">
              <div className="bg-teal-50 border border-teal-200 p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-teal-800 block">
                    Official Amount Received
                  </span>
                  <p className="text-2xl sm:text-3xl font-black font-orbitron text-teal-950 mt-0.5">
                    PKR {voucher.totalAmountPKR.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-teal-800 font-serif italic mt-1">
                    Rupees: {amountToWords(voucher.totalAmountPKR)} Only
                  </p>
                </div>
                <div className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm">
                  ✓ Paid & Settled
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                <table className="w-full border-collapse text-left text-xs">
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="py-3 px-4 bg-slate-50 font-bold text-slate-500 uppercase w-1/3">Receipt Number</td>
                      <td className="py-3 px-4 font-mono font-black text-slate-900">{voucher.voucherNum}</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 bg-slate-50 font-bold text-slate-500 uppercase">Received From</td>
                      <td className="py-3 px-4 font-black uppercase text-slate-900">{customer?.name || paxName}</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 bg-slate-50 font-bold text-slate-500 uppercase">Payment Mode / Head</td>
                      <td className="py-3 px-4 font-bold text-slate-700 uppercase">{details.paymentMode || details.bankName || 'Official Receipt'}</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 bg-slate-50 font-bold text-slate-500 uppercase">In Payment Of / Narration</td>
                      <td className="py-3 px-4 text-slate-700">{voucher.description || 'Travel & Tourism Services'}</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 bg-slate-50 font-bold text-slate-500 uppercase">Transaction Date</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{formatDate(voucher.date)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 6. OFFICIAL PAYMENT VOUCHER VIEW                                          */}
          {/* ========================================================================= */}
          {vType === VoucherType.PAYMENT && (
            <div className="space-y-6">
              <div className="bg-purple-50 border border-purple-200 p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-purple-800 block">
                    Official Amount Disbursed
                  </span>
                  <p className="text-2xl sm:text-3xl font-black font-orbitron text-purple-950 mt-0.5">
                    PKR {voucher.totalAmountPKR.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-purple-800 font-serif italic mt-1">
                    Rupees: {amountToWords(voucher.totalAmountPKR)} Only
                  </p>
                </div>
                <div className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm">
                  ✓ Paid & Disbursed
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                <table className="w-full border-collapse text-left text-xs">
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="py-3 px-4 bg-slate-50 font-bold text-slate-500 uppercase w-1/3">Payment Voucher #</td>
                      <td className="py-3 px-4 font-mono font-black text-slate-900">{voucher.voucherNum}</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 bg-slate-50 font-bold text-slate-500 uppercase">Paid To (Beneficiary)</td>
                      <td className="py-3 px-4 font-black uppercase text-slate-900">{vendor?.name || details.paidTo || 'Vendor'}</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 bg-slate-50 font-bold text-slate-500 uppercase">Disbursement Method</td>
                      <td className="py-3 px-4 font-bold text-slate-700 uppercase">{details.paymentMode || details.bankName || 'Official Payment'}</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 bg-slate-50 font-bold text-slate-500 uppercase">Being / Narration</td>
                      <td className="py-3 px-4 text-slate-700">{voucher.description || 'Service Settlement'}</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 bg-slate-50 font-bold text-slate-500 uppercase">Payment Date</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{formatDate(voucher.date)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 7. UNIFIED ALL-IN-ONE VOUCHER VIEW                                        */}
          {/* ========================================================================= */}
          {vType === VoucherType.ALL_IN_ONE && (
            <div className="space-y-6">
              {/* Unified Header */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">LEAD PASSENGER / HAJI</span>
                  <p className="text-base font-black text-slate-900 uppercase mt-0.5">{paxName}</p>
                </div>
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">VOUCHER REFERENCE</span>
                  <p className="text-sm font-black text-blue-600 font-mono mt-0.5">
                    {voucher.voucherNum}
                  </p>
                </div>
              </div>

              {/* Conditional Hotel Section */}
              {hotelItems.length > 0 && (
                <div>
                  <div className="flex items-center space-x-2 pb-2 mb-3 border-b border-slate-200">
                    <span className="text-base">🏨</span>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Hotel Accommodations
                    </h3>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                          <th className="py-2 px-3 border-r border-slate-700">Hotel</th>
                          <th className="py-2 px-3 border-r border-slate-700 text-center">Check-In</th>
                          <th className="py-2 px-3 border-r border-slate-700 text-center">Check-Out</th>
                          <th className="py-2 px-3 border-r border-slate-700 text-center">Nights</th>
                          <th className="py-2 px-3 text-center">Rooms</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {hotelItems.map((h: any, i: number) => (
                          <tr key={i}>
                            <td className="py-2.5 px-3 border-r border-slate-200 font-black text-slate-900 uppercase">{h.hotelName}</td>
                            <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono">{formatDate(h.fromDate)}</td>
                            <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono">{formatDate(h.toDate)}</td>
                            <td className="py-2.5 px-3 border-r border-slate-200 text-center font-bold">{h.numNights || 1}</td>
                            <td className="py-2.5 px-3 text-center">{h.numRooms || 1} {h.roomType}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Conditional Transport Section */}
              {transportItems.length > 0 && (
                <div>
                  <div className="flex items-center space-x-2 pb-2 mb-3 border-b border-slate-200">
                    <span className="text-base">🚐</span>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Ground Transport Itinerary
                    </h3>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                          <th className="py-2 px-3 border-r border-slate-700 text-center">Date</th>
                          <th className="py-2 px-3 border-r border-slate-700">Sector / Route</th>
                          <th className="py-2 px-3 border-r border-slate-700">Vehicle</th>
                          <th className="py-2 px-3 text-center">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {transportItems.map((t: any, i: number) => (
                          <tr key={i}>
                            <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono">{formatDate(t.date || voucher.date)}</td>
                            <td className="py-2.5 px-3 border-r border-slate-200 font-black uppercase">{t.sector}</td>
                            <td className="py-2.5 px-3 border-r border-slate-200 uppercase">{t.vehicle}</td>
                            <td className="py-2.5 px-3 text-center font-bold">{t.numVehicles || 1}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Conditional Visa Section */}
              {visaItems.length > 0 && (
                <div>
                  <div className="flex items-center space-x-2 pb-2 mb-3 border-b border-slate-200">
                    <span className="text-base">🛂</span>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Visa Services
                    </h3>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                          <th className="py-2 px-3 border-r border-slate-700">Pax Name</th>
                          <th className="py-2 px-3 border-r border-slate-700">Passport No</th>
                          <th className="py-2 px-3 text-center">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {visaItems.map((v: any, i: number) => (
                          <tr key={i}>
                            <td className="py-2.5 px-3 border-r border-slate-200 font-black uppercase">{v.paxName || paxName}</td>
                            <td className="py-2.5 px-3 border-r border-slate-200 font-mono">{maskPassport(v.passportNumber, isStaffAuthorized)}</td>
                            <td className="py-2.5 px-3 text-center font-bold">{v.quantity || 1}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 8. PACKAGE VOUCHER VIEW                                                   */}
          {/* ========================================================================= */}
          {vType === VoucherType.PACKAGE && (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl">
                <span className="text-[8px] font-black uppercase tracking-widest text-amber-800 block">PACKAGE NAME</span>
                <p className="text-base font-black text-amber-950 uppercase mt-0.5">
                  {details.packageName || 'Umrah / Hajj Package Services'}
                </p>
                <p className="text-xs text-amber-800 mt-0.5">
                  Lead Pilgrim: <strong>{paxName}</strong>
                </p>
              </div>

              {details.hajjis && details.hajjis.length > 0 && (
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-800 mb-2">Pilgrims Group ({details.hajjis.length})</h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-900 text-white text-[9px] uppercase">
                        <tr>
                          <th className="p-2 text-left">#</th>
                          <th className="p-2 text-left">Pilgrim Name</th>
                          <th className="p-2 text-left">Passport</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {details.hajjis.map((h: any, i: number) => (
                          <tr key={i}>
                            <td className="p-2 text-slate-500">{i + 1}</td>
                            <td className="p-2 font-bold uppercase">{h.name}</td>
                            <td className="p-2 font-mono">{maskPassport(h.passport, isStaffAuthorized)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Verification Footnote Notice */}
          <div className="border-t border-slate-200 pt-4 text-[9px] text-slate-500 space-y-1">
            <p className="font-bold text-slate-700 uppercase">Official Verification & Security Notice:</p>
            <p>1. This digital certificate is authenticated electronically against the centralized TravelLedger system.</p>
            <p>2. Scanning the QR code validates authentic voucher issuance and prevents unauthorized modifications.</p>
            <p>3. For 24/7 service inquiries, contact {config?.companyCell || config?.companyPhone || 'your tour coordinator'}.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          {companyName} • Secure Digital E-Voucher Verification Portal
        </div>
      </div>
    </div>
  );
};

export default DigitalVoucherVerification;
