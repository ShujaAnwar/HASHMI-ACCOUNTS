import React, { useState, useMemo, useEffect } from 'react';
import { VoucherType, Currency, AccountType, Voucher, VoucherStatus, Account, AppConfig } from '../types';
import { getAccounts, getConfig } from '../services/db';
import DateInput from './DateInput';
import { AccountingService } from '../services/AccountingService';

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

const MAKKAH_HOTELS = [
  { name: 'Anwar Deafah', cat: 'Gold' }, { name: 'Nada Deafah', cat: 'Gold' }, { name: 'Mira Ajyaad', cat: 'Gold' }, 
  { name: 'Sunood Ajyaad', cat: 'Gold' }, { name: 'Barka Mawadda', cat: 'Gold' }, 
  { name: 'Grand Massa (Shohda Side)', cat: 'Gold' }, { name: 'Rihab Taqwa (Hijra)', cat: 'Gold' }, 
  { name: 'Waha Deafah', cat: 'Silver' }, { name: 'Mather Jawar (Hijra)', cat: 'Silver' }, 
  { name: 'Dar Al Khalil (Misfala)', cat: 'Silver' }, { name: 'Awtad Makkah', cat: 'Silver' }, 
  { name: 'Fajar Badee 5 (Misfala)', cat: 'Silver' }, { name: 'Tara Ajyad (Bir Barila)', cat: 'Silver' }, 
  { name: 'Jaad Ajyad', cat: 'Silver' }, { name: 'Burj Deafah', cat: 'Bronze' }, 
  { name: 'Sharooq Al Misq', cat: 'Bronze' }, { name: 'Keyan Al Dana', cat: 'Shuttle' }, 
  { name: 'Asfaar Al Hijjaz 1', cat: 'Shuttle' }, { name: 'Asfaar Al Hijjaz 2', cat: 'Shuttle' }, 
  { name: 'Asfaar Al Hijjaz 3', cat: 'Shuttle' }, { name: 'Johra Mayassar', cat: 'Shuttle' }, 
  { name: 'Dorrat Al Khayr', cat: 'Shuttle' }, { name: 'Makkah Clock Tower', cat: 'Premium' }, 
  { name: 'Pullman Zamzam Makkah', cat: 'Premium' }, { name: 'Swissotel Makkah', cat: 'Premium' }, 
  { name: 'Swissotel Al Maqam', cat: 'Premium' }, { name: 'Raffles Makkah Palace', cat: 'Premium' }, 
  { name: 'Movenpick Hajar Tower', cat: 'Premium' }, { name: 'Al Safwah Tower', cat: 'Premium' }, 
  { name: 'Dorrar Aleiman', cat: 'Premium' }, { name: 'Elaf Kinda', cat: 'Premium' }, 
  { name: 'Makkah Tower', cat: 'Premium' }, { name: 'Intercontinental Dar Al Tawhid', cat: 'Premium' }, 
  { name: 'Jumeirah Jabal Omar', cat: 'Premium' }, { name: 'Address Jabal Omar', cat: 'Premium' }, 
  { name: 'DoubleTree by Hilton', cat: 'Premium' }, { name: 'Anjum Makkah', cat: 'Premium' }, 
  { name: 'Sheraton Jabal Al Kaaba', cat: 'Premium' }, { name: 'Le Meridien Makkah', cat: 'Premium' }, 
  { name: 'Kunuz Ajyad', cat: 'Premium' }, { name: 'Azka Al Safa', cat: 'Premium' }, 
  { name: 'Makarem Ajyad', cat: 'Premium' }, { name: 'Elaf Ajyad', cat: 'Premium' }, 
  { name: 'Emaar Andalusia', cat: 'Premium' }, { name: 'Areej Al Wafa', cat: 'Premium' }, 
  { name: 'Nawarat Shams 3', cat: 'Premium' }, { name: 'Emaar Khalil', cat: 'Premium' }, 
  { name: 'Emaar Grand', cat: 'Premium' }, { name: 'Al Massa Badar', cat: 'Premium' }, 
  { name: 'Yasmeen Al Majd', cat: 'Premium' }, { name: 'Le Meridien Towers', cat: 'Premium' }, 
  { name: 'Saja Makkah', cat: 'Premium' }, { name: 'Voco Makkah', cat: 'Premium' }, 
  { name: 'Holiday Inn', cat: 'Premium' }, { name: 'Kiswah Tower', cat: 'Premium' }, 
  { name: 'Hidaya Tower', cat: 'Premium' }
];

