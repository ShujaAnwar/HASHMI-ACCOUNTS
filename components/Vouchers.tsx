import React, { useState, useMemo, useEffect } from 'react';
import { VoucherType, Currency, AccountType, Account, Voucher, VoucherStatus } from '../types';
import { getAccounts, getVouchers, getConfig } from '../services/db';
import { AccountingService } from '../services/AccountingService';

const CITIES_BY_COUNTRY: Record<string, string[]> = {
  "Saudi Arabia": ["Makkah", "Madinah", "Jeddah", "Riyadh", "Dammam", "Abha"],
  "Pakistan": ["Islamabad", "Lahore", "Karachi", "Peshawar", "Quetta", "Multan"],
  "UAE": ["Dubai", "Abu Dhabi", "Sharjah", "Ajman"],
  "Turkey": ["Istanbul", "Antalya", "Ankara", "Izmir"],
  "Egypt": ["Cairo", "Sharm El-Sheikh", "Alexandria"]
};

const TRANSPORT_PRESETS = [
  { label: 'Makkah → Jeddah (H1)', sector: 'Makkah → Jeddah', vehicle: 'H1', rate: 200, currency: Currency.SAR },
  { label: 'Makkah → Jeddah (Car)', sector: 'Makkah → Jeddah', vehicle: 'Sedan', rate: 150, currency: Currency.SAR },
  { label: 'Makkah → Madinah → Makkah (H1)', sector: 'Makkah → Madinah → Makkah', vehicle: 'H1', rate: 400, currency: Currency.SAR },
  { label: 'Makkah → Madinah → Makkah (Car)', sector: 'Makkah → Madinah → Makkah', vehicle: 'Sedan', rate: 350, currency: Currency.SAR },
  { label: 'Madinah Hotel → Airport (H1/Car)', sector: 'Madinah Hotel → Madinah Airport', vehicle: 'H1', rate: 100, currency: Currency.SAR },
];

