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
    if (formMode === 'EDIT' && voucherToEdit) await AccountingService.updateVoucher(voucherToEdit.id, data);
    else await AccountingService.postVoucher(data);
    setShowForm(false); setVoucherToEdit(null); setRefreshKey(prev => prev + 1);
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
        const from = v.details.fromDate ? new Date(v.details.fromDate).toLocaleDateString('en-GB') : '-';
        const to = v.details.toDate ? new Date(v.details.toDate).toLocaleDateString('en-GB') : '-';
        const rooms = v.details.numRooms || 1;
        const nights = v.details.numNights || 0;
        const roe = v.roe || config?.defaultROE || 1;
        return `Hotel: ${v.details.hotelName} | CI: ${from}, CO: ${to} | ${rooms} Room(s), ${nights} Night(s) | Type: ${v.details.roomType} | ROE: ${roe} | Meal: ${formatMeals(v.details.meals)}`;
      case VoucherType.TRANSPORT:
        return `Sector: ${v.details.items?.[0]?.sector || 'N/A'} | Vehicle: ${v.details.items?.[0]?.vehicle || 'N/A'} | Pax: ${v.details.paxName || '-'}`;
      case VoucherType.VISA:
        return `Visa for: ${v.details.headName} | Rate: ${v.details.unitRate} ${v.currency}`;
      case VoucherType.TICKET:
        return `${v.details.paxName} | ${v.details.airline} | ${v.details.sector} | PNR: ${v.reference || 'N/A'}`;
      case VoucherType.RECEIPT:
        return `Receipt | ${v.description}`;
      case VoucherType.PAYMENT:
        return `Payment | ${v.description}`;
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
              <p className="font-bold text-[13px] uppercase tracking-wide">INVOICE : {v.voucherNum.split('-').pop()}</p>
              <p className="font-bold text-[13px] mt-1">(PKR) = {v.totalAmountPKR.toLocaleString(undefined, { minimumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>

        <div className="mb-8 text-[11px] font-medium text-slate-800 leading-relaxed">
          <p>{config?.companyAddress}</p>
          <p className="mt-1">CELL : {config?.companyCell} - PHONE : {config?.companyPhone} - EMAIL : {config?.companyEmail}</p>
        </div>

        <div className="mb-8 border border-slate-300">
          <table className="w-full text-center border-collapse">
            <thead className="bg-[#0b7ea1] text-white">
              <tr>
                <th className="py-2 px-3 border-r border-slate-400 font-bold uppercase text-[11px]">Account Name:</th>
                <th className="py-2 px-3 border-r border-slate-400 font-bold uppercase text-[11px]">Voucher Date</th>
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
                <th className="py-2 border-r border-slate-400 font-bold uppercase">Details</th>
                <th className="py-2 border-r border-slate-400 font-bold uppercase">Room/Vehicle</th>
                <th className="py-2 border-r border-slate-400 font-bold uppercase">Meal/Sector</th>
                <th className="py-2 border-r border-slate-400 font-bold uppercase">Location</th>
                <th className="py-2 border-r border-slate-400 font-bold uppercase">Dates</th>
                <th className="py-2 font-bold uppercase">Amount(PKR)</th>
              </tr>
            </thead>
            <tbody className="text-[11px] font-bold">
              <tr>
                <td className="py-6 px-2 border-r border-slate-300 uppercase">{v.details?.paxName || v.details?.headName || 'N/A'}</td>
                <td className="py-6 px-2 border-r border-slate-300 uppercase">{v.details?.hotelName || v.details?.airline || 'N/A'}</td>
                <td className="py-6 px-2 border-r border-slate-300 uppercase">{v.details?.roomType || v.details?.items?.[0]?.vehicle || 'N/A'}</td>
                <td className="py-6 px-2 border-r border-slate-300 uppercase">{formatMeals(v.details?.meals) || v.details?.sector || 'N/A'}</td>
                <td className="py-6 px-2 border-r border-slate-300 uppercase">{v.details?.city || '-'}</td>
                <td className="py-6 px-2 border-r border-slate-300 leading-normal">
                  {v.details?.fromDate ? new Date(v.details.fromDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '-'}<br/>
                  {v.details?.toDate ? new Date(v.details.toDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '-'}
                </td>
                <td className="py-6 px-2 font-black">{v.totalAmountPKR.toLocaleString(undefined, { minimumFractionDigits: 0 })}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mb-10 text-[12px] font-bold text-slate-900 italic">
          <p>IN WORDS: <span className="uppercase">{amountToWords(v.totalAmountPKR)}</span></p>
        </div>

        <div className="mt-20">
          <h3 className="text-[14px] font-black border-b-2 border-slate-900 pb-2 mb-4 tracking-tight uppercase">Acknowledgement</h3>
          <ol className="text-[10px] space-y-1 font-bold text-slate-700 uppercase leading-relaxed">
            <li>1. ANY INVOICE OBJECTIONS MUST BE SENT TO US WITHIN 3 DAYS OF RECEIPT.</li>
            <li>2. ALL PAYMENTS SHOULD BE MADE AGAINST THE COMPANY ACCOUNTS ONLY</li>
          </ol>
        </div>
      </div>
    );
  };

  const renderConfirmationLetter = (v: Voucher) => {
    return (
      <div className="bg-white p-12 text-black font-inter min-h-[11in] voucher-page text-sm">
        <h1 className="text-center text-xl font-bold uppercase border-b pb-4">Confirmation Letter</h1>
        <div className="mt-8">
           <p><strong>Voucher Number:</strong> {v.voucherNum}</p>
           <p><strong>Date:</strong> {new Date(v.date).toLocaleDateString()}</p>
           <p className="mt-4">We are pleased to confirm your booking for {v.details?.paxName || 'N/A'}.</p>
        </div>
      </div>
    );
  };

  const renderSARQuotation = (v: Voucher) => {
    const totalSAR = v.details?.totalSelectedCurrency || (v.totalAmountPKR / (v.roe || 1));
    return (
      <div className="bg-white p-12 text-black font-inter min-h-[11in] voucher-page text-sm">
        <h1 className="text-center text-xl font-bold uppercase border-b pb-4">Quotation (SAR)</h1>
        <div className="mt-8">
           <p><strong>Total SAR:</strong> {totalSAR.toLocaleString()}</p>
           <p><strong>Exchange Rate (ROE):</strong> {v.roe}</p>
        </div>
      </div>
    );
  };

  const renderServiceVoucher = (v: Voucher) => {
    const fromDateStr = v.details?.fromDate ? new Date(v.details.fromDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-';
    const toDateStr = v.details?.toDate ? new Date(v.details.toDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    return (
      <div className="bg-white p-8 md:p-14 text-slate-900 font-inter min-h-[11in] voucher-page border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-8 mb-8 gap-4">
          <div className="flex-shrink-0">
            {config?.companyLogo && (
              <img 
                src={config.companyLogo} 
                style={{ height: `${config.logoSize}px` }} 
                alt="logo" 
                className="max-w-[200px] object-contain"
              />
            )}
          </div>
          <div className="flex-1 text-center md:text-left md:pl-8">
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight leading-none">Hotel Booking Voucher</h1>
            <p className="text-lg font-bold text-rose-600 mt-1 uppercase tracking-wide">
              {config?.companyName} {config?.appSubtitle}
            </p>
          </div>
          <div className="text-right text-[10px] md:text-[11px] font-semibold text-slate-500 uppercase leading-relaxed max-w-[240px]">
             <p>{config?.companyAddress}</p>
             <p>Cell: {config?.companyCell}</p>
             <p>Phone: {config?.companyPhone}</p>
          </div>
        </div>

        <div className="mb-10 text-[14px] font-bold text-slate-800">
          <p>Hotel Voucher: {v.voucherNum.split('-').pop()}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-10 mb-12">
          <div className="space-y-8 pr-4">
            <div>
              <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-1">HOTEL NAME</p>
              <p className="text-[16px] font-black uppercase text-slate-800 leading-tight">{v.details?.hotelName}</p>
            </div>
            <div>
              <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-1">CITY / COUNTRY</p>
              <p className="text-[14px] font-bold uppercase text-slate-700">
                {v.details?.city} {v.details?.country ? `- ${v.details.country}` : ''}
              </p>
            </div>
          </div>
          <div className="space-y-8 pl-0 md:pl-20">
            <div className="grid grid-cols-1 gap-6">
              <div>
                <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-1">CHECK-IN</p>
                <p className="text-[16px] font-black text-slate-800">{fromDateStr}</p>
              </div>
              <div>
                <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-1">CHECK-OUT</p>
                <p className="text-[16px] font-black text-slate-800">{toDateStr}</p>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-100 col-span-1 md:col-span-1">
             <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-1">LEAD GUEST</p>
             <p className="text-[15px] font-black uppercase text-slate-900">{v.details?.paxName}</p>
          </div>
          <div className="pt-8 border-t border-slate-100 col-span-1 md:col-span-1 md:pl-20">
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
          <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-tighter mb-6">Policies</h4>
          <ul className="text-[12px] font-medium text-slate-600 space-y-3 leading-relaxed">
            <li className="flex items-start space-x-3"><span className="text-slate-900">•</span> <span>Standard check-in is 2:00 PM.</span></li>
            <li className="flex items-start space-x-3"><span className="text-slate-900">•</span> <span>Standard check-out is 12:00 PM.</span></li>
          </ul>
        </div>

        <div className="mt-auto pt-8 border-t border-slate-200">
          <div className="border border-slate-200 p-6 rounded-sm">
            <p className="text-[12px] font-medium text-slate-700 leading-relaxed">
              <span className="font-bold text-slate-900">Booking Notes: :</span> Check your Reservation details carefully and inform us immediately.
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
        <button onClick={() => { setFormMode('CREATE'); setShowForm(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-blue-500/20 uppercase tracking-widest text-[11px] transition-all">
          + New Voucher
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
                  {['SERVICE', 'OFFICIAL', 'PKR', 'SAR'].map(tab => (
                    <button key={tab} onClick={() => setInspectorView(tab as any)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${inspectorView === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>
                      {tab}
                    </button>
                  ))}
               </div>
               <div className="flex items-center space-x-3">
                  <button onClick={handlePrint} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-2 rounded-xl font-black uppercase text-[10px] transition-all">Print</button>
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