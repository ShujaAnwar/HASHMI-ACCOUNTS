
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { VoucherType, Currency, AccountType, Voucher, VoucherStatus, Account, AppConfig } from '../types';
import { formatDate } from '../utils/format';
import { getAccounts, getVouchers, getConfig } from '../services/db';
import { AccountingService } from '../services/AccountingService';
import PaymentVoucherForm from './PaymentVoucherForm';
import ReceiptVoucherForm from './ReceiptVoucherForm';
import TransportVoucherForm from './TransportVoucherForm';
import VisaVoucherForm from './VisaVoucherForm';
// Removed duplicate import of HotelVoucherForm
import HotelVoucherForm from './HotelVoucherForm';
import TicketVoucherForm from './TicketVoucherForm';

const amountToWords = (num: number): string => {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const numStr = Math.floor(num).toString();
  if (numStr.length > 9) return 'Amount too large';
  let n = ('000000000' + numStr).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  let str = '';
  str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (Number(n[5]) != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + ' ' : '';
  return str.trim() + ' PKR Only';
};

interface VouchersProps {
  config: AppConfig;
  refreshKey?: number;
  externalIntent?: { type: 'EDIT' | 'VIEW', voucher: Voucher } | null;
  clearIntent?: () => void;
}

const Vouchers: React.FC<VouchersProps> = ({ config, refreshKey: globalRefreshKey, externalIntent, clearIntent }) => {
  const [activeType, setActiveType] = useState<VoucherType>(VoucherType.HOTEL);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'CREATE' | 'EDIT' | 'CLONE'>('CREATE');
  const [viewingVoucher, setViewingVoucher] = useState<Voucher | null>(null);
  const [inspectorView, setInspectorView] = useState<'OFFICIAL' | 'PKR' | 'SAR' | 'SERVICE'>('OFFICIAL');
  const [voucherToEdit, setVoucherToEdit] = useState<Voucher | null>(null);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allVouchers, setAllVouchers] = useState<Voucher[]>([]);
  const [selectedVoucherIds, setSelectedVoucherIds] = useState<string[]>([]);

  const voucherRef = useRef<HTMLDivElement>(null);
  
  const toggleSelection = (id: string) => {
    setSelectedVoucherIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedVoucherIds.length === 0) return;
    if (window.confirm(`Delete ${selectedVoucherIds.length} vouchers?`)) {
      setIsSaving(true);
      try {
        await AccountingService.deleteVouchers(selectedVoucherIds);
        setSelectedVoucherIds([]);
        setLocalRefreshKey(prev => prev + 1);
      } catch (err) {
        console.error("Bulk Delete Error:", err);
        alert("Failed to delete some vouchers.");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const fetchVoucherData = useCallback(async () => {
    const [accs, vchs] = await Promise.all([
      getAccounts(),
      getVouchers()
    ]);
    setAccounts(accs);
    setAllVouchers(vchs);
  }, []);

  useEffect(() => {
    fetchVoucherData();
  }, [globalRefreshKey, localRefreshKey, showForm, fetchVoucherData]);

  useEffect(() => {
    if (externalIntent) {
      if (externalIntent.type === 'EDIT') handleEdit(externalIntent.voucher);
      else if (externalIntent.type === 'VIEW') {
        setActiveType(externalIntent.voucher.type);
        setViewingVoucher(externalIntent.voucher);
        setInspectorView('SERVICE'); 
      }
      if (clearIntent) clearIntent();
    }
  }, [externalIntent]);

  const handleEdit = (v: Voucher) => { 
    setActiveType(v.type); 
    setFormMode('EDIT'); 
    setVoucherToEdit(v); 
    setShowForm(true); 
  };

  const handleClone = (v: Voucher) => { 
    setActiveType(v.type); 
    setFormMode('CLONE'); 
    setVoucherToEdit(v); 
    setShowForm(true); 
  };
  
  const handleDelete = async (id: string) => { 
    if (window.confirm('Delete voucher?')) { 
      await AccountingService.deleteVoucher(id); 
      setLocalRefreshKey(prev => prev + 1); 
      setViewingVoucher(null); 
    } 
  };

  const handleSave = async (data: any) => {
    setIsSaving(true);
    try {
      if (formMode === 'EDIT' && voucherToEdit) {
        await AccountingService.updateVoucher(voucherToEdit.id, data);
      } else {
        await AccountingService.postVoucher(data);
      }
      setShowForm(false);
      setVoucherToEdit(null);
      setLocalRefreshKey(prev => prev + 1);
    } catch (error: any) {
      console.error("Voucher Save Error:", error);
      alert(`Failed to save voucher: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredVouchers = useMemo(() => {
    return allVouchers.filter(v => v.type === activeType);
  }, [allVouchers, activeType]);

  const formatMeals = (meals: any) => {
    if (Array.isArray(meals)) return meals.join(', ');
    if (typeof meals === 'string') return meals;
    return 'NONE';
  };

  const getDetailedNarrative = (v: Voucher) => {
    if (!v.details) return v.description;
    
    switch (v.type) {
      case VoucherType.HOTEL:
        const hItems = v.details.items || [];
        const firstHItem = hItems[0] || {};
        const pax = (v.details.paxName || firstHItem.paxName || 'N/A').toUpperCase();
        
        if (hItems.length > 0) {
          const hSummary = hItems.map((i: any) => `${i.hotelName} (${i.city})`).join(' | ');
          return `${pax} | ${hSummary.toUpperCase()}`;
        }
        const hotel = (v.details.hotelName || 'N/A').toUpperCase();
        const ci = v.details.fromDate || '-';
        const co = v.details.toDate || '-';
        const rb = v.details.numRooms || '0';
        const ngt = v.details.numNights || '0';
        const loc = v.details.city || 'N/A';
        const countrySuffix = (loc.toLowerCase().includes('makkah') || loc.toLowerCase().includes('madinah') || loc.toLowerCase().includes('jeddah')) ? '-KSA' : '';
        return `${pax} | ${hotel} |Checkin: ${ci} | Checkout: ${co} | R/B: ${rb} | Nights:${ngt} | ${loc.toUpperCase()} ${countrySuffix}`;
      case VoucherType.TRANSPORT:
        const tPax = v.details.paxName || '-';
        const tItems = v.details.items || [];
        const tSummary = tItems.map((i: any) => {
          if (i.isMultiSector && i.subSectors?.length > 0) {
            return i.subSectors.map((s: any) => s.route).join(' → ');
          }
          return `${i.sector === 'CUSTOM' ? i.customLabel : i.sector} (${i.vehicle})`;
        }).join(' | ');
        return `${tPax.toUpperCase()} | ${tSummary.toUpperCase()}`;
      case VoucherType.VISA:
        const vItems = v.details.items || [];
        const itemsSummary = vItems.map((i: any) => `${i.paxName || 'N/A'} (${i.passportNumber || 'N/A'})`).join(', ');
        return `Visa: ${itemsSummary} | ${v.description || ''}`;
      case VoucherType.TICKET:
        return `${(v.details.paxName || 'N/A').toUpperCase()} | ${v.details.airline || 'N/A'} | ${v.details.sector || 'N/A'} | PNR: ${v.reference || 'N/A'}`;
      default:
        return v.description;
    }
  };

  const handleDownloadPDF = async () => {
    if (!viewingVoucher || !voucherRef.current) return;
    
    setIsDownloading(true);
    const element = voucherRef.current;
    
    const paxName = viewingVoucher.details?.paxName?.replace(/\s+/g, '_') || 'Guest';
    const voucherNum = viewingVoucher.voucherNum;
    const typeLabel = viewingVoucher.type === VoucherType.HOTEL ? 'HotelVoucher' : 
                     viewingVoucher.type === VoucherType.TRANSPORT ? 'TransportVoucher' : 
                     viewingVoucher.type === VoucherType.VISA ? 'VisaVoucher' : 'Voucher';
    const fileName = `${typeLabel}_${voucherNum}_${paxName}.pdf`;

    const opt = {
      margin: 0,
      filename: fileName,
      image: { type: 'jpeg', quality: 1.0 },
      html2canvas: { scale: 3, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      // @ts-ignore
      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error("PDF Export Error:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleWhatsAppShare = async () => {
    if (!viewingVoucher || !voucherRef.current) return;
    
    setIsSharing(true);
    const element = voucherRef.current;
    
    const paxName = viewingVoucher.details?.paxName?.replace(/\s+/g, '_') || 'Guest';
    const voucherNum = viewingVoucher.voucherNum;
    const typeLabel = viewingVoucher.type === VoucherType.HOTEL ? 'HotelVoucher' : 
                     viewingVoucher.type === VoucherType.TRANSPORT ? 'TransportVoucher' : 
                     viewingVoucher.type === VoucherType.VISA ? 'VisaVoucher' : 'Voucher';
    const fileName = `${typeLabel}_${voucherNum}_${paxName}.pdf`;

    const opt = {
      margin: 0,
      filename: fileName,
      image: { type: 'jpeg', quality: 1.0 },
      html2canvas: { scale: 3, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      // @ts-ignore
      const blob = await html2pdf().set(opt).from(element).output('blob');
      const file = new File([blob], fileName, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: fileName,
          text: `Please find the attached ${typeLabel} for ${paxName}.`,
        });
      } else {
        // Fallback for desktop or unsupported browsers
        // Download the file
        // @ts-ignore
        await html2pdf().set(opt).from(element).save();
        
        // Then open WhatsApp
        const message = encodeURIComponent(`I've sent you the ${typeLabel} (${voucherNum}). Please check your downloads and attach the file.`);
        const whatsappUrl = /Android|iPhone|iPad/i.test(navigator.userAgent) 
          ? `whatsapp://send?text=${message}`
          : `https://web.whatsapp.com/send?text=${message}`;
        
        window.open(whatsappUrl, '_blank');
      }
    } catch (err) {
      console.error("WhatsApp Share Error:", err);
    } finally {
      setIsSharing(false);
    }
  };

  const renderOfficialInvoice = (v: Voucher) => {
    const customer = accounts.find(a => a.id === v.customerId);
    const invoiceNum = v.voucherNum.split('-').pop();
    return (
      <div ref={voucherRef} className="bg-white p-8 text-black font-inter h-[295mm] w-[210mm] overflow-hidden flex flex-col box-border">
        <div className="flex justify-between items-start mb-4">
          <div>
            {config?.companyLogo && <img src={config.companyLogo} style={{ height: `${config.logoSize * 0.8}px` }} alt="logo" className="mb-2" />}
          </div>
          <div className="text-center pt-4">
            <h2 className="text-lg font-bold text-[#e11d48] uppercase tracking-tight">{config?.companyName} {config?.appSubtitle}</h2>
          </div>
          <div className="text-right">
            <div className="border-2 border-slate-900 px-6 py-2 text-center min-w-[180px] rounded-sm shadow-sm">
              <p className="font-bold text-[11px] uppercase tracking-wide">
                {v.type === VoucherType.RECEIPT ? 'RECEIPT' : v.type === VoucherType.PAYMENT ? 'PAYMENT' : 'INVOICE'} : {invoiceNum}
              </p>
              <p className="font-bold text-[11px] mt-0.5">(PKR) = {v.totalAmountPKR.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        <div className="mb-4 text-[9px] font-medium text-slate-800 leading-relaxed">
          <p>{config?.companyAddress}</p>
          <p className="mt-0.5">CELL : {config?.companyCell} - PHONE : {config?.companyPhone} - EMAIL : {config?.companyEmail}</p>
          <p className="mt-0.5"><span className="font-bold">Status:</span> Definite Invoice</p>
        </div>

        <div className="mb-4 border border-slate-300">
          <table className="w-full text-center border-collapse">
            <thead className="bg-[#0b7ea1] text-white">
              <tr>
                <th className="py-1.5 px-3 border-r border-slate-400 font-bold uppercase text-[9px]">Account Name:</th>
                <th className="py-1.5 px-3 border-r border-slate-400 font-bold uppercase text-[9px]">
                  {v.type === VoucherType.RECEIPT || v.type === VoucherType.PAYMENT ? 'Voucher Date' : 'Invoice Date'}
                </th>
                <th className="py-1.5 px-3 border-r border-slate-400 font-bold uppercase text-[9px]">
                  {v.type === VoucherType.RECEIPT || v.type === VoucherType.PAYMENT ? 'Currency' : 'Option Date'}
                </th>
                <th className="py-1.5 px-3 font-bold uppercase text-[9px]">
                  {v.type === VoucherType.RECEIPT || v.type === VoucherType.PAYMENT ? 'Reference / PNR' : 'Confirmation #'}
                </th>
              </tr>
            </thead>
            <tbody className="text-[10px] font-bold">
              <tr>
                <td className="py-2 px-3 border-r border-slate-300 uppercase">{customer?.name || 'N/A'}</td>
                <td className="py-2 px-3 border-r border-slate-300">{formatDate(v.date)}</td>
                <td className="py-2 px-3 border-r border-slate-300 uppercase">
                  {v.type === VoucherType.RECEIPT || v.type === VoucherType.PAYMENT ? v.currency : '30, Nov -0001'}
                </td>
                <td className="py-2 px-3 uppercase">
                  {v.reference || 'N/A'}
                  {v.details?.bookingRef && (
                    <div className="text-[8px] text-blue-600 mt-0.5 font-black">
                      REF: {v.details.bookingRef}
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mb-4 border border-slate-300">
          <table className="w-full text-center border-collapse text-[9px]">
            <thead className="bg-[#0b7ea1] text-white">
              {v.type === VoucherType.RECEIPT || v.type === VoucherType.PAYMENT ? (
                <tr>
                  <th className="py-1.5 border-r border-slate-400 font-bold uppercase">Date</th>
                  <th className="py-1.5 border-r border-slate-400 font-bold uppercase">Description / Narration</th>
                  <th className="py-1.5 border-r border-slate-400 font-bold uppercase">
                    {v.type === VoucherType.RECEIPT ? 'Paid From' : 'Paid From (Source)'}
                  </th>
                  <th className="py-1.5 border-r border-slate-400 font-bold uppercase">
                    {v.type === VoucherType.RECEIPT ? 'Received In' : 'Paid To'}
                  </th>
                  <th className="py-1.5 font-bold uppercase">Amount(PKR)</th>
                </tr>
              ) : v.type === VoucherType.VISA ? (
                <tr>
                  <th className="py-1.5 border-r border-slate-400 font-bold uppercase">Pax Name</th>
                  <th className="py-1.5 border-r border-slate-400 font-bold uppercase">Passport Number</th>
                  <th className="py-1.5 border-r border-slate-400 font-bold uppercase">Qty</th>
                  <th className="py-1.5 border-r border-slate-400 font-bold uppercase">Rate ({v.currency})</th>
                  <th className="py-1.5 font-bold uppercase">Amount(PKR)</th>
                </tr>
              ) : v.type === VoucherType.TRANSPORT ? (
                <tr>
                  <th className="py-1.5 border-r border-slate-400 font-bold uppercase">Pax Name</th>
                  <th className="py-1.5 border-r border-slate-400 font-bold uppercase">Sector / Route</th>
                  <th className="py-1.5 border-r border-slate-400 font-bold uppercase">Vehicle</th>
                  <th className="py-1.5 border-r border-slate-400 font-bold uppercase">Rate ({v.currency})</th>
                  <th className="py-1.5 font-bold uppercase">Amount(PKR)</th>
                </tr>
              ) : (
                <tr>
                  <th className="py-1.5 border-r border-slate-400 font-bold uppercase">Pax Name</th>
                  <th className="py-1.5 border-r border-slate-400 font-bold uppercase">Hotel</th>
                  <th className="py-1.5 border-r border-slate-400 font-bold uppercase">Room Type</th>
                  <th className="py-1.5 border-r border-slate-400 font-bold uppercase">Meal</th>
                  <th className="py-1.5 border-r border-slate-400 font-bold uppercase">Destination</th>
                  <th className="py-1.5 border-r border-slate-400 font-bold uppercase">Checkin Checkout</th>
                  <th className="py-1.5 font-bold uppercase">Amount(PKR)</th>
                </tr>
              )}
            </thead>
            <tbody className="text-[9px] font-bold">
              {v.type === VoucherType.RECEIPT ? (
                <tr>
                  <td className="py-3 px-2 border-r border-slate-300 uppercase">
                    {formatDate(v.date)}
                  </td>
                  <td className="py-3 px-2 border-r border-slate-300 uppercase text-left">
                    {v.description || 'N/A'}
                  </td>
                  <td className="py-3 px-2 border-r border-slate-300 uppercase">
                    {accounts.find(a => a.id === v.customerId || a.id === v.vendorId)?.name || 'N/A'}
                  </td>
                  <td className="py-3 px-2 border-r border-slate-300 uppercase">
                    {accounts.find(a => a.id === v.details?.bankId)?.name || 'N/A'}
                  </td>
                  <td className="py-3 px-2 font-black">
                    {v.totalAmountPKR.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ) : v.type === VoucherType.PAYMENT && v.details?.items?.length > 0 ? (
                v.details.items.map((item: any, i: number) => (
                  <tr key={i} className={i > 0 ? 'border-t border-slate-200' : ''}>
                    <td className="py-2 px-2 border-r border-slate-300 uppercase">
                      {formatDate(v.date)}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-300 uppercase text-left">
                      {item.description || v.description}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-300 uppercase">
                      {accounts.find(a => a.id === v.details?.bankId)?.name || 'N/A'}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-300 uppercase">
                      {accounts.find(a => a.id === item.accountId)?.name || 'N/A'}
                    </td>
                    <td className="py-2 px-2 font-black">
                      {(Number(item.amount) * (v.currency === Currency.SAR ? v.roe : 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              ) : v.type === VoucherType.VISA && v.details?.items?.length > 0 ? (
                v.details.items.map((item: any, i: number) => (
                  <tr key={i} className={i > 0 ? 'border-t border-slate-200' : ''}>
                    <td className="py-2 px-2 border-r border-slate-300 uppercase text-left">
                      {item.paxName || 'N/A'}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-300 uppercase">
                      {item.passportNumber || v.details.passportNumber || 'N/A'}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-300">
                      {item.quantity}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-300 font-bold">
                      {Number(item.rate).toLocaleString()}
                    </td>
                    <td className="py-2 px-2 font-black">
                      {(Number(item.quantity) * Number(item.rate) * (v.currency === Currency.SAR ? v.roe : 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              ) : v.type === VoucherType.TRANSPORT && v.details?.items?.length > 0 ? (
                v.details.items.map((item: any, i: number) => (
                  <tr key={i} className={i > 0 ? 'border-t border-slate-200' : ''}>
                    <td className="py-2 px-2 border-r border-slate-300 uppercase text-left">
                      {v.details.paxName || 'N/A'}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-300 uppercase text-left">
                      {item.isMultiSector && item.subSectors?.length > 0 ? (
                        <div className="space-y-0.5 py-1">
                          {item.subSectors.map((sub: any, si: number) => (
                            <div key={si} className="text-[8px] border-b border-slate-50 last:border-0 pb-0.5 whitespace-nowrap">
                              <span className="font-black text-blue-600">{sub.route}</span>
                              <span className="text-slate-400 font-bold ml-1 text-[7px]">({sub.date ? new Date(sub.date).toLocaleDateString('en-GB').replace(/\//g, '-') : ''})</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-1">
                          <span>{item.sector === 'CUSTOM' ? item.customLabel : item.sector}</span>
                          {item.date && (
                            <span className="text-slate-400 font-bold ml-2 text-[7px] lowercase">({new Date(item.date).toLocaleDateString('en-GB').replace(/\//g, '-')})</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-300 uppercase">
                      {item.vehicle}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-300 font-bold">
                      {Number(item.rate).toLocaleString()}
                    </td>
                    <td className="py-2 px-2 font-black">
                      {(Number(item.rate) * (v.currency === Currency.SAR ? v.roe : 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              ) : (v.type === VoucherType.HOTEL && v.details?.items?.length > 0) ? (
                v.details.items.map((item: any, i: number) => (
                  <tr key={i} className={i > 0 ? 'border-t border-slate-200' : ''}>
                    <td className="py-2 px-2 border-r border-slate-300 uppercase">{v.details?.paxName || 'N/A'}</td>
                    <td className="py-2 px-2 border-r border-slate-300 uppercase">{item.hotelName || 'N/A'}</td>
                    <td className="py-2 px-2 border-r border-slate-300 uppercase">
                      {item.roomType || 'N/A'}
                      {item.adults !== undefined && (
                        <div className="text-[8px] opacity-60 mt-0.5 font-bold">
                          {item.adults || 0} ADT / {item.children || 0} CHD
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-300 uppercase">{formatMeals(item.meals)}</td>
                    <td className="py-2 px-2 border-r border-slate-300 uppercase">{item.city || '-'}, {item.country || '-'}</td>
                    <td className="py-2 px-2 border-r border-slate-300 leading-normal">
                      {item.fromDate ? formatDate(item.fromDate) : '-'}<br/>
                      {item.toDate ? formatDate(item.toDate) : '-'}
                    </td>
                    <td className="py-2 px-2 font-black">
                      {(Number(item.unitRate) * Number(item.numRooms) * Number(item.numNights) * (v.currency === Currency.SAR ? v.roe : 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-3 px-2 border-r border-slate-300 uppercase">{v.details?.paxName || v.details?.headName || accounts.find(a => a.id === v.customerId || a.id === v.vendorId)?.name || 'N/A'}</td>
                  <td className="py-3 px-2 border-r border-slate-300 uppercase">{v.details?.hotelName || v.details?.airline || v.description || 'N/A'}</td>
                  <td className="py-3 px-2 border-r border-slate-300 uppercase">
                    {v.details?.roomType || 'N/A'}
                    {v.details?.adults !== undefined && (
                      <div className="text-[8px] opacity-60 mt-0.5 font-bold">
                        {v.details?.adults || 0} ADT / {v.details?.children || 0} CHD
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-2 border-r border-slate-300 uppercase">{formatMeals(v.details?.meals)}</td>
                  <td className="py-3 px-2 border-r border-slate-300 uppercase">{v.details?.city || '-'}, {v.details?.country || '-'}</td>
                  <td className="py-3 px-2 border-r border-slate-300 leading-normal">
                    {v.details?.fromDate ? formatDate(v.details.fromDate) : '-'}<br/>
                    {v.details?.toDate ? formatDate(v.details.toDate) : '-'}
                  </td>
                  <td className="py-3 px-2 font-black">{v.totalAmountPKR.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              )}
              <tr className="bg-slate-50 border-t border-slate-300 font-bold">
                <td colSpan={v.type === VoucherType.RECEIPT || v.type === VoucherType.PAYMENT || v.type === VoucherType.VISA ? 3 : 6} className="py-2 text-right px-8 uppercase text-[9px]">Total:</td>
                <td className="py-2 px-2">PKR {v.totalAmountPKR.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mb-6 text-[10px] font-bold text-slate-900 italic">
          <p>IN WORDS: <span className="uppercase">{amountToWords(v.totalAmountPKR)}</span></p>
          <p className="mt-4 not-italic">On behalf of <span className="text-[#e11d48]">{config?.companyName} {config?.appSubtitle}</span></p>
        </div>

        <div className="mt-auto pt-4">
          <div className="flex justify-between items-end mb-4">
            <div className="text-center">
              <div className="w-40 border-t border-slate-900 pt-1 font-black text-[9px] uppercase tracking-widest">
                Prepared By
              </div>
            </div>
            <div className="text-center">
              <div className="w-40 border-t border-slate-900 pt-1 font-black text-[9px] uppercase tracking-widest">
                Customer Signature
              </div>
            </div>
            <div className="text-center">
              <div className="w-40 border-t border-slate-900 pt-1 font-black text-[9px] uppercase tracking-widest">
                Authorized Stamp
              </div>
            </div>
          </div>
          <h3 className="text-[11px] font-black border-b border-slate-900 pb-1 mb-2 tracking-tight uppercase">Acknowledgement</h3>
          <ol className="text-[8px] space-y-0.5 font-bold text-slate-700 uppercase leading-tight">
            <li>1. ANY INVOICE OBJECTIONS MUST BE SENT TO US WITHIN 3 DAYS OF RECEIPT.</li>
            <li>2. IF PAYMENT'S MADE, DISREGARD THIS INVOICE.</li>
            <li>3. ALL PAYMENTS SHOULD BE MADE AGAINST THE COMPANY ACCOUNTS ONLY.</li>
          </ol>
        </div>
      </div>
    );
  };

  const renderConfirmationLetter = (v: Voucher) => {
    const customer = accounts.find(a => a.id === v.customerId);
    const invoiceNum = v.voucherNum.split('-').pop();
    return (
      <div ref={voucherRef} className="bg-white p-6 text-slate-900 font-inter h-[295mm] w-[210mm] overflow-hidden flex flex-col box-border shadow-none">
        
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col items-center">
            {config?.companyLogo && <img src={config.companyLogo} style={{ height: `45px` }} alt="logo" />}
          </div>
          <div className="text-center pt-2">
            <h1 className="text-xl font-bold text-[#e11d48] uppercase tracking-tight">{config?.companyName} {config?.appSubtitle}</h1>
          </div>
          <div className="text-right">
             <div className="flex items-center justify-end space-x-3 border-b-2 border-slate-300 pb-0.5 mb-1">
                <span className="text-slate-500 font-bold text-[14px]">Invoice #</span>
                <span className="text-slate-900 font-black text-[18px] tracking-tighter">{invoiceNum}</span>
             </div>
             <p className="text-[#0b7ea1] font-black uppercase text-[12px] leading-tight">{v.details?.hotelName}</p>
          </div>
        </div>

        <hr className="border-slate-200 mb-4" />

        <div className="mb-4 text-[11px] leading-relaxed">
          <p>Dear Sir:</p>
          <p className="mt-1.5">Greeting From <span className="text-[#e11d48] font-bold">{config?.companyName} {config?.appSubtitle}</span></p>
          <p className="mt-0.5">We are pleased to confirm the following reservation on a <span className="font-bold">Definite basis .</span></p>
        </div>

        <div className="flex space-x-8 mb-4 items-center bg-slate-50 p-2 rounded-lg">
          <p className="font-bold text-[10px] uppercase tracking-wider text-slate-500 whitespace-nowrap">Account Name:</p>
          <p className="font-black text-[12px] uppercase flex-1 border-b border-slate-400 pb-0.5">{customer?.name}</p>
        </div>

        <table className="w-full text-left mb-4 border-collapse border border-slate-300">
          <thead className="bg-[#bdc3c7] text-slate-700 text-[8px] font-black uppercase tracking-widest">
            <tr>
              <th className="p-1.5 border border-slate-400">Hotel</th>
              <th className="p-1.5 border border-slate-400">Guest Name</th>
              <th className="p-1.5 border border-slate-400">Location</th>
              <th className="p-1.5 border border-slate-400">CONF NO</th>
            </tr>
          </thead>
          <tbody className="text-[9px] uppercase font-bold text-slate-800">
            <tr className="bg-white">
              <td className="p-2 border border-slate-300">{v.details?.hotelName}</td>
              <td className="p-2 border border-slate-300">{v.details?.paxName}</td>
              <td className="p-2 border border-slate-300">{v.details?.city}, {v.details?.country}</td>
              <td className="p-2 border border-slate-300">
                {v.reference || 'N/A'}
                {v.details?.bookingRef && (
                  <div className="text-[8px] text-blue-600 mt-0.5 font-black">
                    REF: {v.details.bookingRef}
                  </div>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        <table className="w-full text-left mb-4 border-collapse border border-slate-300">
          <thead className="bg-[#bdc3c7] text-slate-700 text-[8px] font-black uppercase tracking-widest">
            <tr>
              <th className="p-1.5 border border-slate-400">ROOM TYPE</th>
              <th className="p-1.5 border border-slate-400">MEAL</th>
              <th className="p-1.5 border border-slate-400">CHECK IN</th>
              <th className="p-1.5 border border-slate-400">CHECK OUT</th>
              <th className="p-1.5 border border-slate-400">NIGHT(s)</th>
              <th className="p-1.5 border border-slate-400">ROOM(s)</th>
              <th className="p-1.5 border border-slate-400">TOTAL</th>
            </tr>
          </thead>
          <tbody className="text-[9px] font-bold uppercase text-slate-800">
            <tr className="bg-white">
              <td className="p-2 border border-slate-300">
                {v.details?.roomType}
                <div className="text-[8px] text-slate-500 mt-0.5">
                  {v.details?.adults || 0} ADULTS / {v.details?.children || 0} CHILDREN
                </div>
              </td>
              <td className="p-2 border border-slate-300">{formatMeals(v.details?.meals)}</td>
              <td className="p-2 border border-slate-300 whitespace-nowrap">{v.details?.fromDate ? formatDate(v.details.fromDate) : '-'}</td>
              <td className="p-2 border border-slate-300 whitespace-nowrap">{v.details?.toDate ? formatDate(v.details.toDate) : '-'}</td>
              <td className="p-2 border border-slate-300 text-center">{v.details?.numNights}</td>
              <td className="p-2 border border-slate-300 text-center">{v.details?.numRooms}</td>
              <td className="p-2 border border-slate-300 font-black text-right">PKR {v.totalAmountPKR.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-auto pt-4 text-[9px] font-bold leading-relaxed space-y-1 text-slate-700 uppercase">
           <p className="underline font-black text-slate-900 mb-1 tracking-widest">Notes</p>
           <ul className="list-disc pl-4 space-y-0.5">
             <li>ANY INVOICE OBJECTIONS MUST BE SENT TO US WITHIN 3 DAYS OF RECEIPT.</li>
             <li>ALL PAYMENTS SHOULD BE MADE AGAINST THE COMPANY ACCOUNTS ONLY.</li>
           </ul>
        </div>

        <p className="text-[10px] font-medium text-slate-600 mt-4 pt-2 border-t border-slate-100">
          <span className="font-black text-slate-900">Booking Notes: :</span> Check your Reservation details carefully and inform us immediately.
        </p>
      </div>
    );
  };

  const renderSARQuotation = (v: Voucher) => {
    const customer = accounts.find(a => a.id === v.customerId);
    const totalSAR = v.details?.totalSelectedCurrency || (v.totalAmountPKR / (v.roe || 1));
    const invoiceNum = v.voucherNum.split('-').pop();
    return (
      <div ref={voucherRef} className="bg-white p-8 text-black font-inter h-[295mm] w-[210mm] overflow-hidden flex flex-col box-border">
        <div className="flex justify-center mb-6">
          {config?.companyLogo && <img src={config.companyLogo} style={{ height: `${config.logoSize * 0.8}px` }} alt="logo" />}
        </div>

        <div className="grid grid-cols-2 gap-y-1 mb-4 text-[10px] font-bold uppercase tracking-wide">
          <div className="flex space-x-3"><span>Account Name:</span> <span className="font-black">{customer?.name}</span></div>
          <div className="text-right flex justify-end space-x-3"><span>HVI #:</span> <span className="font-black">{invoiceNum}</span></div>
          <div className="flex space-x-3"><span>Subject:</span> <span className="font-black">Definite Invoice</span></div>
          <div className="text-right flex justify-end space-x-3"><span>Date:</span> <span className="font-black">{formatDate(v.date)}</span></div>
          {v.details?.bookingRef && (
            <div className="flex space-x-3"><span>Booking Ref:</span> <span className="font-black text-blue-600">{v.details.bookingRef}</span></div>
          )}
        </div>

        <p className="text-center text-[#e11d48] font-bold mb-4 text-[11px] tracking-wide">{config?.companyName} {config?.appSubtitle}</p>

        <div className="flex justify-between items-center mb-4 text-[11px] font-bold">
          <p className="uppercase">Guest Name: <span className="font-black">{v.details?.paxName}</span></p>
        </div>

        <table className="w-full text-center mb-6 border-collapse border border-slate-300 shadow-sm">
          <thead className="bg-[#0b7ea1] text-white text-[9px] font-black uppercase tracking-widest">
            <tr>
              <th className="p-2 border-r border-slate-400">Hotel</th>
              <th className="p-2 border-r border-slate-400">Room</th>
              <th className="p-2 border-r border-slate-400">Checkin</th>
              <th className="p-2 border-r border-slate-400">Checkout</th>
              <th className="p-2 border-r border-slate-400">Rooms</th>
              <th className="p-2 border-r border-slate-400">Nights</th>
              <th className="p-2">Total(SAR)</th>
            </tr>
          </thead>
          <tbody className="text-[9px] uppercase font-bold text-slate-800">
            {v.details?.items?.length > 0 ? (
              v.details.items.map((item: any, i: number) => (
                <tr key={i} className="bg-white border-b border-slate-200">
                  <td className="p-2 border-r border-slate-300">{item.hotelName}</td>
                  <td className="p-2 border-r border-slate-300">
                    {item.roomType}
                    <div className="text-[8px] opacity-60 mt-0.5">
                      {item.adults || 0} ADT / {item.children || 0} CHD
                    </div>
                  </td>
                  <td className="p-2 border-r border-slate-300 whitespace-nowrap">{item.fromDate ? formatDate(item.fromDate) : '-'}</td>
                  <td className="p-2 border-r border-slate-300 whitespace-nowrap">{item.toDate ? formatDate(item.toDate) : '-'}</td>
                  <td className="p-2 border-r border-slate-300">{item.numRooms}</td>
                  <td className="p-2 border-r border-slate-300">{item.numNights}</td>
                  <td className="p-2 font-black text-right">
                    {(Number(item.unitRate) * Number(item.numRooms) * Number(item.numNights)).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                  </td>
                </tr>
              ))
            ) : (
              <tr className="bg-white border-b border-slate-200">
                <td className="p-2 border-r border-slate-300">{v.details?.hotelName}</td>
                <td className="p-2 border-r border-slate-300">
                  {v.details?.roomType}
                  <div className="text-[8px] opacity-60 mt-0.5">
                    {v.details?.adults || 0} ADT / {v.details?.children || 0} CHD
                  </div>
                </td>
                <td className="p-2 border-r border-slate-300 whitespace-nowrap">{v.details?.fromDate ? formatDate(v.details.fromDate) : '-'}</td>
                <td className="p-2 border-r border-slate-300 whitespace-nowrap">{v.details?.toDate ? formatDate(v.details.toDate) : '-'}</td>
                <td className="p-2 border-r border-slate-300">{v.details?.numRooms}</td>
                <td className="p-2 border-r border-slate-300">{v.details?.numNights}</td>
                <td className="p-2 font-black text-right">{totalSAR.toLocaleString(undefined, { minimumFractionDigits: 0 })}</td>
              </tr>
            )}
            <tr className="bg-slate-50 font-black">
              <td colSpan={6} className="p-2 text-right uppercase">Total:</td>
              <td className="p-2 text-right">SAR {totalSAR.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-auto pt-6">
          <div className="bg-[#0b7ea1] text-white py-1.5 px-6 text-center font-black uppercase text-[11px] tracking-widest rounded-t-lg">
            TERMS AND CONDITIONS
          </div>
          <ul className="text-[9px] font-bold text-slate-700 p-4 space-y-1.5 uppercase border border-t-0 border-slate-300 bg-slate-50/50 rounded-b-lg">
            <li>▪ Above rates are net and non commission-able.</li>
            <li>▪ Once you Re-Confirm this booking it will be Non Cancellation.</li>
            <li>▪ Check in after 16:00 hour and check out at 12:00 hour.</li>
          </ul>
        </div>
      </div>
    );
  };

  const renderServiceVoucher = (v: Voucher) => {
    const fromDateStr = v.details?.fromDate ? formatDate(v.details.fromDate) : '-';
    const toDateStr = v.details?.toDate ? formatDate(v.details.toDate) : '-';
    
    return (
      <div ref={voucherRef} className="bg-white p-6 text-slate-900 font-inter h-[295mm] w-[210mm] overflow-hidden flex flex-col box-border shadow-none">
        
        {/* Compact Header */}
        <div className="flex justify-between items-start mb-2 pb-2 border-b border-slate-100">
          <div className="w-32">
             {config?.companyLogo ? (
               <img src={config.companyLogo} style={{ height: `45px` }} alt="logo" className="object-contain" />
             ) : (
               <div className="font-black text-xl tracking-tighter text-[#0f172a]">{config?.companyName || 'ENTERPRISE'}</div>
             )}
          </div>
          <div className="text-center flex-1">
            <h1 className="text-[22px] font-black text-[#0f172a] uppercase tracking-tighter leading-none mb-0.5">Hotel Booking Voucher</h1>
            <p className="text-[14px] font-bold text-[#e11d48] uppercase tracking-wider">
              {config?.appSubtitle || 'TRAVELS SERVICES'}
            </p>
          </div>
          <div className="w-40 text-right pr-4">
             <div className="space-y-0.5">
                <p className="text-[9px] font-black text-slate-400 uppercase flex justify-end gap-2">
                  CELL: <span className="text-[#0f172a] font-bold">{config?.companyCell}</span>
                </p>
                <p className="text-[9px] font-black text-slate-400 uppercase flex justify-end gap-2">
                  PHONE: <span className="text-[#0f172a] font-bold">{config?.companyPhone}</span>
                </p>
             </div>
          </div>
        </div>

        {/* Reference Line */}
        <div className="mb-3 flex justify-between items-end">
          <p className="text-[13px] font-black text-[#0f172a]">Hotel Voucher: {v.voucherNum}</p>
          {v.details?.bookingRef && (
            <p className="text-[11px] font-black text-blue-600 uppercase tracking-tight">
              Booking Ref: {v.details.bookingRef}
            </p>
          )}
        </div>

        {/* Details Grid */}
        <div className="mb-3">
          {v.details?.items?.length > 0 ? (
            v.details.items.map((item: any, i: number) => (
              <div key={i} className={`grid grid-cols-2 gap-x-16 gap-y-2 pb-3 ${i > 0 ? 'mt-3 pt-3 border-t border-slate-100' : ''}`}>
                <div className="space-y-2">
                  <div className="space-y-0.5">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">HOTEL NAME</p>
                    <p className="text-[14px] font-black uppercase text-[#0f172a] leading-tight">
                      {item.hotelName || 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">CITY / COUNTRY</p>
                    <p className="text-[12px] font-black uppercase text-slate-700">
                      {item.city || 'N/A'} - {item.country?.toUpperCase() || 'SAUDI ARABIA'}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="space-y-0.5">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">CHECK-IN / CHECK-OUT</p>
                    <p className="text-[12px] font-black text-[#0f172a]">{formatDate(item.fromDate)} - {formatDate(item.toDate)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">ROOM(S)</p>
                      <p className="text-[12px] font-black text-slate-700">{item.numRooms || 1}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">NIGHT(S)</p>
                      <p className="text-[12px] font-black text-slate-700">{item.numNights || 1}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="grid grid-cols-2 gap-x-16 gap-y-2 border-b border-slate-100 pb-3">
              <div className="space-y-2">
                <div className="space-y-0.5">
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">HOTEL NAME</p>
                  <p className="text-[14px] font-black uppercase text-[#0f172a] leading-tight">
                    {v.details?.hotelName || 'N/A'}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">CITY / COUNTRY</p>
                  <p className="text-[12px] font-black uppercase text-slate-700">
                    {v.details?.city || 'N/A'} - {v.details?.country?.toUpperCase() || 'SAUDI ARABIA'}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="space-y-0.5">
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">CHECK-IN</p>
                  <p className="text-[12px] font-black text-[#0f172a]">{fromDateStr}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">CHECK-OUT</p>
                  <p className="text-[12px] font-black text-[#0f172a]">{toDateStr}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lead Guest bar */}
        <div className="grid grid-cols-2 gap-x-16 pt-2 border-t border-slate-100 mb-3">
           <div className="space-y-0.5">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">LEAD GUEST</p>
              <p className="text-[12px] font-black uppercase text-[#0f172a]">{v.details?.paxName || 'N/A'}</p>
           </div>
        </div>

        {/* Table */}
        <div className="mb-3">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[8px] font-black uppercase tracking-widest text-white bg-[#0f172a]">
                <th className="py-1.5 px-3 text-left border-r border-slate-700">HOTEL / CITY</th>
                <th className="py-1.5 px-3 text-left border-r border-slate-700">ROOM TYPE</th>
                <th className="py-1.5 px-3 text-left border-r border-slate-700">MEAL</th>
                <th className="py-1.5 px-3 text-left border-r border-slate-700">RMS</th>
                <th className="py-1.5 px-3 text-left border-r border-slate-700">NTS</th>
                <th className="py-1.5 px-3 text-left border-r border-slate-700">ADULT(S)</th>
                <th className="py-1.5 px-3 text-left">CHILDREN</th>
              </tr>
            </thead>
            <tbody className="text-[10px] font-bold text-slate-800">
              {v.details?.items?.length > 0 ? (
                v.details.items.map((item: any, i: number) => (
                  <tr key={i} className="bg-slate-50 border-b border-slate-200">
                    <td className="py-1.5 px-3 border-r border-slate-200 uppercase">{item.hotelName} ({item.city})</td>
                    <td className="py-1.5 px-3 border-r border-slate-200 uppercase">{item.roomType}</td>
                    <td className="py-1.5 px-3 border-r border-slate-200 uppercase">{formatMeals(item.meals)}</td>
                    <td className="py-1.5 px-3 border-r border-slate-200">{item.numRooms}</td>
                    <td className="py-1.5 px-3 border-r border-slate-200">{item.numNights}</td>
                    <td className="py-1.5 px-3 border-r border-slate-200">{item.adults || 2}</td>
                    <td className="py-1.5 px-3">{item.children || 0}</td>
                  </tr>
                ))
              ) : (
                <tr className="bg-slate-50 border-b border-slate-200">
                  <td className="py-1.5 px-3 border-r border-slate-200 uppercase">{v.details?.hotelName} ({v.details?.city})</td>
                  <td className="py-1.5 px-3 border-r border-slate-200 uppercase">{v.details?.roomType || 'TRIPLE'}</td>
                  <td className="py-1.5 px-3 border-r border-slate-200 uppercase">{formatMeals(v.details?.meals)}</td>
                  <td className="py-1.5 px-3 border-r border-slate-200">{v.details?.numRooms || 1}</td>
                  <td className="py-1.5 px-3 border-r border-slate-200">{v.details?.numNights || 1}</td>
                  <td className="py-1.5 px-3 border-r border-slate-200">{v.details?.adults || 2}</td>
                  <td className="py-1.5 px-3">{v.details?.children || 0}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Policies - Updated to match screenshot exactly */}
        <div className="mb-2">
          <h4 className="text-[11px] font-black text-[#0f172a] uppercase tracking-tighter mb-2 border-b border-slate-100 pb-1">Check-in/Check-out Timings & Policies</h4>
          <ul className="text-[9px] font-medium text-slate-600 space-y-1 leading-tight list-disc ml-4">
            <li>The usual check-in time is 2:00/4:00 PM hours however this might vary from hotel to hotel and with different destinations.</li>
            <li>Rooms may not be available for early check-in, unless especially required in advance. However, luggage may be deposited at the hotel reception and collected once the room is allotted.</li>
            <li>Note that reservation may be canceled automatically after 18:00 hours if hotel is not informed about the approximate time of late arrivals.</li>
            <li>The usual checkout time is at 12:00 hours however this might vary from hotel to hotel and with different destinations. Any late checkout may involve additional charges. Please check with the hotel reception in advance.</li>
            <li>For any specific queries related to a particular hotel, kindly reach out to local support team for further assistance</li>
          </ul>
        </div>

        {/* Booking Notes - Updated narrative and locked to bottom */}
        <div className="mt-auto pt-2 pb-1 border-t border-slate-100">
          <div className="border border-slate-200 p-3 rounded-md bg-slate-50/50">
            <p className="text-[10px] font-medium text-slate-700 leading-tight italic">
              <span className="font-black text-[#0f172a] not-italic">Booking Notes: :</span> Check your Reservation details carefully and inform us immediately. if you need any further clarification, please do not hesitate to contact us.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderTransportVoucher = (v: Voucher) => {
    return (
      <div ref={voucherRef} className="bg-white p-6 text-slate-900 font-inter h-[295mm] w-[210mm] overflow-hidden flex flex-col box-border shadow-none">
        
        {/* Compact Header */}
        <div className="flex justify-between items-start mb-2 pb-2 border-b border-slate-100">
          <div className="w-32">
             {config?.companyLogo ? (
               <img src={config.companyLogo} style={{ height: `45px` }} alt="logo" className="object-contain" />
             ) : (
               <div className="font-black text-xl tracking-tighter text-[#0f172a]">{config?.companyName || 'ENTERPRISE'}</div>
             )}
          </div>
          <div className="text-center flex-1">
            <h1 className="text-[22px] font-black text-[#0f172a] uppercase tracking-tighter leading-none mb-0.5">Transport Voucher</h1>
            <p className="text-[14px] font-bold text-[#e11d48] uppercase tracking-wider">
              {config?.appSubtitle || 'TRAVELS SERVICES'}
            </p>
          </div>
          <div className="w-40 text-right pr-4">
             <div className="space-y-0.5">
                <p className="text-[9px] font-black text-slate-400 uppercase flex justify-end gap-2">
                  CELL: <span className="text-[#0f172a] font-bold">{config?.companyCell}</span>
                </p>
                <p className="text-[9px] font-black text-slate-400 uppercase flex justify-end gap-2">
                  PHONE: <span className="text-[#0f172a] font-bold">{config?.companyPhone}</span>
                </p>
             </div>
          </div>
        </div>

        {/* Reference Line */}
        <div className="mb-3 flex justify-between items-end">
          <p className="text-[13px] font-black text-[#0f172a]">Voucher No: {v.voucherNum}</p>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-tight">
            Date: {formatDate(v.date)}
          </p>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-x-16 gap-y-2 mb-3 border-b border-slate-100 pb-3">
          <div className="space-y-2">
            <div className="space-y-0.5">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">CUSTOMER NAME</p>
              <p className="text-[14px] font-black uppercase text-[#0f172a] leading-tight">
                {accounts.find(a => a.id === v.customerId)?.name || 'N/A'}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">PASSENGER NAME</p>
              <p className="text-[12px] font-black uppercase text-slate-700">
                {v.details?.paxName || 'N/A'}
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="space-y-0.5">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">REFERENCE / PNR</p>
              <p className="text-[12px] font-black text-[#0f172a]">{v.reference || 'N/A'}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">CURRENCY / ROE</p>
              <p className="text-[12px] font-black text-slate-700">
                {v.currency} @ {v.roe || 1}
              </p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="mb-3 flex-1">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[8px] font-black uppercase tracking-widest text-white bg-[#0f172a]">
                <th className="py-1.5 px-3 text-left border-r border-slate-700">#</th>
                <th className="py-1.5 px-3 text-left border-r border-slate-700">SECTOR / ROUTE</th>
                <th className="py-1.5 px-3 text-left border-r border-slate-700">VEHICLE TYPE</th>
                <th className="py-1.5 px-3 text-right border-r border-slate-700">RATE ({v.currency})</th>
                <th className="py-1.5 px-3 text-right">AMOUNT (PKR)</th>
              </tr>
            </thead>
            <tbody className="text-[10px] font-bold text-slate-800">
              {v.details?.items?.map((item: any, i: number) => (
                <tr key={i} className="bg-white border-b border-slate-200">
                  <td className="py-1.5 px-3 border-r border-slate-200">{i + 1}</td>
                  <td className="py-1.5 px-3 border-r border-slate-200 uppercase">
                    {item.isMultiSector && item.subSectors?.length > 0 ? (
                      <div className="space-y-1 py-1">
                        {item.subSectors.map((sub: any, si: number) => (
                          <div key={si} className="border-b border-slate-100 last:border-0 pb-1">
                            <span className="font-black text-blue-600">{sub.route}</span>
                            <span className="text-slate-400 font-bold ml-2 text-[9px]">({sub.date ? new Date(sub.date).toLocaleDateString('en-GB').replace(/\//g, '-') : ''})</span>
                            {sub.note && <span className="block text-[8px] text-slate-400 italic lowercase mt-0.5">{sub.note}</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-1">
                        <span>{item.sector === 'CUSTOM' ? item.customLabel : item.sector}</span>
                        {item.date && (
                          <span className="text-slate-400 font-bold ml-2 text-[9px] lowercase">({new Date(item.date).toLocaleDateString('en-GB').replace(/\//g, '-')})</span>
                        )}
                        {item.note && <span className="block text-[8px] text-slate-400 italic lowercase mt-0.5">{item.note}</span>}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 px-3 border-r border-slate-200 uppercase">{item.vehicle}</td>
                  <td className="py-1.5 px-3 border-r border-slate-200 text-right">{Number(item.rate).toLocaleString()}</td>
                  <td className="py-1.5 px-3 text-right">
                    {(Number(item.rate) * (v.currency === Currency.SAR ? v.roe : 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-black text-[11px]">
                <td colSpan={4} className="py-2 px-3 text-right uppercase tracking-widest">Grand Total:</td>
                <td className="py-2 px-3 text-right text-blue-600">
                  PKR {v.totalAmountPKR.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Remarks Section */}
        {v.description && (
          <div className="mb-4 p-3 border border-slate-200 rounded-lg bg-slate-50/50">
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">REMARKS / INSTRUCTIONS</p>
            <p className="text-[10px] font-medium text-slate-700 leading-tight whitespace-pre-wrap">
              {v.description}
            </p>
          </div>
        )}

        {/* Signatures */}
        <div className="mt-auto pt-6 pb-2">
          <div className="flex justify-between items-end">
            <div className="text-center">
              <div className="w-40 border-t border-slate-900 pt-1 font-black text-[9px] uppercase tracking-widest">
                Prepared By
              </div>
            </div>
            <div className="text-center">
              <div className="w-40 border-t border-slate-900 pt-1 font-black text-[9px] uppercase tracking-widest">
                Customer Signature
              </div>
            </div>
            <div className="text-center">
              <div className="w-40 border-t border-slate-900 pt-1 font-black text-[9px] uppercase tracking-widest">
                Authorized Stamp
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderVisaVoucher = (v: Voucher) => {
    return (
      <div ref={voucherRef} className="bg-white p-6 text-slate-900 font-inter h-[295mm] w-[210mm] overflow-hidden flex flex-col box-border shadow-none">
        
        {/* Compact Header */}
        <div className="flex justify-between items-start mb-2 pb-2 border-b border-slate-100">
          <div className="w-32">
             {config?.companyLogo ? (
               <img src={config.companyLogo} style={{ height: `45px` }} alt="logo" className="object-contain" />
             ) : (
               <div className="font-black text-xl tracking-tighter text-[#0f172a]">{config?.companyName || 'ENTERPRISE'}</div>
             )}
          </div>
          <div className="text-center flex-1">
            <h1 className="text-[22px] font-black text-[#0f172a] uppercase tracking-tighter leading-none mb-0.5">Visa Voucher</h1>
            <p className="text-[14px] font-bold text-[#e11d48] uppercase tracking-wider">
              {config?.appSubtitle || 'TRAVELS SERVICES'}
            </p>
          </div>
          <div className="w-40 text-right pr-4">
             <div className="space-y-0.5">
                <p className="text-[9px] font-black text-slate-400 uppercase flex justify-end gap-2">
                  CELL: <span className="text-[#0f172a] font-bold">{config?.companyCell}</span>
                </p>
                <p className="text-[9px] font-black text-slate-400 uppercase flex justify-end gap-2">
                  PHONE: <span className="text-[#0f172a] font-bold">{config?.companyPhone}</span>
                </p>
             </div>
          </div>
        </div>

        {/* Reference Line */}
        <div className="mb-3 flex justify-between items-end">
          <p className="text-[13px] font-black text-[#0f172a]">Voucher No: {v.voucherNum}</p>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-tight">
            Date: {formatDate(v.date)}
          </p>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-x-16 gap-y-2 mb-3 border-b border-slate-100 pb-3">
          <div className="space-y-2">
            <div className="space-y-0.5">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">CUSTOMER NAME</p>
              <p className="text-[14px] font-black uppercase text-[#0f172a] leading-tight">
                {accounts.find(a => a.id === v.customerId)?.name || 'N/A'}
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="space-y-0.5">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">REFERENCE / PNR</p>
              <p className="text-[12px] font-black text-[#0f172a]">{v.reference || 'N/A'}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">CURRENCY / ROE</p>
              <p className="text-[12px] font-black text-slate-700">
                {v.currency} @ {v.roe || 1}
              </p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="mb-3 flex-1">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[8px] font-black uppercase tracking-widest text-white bg-[#0f172a]">
                <th className="py-1.5 px-3 text-left border-r border-slate-700">#</th>
                <th className="py-1.5 px-3 text-left border-r border-slate-700">PAX NAME</th>
                <th className="py-1.5 px-3 text-left border-r border-slate-700">PASSPORT NO</th>
                <th className="py-1.5 px-3 text-center border-r border-slate-700">QTY</th>
                <th className="py-1.5 px-3 text-right border-r border-slate-700">RATE ({v.currency})</th>
                <th className="py-1.5 px-3 text-right">AMOUNT (PKR)</th>
              </tr>
            </thead>
            <tbody className="text-[10px] font-bold text-slate-800">
              {v.details?.items?.map((item: any, i: number) => (
                <tr key={i} className="bg-white border-b border-slate-200">
                  <td className="py-1.5 px-3 border-r border-slate-200">{i + 1}</td>
                  <td className="py-1.5 px-3 border-r border-slate-200 uppercase">{item.paxName || 'N/A'}</td>
                  <td className="py-1.5 px-3 border-r border-slate-200 uppercase">{item.passportNumber || 'N/A'}</td>
                  <td className="py-1.5 px-3 border-r border-slate-200 text-center">{item.quantity}</td>
                  <td className="py-1.5 px-3 border-r border-slate-200 text-right">{Number(item.rate).toLocaleString()}</td>
                  <td className="py-1.5 px-3 text-right">
                    {(Number(item.quantity) * Number(item.rate) * (v.currency === Currency.SAR ? v.roe : 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-black text-[11px]">
                <td colSpan={5} className="py-2 px-3 text-right uppercase tracking-widest">Grand Total:</td>
                <td className="py-2 px-3 text-right text-blue-600">
                  PKR {v.totalAmountPKR.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Remarks Section */}
        {v.description && (
          <div className="mb-4 p-3 border border-slate-200 rounded-lg bg-slate-50/50">
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">REMARKS / INSTRUCTIONS</p>
            <p className="text-[10px] font-medium text-slate-700 leading-tight whitespace-pre-wrap">
              {v.description}
            </p>
          </div>
        )}

        {/* Signatures */}
        <div className="mt-auto pt-6 pb-2">
          <div className="flex justify-between items-end">
            <div className="text-center">
              <div className="w-40 border-t border-slate-900 pt-1 font-black text-[9px] uppercase tracking-widest">
                Prepared By
              </div>
            </div>
            <div className="text-center">
              <div className="w-40 border-t border-slate-900 pt-1 font-black text-[9px] uppercase tracking-widest">
                Customer Signature
              </div>
            </div>
            <div className="text-center">
              <div className="w-40 border-t border-slate-900 pt-1 font-black text-[9px] uppercase tracking-widest">
                Authorized Stamp
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderInspectorContent = () => {
    if (!viewingVoucher) return null;
    
    // For Receipt and Payment Vouchers, always show the financial view
    if (viewingVoucher.type === VoucherType.RECEIPT || viewingVoucher.type === VoucherType.PAYMENT) {
      return renderOfficialInvoice(viewingVoucher);
    }

    switch (inspectorView) {
      case 'OFFICIAL': return renderOfficialInvoice(viewingVoucher);
      case 'PKR': return renderConfirmationLetter(viewingVoucher);
      case 'SAR': return renderSARQuotation(viewingVoucher);
      case 'SERVICE': 
        if (viewingVoucher.type === VoucherType.TRANSPORT) return renderTransportVoucher(viewingVoucher);
        if (viewingVoucher.type === VoucherType.VISA) return renderVisaVoucher(viewingVoucher);
        return renderServiceVoucher(viewingVoucher);
      default: return renderOfficialInvoice(viewingVoucher);
    }
  };

  const renderVoucherForm = () => {
    const props = {
      initialData: formMode === 'CREATE' ? undefined : (voucherToEdit || {}),
      onSave: handleSave,
      onCancel: () => setShowForm(false),
      isClone: formMode === 'CLONE'
    };
    switch (activeType) {
      case VoucherType.RECEIPT: return <ReceiptVoucherForm {...props} />;
      case VoucherType.HOTEL: return <HotelVoucherForm {...props} />;
      case VoucherType.TRANSPORT: return <TransportVoucherForm {...props} />;
      case VoucherType.VISA: return <VisaVoucherForm {...props} />;
      case VoucherType.TICKET: return <TicketVoucherForm {...props} />;
      case VoucherType.PAYMENT: return <PaymentVoucherForm {...props} />;
      default: return null;
    }
  };

  const renderMobileVouchers = () => (
    <div className="md:hidden space-y-4">
      {filteredVouchers.map((v) => (
        <div 
          key={v.id} 
          onClick={() => { setActiveType(v.type); setViewingVoucher(v); setInspectorView('SERVICE'); }}
          className={`bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm active:scale-[0.98] transition-all relative ${selectedVoucherIds.includes(v.id) ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
        >
          <div className="absolute top-4 left-4 z-10">
            <input 
              type="checkbox" 
              className="w-5 h-5 rounded-full border-slate-300 text-blue-600 focus:ring-blue-500 shadow-sm"
              checked={selectedVoucherIds.includes(v.id)}
              onChange={(e) => { e.stopPropagation(); toggleSelection(v.id); }}
            />
          </div>
          <div className="flex justify-between items-start mb-3 ml-8">
            <div className="flex-1">
              <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-lg uppercase tracking-widest">{v.voucherNum}</span>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">{formatDate(v.date)}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-orbitron font-black text-slate-900 dark:text-white tracking-tighter">
                Rs {(v.totalAmountPKR || 0).toLocaleString()}
              </p>
              {v.currency === Currency.SAR && (
                <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mt-0.5">
                  SAR {((v.totalAmountPKR || 0) / (v.roe || 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })} @ {v.roe}
                </p>
              )}
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl mb-4">
            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase leading-relaxed line-clamp-2">
              {getDetailedNarrative(v)}
            </p>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-slate-50 dark:border-slate-800">
             <div className="flex -space-x-2">
               <div className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px]">👤</div>
               {v.type === VoucherType.HOTEL && <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px]">🏨</div>}
             </div>
             <div className="flex space-x-2">
               <button 
                 onClick={(e) => { e.stopPropagation(); handleEdit(v); }}
                 className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs active:bg-blue-600 active:text-white transition-colors"
               >✏️</button>
               <button 
                 onClick={(e) => { e.stopPropagation(); handleClone(v); }}
                 className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs active:bg-blue-600 active:text-white transition-colors"
               >👯</button>
               <button 
                 onClick={(e) => { e.stopPropagation(); handleDelete(v.id); }}
                 className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs active:bg-rose-600 active:text-white transition-colors"
               >🗑️</button>
             </div>
          </div>
        </div>
      ))}
      {filteredVouchers.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">No vouchers found</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-[1.5rem] md:rounded-2xl border dark:border-slate-800 shadow-sm overflow-x-auto w-full md:w-auto no-scrollbar scroll-smooth">
          {Object.values(VoucherType).map(t => {
            const count = allVouchers.filter(v => v.type === t).length;
            return (
              <button key={t} onClick={() => { setActiveType(t); setSelectedVoucherIds([]); }} className={`px-6 py-2.5 rounded-[1.2rem] md:rounded-xl font-black text-[10px] transition-all uppercase whitespace-nowrap group relative ${activeType === t ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-blue-500'}`}>
                {count > 0 && (
                  <span className={`absolute -top-1 -right-1 flex items-center justify-center px-1.5 py-0.5 rounded-full text-[7px] font-black leading-none min-w-[14px] ${activeType === t ? 'bg-white text-blue-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                    {count}
                  </span>
                )}
                {t}
              </button>
            );
          })}
        </div>
        <div className="flex items-center space-x-3 w-full md:w-auto">
          {selectedVoucherIds.length > 0 && (
            <button 
              onClick={handleBulkDelete}
              className="flex-1 md:flex-none bg-rose-600 hover:bg-rose-700 text-white px-6 py-4 rounded-[1.5rem] md:rounded-2xl font-black shadow-xl shadow-rose-500/20 uppercase tracking-widest text-[11px] transition-all active:scale-95 flex items-center justify-center"
            >
              <span className="mr-2">🗑️</span> Delete ({selectedVoucherIds.length})
            </button>
          )}
          <button 
            disabled={isSaving}
            onClick={() => { setFormMode('CREATE'); setShowForm(true); }} 
            className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-[1.5rem] md:rounded-2xl font-black shadow-xl shadow-blue-500/20 uppercase tracking-widest text-[11px] transition-all active:scale-95 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : '+ New Voucher'}
          </button>
        </div>
      </div>

      {renderMobileVouchers()}

      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-[2rem] border dark:border-slate-800 shadow-xl overflow-hidden no-print">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 text-slate-400 text-[10px] uppercase font-black tracking-widest">
              <tr>
                <th className="px-5 py-5 border-b dark:border-slate-800 w-10">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={filteredVouchers.length > 0 && selectedVoucherIds.length === filteredVouchers.length}
                    onChange={() => {
                      if (selectedVoucherIds.length === filteredVouchers.length) {
                        setSelectedVoucherIds([]);
                      } else {
                        setSelectedVoucherIds(filteredVouchers.map(v => v.id));
                      }
                    }}
                  />
                </th>
                <th className="px-5 py-5 border-b dark:border-slate-800">S.No</th>
                <th className="px-5 py-5 border-b dark:border-slate-800">Date / Number</th>
                <th className="px-5 py-5 border-b dark:border-slate-800">Particulars</th>
                <th className="px-5 py-5 border-b dark:border-slate-800">Narrative</th>
                <th className="px-5 py-5 border-b dark:border-slate-800 text-right">Aggregate (PKR)</th>
                <th className="px-5 py-5 border-b dark:border-slate-800 text-center">Command</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {filteredVouchers.map((v, idx) => (
                <tr key={v.id} className={`group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all ${selectedVoucherIds.includes(v.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                  <td className="px-5 py-6 border-b dark:border-slate-800">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedVoucherIds.includes(v.id)}
                      onChange={() => toggleSelection(v.id)}
                    />
                  </td>
                  <td className="px-5 py-6 text-[10px] font-black text-slate-400">
                    {idx + 1}
                  </td>
                  <td className="px-5 py-6">
                    <div>
                      <p className="font-black text-slate-900 dark:text-white leading-none text-sm">{v.voucherNum}</p>
                      <p className="text-[10px] text-slate-400 mt-1 font-bold">{formatDate(v.date)}</p>
                    </div>
                  </td>
                  <td className="px-5 py-6">
                    <div className="space-y-1">
                      {v.type === VoucherType.RECEIPT ? (
                        <>
                          <p className="font-black text-xs uppercase text-slate-700 dark:text-slate-300">
                            <span className="text-[8px] text-slate-400 mr-1">FROM:</span>
                            {accounts.find(a => a.id === v.customerId || a.id === v.vendorId)?.name || 'N/A'}
                          </p>
                          <p className="font-bold text-[10px] uppercase text-blue-600 dark:text-blue-400">
                            <span className="text-[8px] text-slate-400 mr-1">IN:</span>
                            {accounts.find(a => a.id === v.details?.bankId)?.name || 'N/A'}
                          </p>
                        </>
                      ) : v.type === VoucherType.PAYMENT ? (
                        <>
                          <p className="font-black text-xs uppercase text-slate-700 dark:text-slate-300">
                            <span className="text-[8px] text-slate-400 mr-1">FROM:</span>
                            {accounts.find(a => a.id === v.details?.bankId)?.name || 'N/A'}
                          </p>
                          <p className="font-bold text-[10px] uppercase text-rose-600 dark:text-rose-400">
                            <span className="text-[8px] text-slate-400 mr-1">TO:</span>
                            {v.details?.items?.length > 1 
                              ? `${v.details.items.length} ACCOUNTS` 
                              : (accounts.find(a => a.id === v.details?.items?.[0]?.accountId)?.name || 'N/A')}
                          </p>
                        </>
                      ) : (
                        <p className="font-black text-xs uppercase text-slate-700 dark:text-slate-300 text-wrap max-w-[200px]">
                          {accounts.find(a => a.id === v.customerId || a.id === v.vendorId)?.name || 'N/A'}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-6 max-w-xs truncate">
                    <p className="text-[11px] font-medium text-slate-500 italic" title={getDetailedNarrative(v)}>{getDetailedNarrative(v)}</p>
                  </td>
                  <td className="px-5 py-6 text-right">
                    <p className="font-black text-slate-900 dark:text-white text-base leading-none">{v.totalAmountPKR.toLocaleString()}</p>
                  </td>
                  <td className="px-5 py-6">
                    <div className="flex justify-center space-x-2">
                       <button onClick={() => { setActiveType(v.type); setViewingVoucher(v); setInspectorView('SERVICE'); }} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-blue-600 hover:text-white transition-all text-xs">👁️</button>
                       <button onClick={() => handleEdit(v)} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-amber-500 hover:text-white transition-all text-xs">✏️</button>
                       <button onClick={() => handleClone(v)} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-indigo-600 hover:text-white transition-all text-xs">👯</button>
                       <button onClick={() => handleDelete(v.id)} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-rose-600 hover:text-white transition-all text-xs">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewingVoucher && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl md:p-4 overflow-hidden print:p-0 print:bg-white print:block">
          <div className="bg-white dark:bg-slate-900 w-full md:max-w-5xl h-full md:h-auto md:max-h-[92vh] md:rounded-[3rem] shadow-2xl flex flex-col print:shadow-none print:rounded-none">
            <div className="no-print p-4 md:p-6 border-b dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 dark:bg-slate-800/50 shrink-0">
               <div className="flex overflow-x-auto w-full sm:w-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 space-x-2">
                  {!(viewingVoucher.type === VoucherType.RECEIPT || viewingVoucher.type === VoucherType.PAYMENT) && [
                    { id: 'SERVICE', label: 'Booking', icon: '🏨' },
                    { id: 'OFFICIAL', label: 'Invoice', icon: '📄' },
                    { id: 'PKR', label: 'Confirm', icon: '✅' },
                    { id: 'SAR', label: 'Quote', icon: '🇸🇦' }
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setInspectorView(tab.id as any)} className={`shrink-0 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center space-x-2 ${inspectorView === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                      <span>{tab.icon}</span> <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  ))}
                  {(viewingVoucher.type === VoucherType.RECEIPT || viewingVoucher.type === VoucherType.PAYMENT) && (
                    <div className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg flex items-center space-x-2">
                      <span>📄</span> <span>Financial Entry</span>
                    </div>
                  )}
               </div>
               <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                  <button 
                    onClick={handleDownloadPDF} 
                    disabled={isDownloading}
                    className="flex-1 sm:flex-none justify-center bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3 md:py-2 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all flex items-center space-x-2 disabled:opacity-50 shadow-xl"
                  >
                    <span>{isDownloading ? '⏳' : '📥'}</span> 
                    <span className="hidden sm:inline">{isDownloading ? 'Saving...' : 'Download'}</span>
                  </button>
                  <button 
                    onClick={handleWhatsAppShare} 
                    disabled={isSharing}
                    className="flex-1 sm:flex-none justify-center bg-emerald-600 text-white px-4 py-3 md:py-2 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all flex items-center space-x-2 disabled:opacity-50 shadow-xl shadow-emerald-500/20"
                  >
                    <span>{isSharing ? '⏳' : '🟢'}</span> 
                    <span className="hidden sm:inline">{isSharing ? 'Share' : 'WhatsApp'}</span>
                  </button>
                  <button onClick={() => setViewingVoucher(null)} className="p-3 bg-slate-200 dark:bg-slate-700 text-slate-500 rounded-xl active:bg-rose-500 active:text-white transition-colors">
                    <span className="text-sm">✕</span>
                  </button>
               </div>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar print:overflow-visible flex justify-center py-6 md:py-10 bg-slate-50/30 dark:bg-slate-950/20">
              <div className="w-full max-w-4xl px-2 sm:px-6">
                <div className="overflow-x-auto bg-white shadow-2xl md:rounded-2xl border border-slate-100 p-0 sm:p-2">
                  {renderInspectorContent()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && renderVoucherForm()}
    </div>
  );
};

export default Vouchers;
    