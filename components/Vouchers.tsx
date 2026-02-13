import React, { useState, useMemo, useEffect } from 'react';
import { VoucherType, Currency, AccountType, Voucher, VoucherStatus } from '../types';
import { getAccounts, getVouchers, getConfig } from '../services/db';
import { AccountingService } from '../services/AccountingService';

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
  const [activeType, setActiveType] = useState<VoucherType>(VoucherType.RECEIPT);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'CREATE' | 'EDIT' | 'CLONE'>('CREATE');
  const [viewingVoucher, setViewingVoucher] = useState<Voucher | null>(null);
  const [inspectorView, setInspectorView] = useState<'SERVICE' | 'SAR' | 'OFFICIAL' | 'PKR'>('SERVICE');
  const [printType, setPrintType] = useState<'SERVICE' | 'SAR' | 'OFFICIAL' | 'PKR' | null>(null);
  const [voucherToEdit, setVoucherToEdit] = useState<Voucher | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const accounts = useMemo(() => getAccounts(), []);
  const config = useMemo(() => getConfig(), [refreshKey]);
  const allVouchers = useMemo(() => getVouchers(), [showForm, refreshKey]);

  const getDefaultFormData = (type: VoucherType) => ({
    date: new Date().toISOString().split('T')[0],
    currency: Currency.PKR,
    roe: config.defaultROE,
    amount: 0, 
    customerId: '', vendorId: '', description: '', reference: '',
    bankId: config.banks[0]?.id || '', expenseId: '',
    details: { 
      paxName: '', hotelName: '', country: 'SAUDIA ARABIA', city: 'MADINAH MUNAWWARAH', 
      roomType: 'DBL C.V', fromDate: '', toDate: '', numNights: 0, 
      numRooms: 1, meals: { breakfast: false, lunch: false, dinner: false }, 
      numAdults: 2, numChildren: 0 
    }
  });

  const [formData, setFormData] = useState<any>(getDefaultFormData(activeType));

  useEffect(() => {
    if (formMode !== 'EDIT') {
      setFormData(getDefaultFormData(activeType));
    }
    setViewingVoucher(null);
  }, [activeType, config.defaultROE, config.banks]);

  useEffect(() => {
    if (externalIntent && externalIntent.type === 'EDIT') {
      setActiveType(externalIntent.voucher.type);
      setFormMode('EDIT');
      setVoucherToEdit(externalIntent.voucher);
      setShowForm(true);
      if (clearIntent) clearIntent();
    }
  }, [externalIntent]);

  const filteredVouchers = useMemo(() => {
    return allVouchers
      .filter(v => v.type === activeType)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allVouchers, activeType]);

  useEffect(() => {
    if (activeType === VoucherType.HOTEL && formData.details.fromDate && formData.details.toDate) {
      const start = new Date(formData.details.fromDate);
      const end = new Date(formData.details.toDate);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 0;
      setFormData((prev: any) => ({ ...prev, details: { ...prev.details, numNights: Math.max(0, diffDays) } }));
    }
  }, [formData.details.fromDate, formData.details.toDate, activeType]);

  useEffect(() => {
    if (printType && viewingVoucher) {
      const originalTitle = document.title;
      document.title = `${viewingVoucher.voucherNum}_${printType}_Voucher`;
      setTimeout(() => { 
        window.print(); 
        document.title = originalTitle; 
        setPrintType(null); 
      }, 500);
    }
  }, [printType, viewingVoucher]);

  const handleEdit = (v: Voucher) => { setFormMode('EDIT'); setVoucherToEdit(v); setShowForm(true); };
  const handleClone = (v: Voucher) => { setFormMode('CLONE'); setVoucherToEdit(v); setShowForm(true); };
  const handleDelete = (id: string) => { if (window.confirm('Delete voucher?')) { AccountingService.deleteVoucher(id); setRefreshKey(prev => prev + 1); setViewingVoucher(null); } };

  useEffect(() => {
    if (voucherToEdit) {
      setFormData({
        date: formMode === 'CLONE' ? new Date().toISOString().split('T')[0] : voucherToEdit.date.split('T')[0],
        currency: voucherToEdit.currency,
        roe: voucherToEdit.roe,
        amount: voucherToEdit.details?.unitRate || (voucherToEdit.totalAmountPKR / voucherToEdit.roe),
        customerId: voucherToEdit.customerId || '',
        vendorId: voucherToEdit.vendorId || '',
        description: voucherToEdit.description,
        reference: formMode === 'CLONE' ? '' : (voucherToEdit.reference || ''),
        bankId: voucherToEdit.details?.bankId || config.banks[0]?.id || '',
        expenseId: voucherToEdit.details?.expenseId || '',
        details: { ...voucherToEdit.details }
      });
    }
  }, [voucherToEdit, formMode, config.banks]);

  const totalCalculatedAmount = useMemo(() => {
    if (activeType === VoucherType.HOTEL) return (formData.amount || 0) * (formData.details.numNights || 1) * (formData.details.numRooms || 1);
    return formData.amount;
  }, [activeType, formData.amount, formData.details.numNights, formData.details.numRooms]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const roe = formData.currency === Currency.SAR ? formData.roe : 1;
    const voucherPayload = { 
      type: activeType, 
      date: new Date(formData.date).toISOString(), 
      currency: formData.currency, 
      roe, 
      totalAmountPKR: totalCalculatedAmount * roe, 
      customerId: formData.customerId, 
      vendorId: formData.vendorId, 
      description: formData.description, 
      reference: formData.reference, 
      status: VoucherStatus.POSTED, 
      details: { ...formData.details, bankId: formData.bankId, expenseId: formData.expenseId, unitRate: formData.amount } 
    };
    if (formMode === 'EDIT' && voucherToEdit) AccountingService.updateVoucher(voucherToEdit.id, voucherPayload);
    else AccountingService.postVoucher(voucherPayload);
    setShowForm(false); setVoucherToEdit(null); setRefreshKey(prev => prev + 1);
  };

  /* ---------------- FORMAT 1: HOTEL BOOKING VOUCHER (SERVICE) ---------------- */
  const renderServiceVoucher = (v: Voucher) => (
    <div className="bg-white p-12 text-black font-inter min-h-[11in] voucher-page relative">
      <div className="flex justify-between items-start mb-8">
        <div className="w-1/3">
          {config.companyLogo && <img src={config.companyLogo} style={{ height: `60px` }} alt="logo" />}
        </div>
        <div className="w-1/3 text-center">
          <h2 className="text-xl font-bold">Hotel Booking Voucher</h2>
          <p className="text-rose-600 font-bold">{config.companyName} {config.appSubtitle}</p>
        </div>
        <div className="w-1/3 text-right text-[10px] text-slate-700 leading-relaxed font-medium no-print">
          <button onClick={() => setPrintType('SERVICE')} className="bg-[#0b7ea1] text-white px-6 py-2 rounded font-bold text-xs uppercase shadow hover:bg-blue-600">Print</button>
        </div>
        <div className="w-1/3 text-right text-[10px] text-slate-700 leading-relaxed font-medium hidden print:block">
          <p>{config.companyAddress}</p>
          <p>Cell: {config.companyCell}</p>
          <p>Phone: {config.companyPhone}</p>
        </div>
      </div>
      <div className="mb-6"><p className="font-bold">Hotel Voucher: {v.voucherNum.split('-')[1]}</p></div>
      <div className="grid grid-cols-2 gap-8 mb-8 border-b-2 border-slate-100 pb-8">
        <div className="space-y-4">
          <div><p className="text-[10px] font-bold text-slate-400 uppercase">HOTEL NAME</p><p className="font-black uppercase text-slate-800">{v.details?.hotelName || 'ARTAL INTERNATIONAL HOTEL'}</p></div>
          <div><p className="text-[10px] font-bold text-slate-400 uppercase">CITY / COUNTRY</p><p className="font-bold uppercase text-slate-700 text-xs">{v.details?.city || 'MADINAH MUNAWWARAH'}-{v.details?.country || 'SAUDIA ARABIA'}</p></div>
        </div>
        <div className="space-y-4">
          <div><p className="text-[10px] font-bold text-slate-400 uppercase">CHECK-IN</p><p className="font-black text-sm">{v.details?.fromDate ? new Date(v.details.fromDate).toDateString() : 'N/A'}</p></div>
          <div><p className="text-[10px] font-bold text-slate-400 uppercase">CHECK-OUT</p><p className="font-black text-sm">{v.details?.toDate ? new Date(v.details.toDate).toDateString() : 'N/A'}</p></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-8 mb-10">
        <div><p className="text-[10px] font-bold text-slate-400 uppercase">LEAD GUEST</p><p className="font-black uppercase text-slate-800">{v.details?.paxName || 'N/A'}</p></div>
        <div><p className="text-[10px] font-bold text-slate-400 uppercase">ROOM(S) / NIGHT(S)</p><p className="font-black text-xs">{v.details?.numRooms || 1} / {v.details?.numNights || 1}</p></div>
      </div>
      <table className="w-full text-[11px] border-collapse mb-10">
        <thead className="bg-slate-50 border-y-2 border-slate-200"><tr className="uppercase text-[9px] font-black text-slate-500"><th className="p-4 text-left">ROOMS/BEDS</th><th className="p-4 text-left">Room Type</th><th className="p-4 text-left">Meal</th><th className="p-4 text-left">Guest Name</th><th className="p-4 text-center">Adult(s)</th><th className="p-4 text-center">Children</th></tr></thead>
        <tbody><tr className="bg-slate-50/50"><td className="p-4 border-b font-bold">{v.details?.numRooms || 1}</td><td className="p-4 border-b font-bold">{v.details?.roomType || 'DBL C.V'}</td><td className="p-4 border-b font-bold uppercase">NONE</td><td className="p-4 border-b font-bold uppercase">{v.details?.paxName}</td><td className="p-4 border-b text-center font-bold">{v.details?.numAdults || 2}</td><td className="p-4 border-b text-center font-bold"></td></tr></tbody>
      </table>
      <div className="space-y-4 text-[11px] mb-12"><p className="font-black uppercase">Check-in/Check-out Timings & Policies</p><ul className="list-disc pl-5 space-y-1 text-slate-700"><li>The usual check-in time is 2:00/4:00 PM hours however this might vary...</li><li>Rooms may not be available for early check-in, unless especially required in advance.</li><li>Note that reservation may be canceled automatically after 18:00 hours...</li><li>The usual checkout time is at 12:00 hours however this might vary...</li></ul></div>
      <p className="text-[10px] text-slate-500 font-bold border-t pt-4 italic">Booking Notes: Check your Reservation details carefully and inform us immediately. If you need any further clarification, please do not hesitate to contact us.</p>
    </div>
  );

  /* ---------------- FORMAT 2: SAR DEFINITE INVOICE (SAR) ---------------- */
  const renderSARInvoice = (v: Voucher) => {
    const customer = accounts.find(a => a.id === v.customerId);
    const amountSAR = (v.totalAmountPKR / v.roe);
    return (
      <div className="bg-white p-12 text-black font-inter min-h-[11in] voucher-page">
        <div className="text-center mb-10">
          {config.companyLogo && <img src={config.companyLogo} style={{ height: `60px` }} alt="logo" className="mx-auto mb-4" />}
          <p className="text-rose-600 text-sm font-black uppercase tracking-widest">{config.companyName} Travels Services</p>
        </div>
        <div className="grid grid-cols-2 gap-x-20 mb-8 text-[11px] leading-tight font-black">
          <div className="space-y-1"><p>Account Name: <span className="uppercase">{customer?.name || 'NEEM TREE CUSTOMER'}</span></p><p>Subject: Definite Invoice</p><p>Confirmation #: {v.reference || 'N/A'}</p></div>
          <div className="text-right space-y-1"><p>HVI #: {v.voucherNum.split('-')[1]}</p><p>Date: {new Date(v.date).toDateString()}</p><p>Phone No: {config.companyCell}</p></div>
        </div>
        <p className="text-[11px] mb-6">Guest Name: <span className="font-black uppercase">{v.details?.paxName}</span> <span className="float-right">Option Date: <span className="font-black">30, Nov -0001</span></span></p>
        <table className="w-full text-[10px] border-collapse mb-4 font-bold">
          <thead className="bg-[#0b7ea1] text-white uppercase"><tr className="border border-slate-300"><th className="border p-2">Hotel</th><th className="border p-2">Room</th><th className="border p-2">Meal</th><th className="border p-2">Checkin</th><th className="border p-2">Checkout</th><th className="border p-2">Rooms / Nights</th><th className="border p-2">Rate</th><th className="border p-2">Total(SAR)</th></tr></thead>
          <tbody><tr><td className="border p-2 text-center uppercase">{v.details?.hotelName}</td><td className="border p-2 text-center">{v.details?.roomType}</td><td className="border p-2 text-center">Room Only</td><td className="border p-2 text-center">{v.details?.fromDate ? new Date(v.details.fromDate).toLocaleDateString() : 'N/A'}</td><td className="border p-2 text-center">{v.details?.toDate ? new Date(v.details.toDate).toLocaleDateString() : 'N/A'}</td><td className="border p-2 text-center">{v.details?.numRooms}/{v.details?.numNights}</td><td className="border p-2 text-right">{(amountSAR / (v.details?.numNights || 1) / (v.details?.numRooms || 1)).toFixed(2)}</td><td className="border p-2 text-right">{amountSAR.toLocaleString(undefined, {minimumFractionDigits:2})}</td></tr><tr className="bg-slate-50 font-black"><td colSpan={7} className="border p-2 text-right">Total:</td><td className="border p-2 text-right">SAR {amountSAR.toLocaleString(undefined, {minimumFractionDigits: 2})}</td></tr></tbody>
        </table>
        <div className="border border-[#0b7ea1] rounded overflow-hidden mb-10"><div className="bg-[#0b7ea1] text-white text-center py-1.5 text-[10px] font-black uppercase tracking-widest">TERMS AND CONDITIONS</div><div className="p-5 text-[10px] space-y-1 font-medium"><li>Above rates are net and non commission-able quoted in SAR.</li><li>Once you Re-Confirm this booking it will be:</li><div className="pl-4"><li>Non Cancellation / Non Refundable / Non Amendable</li></div><li>Check in after 16:00 hour and check out at 12:00 hour.</li><li>Triple or Quad occupancy will be through extra bed # standard room is not available.</li></div></div>
        <p className="text-[10px] font-black text-blue-800 mb-2">Bank Account Details with Account Title {config.companyName} Travels Services</p>
        <table className="w-full text-[10px] border-collapse font-bold"><thead className="bg-[#0b7ea1] text-white"><tr><th className="border p-2 text-left">Bank Name</th><th className="border p-2 text-left">Bank Address</th><th className="border p-2 text-left">Bank Accounts</th></tr></thead><tbody>{config.banks.map((b, i) => (<tr key={i}><td className="border p-2">{b.name}</td><td className="border p-2">Saudi Arabia Branch</td><td className="border p-2">{b.accountNumber}</td></tr>))}</tbody></table>
      </div>
    );
  };

  /* ---------------- FORMAT 3: PKR FORMAL INVOICE (OFFICIAL) ---------------- */
  const renderFormalInvoice = (v: Voucher) => {
    const customer = accounts.find(a => a.id === v.customerId);
    const ratePerNight = v.totalAmountPKR / (v.details?.numNights || 1) / (v.details?.numRooms || 1);
    return (
      <div className="bg-white p-16 text-black font-inter min-h-[11in] voucher-page">
        <div className="flex justify-between items-start mb-10">
          <div className="w-1/3">{config.companyLogo && <img src={config.companyLogo} style={{ height: `60px` }} alt="logo" />}</div>
          <div className="w-1/3 text-center"><p className="text-rose-600 text-lg font-black">{config.companyName} Travels Services</p></div>
          <div className="w-1/3 text-right"><p className="text-xl font-bold text-amber-600">Invoice # <span className="ml-10 text-slate-900 font-black">{v.voucherNum.split('-')[1]}</span></p><p className="text-amber-600 font-black uppercase text-lg mt-1">{v.details?.hotelName}</p></div>
        </div>
        <div className="border-t-2 border-slate-100 pt-8 text-sm mb-12 space-y-1 font-medium">
          <p>Dear Sir:</p><p>Greeting From <span className="text-rose-600 font-black">{config.companyName} Travels Services</span></p><p>We are pleased to confirm the following reservation on a <span className="font-black">Definite basis .</span></p>
          <div className="pt-4 flex"><span className="font-black w-32 uppercase">Account Name:</span> <span className="font-black uppercase">{customer?.name || 'NEEM TREE CUSTOMER'}</span></div>
        </div>
        <table className="w-full text-xs border-collapse mb-10"><thead className="bg-slate-200"><tr className="uppercase text-[10px] font-black tracking-widest"><th className="border p-3 text-left">Hotel</th><th className="border p-3 text-left">Guest Name</th><th className="border p-3 text-left">Location</th><th className="border p-3 text-left">CONF NO</th></tr></thead><tbody><tr className="font-bold"><td className="border p-3 uppercase">{v.details?.hotelName}</td><td className="border p-3 uppercase">{v.details?.paxName}</td><td className="border p-3 uppercase">MADINAH MUNAWWARAH-SAUDIA ARABIA</td><td className="border p-3">N/A</td></tr></tbody></table>
        <table className="w-full text-[10px] border-collapse mb-12"><thead className="bg-slate-200"><tr className="uppercase font-black text-slate-700 tracking-tighter"><th className="border p-3">ROOM TYPE</th><th className="border p-3">MEAL</th><th className="border p-3">CHECK IN</th><th className="border p-3">CHECK OUT</th><th className="border p-3">NIGHT (s)</th><th className="border p-3">ROOM (s)</th><th className="border p-3">RATE/R/N</th><th className="border p-3">HCN</th><th className="border p-3">TOTAL</th></tr></thead>
        <tbody className="font-black"><tr><td className="border p-3 uppercase text-center">{v.details?.roomType}</td><td className="border p-3 text-center">None</td><td className="border p-3 text-center">{new Date(v.details?.fromDate).toDateString()}</td><td className="border p-3 text-center">{new Date(v.details?.toDate).toDateString()}</td><td className="border p-3 text-center">{v.details?.numNights}</td><td className="border p-3 text-center">{v.details?.numRooms}</td><td className="border p-3 text-right">{ratePerNight.toLocaleString(undefined, {minimumFractionDigits:2})}</td><td className="border p-3"></td><td className="border p-3 text-right">PKR {v.totalAmountPKR.toLocaleString(undefined, {minimumFractionDigits:2})}</td></tr></tbody></table>
        <div className="mb-12"><p className="font-black text-slate-800 text-sm mb-4">Bank Details</p><table className="w-full text-[10px] border-collapse font-bold"><thead className="bg-slate-200"><tr><th className="border p-2">Sr. #</th><th className="border p-2 text-left">Bank Name</th><th className="border p-2 text-left">Account Name</th><th className="border p-2 text-left">Account Number</th><th className="border p-2 text-left">Bank Address</th></tr></thead><tbody>{config.banks.map((b, i) => (<tr key={i}><td className="border p-2 text-center">{i+1}</td><td className="border p-2">{b.name}</td><td className="border p-2 uppercase">{config.companyName}</td><td className="border p-2">{b.accountNumber}</td><td className="border p-2">Karachi, PK</td></tr>))}</tbody></table></div>
        <div className="text-[10px] space-y-4 border-t-2 pt-6"><p className="font-black uppercase tracking-widest border-b border-slate-900 inline-block pr-10">Notes</p><ul className="list-disc pl-5 space-y-1 font-bold text-slate-700"><li>ANY INVOICE OBJECTIONS MUST BE SENT TO US WITHIN 3 DAYS OF RECEIPT.</li><li>IF PAYMENT'S MADE, DISREGARD THIS INVOICE.</li><li>ALL PAYMENTS SHOULD BE MADE AGAINST THE COMPANY ACCOUNTS ONLY</li></ul></div>
      </div>
    );
  };

  /* ---------------- FORMAT 4: PKR ACCOUNT SUMMARY (PKR) ---------------- */
  const renderPKRSummaryInvoice = (v: Voucher) => {
    const customer = accounts.find(a => a.id === v.customerId);
    return (
      <div className="bg-white p-12 text-black font-inter min-h-[11in] voucher-page">
        <div className="flex justify-between items-start mb-12">
          <div className="w-1/3">{config.companyLogo && <img src={config.companyLogo} style={{ height: `60px` }} alt="logo" />}</div>
          <div className="w-1/3 text-center pt-10"><p className="text-rose-600 font-black uppercase text-sm tracking-widest">{config.companyName} Travels Services</p></div>
          <div className="w-1/3 text-right"><div className="border border-slate-900 p-3 inline-block min-w-[220px] text-center font-black text-xs uppercase shadow-sm"><p className="border-b border-slate-900 pb-2 mb-2">INVOICE : {v.voucherNum.split('-')[1]}</p><p>(PKR) = {v.totalAmountPKR.toLocaleString()}</p></div></div>
        </div>
        <div className="text-[11px] leading-relaxed text-slate-800 mb-10 space-y-0.5 font-bold"><p>{config.companyAddress}</p><p><span className="font-black">CELL :</span> {config.companyCell} - <span className="font-black">PHONE :</span> {config.companyPhone} - <span className="font-black">EMAIL :</span> {config.companyEmail}</p><p><span className="font-black">Status:</span> Definite Invoice</p></div>
        <table className="w-full text-[10px] border-collapse mb-6 font-black"><thead className="bg-[#0b7ea1] text-white uppercase border border-slate-300"><tr><th className="border p-3">Account Name:</th><th className="border p-3">Hotel Invoice Date #</th><th className="border p-3">Option Date</th><th className="border p-3">Confirmation #</th></tr></thead><tbody><tr><td className="border p-3 text-center uppercase">{customer?.name || 'NEEM TREE CUSTOMER'}</td><td className="border p-3 text-center">{new Date(v.date).toDateString()}</td><td className="border p-3 text-center">30, Nov -0001</td><td className="border p-3 text-center">N/A</td></tr></tbody></table>
        <table className="w-full text-[10px] border-collapse mb-8 font-black"><thead className="bg-[#0b7ea1] text-white uppercase border border-slate-300"><tr><th className="border p-3">Pax Name</th><th className="border p-3">Hotel</th><th className="border p-3">Room Type #</th><th className="border p-3">Meal</th><th className="border p-3">Destination</th><th className="border p-3">Checkin Checkout</th><th className="border p-3">Amount(PKR)</th></tr></thead>
        <tbody><tr><td className="border p-3 uppercase text-center">{v.details?.paxName}</td><td className="border p-3 uppercase text-center">{v.details?.hotelName}</td><td className="border p-3 text-center font-black">{v.details?.roomType}</td><td className="border p-3 text-center font-black">None</td><td className="border p-3 text-center uppercase font-black text-[9px] leading-tight">MADINAH MUNAWWARAH-SAUDIA ARABIA</td><td className="border p-3 text-center text-[9px] font-black">{new Date(v.details?.fromDate).toLocaleDateString()}<br/>{new Date(v.details?.toDate).toLocaleDateString()}</td><td className="border p-3 text-right font-black">{v.totalAmountPKR.toLocaleString()}</td></tr><tr className="font-black bg-slate-50"><td colSpan={6} className="border p-3 text-right">Total:</td><td className="border p-3 text-right font-black">PKR {v.totalAmountPKR.toLocaleString(undefined, {minimumFractionDigits: 2})}</td></tr></tbody></table>
        <div className="text-[11px] font-black uppercase mb-8 pt-4 border-t border-slate-100">IN WORDS: {amountToWords(v.totalAmountPKR)}</div>
        <p className="text-[11px] font-black mb-12">On behalf of {config.companyName} Travels Services</p>
        <div className="space-y-4 text-[10px] font-bold text-slate-700 border-t-2 pt-6"><p className="font-black text-slate-900 text-sm uppercase tracking-widest mb-2">Acknowledgement</p><ol className="list-decimal pl-6 space-y-1"><li>ANY INVOICE OBJECTIONS MUST BE SENT TO US WITHIN 3 DAYS OF RECEIPT.</li><li>IF PAYMENT'S MADE, DISREGARD THIS INVOICE.</li><li>ALL PAYMENTS SHOULD BE MADE AGAINST THE COMPANY ACCOUNTS ONLY</li><li>ALL PAYMENTS SHOULD BE MADE AGAINST THE COMPANY ACCOUNTS ONLY</li></ol></div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className={`${printType || viewingVoucher ? 'hidden' : 'block'}`}>
        <div className="flex flex-wrap gap-2 no-print bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          {Object.entries(VoucherType).map(([key, val]) => (
            <button key={val} onClick={() => setActiveType(val)} className={`px-5 py-2.5 rounded-xl font-bold transition-all text-sm ${activeType === val ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{key.replace('_', ' ')}</button>
          ))}
        </div>
        <div className="flex justify-between items-center mt-6 no-print"><h2 className="text-2xl font-bold text-slate-800 dark:text-white uppercase tracking-tight">{activeType} Central Console</h2><button onClick={() => { setFormMode('CREATE'); setVoucherToEdit(null); setShowForm(true); }} className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-8 py-3.5 rounded-2xl font-bold shadow-xl active:scale-95 transition-all">+ New {activeType}</button></div>
        <div className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-xl mt-6">
          <table className="w-full text-left"><thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-xs uppercase tracking-widest font-bold"><tr><th className="px-6 py-5">Date / ID</th><th className="px-6 py-5">Customer & Description</th><th className="px-6 py-5 text-right">PKR Total</th><th className="px-6 py-5 text-center">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{filteredVouchers.map((v) => (
              <tr key={v.id} className="hover:bg-blue-50/20 transition-colors group"><td className="px-6 py-5"><p className="text-sm font-medium">{new Date(v.date).toLocaleDateString()}</p><p className="font-bold text-blue-600 text-xs uppercase">{v.voucherNum}</p></td><td className="px-6 py-5"><p className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase">{accounts.find(a => a.id === v.customerId)?.name || 'Walk-in'}</p><p className="text-xs text-slate-500 truncate max-w-xs">{v.description || `${v.type} Transaction`}</p></td><td className="px-6 py-5 text-right"><p className="font-orbitron font-bold text-lg">{v.totalAmountPKR.toLocaleString()}</p></td>
                <td className="px-6 py-5 text-center"><div className="flex justify-center space-x-2">
                  <button onClick={() => { setViewingVoucher(v); setInspectorView('SERVICE'); }} className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white">👁️</button>
                  <button onClick={() => handleClone(v)} className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white">📑</button>
                  <button onClick={() => handleEdit(v)} className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded-lg hover:bg-amber-600 hover:text-white">✏️</button>
                  <button onClick={() => handleDelete(v.id)} className="p-2 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white">🗑️</button>
                </div></td></tr>))}
            </tbody>
          </table>
        </div>
      </div>

      {viewingVoucher && !printType && (
        <div className="fixed inset-0 z-[100] bg-slate-100 dark:bg-slate-950 flex flex-col no-print overflow-y-auto">
          <div className="bg-[#0f172a] text-white p-6 shadow-2xl flex flex-col md:flex-row justify-between items-center sticky top-0 z-20">
            <div className="flex items-center space-x-6"><button onClick={() => setViewingVoucher(null)} className="p-3 bg-slate-800 rounded-xl hover:bg-slate-700 font-black">←</button><div><h3 className="text-2xl font-black font-orbitron uppercase">Voucher Inspector</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Audit Ref: {viewingVoucher.voucherNum}</p></div></div>
            <div className="flex items-center space-x-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
              {['SERVICE', 'SAR', 'OFFICIAL', 'PKR'].map((v: any) => (<button key={v} onClick={() => setInspectorView(v)} className={`px-6 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${inspectorView === v ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>{v} View</button>))}
            </div>
            <div className="flex items-center space-x-3"><button onClick={() => setPrintType(inspectorView as any)} className="px-5 py-3 bg-[#0b7ea1] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center space-x-2 hover:bg-blue-500 shadow-xl font-black"><span>🖨️</span> <span>Download PDF / Print</span></button><button onClick={() => { setViewingVoucher(null); handleEdit(viewingVoucher); }} className="px-5 py-3 bg-slate-800 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700"><span>✏️</span> <span>Edit Entry</span></button></div>
          </div>
          <div className="flex-1 p-8 md:p-12 flex justify-center bg-slate-100 dark:bg-slate-950">
            <div className="w-full max-w-5xl shadow-2xl rounded-xl overflow-hidden bg-white">
               {inspectorView === 'SERVICE' && renderServiceVoucher(viewingVoucher)}
               {inspectorView === 'SAR' && renderSARInvoice(viewingVoucher)}
               {inspectorView === 'OFFICIAL' && renderFormalInvoice(viewingVoucher)}
               {inspectorView === 'PKR' && renderPKRSummaryInvoice(viewingVoucher)}
            </div>
          </div>
        </div>
      )}

      {printType && viewingVoucher && (
        <div className="fixed inset-0 z-[999] bg-white text-slate-900 print-only overflow-visible">
          {printType === 'SERVICE' && renderServiceVoucher(viewingVoucher)}
          {printType === 'SAR' && renderSARInvoice(viewingVoucher)}
          {printType === 'OFFICIAL' && renderFormalInvoice(viewingVoucher)}
          {printType === 'PKR' && renderPKRSummaryInvoice(viewingVoucher)}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-[2.5rem] shadow-2xl p-8 md:p-12 border border-white/10 my-10 animate-in slide-in-from-bottom-6 duration-300">
            <div className="flex justify-between items-start mb-8"><div><h3 className="text-3xl font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500 uppercase tracking-tighter">{formMode} {activeType}</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-2">Enterprise Double-Entry Authorization</p></div><button onClick={() => setShowForm(false)} className="text-2xl hover:rotate-90 transition-transform">✕</button></div>
            <form onSubmit={handleSave} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-50 dark:bg-slate-800/30 p-8 rounded-[2rem]">
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Date</label><input type="date" required className="w-full bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm font-bold text-sm" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Currency</label><select className="w-full bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm font-bold text-sm" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value as Currency})}><option value={Currency.PKR}>PKR</option><option value={Currency.SAR}>SAR</option></select></div>
                {formData.currency === Currency.SAR && (<div className="space-y-1"><label className="text-[10px] font-bold text-blue-600 uppercase ml-1">ROE</label><input type="number" step="0.01" className="w-full bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 font-bold text-sm" value={formData.roe} onChange={e => setFormData({...formData, roe: Number(e.target.value)})} /></div>)}
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">{activeType === VoucherType.HOTEL ? 'Rate/Unit' : 'Amount'}</label><input type="number" required className="w-full bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm font-orbitron font-bold text-lg text-blue-600" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} /></div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Customer (Dr)</label><select required className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl p-3 text-sm font-semibold" value={formData.customerId} onChange={e => setFormData({...formData, customerId: e.target.value})}><option value="">Payer...</option>{accounts.filter(a => a.type === AccountType.CUSTOMER).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Vendor (Cr)</label><select required className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl p-3 text-sm font-semibold" value={formData.vendorId} onChange={e => setFormData({...formData, vendorId: e.target.value})}><option value="">Payee...</option>{accounts.filter(a => a.type === AccountType.VENDOR).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                  </div>
                  <input required className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl p-4 text-sm font-bold" placeholder="Lead Pax Name" value={formData.details.paxName} onChange={e => setFormData({...formData, details: {...formData.details, paxName: e.target.value}})} />
                  {activeType === VoucherType.HOTEL && (
                    <><div className="grid grid-cols-2 gap-4"><input required className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl p-3 text-sm" placeholder="Hotel Name" value={formData.details.hotelName} onChange={e => setFormData({...formData, details: {...formData.details, hotelName: e.target.value}})} /><select className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl p-3 text-sm font-semibold" value={formData.details.roomType} onChange={e => setFormData({...formData, details: {...formData.details, roomType: e.target.value}})}>{['Single', 'Double', 'Triple', 'Quad', 'Suite', 'DBL C.V'].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                      <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Check In</label><input type="date" required className="w-full bg-white dark:bg-slate-800 rounded-xl p-3 text-sm" value={formData.details.fromDate} onChange={e => setFormData({...formData, details: {...formData.details, fromDate: e.target.value}})} /></div><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Check Out</label><input type="date" required className="w-full bg-white dark:bg-slate-800 rounded-xl p-3 text-sm" value={formData.details.toDate} onChange={e => setFormData({...formData, details: {...formData.details, toDate: e.target.value}})} /></div></div></>)}
                </div>
                <div className="space-y-6">{activeType === VoucherType.HOTEL && (<div className="bg-slate-50 dark:bg-slate-800/20 p-6 rounded-[2rem] space-y-4"><div className="grid grid-cols-4 gap-2 text-center"><div><label className="text-[8px] font-bold text-slate-400 uppercase">Nights</label><input readOnly className="w-full bg-slate-200 dark:bg-slate-900 rounded-lg p-2 font-bold text-xs" value={formData.details.numNights} /></div><div><label className="text-[8px] font-bold text-slate-400 uppercase">Rooms</label><input type="number" min="1" className="w-full bg-white dark:bg-slate-800 rounded-lg p-2 text-xs" value={formData.details.numRooms} onChange={e => setFormData({...formData, details: {...formData.details, numRooms: Number(e.target.value)}})} /></div><div><label className="text-[8px] font-bold text-slate-400 uppercase">Adults</label><input type="number" min="1" className="w-full bg-white dark:bg-slate-800 rounded-lg p-2 text-xs" value={formData.details.numAdults} onChange={e => setFormData({...formData, details: {...formData.details, numAdults: Number(e.target.value)}})} /></div><div><label className="text-[8px] font-bold text-slate-400 uppercase">Children</label><input type="number" min="0" className="w-full bg-white dark:bg-slate-800 rounded-lg p-2 text-xs" value={formData.details.numChildren} onChange={e => setFormData({...formData, details: {...formData.details, numChildren: Number(e.target.value)}})} /></div></div></div>)}<textarea className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl p-4 h-[100px] text-sm" placeholder="Internal Narrative / Remarks..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
              </div>
              <div className="bg-slate-900 p-10 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center text-white"><div><p className="text-[10px] font-bold uppercase opacity-60">Calculated Total</p><p className="text-5xl font-orbitron font-bold">{totalCalculatedAmount.toLocaleString()} {formData.currency}</p></div>{formData.currency === Currency.SAR && (<div className="text-right mt-4 md:mt-0"><p className="text-[10px] font-bold uppercase opacity-60">Measured PKR</p><p className="text-4xl font-orbitron font-bold text-cyan-400">{(totalCalculatedAmount * formData.roe).toLocaleString()}</p></div>)}</div>
              <div className="flex space-x-4"><button type="button" onClick={() => setShowForm(false)} className="flex-1 py-5 bg-slate-100 dark:bg-slate-800 font-bold rounded-2xl">Discard</button><button type="submit" className="flex-[2] py-5 bg-blue-600 text-white font-bold rounded-2xl shadow-xl">Commit Transaction</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vouchers;