import React, { useState, useMemo, useEffect } from 'react';
import { VoucherType, Currency, AccountType, Voucher, VoucherStatus, Account, AppConfig } from '../types';
import { getAccounts, getConfig } from '../services/db';

interface HotelVoucherFormProps {
  initialData?: Partial<Voucher>;
  onSave: (data: any) => void;
  onCancel: () => void;
  isClone?: boolean;
}

const ROOM_TYPES = ['Single', 'Double', 'Triple', 'Quad', 'Quint', 'Executive Suite', 'Suite', 'DBL C.V'];
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Room Only'];
const CITIES = ['Karachi', 'Lahore', 'Islamabad', 'Makkah', 'Madinah', 'Jeddah', 'Riyadh', 'Dubai'];
const COUNTRIES = ['Pakistan', 'Saudi Arabia', 'UAE', 'Turkey', 'USA', 'UK'];

const HotelVoucherForm: React.FC<HotelVoucherFormProps> = ({ initialData, onSave, onCancel, isClone }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [accs, conf] = await Promise.all([getAccounts(), getConfig()]);
      setAccounts(accs);
      setConfig(conf);
      setLoading(false);
    };
    load();
  }, []);

  const [formData, setFormData] = useState({
    date: initialData?.date?.split('T')[0] || new Date().toISOString().split('T')[0],
    currency: initialData?.currency || Currency.PKR,
    roe: initialData?.roe || 1,
    voucherNum: initialData?.voucherNum || `HV-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    customerId: initialData?.customerId || '',
    vendorId: initialData?.vendorId || '',
    incomeAccountId: initialData?.details?.incomeAccountId || '',
    description: initialData?.description || '',
    reference: isClone ? '' : (initialData?.reference || ''),
    paxName: initialData?.details?.paxName || '',
    hotelName: initialData?.details?.hotelName || '',
    city: initialData?.details?.city || 'Karachi',
    country: initialData?.details?.country || 'Pakistan',
    roomType: initialData?.details?.roomType || 'DBL C.V',
    numRooms: initialData?.details?.numRooms || 1,
    numNights: initialData?.details?.numNights || 0,
    unitRate: initialData?.details?.unitRate || 0,
    serviceFee: initialData?.details?.serviceFee || 0,
    fromDate: initialData?.details?.fromDate || '',
    toDate: initialData?.details?.toDate || '',
    meals: (Array.isArray(initialData?.details?.meals) ? initialData.details.meals : (typeof initialData?.details?.meals === 'string' ? [initialData.details.meals] : [])) as string[],
    adults: initialData?.details?.adults || 2,
    children: initialData?.details?.children || 0
  });

  const incomeAccounts = useMemo(() => accounts.filter(a => a.type === AccountType.REVENUE), [accounts]);
  const customerAccounts = useMemo(() => accounts.filter(a => a.type === AccountType.CUSTOMER), [accounts]);
  const vendorAccounts = useMemo(() => accounts.filter(a => a.type === AccountType.VENDOR), [accounts]);

  // Set defaults from config when config loads
  useEffect(() => {
    if (config && !initialData) {
      setFormData(prev => ({ 
        ...prev, 
        roe: prev.currency === Currency.SAR ? config.defaultROE : 1,
        incomeAccountId: prev.incomeAccountId || incomeAccounts.find(a => a.name.toLowerCase().includes('service'))?.id || incomeAccounts[0]?.id || ''
      }));
    } else if (config && initialData) {
      // If editing an existing voucher, only set income account if missing
      setFormData(prev => ({ 
        ...prev, 
        incomeAccountId: prev.incomeAccountId || incomeAccounts.find(a => a.name.toLowerCase().includes('service'))?.id || incomeAccounts[0]?.id || ''
      }));
    }
  }, [config, incomeAccounts, initialData]);

  useEffect(() => {
    if (formData.fromDate && formData.toDate) {
      const start = new Date(formData.fromDate);
      const end = new Date(formData.toDate);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 0) {
        setFormData(prev => ({ ...prev, numNights: diffDays }));
      }
    }
  }, [formData.fromDate, formData.toDate]);

  const vendorSubtotal = useMemo(() => {
    return (formData.unitRate || 0) * (formData.numRooms || 1) * (formData.numNights || 1);
  }, [formData.unitRate, formData.numRooms, formData.numNights]);

  const totalSelectedCurrency = useMemo(() => {
    return vendorSubtotal + (Number(formData.serviceFee) || 0);
  }, [vendorSubtotal, formData.serviceFee]);

  const totalPKR = useMemo(() => {
    const rate = formData.currency === Currency.SAR ? formData.roe : 1;
    return totalSelectedCurrency * rate;
  }, [totalSelectedCurrency, formData.roe, formData.currency]);

  const toggleMeal = (meal: string) => {
    setFormData(prev => ({
      ...prev,
      meals: prev.meals.includes(meal) 
        ? prev.meals.filter(m => m !== meal) 
        : [...prev.meals, meal]
    }));
  };

  const handleCurrencyChange = (newCurrency: Currency) => {
    setFormData(prev => ({
      ...prev,
      currency: newCurrency,
      roe: newCurrency === Currency.SAR ? (config?.defaultROE || prev.roe) : 1
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId || !formData.vendorId) return alert("Select Customer and Vendor");
    
    onSave({
      ...formData,
      type: VoucherType.HOTEL,
      totalAmountPKR: totalPKR,
      status: VoucherStatus.POSTED,
      details: {
        ...formData,
        vendorAmountPKR: vendorSubtotal * (formData.currency === Currency.SAR ? formData.roe : 1),
        incomeAmountPKR: (Number(formData.serviceFee) || 0) * (formData.currency === Currency.SAR ? formData.roe : 1),
        totalSelectedCurrency
      }
    });
  };

  if (loading || !config) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto no-print">
      <div className="bg-[#f8fbff] dark:bg-slate-900 w-full max-w-5xl rounded-[2.5rem] shadow-2xl flex flex-col border border-white/20 animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Simple Heading */}
        <div className="px-10 pt-8 pb-4 flex justify-between items-center bg-[#f8fbff] dark:bg-slate-900">
            <h1 className="text-2xl font-black font-orbitron text-slate-800 dark:text-white uppercase tracking-tighter">
                HOTEL VOUCHER
            </h1>
            <button onClick={onCancel} className="text-slate-400 hover:text-rose-500 transition-colors">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-8 overflow-y-auto max-h-[85vh]">
          
          {/* Top Control Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">DATE</label>
              <input type="date" required className="w-full bg-white dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-bold shadow-sm outline-none ring-1 ring-slate-100" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CURRENCY</label>
              <select className="w-full bg-white dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-bold shadow-sm outline-none appearance-none ring-1 ring-slate-100" value={formData.currency} onChange={e => handleCurrencyChange(e.target.value as Currency)}>
                <option value={Currency.PKR}>PKR</option>
                <option value={Currency.SAR}>SAR</option>
              </select>
            </div>
            {formData.currency === Currency.SAR && (
              <div className="space-y-2 animate-in slide-in-from-left-2">
                <label className="text-[10px] font-bold text-blue-600 uppercase tracking-widest ml-1">ROE</label>
                <input type="number" step="0.0001" className="w-full bg-blue-50/50 dark:bg-blue-900/20 border-none rounded-2xl p-4 text-sm font-bold text-blue-600 outline-none ring-1 ring-blue-100" value={formData.roe} onChange={e => setFormData({...formData, roe: Number(e.target.value)})} />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">RATE/UNIT</label>
              <div className="flex items-center bg-white dark:bg-slate-800 border-none rounded-2xl p-3 px-5 shadow-sm ring-1 ring-slate-100">
                <input 
                  type="number" 
                  step="0.01" 
                  className="w-full bg-transparent border-none p-2 focus:ring-0 text-3xl font-black [appearance:textfield]" 
                  value={formData.unitRate} 
                  onChange={e => setFormData({...formData, unitRate: Number(e.target.value)})} 
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CUSTOMER (DR)</label>
                  <select required className="w-full bg-[#f0f4f9] dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-bold outline-none ring-1 ring-slate-100" value={formData.customerId} onChange={e => setFormData({...formData, customerId: e.target.value})}>
                    <option value="">Payer...</option>
                    {customerAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">VENDOR (CR)</label>
                  <select required className="w-full bg-[#f0f4f9] dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-bold outline-none ring-1 ring-slate-100" value={formData.vendorId} onChange={e => setFormData({...formData, vendorId: e.target.value})}>
                    <option value="">Payee...</option>
                    {vendorAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <input required className="w-full bg-[#f0f4f9] dark:bg-slate-800 border-none rounded-2xl p-5 text-sm font-bold placeholder:text-slate-400 outline-none ring-1 ring-slate-100" placeholder="Lead Pax Name" value={formData.paxName} onChange={e => setFormData({...formData, paxName: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <input required className="w-full bg-[#f0f4f9] dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-bold placeholder:text-slate-400 outline-none ring-1 ring-slate-100" placeholder="Hotel Name" value={formData.hotelName} onChange={e => setFormData({...formData, hotelName: e.target.value})} />
                <div className="grid grid-cols-2 gap-2">
                  <select className="bg-[#f0f4f9] dark:bg-slate-800 border-none rounded-2xl p-2 text-xs font-bold outline-none ring-1 ring-slate-100" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})}>
                    {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="bg-[#f0f4f9] dark:bg-slate-800 border-none rounded-2xl p-2 text-xs font-bold outline-none ring-1 ring-slate-100" value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})}>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">ROOM CONFIGURATION</label>
                <div className="grid grid-cols-3 gap-4">
                  <select className="bg-[#f0f4f9] dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-bold outline-none ring-1 ring-slate-100" value={formData.roomType} onChange={e => setFormData({...formData, roomType: e.target.value})}>
                    {ROOM_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <div className="flex items-center bg-[#f0f4f9] dark:bg-slate-800 border-none rounded-2xl p-4 ring-1 ring-slate-100">
                    <span className="text-[10px] font-black mr-2">RMS:</span>
                    <input type="number" min="1" className="w-full bg-transparent border-none p-0 text-sm font-black focus:ring-0" value={formData.numRooms} onChange={e => setFormData({...formData, numRooms: Number(e.target.value)})} />
                  </div>
                  <div className="flex items-center bg-[#f0f4f9] dark:bg-slate-800 border-none rounded-2xl p-4 ring-1 ring-slate-100">
                    <span className="text-[10px] font-black mr-2">NGT:</span>
                    <input type="number" min="1" className="w-full bg-transparent border-none p-0 text-sm font-black focus:ring-0" value={formData.numNights} onChange={e => setFormData({...formData, numNights: Number(e.target.value)})} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CHECK-IN</label>
                  <input type="date" required className="w-full bg-[#f0f4f9] dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-bold outline-none ring-1 ring-slate-100" value={formData.fromDate} onChange={e => setFormData({...formData, fromDate: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CHECK-OUT</label>
                  <input type="date" required className="w-full bg-[#f0f4f9] dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-bold outline-none ring-1 ring-slate-100" value={formData.toDate} onChange={e => setFormData({...formData, toDate: e.target.value})} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">MEAL PLAN</label>
                <div className="flex space-x-2">
                  {MEALS.map(meal => (
                    <button key={meal} type="button" onClick={() => toggleMeal(meal)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${formData.meals.includes(meal) ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-[#f0f4f9] dark:bg-slate-800 text-slate-400'}`}>
                      {meal}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-amber-600 uppercase tracking-widest ml-1">SERVICE FEE ({formData.currency})</label>
                  <input type="number" step="0.01" className="w-full bg-amber-50/50 dark:bg-amber-900/10 border-none rounded-2xl p-4 text-sm font-black text-amber-600 outline-none ring-1 ring-amber-100" value={formData.serviceFee} onChange={e => setFormData({...formData, serviceFee: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">REVENUE ACCOUNT</label>
                   <select required className="w-full bg-[#f0f4f9] dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-bold outline-none ring-1 ring-slate-100" value={formData.incomeAccountId} onChange={e => setFormData({...formData, incomeAccountId: e.target.value})}>
                     {incomeAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                   </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CONFIRMATION / PNR / REF</label>
                <input className="w-full bg-[#f0f4f9] dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-black uppercase outline-none ring-1 ring-slate-100" placeholder="e.g. 125983" value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-8 rounded-[3rem] flex flex-col md:flex-row justify-between items-center text-white border border-white/5 shadow-2xl">
            <div className="flex flex-col items-center md:items-start mb-6 md:mb-0">
               <p className="text-[10px] font-bold uppercase opacity-50 tracking-[0.4em] mb-2">Total Customer Debit</p>
               <p className="text-5xl font-black font-orbitron tracking-tighter">
                 PKR {totalPKR.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
               </p>
            </div>
            <div className="flex space-x-4">
               <button type="button" onClick={onCancel} className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl uppercase text-[10px] tracking-widest transition-all">Discard</button>
               <button type="submit" className="px-12 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-600/20 uppercase text-[10px] tracking-[0.3em] font-orbitron transition-all active:scale-95">Post Voucher</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HotelVoucherForm;
