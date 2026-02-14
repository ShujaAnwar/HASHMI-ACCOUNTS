import React, { useState, useMemo, useEffect } from 'react';
import { VoucherType, Currency, AccountType, Voucher, VoucherStatus, Account, AppConfig } from '../types';
import { getAccounts, getVouchers, getConfig } from '../services/db';
import { AccountingService } from '../services/AccountingService';
import PaymentVoucherForm from './PaymentVoucherForm';
import ReceiptVoucherForm from './ReceiptVoucherForm';
import TransportVoucherForm from './TransportVoucherForm';
import VisaVoucherForm from './VisaVoucherForm';
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
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [allVouchers, setAllVouchers] = useState<Voucher[]>([]);

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
      // Success feedback could be added here
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
    return 'Room Only';
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

  const handlePrint = () => {
    if (!viewingVoucher) return;
    window.print();
  };

  const renderOfficialInvoice = (v: Voucher) => {
    const customer = accounts.find(a => a.id === v.customerId);
    const invoiceNum = v.voucherNum.split('-').pop();
    return (
      <div className="bg-white p-12 text-black font-inter min-h-[11in] voucher-page text-sm">
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

        <div className="mt-20">
          <h3 className="text-[14px] font-black border-b-2 border-slate-900 pb-2 mb-4 tracking-tight uppercase">Acknowledgement</h3>
          <ol className="text-[10px] space-y-1 font-bold text-slate-700 uppercase leading-relaxed">
            <li>1. ANY INVOICE OBJECTIONS MUST BE SENT TO US WITHIN 3 DAYS OF RECEIPT. NO OBJECTIONS ACCEPTED AFTERWARD.</li>
            <li>2. IF PAYMENT'S MADE, DISREGARD THIS INVOICE.</li>
            <li>3. ALL PAYMENTS SHOULD BE MADE AGAINST THE COMPANY ACCOUNTS ONLY</li>
            <li>4. ALL PAYMENTS SHOULD BE MADE AGAINST THE COMPANY ACCOUNTS ONLY</li>
          </ol>
        </div>
      </div>
    );
  };

  const renderConfirmationLetter = (v: Voucher) => {
    const customer = accounts.find(a => a.id === v.customerId);
    const invoiceNum = v.voucherNum.split('-').pop();
    return (
      <div className="bg-white p-12 text-black font-inter min-h-[11in] voucher-page text-sm">
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
              <th className="p-2 border border-slate-400">RATE/R/N</th>
              <th className="p-2 border border-slate-400">HCN</th>
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
              <td className="p-3 border border-slate-300 text-right">{v.details?.unitRate?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="p-3 border border-slate-300"></td>
              <td className="p-3 border border-slate-300 font-black text-right">PKR {v.totalAmountPKR.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <div className="mb-10">
          <h3 className="text-[16px] font-black text-slate-900 mb-4 uppercase">Bank Details</h3>
          <table className="w-full border-collapse border border-slate-300">
            <thead className="bg-[#bdc3c7] text-[10px] uppercase font-black tracking-widest text-slate-700 text-center">
              <tr>
                <th className="p-2 border border-slate-300">Sr. #</th>
                <th className="p-2 border border-slate-300">Bank Name</th>
                <th className="p-2 border border-slate-300">Account Name</th>
                <th className="p-2 border border-slate-300">Account Number</th>
                <th className="p-2 border border-slate-300">Bank Address</th>
              </tr>
            </thead>
            <tbody>
              {config?.banks?.map((bank, bi) => (
                <tr key={bank.id} className="text-center text-[10px] font-bold">
                  <td className="p-2 border border-slate-300">{bi + 1}</td>
                  <td className="p-2 border border-slate-300 uppercase">{bank.name}</td>
                  <td className="p-2 border border-slate-300 uppercase">{config.companyName}</td>
                  <td className="p-2 border border-slate-300 font-mono">{bank.accountNumber}</td>
                  <td className="p-2 border border-slate-300 text-[9px] uppercase">{bank.address}</td>
                </tr>
              )) || <tr><td colSpan={5} className="p-4 text-center text-slate-400 italic">No bank accounts configured</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="text-[11px] font-bold leading-relaxed space-y-2 mb-10 text-slate-700 uppercase">
           <p className="underline font-black text-slate-900 mb-2 tracking-widest">Notes</p>
           <ul className="list-disc pl-5 space-y-1">
             <li>ANY INVOICE OBJECTIONS MUST BE SENT TO US WITHIN 3 DAYS OF RECEIPT. NO OBJECTIONS ACCEPTED AFTERWARD.</li>
             <li>IF PAYMENT'S MADE, DISREGARD THIS INVOICE.</li>
             <li>ALL PAYMENTS SHOULD BE MADE AGAINST THE COMPANY ACCOUNTS ONLY</li>
             <li>ALL PAYMENTS SHOULD BE MADE AGAINST THE COMPANY ACCOUNTS ONLY</li>
           </ul>
        </div>

        <p className="text-[12px] font-medium text-slate-600 mt-12 pt-8 border-t border-slate-100">
          <span className="font-black text-slate-900">Booking Notes: :</span> Check your Reservation details carefully and inform us immediately.if you need any further clarification, please do not hesitate to <span className="font-bold text-slate-900">contact us.</span>
        </p>
      </div>
    );
  };

  const renderSARQuotation = (v: Voucher) => {
    const customer = accounts.find(a => a.id === v.customerId);
    const totalSAR = v.details?.totalSelectedCurrency || (v.totalAmountPKR / (v.roe || 1));
    const invoiceNum = v.voucherNum.split('-').pop();
    return (
      <div className="bg-white p-12 text-black font-inter min-h-[11in] voucher-page text-sm">
        <div className="flex justify-center mb-10">
          {config?.companyLogo && <img src={config.companyLogo} style={{ height: `${config.logoSize}px` }} alt="logo" />}
        </div>

        <div className="grid grid-cols-2 gap-y-1 mb-8 text-[11px] font-bold uppercase tracking-wide">
          <div className="flex space-x-3"><span>Account Name:</span> <span className="font-black">{customer?.name}</span></div>
          <div className="text-right flex justify-end space-x-3"><span>HVI #:</span> <span className="font-black">{invoiceNum}</span></div>
          <div className="flex space-x-3"><span>Subject:</span> <span className="font-black">Definite Invoice</span></div>
          <div className="text-right flex justify-end space-x-3"><span>Date:</span> <span className="font-black">{new Date(v.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
          <div className="flex space-x-3"><span>Confirmation #:</span> <span className="font-black">{v.reference || 'N/A'}</span></div>
          <div className="text-right flex justify-end space-x-3"><span>Phone No:</span> <span className="font-black">{config?.companyCell}</span></div>
        </div>

        <p className="text-center text-[#e11d48] font-bold mb-8 text-[12px] tracking-wide">{config?.companyName} {config?.appSubtitle}</p>

        <div className="flex justify-between items-center mb-6 text-[12px] font-bold">
          <p className="uppercase">Guest Name: <span className="font-black">{v.details?.paxName}</span></p>
          <p className="uppercase">Option Date: <span className="font-black">30, Nov -0001</span></p>
        </div>

        <table className="w-full text-center mb-10 border-collapse border border-slate-300 shadow-sm">
          <thead className="bg-[#0b7ea1] text-white text-[10px] font-black uppercase tracking-widest">
            <tr>
              <th className="p-3 border-r border-slate-400">Hotel</th>
              <th className="p-3 border-r border-slate-400">Room</th>
              <th className="p-3 border-r border-slate-400">Meal</th>
              <th className="p-3 border-r border-slate-400">Checkin</th>
              <th className="p-3 border-r border-slate-400">Checkout</th>
              <th className="p-3 border-r border-slate-400">Rooms / Nights</th>
              <th className="p-3 border-r border-slate-400">Rate</th>
              <th className="p-3">Total(SAR)</th>
            </tr>
          </thead>
          <tbody className="text-[10px] uppercase font-bold text-slate-800">
            <tr className="bg-white">
              <td className="p-4 border border-slate-300">{v.details?.hotelName}</td>
              <td className="p-4 border border-slate-300">{v.details?.roomType}</td>
              <td className="p-4 border border-slate-300">{formatMeals(v.details?.meals)}</td>
              <td className="p-4 border border-slate-300 whitespace-nowrap">{v.details?.fromDate ? new Date(v.details.fromDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</td>
              <td className="p-4 border border-slate-300 whitespace-nowrap">{v.details?.toDate ? new Date(v.details.toDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</td>
              <td className="p-4 border border-slate-300">{v.details?.numRooms} / {v.details?.numNights}</td>
              <td className="p-4 border border-slate-300 text-right">{v.details?.unitRate?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="p-4 border border-slate-300 font-black text-right">{totalSAR.toLocaleString(undefined, { minimumFractionDigits: 0 })}</td>
            </tr>
            <tr className="bg-slate-50 font-black">
              <td colSpan={7} className="p-2 text-right uppercase">Total:</td>
              <td className="p-2 text-right">SAR {totalSAR.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <div className="mb-10 overflow-hidden rounded-lg">
          <div className="bg-[#0b7ea1] text-white py-2 px-6 text-center font-black uppercase text-[12px] tracking-widest">
            TERMS AND CONDITIONS
          </div>
          <ul className="text-[10px] font-bold text-slate-700 p-6 space-y-2 uppercase border border-t-0 border-slate-300 bg-slate-50/50">
            <li>▪ Above rates are net and non commission-able quoted in SAR.</li>
            <li>▪ Once you Re-Confirm this booking it will be:</li>
            <li className="ml-4">• Non Cancellation</li>
            <li className="ml-4">• Non Refundable</li>
            <li className="ml-4">• Non Amendable</li>
            <li>▪ Check in after 16:00 hour and check out at 12:00 hour.</li>
            <li>▪ Triple or Quad occupancy will be through extra bed # standard room is not available.</li>
          </ul>
        </div>

        <div className="mt-auto">
          <p className="font-black text-[11px] mb-2 text-blue-900 uppercase">Bank Account Details with Account Title <span className="text-[#e11d48]">{config?.companyName} {config?.appSubtitle}</span></p>
          <table className="w-full border-collapse border border-slate-300 text-[10px] font-black uppercase text-center">
            <thead className="bg-[#0b7ea1] text-white">
              <tr>
                <th className="p-2 border border-slate-400">Bank Name</th>
                <th className="p-2 border border-slate-400">Bank Address</th>
                <th className="p-2">Bank Accounts</th>
              </tr>
            </thead>
            <tbody>
              {config?.banks?.map(bank => (
                <tr key={bank.id}>
                  <td className="p-2 border border-slate-300 uppercase">{bank.name}</td>
                  <td className="p-2 border border-slate-300 uppercase">{bank.address}</td>
                  <td className="p-2 border border-slate-300 font-mono">{bank.accountNumber}</td>
                </tr>
              )) || <tr><td colSpan={3} className="p-6 border border-slate-300 italic text-slate-400 uppercase">No bank info</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderServiceVoucher = (v: Voucher) => {
    const fromDateStr = v.details?.fromDate ? new Date(v.details.fromDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-';
    const toDateStr = v.details?.toDate ? new Date(v.details.toDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-';
    const invoiceNum = v.voucherNum.split('-').pop();

    return (
      <div className="bg-white p-14 text-slate-900 font-inter min-h-[11in] voucher-page border border-slate-200">
        <div className="flex justify-between items-start mb-12">
          <div className="flex flex-col">
            {config?.companyLogo && <img src={config.companyLogo} style={{ height: `${config.logoSize}px` }} alt="logo" className="mb-4" />}
          </div>
          <div className="text-center pt-4 flex-1">
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight leading-none">Hotel Booking Voucher</h1>
            <p className="text-lg font-bold text-rose-600 mt-1 uppercase tracking-wide">
              {config?.companyName} {config?.appSubtitle}
            </p>
          </div>
          <div className="text-right text-[11px] font-semibold text-slate-500 uppercase leading-relaxed max-w-[240px]">
             <p>{config?.companyAddress}</p>
             <p>Cell: {config?.companyCell}</p>
             <p>Phone: {config?.companyPhone}</p>
          </div>
        </div>

        <div className="mb-10 text-[14px] font-bold text-slate-800">
          <p>Hotel Voucher: {invoiceNum}</p>
        </div>

        <div className="grid grid-cols-2 gap-y-12 mb-12">
          <div className="space-y-10">
            <div>
              <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-1">HOTEL NAME</p>
              <p className="text-[16px] font-black uppercase text-slate-800 leading-tight">
                {v.details?.hotelName}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-1">CITY / COUNTRY</p>
              <p className="text-[14px] font-bold uppercase text-slate-700">
                {v.details?.city} {v.details?.country ? `- ${v.details.country}` : ''}
              </p>
            </div>
          </div>
          <div className="space-y-10 pl-24">
            <div>
              <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-1">CHECK-IN</p>
              <p className="text-[16px] font-black text-slate-800">{fromDateStr}</p>
            </div>
            <div>
              <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-1">CHECK-OUT</p>
              <p className="text-[16px] font-black text-slate-800">{toDateStr}</p>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-100">
             <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-1">LEAD GUEST</p>
             <p className="text-[15px] font-black uppercase text-slate-900">{v.details?.paxName}</p>
          </div>
          <div className="pt-8 border-t border-slate-100 pl-24">
             <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-1">ROOM(S) / NIGHT(S)</p>
             <p className="text-[15px] font-bold text-slate-700">{v.details?.numRooms} / {v.details?.numNights}</p>
          </div>
        </div>

        <div className="mb-12 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[11px] font-black uppercase tracking-widest text-slate-900 border-y border-slate-200 bg-slate-50/50">
                <th className="py-4 px-4 text-left font-black">ROOMS/BEDS</th>
                <th className="py-4 px-4 text-left font-black">Room Type</th>
                <th className="py-4 px-4 text-left font-black">Meal</th>
                <th className="py-4 px-4 text-left font-black">Guest Name</th>
                <th className="py-4 px-4 text-left font-black">Adult(s)</th>
                <th className="py-4 px-4 text-left font-black">Children</th>
              </tr>
            </thead>
            <tbody className="text-[12px] font-semibold text-slate-700">
              <tr className="border-b border-slate-100 bg-slate-50/30">
                <td className="py-5 px-4">{v.details?.numRooms}</td>
                <td className="py-5 px-4 uppercase">{v.details?.roomType}</td>
                <td className="py-5 px-4 uppercase">{formatMeals(v.details?.meals)}</td>
                <td className="py-5 px-4 uppercase">{v.details?.paxName}</td>
                <td className="py-5 px-4">{v.details?.adults || 2}</td>
                <td className="py-5 px-4">{v.details?.children || 0}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mb-12">
          <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-tighter mb-6">Check-in/Check-out Timings & Policies</h4>
          <ul className="text-[12px] font-medium text-slate-600 space-y-3 leading-relaxed">
            <li className="flex items-start space-x-3">
              <span className="text-slate-900">•</span> 
              <span>The usual check-in time is 2:00/4:00 PM hours however this might vary from hotel to hotel and with different destinations.</span>
            </li>
            <li className="flex items-start space-x-3">
              <span className="text-slate-900">•</span> 
              <span>Rooms may not be available for early check-in, unless especially required in advance. However, luggage may be deposited at the hotel reception and collected once the room is allotted.</span>
            </li>
            <li className="flex items-start space-x-3">
              <span className="text-slate-900">•</span> 
              <span>Note that reservation may be canceled automatically after 18:00 hours if hotel is not informed about the approximate time of late arrivals.</span>
            </li>
            <li className="flex items-start space-x-3">
              <span className="text-slate-900">•</span> 
              <span>The usual checkout time is at 12:00 hours however this might vary from hotel to hotel and with different destinations. Any late checkout may involve additional charges. Please check with the hotel reception in advance.</span>
            </li>
            <li className="flex items-start space-x-3">
              <span className="text-slate-900">•</span> 
              <span>For any specific queries related to a particular hotel, kindly reach out to local support team for further assistance</span>
            </li>
          </ul>
        </div>

        <div className="mt-auto pt-8 border-t border-slate-200">
          <div className="border border-slate-200 p-6 rounded-sm">
            <p className="text-[12px] font-medium text-slate-700 leading-relaxed">
              <span className="font-bold text-slate-900">Booking Notes: :</span> Check your Reservation details carefully and inform us immediately.if you need any further clarification, please do not hesitate to contact us.
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
                  <button onClick={handlePrint} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-2 rounded-xl font-black uppercase text-[10px] transition-all flex items-center space-x-2"><span>🖨️</span> <span>Print / PDF</span></button>
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