const MADINAH_HOTELS = [
  { name: 'Rose Holiday', cat: 'Gold' }, { name: 'Masa Bustan', cat: 'Gold' }, { name: 'Gulnar Taiba', cat: 'Gold' }, 
  { name: 'Diyar Taiba', cat: 'Gold' }, { name: 'Diyar Al Habib', cat: 'Gold' }, 
  { name: 'Karam Al Hajjaz', cat: 'Gold' }, { name: 'Karam Al Khair', cat: 'Gold' }, 
  { name: 'Erjwan Sada', cat: 'Silver' }, { name: 'Sebal Plus', cat: 'Silver' }, 
  { name: 'Al Zahra', cat: 'Silver' }, { name: 'Raiz Al Zahra', cat: 'Silver' }, 
  { name: 'Al Madina Star', cat: 'Silver' }, { name: 'Guest Time', cat: 'Silver' }, 
  { name: 'Mona Salam', cat: 'Bronze' }, { name: 'Karam Sada', cat: 'Bronze' }, 
  { name: 'Burj Mawadda', cat: 'Bronze' }, { name: 'Riyaz Al Madina', cat: 'Bronze' }, 
  { name: 'Rua Al Khair', cat: 'Bronze' }, { name: 'Jood Al Marjan 1', cat: 'Shuttle' }, 
  { name: 'Jood Al Marjan 2', cat: 'Shuttle' }, { name: 'Jood Al Marjan 3', cat: 'Shuttle' }, 
  { name: 'Marina Golden', cat: 'Shuttle' }, { name: 'Hilton Madina', cat: 'Premium' }, 
  { name: 'Al Haram Madina', cat: 'Premium' }, { name: 'Anwar Al Madina', cat: 'Premium' }, 
  { name: 'Shaza Regency', cat: 'Premium' }, { name: 'Al Aqeeq', cat: 'Premium' }, 
  { name: 'Pullman Zamzam Madina', cat: 'Premium' }, { name: 'Al Ansar Golden Tulip', cat: 'Premium' }, 
  { name: 'Valley Madina', cat: 'Premium' }, { name: 'Saja Al Madina', cat: 'Premium' }, 
  { name: 'Dallah Taibah', cat: 'Premium' }, { name: 'Rua Al Hijra', cat: 'Premium' }, 
  { name: 'Province Al Sham', cat: 'Premium' }, { name: 'Grand Plaza Badar Al Maqam', cat: 'Premium' }, 
  { name: 'Ritz Al Madina', cat: 'Premium' }, { name: 'Al Muna Kareem', cat: 'Premium' }, 
  { name: 'Golden Tulip Zahabi', cat: 'Premium' }, { name: 'Mokhtara International', cat: 'Premium' }, 
  { name: 'Andalus Golden', cat: 'Premium' }, { name: 'Dar Al Naeem', cat: 'Premium' }, 
  { name: 'Zowar International', cat: 'Premium' }, { name: 'Sonabel Al Madina', cat: 'Premium' }, 
  { name: 'Arkan Al Manar', cat: 'Premium' }, { name: 'Qasar Al Ansar Golden Tulip', cat: 'Premium' }, 
  { name: 'Golden Tulip Shufra', cat: 'Premium' }, { name: 'Anwar Al Madinah Movenpick', cat: 'Premium' }, 
  { name: 'Concorde Dar Al Khair', cat: 'Premium' }, { name: 'Emaar Elite Madinah', cat: 'Premium' }, 
  { name: 'Dar Al Iman InterContinental', cat: 'Premium' }, { name: 'Frontel Al Harithia', cat: 'Premium' }, 
  { name: 'Taiba Front & Suites', cat: 'Premium' }, { name: 'Maden Madinah', cat: 'Premium' }, 
  { name: 'Madinah Hilton', cat: 'Premium' }, { name: 'Sofitel Shad Al Madinah', cat: 'Premium' }, 
  { name: 'Grand Plaza Madinah', cat: 'Premium' }, { name: 'Dar Al Eiman Al Haram', cat: 'Premium' }, 
  { name: 'Oberoi', cat: 'Premium' }, { name: 'Safwat Al Madinah', cat: 'Premium' }, 
  { name: 'Ruve Al Madinah', cat: 'Premium' }, { name: 'Artal International', cat: 'Premium' }, 
  { name: 'Odst Al Madinah', cat: 'Premium' }, { name: 'Waqf Outhman', cat: 'Premium' }, 
  { name: 'Verta Al Madinah', cat: 'Premium' }, { name: 'Jawhrat Al Rasheed', cat: 'Premium' }, 
  { name: 'Plaza Inn Ohud', cat: 'Premium' }, { name: 'Valy Madinah', cat: 'Premium' }, 
  { name: 'Sky View', cat: 'Premium' }
];