const Vouchers: React.FC = () => {
  const [activeType, setActiveType] = useState<VoucherType>(VoucherType.RECEIPT);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'CREATE' | 'EDIT' | 'CLONE'>('CREATE');
  const [viewingVoucher, setViewingVoucher] = useState<Voucher | null>(null);
  const [voucherToEdit, setVoucherToEdit] = useState<Voucher | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  
  const accounts = useMemo(() => getAccounts(), []);
  const config = useMemo(() => getConfig(), []);
  const allVouchers = useMemo(() => getVouchers(), [showForm]);

  const filteredVouchers = useMemo(() => {
    return allVouchers
      .filter(v => v.type === activeType)
      .filter(v => filterStatus === 'ALL' || v.status === filterStatus)
      .filter(v => 
        v.voucherNum.toLowerCase().includes(searchTerm.toLowerCase()) || 
        v.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.reference?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allVouchers, activeType, searchTerm, filterStatus]);

  // General Form State
  const [formData, setFormData] = useState<any>({
    date: new Date().toISOString().split('T')[0],
    currency: Currency.PKR,
    roe: config.defaultROE,
    amount: 0, 
    customerId: '',
    vendorId: '',
    description: '',
    reference: '',
    bankId: config.banks[0]?.id || '',
    expenseId: '',
    details: {
      paxName: '',
      hotelName: '',
      country: 'Saudi Arabia',
      city: 'Makkah',
      roomType: 'Single',
      fromDate: '',
      toDate: '',
      numNights: 0,
      numRooms: 1,
      meals: { breakfast: false, lunch: false, dinner: false },
      numAdults: 1,
      numChildren: 0,
      sector: '',
      vehicle: 'Bus',
      ticketNum: '',
      airline: '',
      visaType: 'Umrah'
    }
  });

  // Handle Edit/Clone setup
  useEffect(() => {
    if (voucherToEdit) {
      setFormData({
        date: voucherToEdit.date.split('T')[0],
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

  // Auto-calculate nights for Hotel
  useEffect(() => {
    if (activeType === VoucherType.HOTEL && formData.details.fromDate && formData.details.toDate) {
      const start = new Date(formData.details.fromDate);
      const end = new Date(formData.details.toDate);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 0;
      
      if (diffDays !== formData.details.numNights) {
        setFormData((prev: any) => ({
          ...prev,
          details: { ...prev.details, numNights: Math.max(0, diffDays) }
        }));
      }
    }
  }, [formData.details.fromDate, formData.details.toDate, activeType]);

  const totalCalculatedAmount = useMemo(() => {
    if (activeType === VoucherType.HOTEL) {
      return (formData.amount || 0) * (formData.details.numNights || 0) * (formData.details.numRooms || 0);
    }
    return formData.amount;
  }, [activeType, formData.amount, formData.details.numNights, formData.details.numRooms]);

  const applyPreset = (preset: typeof TRANSPORT_PRESETS[0]) => {
    setFormData((prev: any) => ({
      ...prev,
      currency: preset.currency,
      amount: preset.rate,
      details: {
        ...prev.details,
        sector: preset.sector,
        vehicle: preset.vehicle
      }
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.currency === Currency.SAR && formData.roe <= 0) {
      alert("Please enter a valid Rate of Exchange (ROE) greater than 0.");
      return;
    }
    if (totalCalculatedAmount <= 0) {
      alert("Voucher amount must be greater than zero.");
      return;
    }

    const roe = formData.currency === Currency.SAR ? formData.roe : 1;
    const finalAmountPKR = totalCalculatedAmount * roe;

    let desc = formData.description;
    if (!desc) {
      if (activeType === VoucherType.HOTEL) {
        desc = `Hotel: ${formData.details.hotelName} (${formData.details.numNights} nights) for ${formData.details.paxName}`;
      } else if (activeType === VoucherType.VISA) {
        desc = `Visa: ${formData.details.visaType} (${formData.details.country}) for ${formData.details.paxName}`;
      } else if (activeType === VoucherType.TRANSPORT) {
        desc = `Transport: ${formData.details.vehicle} (${formData.details.sector}) for ${formData.details.paxName}`;
      } else if (activeType === VoucherType.TICKET) {
        desc = `Ticket: ${formData.details.airline} (${formData.details.ticketNum}) for ${formData.details.paxName}`;
      }
    }

    const voucherPayload = {
      type: activeType,
      date: new Date(formData.date).toISOString(),
      currency: formData.currency,
      roe: roe,
      totalAmountPKR: finalAmountPKR,
      customerId: formData.customerId,
      vendorId: formData.vendorId,
      description: desc || `${activeType} Entry`,
      reference: formData.reference,
      status: VoucherStatus.POSTED,
      details: {
        bankId: formData.bankId,
        expenseId: formData.expenseId,
        ...formData.details,
        unitRate: formData.amount,
        totalInCurrency: totalCalculatedAmount
      }
    };

    if (formMode === 'EDIT' && voucherToEdit) {
      AccountingService.updateVoucher(voucherToEdit.id, voucherPayload);
    } else {
      AccountingService.postVoucher(voucherPayload);
    }

    setShowForm(false);
    resetForm();
  };

  const resetForm = () => {
    setFormMode('CREATE');
    setVoucherToEdit(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      currency: Currency.PKR,
      roe: config.defaultROE,
      amount: 0,
      customerId: '',
      vendorId: '',
      description: '',
      reference: '',
      bankId: config.banks[0]?.id || '',
      expenseId: '',
      details: {
        paxName: '',
        hotelName: '',
        country: 'Saudi Arabia',
        city: 'Makkah',
        roomType: 'Single',
        fromDate: '',
        toDate: '',
        numNights: 0,
        numRooms: 1,
        meals: { breakfast: false, lunch: false, dinner: false },
        numAdults: 1,
        numChildren: 0,
        sector: '',
        vehicle: 'Bus',
        ticketNum: '',
        airline: '',
        visaType: 'Umrah'
      }
    });
  };

  const handleEdit = (v: Voucher) => {
    setFormMode('EDIT');
    setVoucherToEdit(v);
    setShowForm(true);
  };

  const handleClone = (v: Voucher) => {
    setFormMode('CLONE');
    setVoucherToEdit(v);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("ARE YOU SURE? This action will permanently delete this voucher and REVERSE all associated ledger entries. This cannot be undone.")) {
      AccountingService.deleteVoucher(id);
      window.location.reload(); 
    }
  };

  const isSalesVoucher = [VoucherType.HOTEL, VoucherType.TRANSPORT, VoucherType.VISA, VoucherType.TICKET].includes(activeType);

  return (
    <div className="space-y-6">
      {/* Type Switcher */}
      <div className="flex flex-wrap gap-2 no-print bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        {Object.entries(VoucherType).map(([key, val]) => (
          <button
            key={val}
            onClick={() => {
              setActiveType(val);
              resetForm();
            }}
            className={`px-5 py-2.5 rounded-xl font-bold transition-all text-sm ${
              activeType === val 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {key.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Filter Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 no-print">
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-64">
            <input 
              type="text" 
              placeholder="Search by Voucher # or Ref"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 pl-10 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="absolute left-3 top-3 opacity-40">🔍</span>
          </div>
          <select 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="ALL">All Status</option>
            <option value={VoucherStatus.POSTED}>Posted</option>
            <option value={VoucherStatus.VOID}>Void</option>
          </select>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="w-full lg:w-auto bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-8 py-3.5 rounded-2xl font-bold shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
        >
          + New {activeType} Voucher
        </button>
      </div>

      {/* List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-xs uppercase tracking-widest font-bold">
              <tr>
                <th className="px-6 py-5">Date / Voucher #</th>
                <th className="px-6 py-5">Account & Description</th>
                <th className="px-6 py-5 text-right">Total Amount (PKR)</th>
                <th className="px-6 py-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredVouchers.map((v) => {
                const debitAccount = v.type === VoucherType.PAYMENT 
                  ? accounts.find(a => a.id === v.details?.expenseId)?.name 
                  : (v.customerId ? accounts.find(a => a.id === v.customerId)?.name : 'N/A');

                return (
                  <tr key={v.id} className="hover:bg-blue-50/20 dark:hover:bg-blue-900/10 transition-colors group">
                    <td className="px-6 py-5">
                      <p className="text-sm font-medium">{new Date(v.date).toLocaleDateString()}</p>
                      <p className="font-bold text-blue-600 dark:text-blue-400 text-xs">{v.voucherNum}</p>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                          {debitAccount || 'Unknown Account'}
                        </p>
                        <p className="text-xs text-slate-500 truncate max-w-xs">{v.description}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <p className="font-orbitron font-bold text-lg">{v.totalAmountPKR.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400">{v.currency} { (v.totalAmountPKR / v.roe).toLocaleString() } @ {v.roe}</p>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex justify-center items-center space-x-2">
                         <button onClick={() => setViewingVoucher(v)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-blue-500 transition-all" title="View Details">👁️</button>
                         <button onClick={() => handleEdit(v)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-amber-500 transition-all" title="Edit Record">✏️</button>
                         <button onClick={() => handleClone(v)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-emerald-500 transition-all" title="Clone Voucher">📑</button>
                         <button onClick={() => handleDelete(v.id)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-rose-500 transition-all" title="Delete & Reverse">🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredVouchers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <div className="opacity-30 mb-2 text-4xl">📄</div>
                    <p className="text-slate-400 italic">No {activeType} records found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Modal */}
      {viewingVoucher && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-[2.5rem] shadow-2xl p-10 border border-white/10 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-10 border-b dark:border-slate-800 pb-6">
              <div>
                <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-widest">Transaction Post Review</span>
                <h3 className="text-3xl font-orbitron font-bold text-slate-900 dark:text-white mt-2">{viewingVoucher.voucherNum}</h3>
                <p className="text-slate-400 text-sm">Recorded on {new Date(viewingVoucher.date).toLocaleString()}</p>
              </div>
              <button onClick={() => setViewingVoucher(null)} className="text-2xl opacity-40 hover:opacity-100">✕</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div>
                   <p className="text-[10px] font-bold text-slate-400 mb-1">Financial Narrative</p>
                   <p className="font-bold text-lg leading-snug">{viewingVoucher.description}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] font-bold text-slate-400 mb-2">Ledger Measurement</p>
                  <p className="text-3xl font-orbitron font-bold text-blue-600">PKR {viewingVoucher.totalAmountPKR.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-1">Exchange Basis: {viewingVoucher.currency} @ {viewingVoucher.roe}</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <p className="text-[10px] font-bold text-slate-400 mb-1">Debit Account</p>
                      <p className="font-bold text-sm">
                        {viewingVoucher.type === VoucherType.PAYMENT ? (accounts.find(a => a.id === viewingVoucher.details?.expenseId)?.name) : (viewingVoucher.customerId ? accounts.find(a => a.id === viewingVoucher.customerId)?.name : 'N/A')}
                      </p>
                   </div>
                   <div>
                      <p className="text-[10px] font-bold text-slate-400 mb-1">Credit Account</p>
                      <p className="font-bold text-sm">
                        {viewingVoucher.vendorId ? accounts.find(a => a.id === viewingVoucher.vendorId)?.name : (viewingVoucher.details?.bankId ? accounts.find(a => a.id === viewingVoucher.details.bankId)?.name : 'N/A')}
                      </p>
                   </div>
                </div>
                {viewingVoucher.reference && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 mb-1">Audit Reference</p>
                    <p className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg inline-block">{viewingVoucher.reference}</p>
                  </div>
                )}
              </div>
            </div>

            <button onClick={() => setViewingVoucher(null)} className="w-full mt-10 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl transition-all hover:scale-[1.01] active:scale-95 text-xs uppercase tracking-widest">Close Detailed View</button>
          </div>
        </div>
      )}

      {/* Main Form Modal (Create / Edit / Clone) */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-[2.5rem] shadow-2xl p-6 md:p-10 transform animate-in slide-in-from-bottom-4 duration-300 my-8 border border-white/10">
            <div className="flex justify-between items-start mb-6">
               <div>
                  <h3 className="text-2xl md:text-3xl font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
                    {formMode === 'EDIT' ? 'Update' : (formMode === 'CLONE' ? 'Clone' : 'Authorize')} {activeType} Voucher
                  </h3>
                  <p className="text-slate-400 text-xs mt-1 uppercase tracking-widest">
                    {formMode === 'EDIT' ? `Modifying Audit Record: ${voucherToEdit?.voucherNum}` : 'Double-Entry Financial System Posting'}
                  </p>
               </div>
               <button onClick={() => { setShowForm(false); resetForm(); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-xl">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              {/* Common Header Info */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50/50 dark:bg-slate-800/30 p-6 rounded-[1.5rem] border border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Voucher Date</label>
                  <input 
                    type="date"
                    required
                    className="w-full bg-white dark:bg-slate-800 border-none rounded-xl p-2.5 shadow-sm font-bold text-sm"
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Currency</label>
                  <select 
                    className="w-full bg-white dark:bg-slate-800 border-none rounded-xl p-2.5 shadow-sm font-bold text-sm"
                    value={formData.currency}
                    onChange={e => setFormData({...formData, currency: e.target.value as Currency})}
                  >
                    <option value={Currency.PKR}>PKR</option>
                    <option value={Currency.SAR}>SAR</option>
                  </select>
                </div>
                {formData.currency === Currency.SAR && (
                  <div>
                    <label className="block text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">ROE</label>
                    <input 
                      type="number" step="0.01" min="0.01"
                      className="w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-2.5 shadow-sm font-bold text-sm"
                      value={formData.roe}
                      onChange={e => setFormData({...formData, roe: Number(e.target.value)})}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    {activeType === VoucherType.HOTEL ? 'Rate per Room/Night' : 'Base Voucher Amount'}
                  </label>
                  <input 
                    type="number"
                    required
                    className="w-full bg-white dark:bg-slate-800 border-none rounded-xl p-2.5 shadow-sm font-bold text-lg text-blue-600 dark:text-blue-400"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: Number(e.target.value)})}
                  />
                </div>
              </div>

              {/* Dynamic Sections Based on Type */}
              {isSalesVoucher ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {activeType === VoucherType.TRANSPORT && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/30">
                        <label className="block text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">Quick Transport Presets (SAR Rates)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {TRANSPORT_PRESETS.map((preset, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => applyPreset(preset)}
                              className="text-left text-[10px] px-3 py-2 bg-white dark:bg-slate-800 rounded-lg hover:bg-blue-600 hover:text-white transition-all font-bold border border-slate-100 dark:border-slate-700 shadow-sm"
                            >
                              {preset.label} - {preset.rate} {preset.currency}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Customer (Debit Account)</label>
                        <select required className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-semibold" value={formData.customerId} onChange={e => setFormData({...formData, customerId: e.target.value})}>
                          <option value="">Select Customer...</option>
                          {accounts.filter(a => a.type === AccountType.CUSTOMER).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Vendor (Credit Account)</label>
                        <select required className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-semibold" value={formData.vendorId} onChange={e => setFormData({...formData, vendorId: e.target.value})}>
                          <option value="">Select Vendor...</option>
                          {accounts.filter(a => a.type === AccountType.VENDOR).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Pax / Traveler Name</label>
                      <input required className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl p-3 text-sm" placeholder="Full name of pax" value={formData.details.paxName} onChange={e => setFormData({...formData, details: {...formData.details, paxName: e.target.value}})} />
                    </div>

                    {activeType === VoucherType.HOTEL && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Hotel Name</label>
                          <input required className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl p-3 text-sm" value={formData.details.hotelName} onChange={e => setFormData({...formData, details: {...formData.details, hotelName: e.target.value}})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Room Type</label>
                          <select className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-semibold" value={formData.details.roomType} onChange={e => setFormData({...formData, details: {...formData.details, roomType: e.target.value}})}>
                            {['Single', 'Double', 'Triple', 'Quad', 'Quint', 'Executive Suite', 'Suite'].map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                    )}

                    {activeType === VoucherType.TRANSPORT && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Vehicle Type</label>
                          <select className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-semibold" value={formData.details.vehicle} onChange={e => setFormData({...formData, details: {...formData.details, vehicle: e.target.value}})}>
                            {['Bus', 'Sedan', 'SUV', 'GMC', 'Hiace', 'Coaster', 'H1'].map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sector / Route</label>
                          <input required className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl p-3 text-sm" placeholder="e.g. JED-MAK-MAD" value={formData.details.sector} onChange={e => setFormData({...formData, details: {...formData.details, sector: e.target.value}})} />
                        </div>
                      </div>
                    )}

                    {activeType === VoucherType.VISA && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Visa Category</label>
                          <select className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-semibold" value={formData.details.visaType} onChange={e => setFormData({...formData, details: {...formData.details, visaType: e.target.value}})}>
                            {['Umrah', 'Hajj', 'Tourist', 'Business', 'Work', 'Visit'].map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Destination Country</label>
                          <select className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-semibold" value={formData.details.country} onChange={e => setFormData({...formData, details: {...formData.details, country: e.target.value}})}>
                            {Object.keys(CITIES_BY_COUNTRY).map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                    )}

                    {activeType === VoucherType.TICKET && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Airline</label>
                          <input required className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl p-3 text-sm" placeholder="e.g. Saudi Airlines" value={formData.details.airline} onChange={e => setFormData({...formData, details: {...formData.details, airline: e.target.value}})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Ticket Number</label>
                          <input required className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-mono" placeholder="13 digits" value={formData.details.ticketNum} onChange={e => setFormData({...formData, details: {...formData.details, ticketNum: e.target.value}})} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {activeType === VoucherType.HOTEL ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Check-in</label>
                            <input type="date" required className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl p-3 text-sm" value={formData.details.fromDate} onChange={e => setFormData({...formData, details: {...formData.details, fromDate: e.target.value}})} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Check-out</label>
                            <input type="date" required className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl p-3 text-sm" value={formData.details.toDate} onChange={e => setFormData({...formData, details: {...formData.details, toDate: e.target.value}})} />
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Nights</label>
                            <input readOnly className="w-full bg-slate-200 dark:bg-slate-900 border-none rounded-xl p-3 text-center font-bold text-sm" value={formData.details.numNights} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Rooms</label>
                            <input type="number" min="1" className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl p-3 text-center text-sm font-bold" value={formData.details.numRooms} onChange={e => setFormData({...formData, details: {...formData.details, numRooms: Number(e.target.value)}})} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Adults</label>
                            <input type="number" min="1" className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl p-3 text-center text-sm" value={formData.details.numAdults} onChange={e => setFormData({...formData, details: {...formData.details, numAdults: Number(e.target.value)}})} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Kids</label>
                            <input type="number" min="0" className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl p-3 text-center text-sm" value={formData.details.numChildren} onChange={e => setFormData({...formData, details: {...formData.details, numChildren: Number(e.target.value)}})} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Meals Plan</label>
                          <div className="flex space-x-4 bg-slate-100 dark:bg-slate-800 p-3 rounded-xl">
                            {['breakfast', 'lunch', 'dinner'].map(m => (
                              <label key={m} className="flex items-center space-x-2 cursor-pointer group">
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                  checked={formData.details.meals[m]} 
                                  onChange={e => setFormData({...formData, details: {...formData.details, meals: {...formData.details.meals, [m]: e.target.checked}}})} 
                                />
                                <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 group-hover:text-blue-500 transition-colors">{m}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="bg-slate-50 dark:bg-slate-800/30 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center text-center">
                         <span className="text-4xl mb-3 opacity-30">🗓️</span>
                         <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Single Posting Date</p>
                         <p className="text-[10px] text-slate-400 mt-1">Audit record will use the primary voucher date selected above.</p>
                      </div>
                    )}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Narrative / Remarks</label>
                      <textarea className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl p-3 h-20 text-sm" placeholder="Additional audit details..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                    </div>
                  </div>
                </div>
              ) : activeType === VoucherType.RECEIPT ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Credit Account (Customer)</label>
                      <select required className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold text-lg appearance-none cursor-pointer shadow-inner" value={formData.customerId} onChange={e => setFormData({...formData, customerId: e.target.value})}>
                        <option value="">Select Payer...</option>
                        {accounts.filter(a => a.type === AccountType.CUSTOMER).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Debit Account (Bank/Cash)</label>
                      <select required className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold text-lg appearance-none cursor-pointer shadow-inner" value={formData.bankId} onChange={e => setFormData({...formData, bankId: e.target.value})}>
                        {config.banks.map(b => <option key={b.id} value={b.id}>{b.name} - {b.accountNumber}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Reference / Chq #</label>
                      <input className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-medium" placeholder="Reference ID" value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Transaction Narrative</label>
                      <textarea className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 h-32 font-medium" placeholder="Explanation..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Debit Account (Expense or Vendor)</label>
                      <select required className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold text-lg appearance-none cursor-pointer shadow-inner" value={formData.expenseId} onChange={e => setFormData({...formData, expenseId: e.target.value})}>
                        <option value="">Select Account...</option>
                        <optgroup label="Operating Expenses">
                          {accounts.filter(a => a.type === AccountType.EXPENSE).map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Vendor Payables">
                          {accounts.filter(a => a.type === AccountType.VENDOR).map(a => (
                            <option key={a.id} value={a.id}>{a.name} (Balance: {a.balance.toLocaleString()})</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Credit Account (Bank/Cash)</label>
                      <select required className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold text-lg appearance-none cursor-pointer shadow-inner" value={formData.bankId} onChange={e => setFormData({...formData, bankId: e.target.value})}>
                        {config.banks.map(b => <option key={b.id} value={b.id}>{b.name} - {b.accountNumber}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Reference / Bill #</label>
                      <input className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-medium" placeholder="Bill #" value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Payment Narrative</label>
                      <textarea className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 h-32 font-medium" placeholder="Purpose of payment..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                    </div>
                  </div>
                </div>
              )}

              {/* Total Summary */}
              <div className="bg-slate-900 dark:bg-blue-600/10 p-8 rounded-[2rem] flex flex-col md:flex-row justify-between items-center text-white border border-white/5 shadow-2xl">
                <div className="text-center md:text-left">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60 mb-1">Voucher Net Total</p>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-4xl font-orbitron font-bold">{totalCalculatedAmount.toLocaleString()}</span>
                    <span className="text-sm font-bold opacity-60">{formData.currency}</span>
                  </div>
                </div>
                {formData.currency === Currency.SAR && (
                  <div className="mt-4 md:mt-0 text-center md:text-right md:border-l border-white/10 md:pl-8">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60 mb-1">Ledger Entry (PKR)</p>
                    <p className="text-3xl font-orbitron font-bold text-cyan-400">
                      {(totalCalculatedAmount * formData.roe).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex space-x-4 pt-4">
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-2xl hover:bg-slate-200 transition-all uppercase text-xs tracking-widest">Cancel</button>
                <button type="submit" className="flex-[2] py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all uppercase text-xs tracking-widest">
                   {formMode === 'EDIT' ? 'Commit Update' : (formMode === 'CLONE' ? 'Clone & Post' : 'Post Voucher')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vouchers;