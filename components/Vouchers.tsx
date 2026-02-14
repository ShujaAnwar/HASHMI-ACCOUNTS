
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { VoucherType, Currency, AccountType, Voucher, VoucherStatus, Account, AppConfig } from '../types';
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
  externalIntent?: { type: 'EDIT' | 'VIEW', voucher: Voucher } | null;
  clearIntent?: () => void;
}

const Vouchers: React.FC<VouchersProps> = ({ externalIntent, clearIntent }) => {
  const [activeType, setActiveType] = useState<VoucherType>(VoucherType.HOTEL);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'CREATE' | 'EDIT' | 'CLONE'>('CREATE');
  const [viewingVoucher, setViewingVoucher] = useState<Voucher | null>(null);
  const [inspectorView, setInspectorView] = useState<'OFFICIAL' | 'PKR' | 'SAR' | 'SERVICE'>('OFFICIAL');
  const [voucherToEdit, setVoucherToEdit] = useState<Voucher | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [allVouchers, setAllVouchers] = useState<Voucher[]>([]);

  const voucherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [accs, conf, vchs] = await Promise.all([
        getAccounts(),
        getConfig(),
        getVouchers()
      ]);
      setAccounts(accs);
      setConfig(conf);
      setAllVouchers(vchs);
    };
    fetchData();
  }, [refreshKey, showForm]);

  useEffect(() => {
    if (externalIntent) {
      if (externalIntent.type === 'EDIT') handleEdit(externalIntent.voucher);
      else if (externalIntent.type === 'VIEW') {
        setViewingVoucher(externalIntent.voucher);
        setInspectorView('SERVICE'); 
      }
      if (clearIntent) clearIntent();
    }
  }, [externalIntent]);

  const handleEdit = (v: Voucher) => { setFormMode('EDIT'); setVoucherToEdit(v); setShowForm(true); };
  const handleClone = (v: Voucher) => { setFormMode('CLONE'); setVoucherToEdit(v); setShowForm(true); };
  
  const handleDelete = async (id: string) => { 
    if (window.confirm('Delete voucher?')) { 
      await AccountingService.deleteVoucher(id); 
      setRefreshKey(prev => prev + 1); 
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
      setRefreshKey(prev => prev + 1);
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
        const pax = v.details.paxName || 'N/A';
        const hotel = v.details.hotelName || 'N/A';
        const ci = v.details.fromDate || '-';
        const co = v.details.toDate || '-';
        const rb = v.details.numRooms || '0';
        const ngt = v.details.numNights || '0';
        const loc = v.details.city || 'N/A';
        const countrySuffix = (loc.toLowerCase().includes('makkah') || loc.toLowerCase().includes('madinah') || loc.toLowerCase().includes('jeddah')) ? '-KSA' : '';
        return `${pax.toUpperCase()} | ${hotel.toUpperCase()} |Checkin: ${ci} | Checkout: ${co} | R/B: ${rb} | Nights:${ngt} | ${loc.toUpperCase()} ${countrySuffix}`;
      case VoucherType.TRANSPORT:
        const tPax = v.details.paxName || '-';
        const sector = v.details.items?.[0]?.sector || 'N/A';
        const vehicle = v.details.items?.[0]?.vehicle || 'N/A';
        return `${tPax.toUpperCase()} | ${sector.toUpperCase()} | ${vehicle.toUpperCase()}`;
      case VoucherType.VISA:
        return `${(v.details.headName || 'N/A').toUpperCase()} | VISA PROCESSING | ${v.currency} ${v.details.unitRate}`;
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
    const fileName = `HotelVoucher_${voucherNum}_${paxName}.pdf`;

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

  const renderOfficialInvoice = (v: Voucher) => {
    const customer = accounts.find(a => a.id === v.customerId);
    const invoiceNum = v.voucherNum.split('-').pop();
    return (
      <div ref={voucherRef} className="bg-white p-12 text-black font-inter h-[295mm] w-[210mm] overflow-hidden flex flex-col box-border">
        <div className="flex justify-between items-start mb-8">
          <div>
            {config?.companyLogo && <img src={config.companyLogo} style={{ height: `${config.logoSize}px` }} alt="logo" className="mb-4" />}
          </div>
          <div className="text-center pt-8">
            <h2 className="text-xl font-bold text-[#e11d48] uppercase tracking-tight">{config?.companyName} {config?.appSubtitle}</h2>
          </div>
          <div className="text-right">
            <div className="border-2 border-slate-900 px-8 py-3 text-center min-w-[220px] rounded-sm shadow-sm">
              <p className="font-bold text-[13px] uppercase tracking-wide">INVOICE : {invoiceNum}</p>
              <p className="font-bold text-[13px] mt-1">(PKR) = {v.totalAmountPKR.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        <div className="mb-8 text-[11px] font-medium text-slate-800 leading-relaxed">
          <p>{config?.companyAddress}</p>
          <p className="mt-1">CELL : {config?.companyCell} - PHONE : {config?.companyPhone} - EMAIL : {config?.companyEmail}</p>
          <p className="mt-1"><span className="font-bold">Status:</span> Definite Invoice</p>
        </div>

        <div className="mb-8 border border-slate-300">
          <table className="w-full text-center border-collapse">
            <thead className="bg-[#0b7ea1] text-white">
              <tr>
                <th className="py-2 px-3 border-r border-slate-400 font-bold uppercase text-[11px]">Account Name:</th>
                <th className="py-2 px-3 border-r border-slate-400 font-bold uppercase text-[11px]">Hotel Invoice Date #</th>
                <th className="py-2 px-3 border-r border-slate-400 font-bold uppercase text-[11px]">Option Date</th>
                <th className="py-2 px-3 font-bold uppercase text-[11px]">Confirmation #</th>
              </tr>
            </thead>
            <tbody className="text-[12px] font-bold">
              <tr>
                <td className="py-4 px-3 border-r border-slate-300 uppercase">{customer?.name || 'N/A'}</td>
                <td className="py-4 px-3 border-r border-slate-300">{new Date(v.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td className="py-4 px-3 border-r border-slate-300">30, Nov -0001</td>
                <td className="py-4 px-3 uppercase">{v.reference || 'N/A'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mb-8 border border-slate-300">
          <table className="w-full text-center border-collapse text-[10px]">
            <thead className="bg-[#0b7ea1] text-white">
              <tr>
                <th className="py-2 border-r border-slate-400 font-bold uppercase">Pax Name</th>
                <th className="py-2 border-r border-slate-400 font-bold uppercase">Hotel</th>
                <th className="py-2 border-r border-slate-400 font-bold uppercase">Room Type #</th>
                <th className="py-2 border-r border-slate-400 font-bold uppercase">Meal</th>
                <th className="py-2 border-r border-slate-400 font-bold uppercase">Destination</th>
                <th className="py-2 border-r border-slate-400 font-bold uppercase">Checkin Checkout</th>
                <th className="py-2 font-bold uppercase">Amount(PKR)</th>
              </tr>
            </thead>
            <tbody className="text-[11px] font-bold">
              <tr>
                <td className="py-6 px-2 border-r border-slate-300 uppercase">{v.details?.paxName || v.details?.headName || 'N/A'}</td>
                <td className="py-6 px-2 border-r border-slate-300 uppercase">{v.details?.hotelName || v.details?.airline || 'N/A'}</td>
                <td className="py-6 px-2 border-r border-slate-300 uppercase">{v.details?.roomType || 'N/A'}</td>
                <td className="py-6 px-2 border-r border-slate-300 uppercase">{formatMeals(v.details?.meals)}</td>
                <td className="py-6 px-2 border-r border-slate-300 uppercase">{v.details?.city}, {v.details?.country}</td>
                <td className="py-6 px-2 border-r border-slate-300 leading-normal">
                  {v.details?.fromDate ? new Date(v.details.fromDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-'}<br/>
                  {v.details?.toDate ? new Date(v.details.toDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                </td>
                <td className="py-6 px-2 font-black">{v.totalAmountPKR.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr className="bg-slate-50 border-t border-slate-300 font-bold">
                <td colSpan={6} className="py-4 text-right px-8 uppercase text-xs">Total:</td>
                <td className="py-4 px-2">PKR {v.totalAmountPKR.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mb-10 text-[12px] font-bold text-slate-900 italic">
          <p>IN WORDS: <span className="uppercase">{amountToWords(v.totalAmountPKR)}</span></p>
          <p className="mt-8 not-italic">On behalf of <span className="text-[#e11d48]">{config?.companyName} {config?.appSubtitle}</span></p>
        </div>

        <div className="mt-auto pt-10">
          <h3 className="text-[14px] font-black border-b-2 border-slate-900 pb-2 mb-4 tracking-tight uppercase">Acknowledgement</h3>
          <ol className="text-[10px] space-y-1 font-bold text-slate-700 uppercase leading-relaxed">
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
      <div ref={voucherRef} className="bg-white p-12 text-black font-inter h-[295mm] w-[210mm] overflow-hidden flex flex-col box-border">
        <div className="flex justify-between items-start mb-6">
          <div className="flex flex-col items-center">
            {config?.companyLogo && <img src={config.companyLogo} style={{ height: `${config.logoSize}px` }} alt="logo" />}
          </div>
          <div className="text-center pt-4">
            <h1 className="text-2xl font-bold text-[#e11d48] uppercase tracking-tight">{config?.companyName} {config?.appSubtitle}</h1>
          </div>
          <div className="text-right">
             <div className="flex items-center justify-end space-x-4 border-b-2 border-slate-300 pb-1 mb-2">
                <span className="text-slate-500 font-bold text-[18px]">Invoice #</span>
                <span className="text-slate-900 font-black text-[22px] tracking-tighter">{invoiceNum}</span>
             </div>
             <p className="text-[#0b7ea1] font-black uppercase text-[16px] leading-tight">{v.details?.hotelName}</p>
          </div>
        </div>

        <hr className="border-slate-200 mb-10" />

        <div className="mb-10 text-[14px] leading-relaxed">
          <p>Dear Sir:</p>
          <p className="mt-3">Greeting From <span className="text-[#e11d48] font-bold">{config?.companyName} {config?.appSubtitle}</span></p>
          <p className="mt-1">We are pleased to confirm the following reservation on a <span className="font-bold">Definite basis .</span></p>
        </div>

        <div className="flex space-x-12 mb-8 items-center bg-slate-50 p-4 rounded-lg">
          <p className="font-bold text-[13px] uppercase tracking-wider text-slate-500 whitespace-nowrap">Account Name:</p>
          <p className="font-black text-[15px] uppercase flex-1 border-b border-slate-400 pb-1">{customer?.name}</p>
        </div>

        <table className="w-full text-left mb-8 border-collapse border border-slate-300">
          <thead className="bg-[#bdc3c7] text-slate-700 text-[10px] font-black uppercase tracking-widest">
            <tr>
              <th className="p-3 border border-slate-400">Hotel</th>
              <th className="p-3 border border-slate-400">Guest Name</th>
              <th className="p-3 border border-slate-400">Location</th>
              <th className="p-3 border border-slate-400">CONF NO</th>
            </tr>
          </thead>
          <tbody className="text-[11px] uppercase font-bold text-slate-800">
            <tr className="bg-white">
              <td className="p-4 border border-slate-300">{v.details?.hotelName}</td>
              <td className="p-4 border border-slate-300">{v.details?.paxName}</td>
              <td className="p-4 border border-slate-300">{v.details?.city}, {v.details?.country}</td>
              <td className="p-4 border border-slate-300">{v.reference || 'N/A'}</td>
            </tr>
          </tbody>
        </table>

        <table className="w-full text-left mb-10 border-collapse border border-slate-300">
          <thead className="bg-[#bdc3c7] text-slate-700 text-[9px] font-black uppercase tracking-widest">
            <tr>
              <th className="p-2 border border-slate-400">ROOM TYPE</th>
              <th className="p-2 border border-slate-400">MEAL</th>
              <th className="p-2 border border-slate-400">CHECK IN</th>
              <th className="p-2 border border-slate-400">CHECK OUT</th>
              <th className="p-2 border border-slate-400">NIGHT(s)</th>
              <th className="p-2 border border-slate-400">ROOM(s)</th>
              <th className="p-2 border border-slate-400">TOTAL</th>
            </tr>
          </thead>
          <tbody className="text-[10px] font-bold uppercase text-slate-800">
            <tr className="bg-white">
              <td className="p-3 border border-slate-300">{v.details?.roomType}</td>
              <td className="p-3 border border-slate-300">{formatMeals(v.details?.meals)}</td>
              <td className="p-3 border border-slate-300 whitespace-nowrap">{v.details?.fromDate ? new Date(v.details.fromDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</td>
              <td className="p-3 border border-slate-300 whitespace-nowrap">{v.details?.toDate ? new Date(v.details.toDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</td>
              <td className="p-3 border border-slate-300 text-center">{v.details?.numNights}</td>
              <td className="p-3 border border-slate-300 text-center">{v.details?.numRooms}</td>
              <td className="p-3 border border-slate-300 font-black text-right">PKR {v.totalAmountPKR.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-auto pt-10 text-[11px] font-bold leading-relaxed space-y-2 text-slate-700 uppercase">
           <p className="underline font-black text-slate-900 mb-2 tracking-widest">Notes</p>
           <ul className="list-disc pl-5 space-y-1">
             <li>ANY INVOICE OBJECTIONS MUST BE SENT TO US WITHIN 3 DAYS OF RECEIPT.</li>
             <li>ALL PAYMENTS SHOULD BE MADE AGAINST THE COMPANY ACCOUNTS ONLY.</li>
           </ul>
        </div>

        <p className="text-[12px] font-medium text-slate-600 mt-8 pt-4 border-t border-slate-100">
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
      <div ref={voucherRef} className="bg-white p-12 text-black font-inter h-[295mm] w-[210mm] overflow-hidden flex flex-col box-border">
        <div className="flex justify-center mb-10">
          {config?.companyLogo && <img src={config.companyLogo} style={{ height: `${config.logoSize}px` }} alt="logo" />}
        </div>

        <div className="grid grid-cols-2 gap-y-1 mb-8 text-[11px] font-bold uppercase tracking-wide">
          <div className="flex space-x-3"><span>Account Name:</span> <span className="font-black">{customer?.name}</span></div>
          <div className="text-right flex justify-end space-x-3"><span>HVI #:</span> <span className="font-black">{invoiceNum}</span></div>
          <div className="flex space-x-3"><span>Subject:</span> <span className="font-black">Definite Invoice</span></div>
          <div className="text-right flex justify-end space-x-3"><span>Date:</span> <span className="font-black">{new Date(v.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
        </div>

        <p className="text-center text-[#e11d48] font-bold mb-8 text-[12px] tracking-wide">{config?.companyName} {config?.appSubtitle}</p>

        <div className="flex justify-between items-center mb-6 text-[12px] font-bold">
          <p className="uppercase">Guest Name: <span className="font-black">{v.details?.paxName}</span></p>
        </div>

        <table className="w-full text-center mb-10 border-collapse border border-slate-300 shadow-sm">
          <thead className="bg-[#0b7ea1] text-white text-[10px] font-black uppercase tracking-widest">
            <tr>
              <th className="p-3 border-r border-slate-400">Hotel</th>
              <th className="p-3 border-r border-slate-400">Room</th>
              <th className="p-3 border-r border-slate-400">Checkin</th>
              <th className="p-3 border-r border-slate-400">Checkout</th>
              <th className="p-3 border-r border-slate-400">Rooms / Nights</th>
              <th className="p-3">Total(SAR)</th>
            </tr>
          </thead>
          <tbody className="text-[10px] uppercase font-bold text-slate-800">
            <tr className="bg-white">
              <td className="p-4 border border-slate-300">{v.details?.hotelName}</td>
              <td className="p-4 border border-slate-300">{v.details?.roomType}</td>
              <td className="p-4 border border-slate-300 whitespace-nowrap">{v.details?.fromDate ? new Date(v.details.fromDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</td>
              <td className="p-4 border border-slate-300 whitespace-nowrap">{v.details?.toDate ? new Date(v.details.toDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</td>
              <td className="p-4 border border-slate-300">{v.details?.numRooms} / {v.details?.numNights}</td>
              <td className="p-4 border border-slate-300 font-black text-right">{totalSAR.toLocaleString(undefined, { minimumFractionDigits: 0 })}</td>
            </tr>
            <tr className="bg-slate-50 font-black">
              <td colSpan={5} className="p-2 text-right uppercase">Total:</td>
              <td className="p-2 text-right">SAR {totalSAR.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-auto pt-10">
          <div className="bg-[#0b7ea1] text-white py-2 px-6 text-center font-black uppercase text-[12px] tracking-widest rounded-t-lg">
            TERMS AND CONDITIONS
          </div>
          <ul className="text-[10px] font-bold text-slate-700 p-6 space-y-2 uppercase border border-t-0 border-slate-300 bg-slate-50/50 rounded-b-lg">
            <li>▪ Above rates are net and non commission-able.</li>
            <li>▪ Once you Re-Confirm this booking it will be Non Cancellation.</li>
            <li>▪ Check in after 16:00 hour and check out at 12:00 hour.</li>
          </ul>
        </div>
      </div>
    );
  };

  const renderServiceVoucher = (v: Voucher) => {
    const fromDateStr = v.details?.fromDate ? new Date(v.details.fromDate).toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-';
    const toDateStr = v.details?.toDate ? new Date(v.details.toDate).toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-';
    
    return (
      <div ref={voucherRef} className="bg-white p-8 text-slate-900 font-inter h-[295mm] w-[210mm] overflow-hidden flex flex-col box-border shadow-none">
        
        {/* Compact Header */}
        <div className="flex justify-between items-start mb-4 pb-4 border-b border-slate-100">
          <div className="w-40">
             {config?.companyLogo ? (
               <img src={config.companyLogo} style={{ height: `60px` }} alt="logo" className="object-contain" />
             ) : (
               <div className="font-black text-2xl tracking-tighter text-[#0f172a]">NEEM TREE</div>
             )}
          </div>
          <div className="text-center flex-1">
            <h1 className="text-[30px] font-black text-[#0f172a] uppercase tracking-tighter leading-none mb-1">Hotel Booking Voucher</h1>
            <p className="text-[20px] font-bold text-[#e11d48] uppercase tracking-wider">
              {config?.appSubtitle || 'TRAVELS SERVICES'}
            </p>
          </div>
          <div className="w-44 text-right pr-6">
             <div className="space-y-0.5">
                <p className="text-[10px] font-black text-slate-400 uppercase flex justify-end gap-3">
                  CELL: <span className="text-[#0f172a] font-bold">{config?.companyCell}</span>
                </p>
                <p className="text-[10px] font-black text-slate-400 uppercase flex justify-end gap-3">
                  PHONE: <span className="text-[#0f172a] font-bold">{config?.companyPhone}</span>
                </p>
             </div>
          </div>
        </div>

        {/* Reference Line */}
        <div className="mb-6">
          <p className="text-[15px] font-black text-[#0f172a]">Hotel Voucher: {v.voucherNum}</p>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-x-24 gap-y-4 mb-6">
          <div className="space-y-4">
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">HOTEL NAME</p>
              <p className="text-[18px] font-black uppercase text-[#0f172a] leading-tight">
                {v.details?.hotelName || 'N/A'}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CITY / COUNTRY</p>
              <p className="text-[16px] font-black uppercase text-slate-700">
                {v.details?.city || 'N/A'} - {v.details?.country?.toUpperCase() || 'SAUDI ARABIA'}
              </p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CHECK-IN</p>
              <p className="text-[16px] font-black text-[#0f172a]">{fromDateStr}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CHECK-OUT</p>
              <p className="text-[16px] font-black text-[#0f172a]">{toDateStr}</p>
            </div>
          </div>
        </div>

        {/* Lead/Nights bar */}
        <div className="grid grid-cols-2 gap-x-24 pt-4 border-t border-slate-100 mb-6">
           <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">LEAD GUEST</p>
              <p className="text-[16px] font-black uppercase text-[#0f172a]">{v.details?.paxName || 'N/A'}</p>
           </div>
           <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ROOM(S) / NIGHT(S)</p>
              <p className="text-[16px] font-black text-slate-700">
                {v.details?.numRooms || 1} / {v.details?.numNights || 1}
              </p>
           </div>
        </div>

        {/* Table */}
        <div className="mb-6">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-white bg-[#0f172a]">
                <th className="py-3 px-5 text-left border-r border-slate-700">ROOMS/BEDS</th>
                <th className="py-3 px-5 text-left border-r border-slate-700">ROOM TYPE</th>
                <th className="py-3 px-5 text-left border-r border-slate-700">MEAL</th>
                <th className="py-3 px-5 text-left border-r border-slate-700">GUEST NAME</th>
                <th className="py-3 px-5 text-left border-r border-slate-700">ADULT(S)</th>
                <th className="py-3 px-5 text-left">CHILDREN</th>
              </tr>
            </thead>
            <tbody className="text-[12px] font-bold text-slate-800">
              <tr className="bg-slate-50 border-b border-slate-200">
                <td className="py-3 px-5 border-r border-slate-200">{v.details?.numRooms || 1}</td>
                <td className="py-3 px-5 border-r border-slate-200 uppercase">{v.details?.roomType || 'TRIPLE'}</td>
                <td className="py-3 px-5 border-r border-slate-200 uppercase">{formatMeals(v.details?.meals)}</td>
                <td className="py-3 px-5 border-r border-slate-200 uppercase">{v.details?.paxName || 'N/A'}</td>
                <td className="py-3 px-5 border-r border-slate-200">{v.details?.adults || 2}</td>
                <td className="py-3 px-5">{v.details?.children || 0}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Policies - Updated to match screenshot exactly */}
        <div className="mb-4">
          <h4 className="text-[13px] font-black text-[#0f172a] uppercase tracking-tighter mb-4 border-b border-slate-100 pb-2">Check-in/Check-out Timings & Policies</h4>
          <ul className="text-[11px] font-medium text-slate-600 space-y-1.5 leading-relaxed list-disc ml-5">
            <li>The usual check-in time is 2:00/4:00 PM hours however this might vary from hotel to hotel and with different destinations.</li>
            <li>Rooms may not be available for early check-in, unless especially required in advance. However, luggage may be deposited at the hotel reception and collected once the room is allotted.</li>
            <li>Note that reservation may be canceled automatically after 18:00 hours if hotel is not informed about the approximate time of late arrivals.</li>
            <li>The usual checkout time is at 12:00 hours however this might vary from hotel to hotel and with different destinations. Any late checkout may involve additional charges. Please check with the hotel reception in advance.</li>
            <li>For any specific queries related to a particular hotel, kindly reach out to local support team for further assistance</li>
          </ul>
        </div>

        {/* Booking Notes - Updated narrative and locked to bottom */}
        <div className="mt-auto pt-4 pb-2 border-t border-slate-100">
          <div className="border border-slate-200 p-4 rounded-md bg-slate-50/50">
            <p className="text-[12px] font-medium text-slate-700 leading-relaxed italic">
              <span className="font-black text-[#0f172a] not-italic">Booking Notes: :</span> Check your Reservation details carefully and inform us immediately. if you need any further clarification, please do not hesitate to contact us.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderInspectorContent = () => {
    if (!viewingVoucher) return null;
    switch (inspectorView) {
      case 'OFFICIAL': return renderOfficialInvoice(viewingVoucher);
      case 'PKR': return renderConfirmationLetter(viewingVoucher);
      case 'SAR': return renderSARQuotation(viewingVoucher);
      case 'SERVICE': return renderServiceVoucher(viewingVoucher);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div className="flex bg-white dark:bg-slate-900 p-2 rounded-2xl border dark:border-slate-800 shadow-sm overflow-x-auto w-full md:w-auto">
          {Object.values(VoucherType).map(t => (
            <button key={t} onClick={() => setActiveType(t)} className={`px-6 py-3 rounded-xl font-bold text-xs transition-all uppercase whitespace-nowrap ${activeType === t ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-blue-500'}`}>
              {t}
            </button>
          ))}
        </div>
        <button 
          disabled={isSaving}
          onClick={() => { setFormMode('CREATE'); setShowForm(true); }} 
          className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-blue-500/20 uppercase tracking-widest text-[11px] transition-all active:scale-95 disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : '+ New Voucher'}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border dark:border-slate-800 shadow-xl overflow-hidden no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 text-[10px] uppercase font-black tracking-widest">
              <tr>
                <th className="px-8 py-5">Date / Number</th>
                <th className="px-8 py-5">Particulars</th>
                <th className="px-8 py-5">Narrative</th>
                <th className="px-8 py-5 text-right">Aggregate (PKR)</th>
                <th className="px-8 py-5 text-center">Command</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {filteredVouchers.map(v => (
                <tr key={v.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                  <td className="px-8 py-6">
                    <div>
                      <p className="font-black text-slate-900 dark:text-white leading-none text-sm">{v.voucherNum}</p>
                      <p className="text-[10px] text-slate-400 mt-1 font-bold">{new Date(v.date).toLocaleDateString()}</p>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <p className="font-black text-xs uppercase text-slate-700 dark:text-slate-300">
                      {accounts.find(a => a.id === v.customerId || a.id === v.vendorId)?.name || 'N/A'}
                    </p>
                  </td>
                  <td className="px-8 py-6 max-w-xs truncate">
                    <p className="text-[11px] font-medium text-slate-500 italic" title={getDetailedNarrative(v)}>{getDetailedNarrative(v)}</p>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <p className="font-black text-slate-900 dark:text-white text-base leading-none">{v.totalAmountPKR.toLocaleString()}</p>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex justify-center space-x-2">
                       <button onClick={() => { setViewingVoucher(v); setInspectorView('SERVICE'); }} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-blue-600 hover:text-white transition-all text-xs">👁️</button>
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
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 overflow-y-auto print:p-0 print:bg-white print:block">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden print:shadow-none print:rounded-none">
            <div className="no-print p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
               <div className="flex space-x-2">
                  {[
                    { id: 'SERVICE', label: 'Booking Voucher', icon: '🏨' },
                    { id: 'OFFICIAL', label: 'Official Invoice', icon: '📄' },
                    { id: 'PKR', label: 'Confirmation', icon: '✅' },
                    { id: 'SAR', label: 'SAR Quote', icon: '🇸🇦' }
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setInspectorView(tab.id as any)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-2 ${inspectorView === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>
                      <span>{tab.icon}</span> <span>{tab.label}</span>
                    </button>
                  ))}
               </div>
               <div className="flex items-center space-x-3">
                  <button 
                    onClick={handleDownloadPDF} 
                    disabled={isDownloading}
                    className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-2 rounded-xl font-black uppercase text-[10px] transition-all flex items-center space-x-2 disabled:opacity-50"
                  >
                    <span>{isDownloading ? '⏳' : '📥'}</span> 
                    <span>{isDownloading ? 'Downloading...' : 'Download PDF'}</span>
                  </button>
                  <button onClick={() => setViewingVoucher(null)} className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-500 rounded-xl">✕</button>
               </div>
            </div>
            <div className="overflow-y-auto max-h-[80vh] print:max-h-none print:overflow-visible flex justify-center py-10 print:py-0">
              {renderInspectorContent()}
            </div>
          </div>
        </div>
      )}

      {showForm && renderVoucherForm()}
    </div>
  );
};

export default Vouchers;