const HotelVoucherForm: React.FC<HotelVoucherFormProps> = ({ initialData, onSave, onCancel, isClone }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const allHotels = useMemo(() => {
    return [...MAKKAH_HOTELS, ...MADINAH_HOTELS];
  }, []);

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
    voucherNum: (isClone || !initialData?.voucherNum) 
      ? AccountingService.generateUniqueVNum('HV')
      : initialData.voucherNum,
    customerId: initialData?.customerId || '',
    vendorId: initialData?.vendorId || '',
    description: initialData?.description || '',
    reference: isClone ? '' : (initialData?.reference || ''),
    paxName: initialData?.details?.paxName || '',
    items: initialData?.details?.items || [{
      hotelName: initialData?.details?.hotelName || '',
      city: initialData?.details?.city || 'Makkah',
      country: initialData?.details?.country || 'Saudi Arabia',
      roomType: initialData?.details?.roomType || 'DBL C.V',
      numRooms: initialData?.details?.numRooms || 1,
      numNights: initialData?.details?.numNights || 0,
      unitRate: initialData?.details?.unitRate || 0,
      fromDate: initialData?.details?.fromDate || '',
      toDate: initialData?.details?.toDate || '',
      meals: (Array.isArray(initialData?.details?.meals) ? initialData.details.meals : (typeof initialData?.details?.meals === 'string' ? [initialData.details.meals] : [])) as string[],
      adults: initialData?.details?.adults || 2,
      children: initialData?.details?.children || 0
    }],
    bookingRef: initialData?.details?.bookingRef || '',
  });

  const customerAccounts = useMemo(() => accounts.filter(a => a.type === AccountType.CUSTOMER), [accounts]);
  const vendorAccounts = useMemo(() => accounts.filter(a => a.type === AccountType.VENDOR), [accounts]);

  useEffect(() => {
    if (config && !initialData) {
      setFormData(prev => ({ 
        ...prev, 
        roe: prev.currency === Currency.SAR ? config.defaultROE : 1
      }));
    }
  }, [config, initialData]);

  const calculateNights = (from: string, to: string) => {
    if (!from || !to) return 0;
    const start = new Date(from);
    const end = new Date(to);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : 0;
  };

  const handleCloneItem = (index: number) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      const itemToClone = { ...newItems[index] };
      // Insert the cloned item right after the original one
      newItems.splice(index + 1, 0, itemToClone);
      return { ...prev, items: newItems };
    });
  };

  const handleRemoveItem = (index: number) => {
    if (formData.items.length === 1) return;
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      let updatedItem = { ...newItems[index], [field]: value };
      
      if (field === 'hotelName') {
        if (MAKKAH_HOTELS.some(h => h.name === value)) {
          updatedItem.city = 'Makkah';
          updatedItem.country = 'Saudi Arabia';
        } else if (MADINAH_HOTELS.some(h => h.name === value)) {
          updatedItem.city = 'Madinah';
          updatedItem.country = 'Saudi Arabia';
        } else if (value === 'Other Hotel') {
          // Keep existing values or reset if needed
        }
      }

      if (field === 'fromDate' || field === 'toDate') {
        updatedItem.numNights = calculateNights(updatedItem.fromDate, updatedItem.toDate);
      }
      
      newItems[index] = updatedItem;
      return { ...prev, items: newItems };
    });
  };

  const toggleMeal = (index: number, meal: string) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      const meals = newItems[index].meals;
      newItems[index] = {
        ...newItems[index],
        meals: meals.includes(meal) 
          ? meals.filter(m => m !== meal) 
          : [...meals, meal]
      };
      return { ...prev, items: newItems };
    });
  };

  const totalSelectedCurrency = useMemo(() => {
    return formData.items.reduce((sum: number, item: any) => {
      return sum + (Number(item.unitRate) * Number(item.numRooms) * Number(item.numNights));
    }, 0);
  }, [formData.items]);

  const totalPKR = useMemo(() => {
    const rate = formData.currency === Currency.SAR ? formData.roe : 1;
    return totalSelectedCurrency * rate;
  }, [totalSelectedCurrency, formData.roe, formData.currency]);

  const handleCurrencyChange = (newCurrency: Currency) => {
    setFormData(prev => ({
      ...prev,
      currency: newCurrency,
      roe: newCurrency === Currency.SAR ? (config?.defaultROE || prev.roe) : 1
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId || !formData.vendorId) return alert("Please select both a Customer and a Vendor to post this voucher.");
    
    onSave({
      ...formData,
      type: VoucherType.HOTEL,
      totalAmountPKR: totalPKR,
      status: VoucherStatus.POSTED,
      details: {
        ...formData,
        totalSelectedCurrency
      }
    });
  };

  if (loading || !config) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto no-print">
      <div className="bg-[#f8fbff] dark:bg-slate-900 w-full max-w-6xl rounded-[2.5rem] shadow-2xl flex flex-col border border-white/20 animate-in zoom-in-95 duration-200 overflow-hidden">
        
        <div className="px-6 pt-4 pb-1 flex justify-between items-center bg-[#f8fbff] dark:bg-slate-900">
            <h1 className="text-lg font-black font-orbitron text-slate-800 dark:text-white uppercase tracking-tighter">
                HOTEL VOUCHER
            </h1>
            <button onClick={onCancel} className="text-slate-400 hover:text-rose-500 transition-colors">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[85vh]">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-white dark:bg-slate-800/50 p-4 rounded-xl shadow-sm ring-1 ring-slate-100">
            <div className="space-y-1">
              <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">DATE</label>
              <DateInput required className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-2 text-xs font-bold shadow-sm outline-none ring-1 ring-slate-100" value={formData.date} onChange={val => setFormData({...formData, date: val})} />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">CURRENCY</label>
              <select className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-2 text-xs font-bold shadow-sm outline-none appearance-none ring-1 ring-slate-100" value={formData.currency} onChange={e => handleCurrencyChange(e.target.value as Currency)}>
                <option value={Currency.PKR}>PKR</option>
                <option value={Currency.SAR}>SAR</option>
              </select>
            </div>
            {formData.currency === Currency.SAR && (
              <div className="space-y-1 animate-in slide-in-from-left-2">
                <label className="text-[8px] font-bold text-blue-600 uppercase tracking-widest ml-1">ROE</label>
                <input type="number" step="0.0001" className="w-full bg-blue-50/50 dark:bg-blue-900/20 border-none rounded-lg p-2 text-xs font-bold text-blue-600 outline-none ring-1 ring-blue-100" value={formData.roe} onChange={e => setFormData({...formData, roe: Number(e.target.value)})} />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">LEAD PAX NAME</label>
              <input required className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-2 text-xs font-bold placeholder:text-slate-400 outline-none ring-1 ring-slate-100" placeholder="Lead Pax Name" value={formData.paxName} onChange={e => setFormData({...formData, paxName: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">CUSTOMER (DR)</label>
                  <select required className="w-full bg-[#f0f4f9] dark:bg-slate-800 border-none rounded-lg p-2 text-xs font-bold outline-none ring-1 ring-slate-100" value={formData.customerId} onChange={e => setFormData({...formData, customerId: e.target.value})}>
                    <option value="">Select Customer...</option>
                    {customerAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">VENDOR (CR)</label>
                  <select required className="w-full bg-[#f0f4f9] dark:bg-slate-800 border-none rounded-lg p-2 text-xs font-bold outline-none ring-1 ring-slate-100" value={formData.vendorId} onChange={e => setFormData({...formData, vendorId: e.target.value})}>
                    <option value="">Select Vendor...</option>
                    {vendorAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">BOOKING REFERENCE NUMBER</label>
                <input className="w-full bg-blue-50 dark:bg-slate-800 border-none rounded-lg p-2 text-xs font-black uppercase outline-none ring-1 ring-blue-100" placeholder="e.g. BK-99281" value={formData.bookingRef} onChange={e => setFormData({...formData, bookingRef: e.target.value})} />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">REMARKS</label>
                <textarea className="w-full bg-[#f0f4f9] dark:bg-slate-800 border-none rounded-lg p-2 text-xs font-medium outline-none ring-1 ring-slate-100 h-16 resize-none" placeholder="Notes for this booking..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
            </div>

            <div className="space-y-3">
               <div className="space-y-1">
                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">CONFIRMATION / PNR / REF</label>
                <input className="w-full bg-[#f0f4f9] dark:bg-slate-800 border-none rounded-lg p-2 text-xs font-black uppercase outline-none ring-1 ring-slate-100" placeholder="e.g. 125983" value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} />
              </div>
            </div>
          </div>

          {/* Hotel Segments */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">Hotel Segments / Bookings</h3>
            </div>

            <div className="space-y-3">
              {formData.items.map((item: any, idx: number) => (
                <div key={idx} className="bg-white dark:bg-slate-800/50 p-4 rounded-xl shadow-sm ring-1 ring-slate-100 relative group animate-in fade-in slide-in-from-bottom-2">
                  <div className="absolute top-3 right-3 flex items-center space-x-2">
                    <button type="button" onClick={() => handleCloneItem(idx)} className="text-blue-500 hover:text-blue-700 font-bold text-[8px] uppercase tracking-widest transition-colors flex items-center bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md">
                      <span className="mr-1">+</span> Clone
                    </button>
                    {formData.items.length > 1 && (
                      <button type="button" onClick={() => handleRemoveItem(idx)} className="text-slate-300 hover:text-rose-500 transition-colors p-1">✕</button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">HOTEL NAME</label>
                        <div className="flex flex-col gap-1">
                          <input 
                            required 
                            list={`hotels-datalist-${idx}`}
                            className="w-full bg-[#f8fbff] dark:bg-slate-900 border-none rounded-lg p-2 text-xs font-bold placeholder:text-slate-400 outline-none ring-1 ring-slate-100" 
                            placeholder="Type or select hotel..." 
                            value={item.hotelName} 
                            onChange={e => updateItem(idx, 'hotelName', e.target.value)} 
                          />
                          <datalist id={`hotels-datalist-${idx}`}>
                            {MAKKAH_HOTELS.map(h => <option key={`mak-${h.name}`} value={h.name}>{h.name} (Makkah)</option>)}
                            {MADINAH_HOTELS.map(h => <option key={`mad-${h.name}`} value={h.name}>{h.name} (Madinah)</option>)}
                          </datalist>
                          
                          {(config.showHotelsList !== false && item.hotelName === '') && (
                            <p className="text-[7px] text-slate-400 uppercase font-black tracking-widest px-1">Start typing for suggestions...</p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">CITY</label>
                          <select className="w-full bg-[#f8fbff] dark:bg-slate-900 border-none rounded-lg p-2 text-xs font-bold outline-none ring-1 ring-slate-100" value={item.city} onChange={e => updateItem(idx, 'city', e.target.value)}>
                            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">COUNTRY</label>
                          <select className="w-full bg-[#f8fbff] dark:bg-slate-900 border-none rounded-lg p-2 text-xs font-bold outline-none ring-1 ring-slate-100" value={item.country} onChange={e => updateItem(idx, 'country', e.target.value)}>
                            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">CHECK-IN</label>
                          <DateInput required className="w-full bg-[#f8fbff] dark:bg-slate-900 border-none rounded-lg p-2 text-xs font-bold outline-none ring-1 ring-slate-100" value={item.fromDate} onChange={val => updateItem(idx, 'fromDate', val)} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">CHECK-OUT</label>
                          <DateInput required className="w-full bg-[#f8fbff] dark:bg-slate-900 border-none rounded-lg p-2 text-xs font-bold outline-none ring-1 ring-slate-100" value={item.toDate} onChange={val => updateItem(idx, 'toDate', val)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">NIGHTS</label>
                          <input type="number" readOnly className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg p-2 text-xs font-black outline-none ring-1 ring-slate-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={item.numNights} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">ROOMS</label>
                          <input type="number" min="1" className="w-full bg-[#f8fbff] dark:bg-slate-900 border-none rounded-lg p-2 text-xs font-bold outline-none ring-1 ring-slate-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={item.numRooms} onChange={e => updateItem(idx, 'numRooms', Number(e.target.value))} onWheel={(e) => (e.target as HTMLInputElement).blur()} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">RATE / NIGHT</label>
                          <input type="number" step="0.01" className="w-full bg-[#f8fbff] dark:bg-slate-900 border-none rounded-lg p-2 text-xs font-black text-blue-600 outline-none ring-1 ring-slate-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={item.unitRate} onChange={e => updateItem(idx, 'unitRate', Number(e.target.value))} onWheel={(e) => (e.target as HTMLInputElement).blur()} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">AMOUNT ({formData.currency})</label>
                          <div className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg p-2 text-xs font-black text-slate-900 dark:text-white ring-1 ring-slate-100">
                            {(item.unitRate * item.numRooms * item.numNights).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">MEAL PLAN</label>
                        <div className="flex flex-wrap gap-1">
                          {MEALS.map(meal => (
                            <button key={meal} type="button" onClick={() => toggleMeal(idx, meal)} className={`px-2 py-1 rounded-md text-[7px] font-black uppercase transition-all ${item.meals.includes(meal) ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>
                              {meal}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-50 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">ROOM TYPE</label>
                      <select 
                        className="w-full bg-[#f8fbff] dark:bg-slate-900 border-none rounded-lg p-2 text-[10px] font-bold outline-none ring-1 ring-slate-100" 
                        value={ROOM_TYPES.includes(item.roomType) ? item.roomType : 'Other Type'} 
                        onChange={e => {
                          const val = e.target.value;
                          if (val === 'Other Type') {
                            updateItem(idx, 'roomType', '');
                          } else {
                            updateItem(idx, 'roomType', val);
                          }
                        }}
                      >
                        {ROOM_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                        <option value="Other Type">Other Type / Manual Entry</option>
                      </select>
                      {!ROOM_TYPES.includes(item.roomType) && (
                        <input 
                          required 
                          className="w-full mt-2 bg-[#f8fbff] dark:bg-slate-900 border-none rounded-lg p-2 text-[10px] font-bold placeholder:text-slate-400 outline-none ring-1 ring-slate-100 animate-in fade-in slide-in-from-top-1" 
                          placeholder="Type Room Type..." 
                          value={item.roomType} 
                          onChange={e => updateItem(idx, 'roomType', e.target.value)} 
                        />
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">ADULTS</label>
                      <input type="number" min="1" className="w-full bg-[#f8fbff] dark:bg-slate-900 border-none rounded-lg p-2 text-[10px] font-bold outline-none ring-1 ring-slate-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={item.adults} onChange={e => updateItem(idx, 'adults', Number(e.target.value))} onWheel={(e) => (e.target as HTMLInputElement).blur()} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1">CHILDREN</label>
                      <input type="number" min="0" className="w-full bg-[#f8fbff] dark:bg-slate-900 border-none rounded-lg p-2 text-[10px] font-bold outline-none ring-1 ring-slate-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={item.children} onChange={e => updateItem(idx, 'children', Number(e.target.value))} onWheel={(e) => (e.target as HTMLInputElement).blur()} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 p-4 rounded-3xl flex flex-col md:flex-row justify-between items-center text-white border border-white/5 shadow-2xl">
            <div className="flex flex-col items-center md:items-start mb-3 md:mb-0">
               <p className="text-[8px] font-bold uppercase opacity-50 tracking-[0.4em] mb-0.5">Total Customer Debit</p>
               <p className="text-2xl font-black font-orbitron tracking-tighter">
                 PKR {totalPKR.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
               </p>
            </div>
            <div className="flex space-x-2">
               <button type="button" onClick={onCancel} className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-lg uppercase text-[8px] tracking-widest transition-all">Discard</button>
               <button type="submit" className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg shadow-xl shadow-blue-600/20 uppercase text-[8px] tracking-[0.3em] font-orbitron transition-all active:scale-95">Post Voucher</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HotelVoucherForm;