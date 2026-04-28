
import React, { useState, useMemo, useEffect } from 'react';
import { VoucherType, Currency, AccountType, Voucher, VoucherStatus, Account, AppConfig } from '../types';
import { getAccounts, getConfig } from '../services/db';
import DateInput from './DateInput';
import HajiSelector from './HajiSelector';
import { AccountingService } from '../services/AccountingService';

import { HajiService } from '../services/HajiService';

interface AllInOneVoucherFormProps {
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

const VEHICLES = ['Car', 'H1', 'Staria', 'GMC', 'Coaster', 'Bus', 'SUV', 'Pickup', 'Other'];
const SECTOR_SUGGESTIONS = [
  { label: 'Makkah → Jeddah', sector: 'Makkah → Jeddah', vehicle: 'Car', rate: 150 },
  { label: 'Makkah → Madinah', sector: 'Makkah → Madinah', vehicle: 'Car', rate: 350 },
  { label: 'Madinah → Makkah', sector: 'Madinah → Makkah', vehicle: 'Car', rate: 350 },
  { label: 'Madinah → Jeddah', sector: 'Madinah → Jeddah', vehicle: 'Car', rate: 400 },
  { label: 'Madinah Hotel → Madinah Airport', sector: 'Madinah Hotel → Madinah Airport', vehicle: 'Car', rate: 100 },
  { label: 'Jeddah Airport → Makkah', sector: 'Jeddah Airport → Makkah Hotel', vehicle: 'Car', rate: 150 },
  { label: 'Ziyarat Makkah', sector: 'Ziyarat Makkah', vehicle: 'H1', rate: 200 },
  { label: 'Ziyarat Madinah', sector: 'Ziyarat Madinah', vehicle: 'H1', rate: 150 },
  { label: 'Ziyaraat e Taif', sector: 'Ziyaraat e Taif', vehicle: 'H1', rate: 450 },
];

const TRANSPORT_TEMPLATES = [
  { id: '1', name: 'MAK-MED-JED', routes: ['Makkah -> Madinah', 'Madinah -> Jeddah'] },
  { id: '2', name: 'JED-MAK-MED-MAK-JED', routes: ['Jeddah -> Makkah', 'Makkah -> Madinah', 'Madinah -> Makkah', 'Makkah -> Jeddah'] },
  { id: '3', name: 'JED-MAK-MED-JED', routes: ['Jeddah -> Makkah', 'Makkah -> Madinah', 'Madinah -> Jeddah'] },
  { id: '4', name: 'MAK-JED-MAK', routes: ['Makkah -> Jeddah', 'Jeddah -> Makkah'] },
];

const MULTI_SECTOR_COMBINATIONS = [
  { label: 'JED → MAK | MAK → MED | MED → MAK | MAK → JED', routes: ['JED → MAK', 'MAK → MED', 'MED → MAK', 'MAK → JED'] },
  { label: 'JED → MAK | MAK → MED | MED HTL → MED AIRPORT', routes: ['JED → MAK', 'MAK → MED', 'MED HTL → MED AIRPORT'] },
  { label: 'JED → MAK | MAK → MED | MED HTL → JED AIRPORT', routes: ['JED → MAK', 'MAK → MED', 'MED HTL → JED AIRPORT'] },
  { label: 'MED AIRPORT → MED HTL | MED HTL → MAK | MAK → JED', routes: ['MED AIRPORT → MED HTL', 'MED HTL → MAK', 'MAK → JED'] },
];

const AllInOneVoucherForm: React.FC<AllInOneVoucherFormProps> = ({ initialData, onSave, onCancel, isClone }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [accs, conf] = await Promise.all([getAccounts(), getConfig()]);
      setAccounts(accs);
      setConfig(conf);
      
      // Generate automatic voucher number if creating or cloning
      if (isClone || !initialData?.voucherNum) {
        const vNum = await AccountingService.generateVoucherNumber(VoucherType.ALL_IN_ONE, initialData?.date);
        setFormData(prev => ({ ...prev, voucherNum: vNum }));
      }
      
      setLoading(false);
    };
    load();
  }, [isClone, initialData]);

  const [formData, setFormData] = useState({
    date: initialData?.date?.split('T')[0] || new Date().toISOString().split('T')[0],
    currency: initialData?.currency || Currency.PKR,
    roe: initialData?.roe || 1,
    voucherNum: initialData?.voucherNum || '', // Placeholder, will be updated by useEffect if needed
    customerId: initialData?.customerId || '',
    description: initialData?.description || '',
    reference: initialData?.reference || '',
    paxName: initialData?.details?.paxName || '',
    passportNumber: initialData?.details?.passportNumber || '',
    
    // Sections
    visaItems: initialData?.details?.visaItems || [],
    hotelItems: initialData?.details?.hotelItems || [],
    transportItems: initialData?.details?.transportItems || [],
    
    incomeAmountPKR: initialData?.details?.incomeAmountPKR || 0,
    incomeAccountId: initialData?.details?.incomeAccountId || '',
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

  const addVisaItem = () => {
    setFormData(prev => ({
      ...prev,
      visaItems: [...prev.visaItems, { paxName: prev.paxName, passportNumber: prev.passportNumber, quantity: 1, rate: 0, vendorId: '' }]
    }));
  };

  const addHotelItem = () => {
    setFormData(prev => ({
      ...prev,
      hotelItems: [...prev.hotelItems, { 
        hotelName: '', city: 'Makkah', country: 'Saudi Arabia', fromDate: '', toDate: '', 
        numRooms: 1, numNights: 0, unitRate: 0, vendorId: '',
        roomType: 'Triple', meals: ['Breakfast'], adults: 2, children: 0, reference: ''
      }]
    }));
  };

  const addTransportItem = () => {
    setFormData(prev => ({
      ...prev,
      transportItems: [...prev.transportItems, { 
        sector: '', vehicle: 'Car', rate: 0, vendorId: '', date: prev.date,
        isMultiSector: false, subSectors: [], customLabel: ''
      }]
    }));
  };

  const removeVisaItem = (index: number) => {
    setFormData(prev => ({ ...prev, visaItems: prev.visaItems.filter((_, i) => i !== index) }));
  };

  const removeHotelItem = (index: number) => {
    setFormData(prev => ({ ...prev, hotelItems: prev.hotelItems.filter((_, i) => i !== index) }));
  };

  const removeTransportItem = (index: number) => {
    setFormData(prev => ({ ...prev, transportItems: prev.transportItems.filter((_, i) => i !== index) }));
  };

  const updateVisaItem = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const items = [...prev.visaItems];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, visaItems: items };
    });
  };

  const updateHotelItem = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const items = [...prev.hotelItems];
      const updated = { ...items[index], [field]: value };
      
      if (field === 'fromDate' || field === 'toDate') {
        if (updated.fromDate && updated.toDate) {
          const start = new Date(updated.fromDate);
          const end = new Date(updated.toDate);
          const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          updated.numNights = diff > 0 ? diff : 0;
        }
      }
      
      items[index] = updated;
      return { ...prev, hotelItems: items };
    });
  };

  const updateTransportItem = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const items = [...prev.transportItems];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, transportItems: items };
    });
  };

  const addSubSector = (itemIndex: number) => {
    setFormData(prev => {
      const transportItems = [...prev.transportItems];
      const currentSubSectors = transportItems[itemIndex].subSectors || [];
      const subSectors = [...currentSubSectors, { route: '', date: prev.date }];
      transportItems[itemIndex] = { ...transportItems[itemIndex], subSectors };
      return { ...prev, transportItems };
    });
  };

  const removeSubSector = (itemIndex: number, subIndex: number) => {
    setFormData(prev => {
      const transportItems = [...prev.transportItems];
      const subSectors = transportItems[itemIndex].subSectors.filter((_: any, i: number) => i !== subIndex);
      transportItems[itemIndex] = { ...transportItems[itemIndex], subSectors };
      return { ...prev, transportItems };
    });
  };

  const updateSubSector = (itemIndex: number, subIndex: number, field: string, value: any) => {
    setFormData(prev => {
      const transportItems = [...prev.transportItems];
      const subSectors = [...transportItems[itemIndex].subSectors];
      subSectors[subIndex] = { ...subSectors[subIndex], [field]: value };
      transportItems[itemIndex] = { ...transportItems[itemIndex], subSectors };
      return { ...prev, transportItems };
    });
  };

  const handleTemplateSelect = (itemIndex: number, template: any) => {
    setFormData(prev => {
      const transportItems = [...prev.transportItems];
      const subSectors = template.routes.map((r: string) => ({ route: r.toUpperCase(), date: prev.date }));
      transportItems[itemIndex] = { ...transportItems[itemIndex], isMultiSector: true, subSectors };
      return { ...prev, transportItems };
    });
  };

  const totals = useMemo(() => {
    const rate = formData.currency === Currency.SAR ? formData.roe : 1;
    
    let visaTotal = formData.visaItems.reduce((sum, item: any) => sum + (Number(item.quantity) * Number(item.rate)), 0);
    let hotelTotal = formData.hotelItems.reduce((sum, item: any) => sum + (Number(item.unitRate) * Number(item.numRooms) * Number(item.numNights)), 0);
    let transportTotal = formData.transportItems.reduce((sum, item: any) => sum + Number(item.rate), 0);
    
    const subtotalSelected = visaTotal + hotelTotal + transportTotal;
    const subtotalPKR = subtotalSelected * rate;
    const grandTotalPKR = subtotalPKR + Number(formData.incomeAmountPKR);
    
    return {
      visaTotal,
      hotelTotal,
      transportTotal,
      subtotalSelected,
      subtotalPKR,
      grandTotalPKR
    };
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId) return alert("Please select a Customer.");
    
    // Auto-save Main Pax to Master Database
    let hajiId = '';
    if (formData.paxName) {
      try {
        const haji = await HajiService.ensureHaji({ 
          fullName: formData.paxName,
          passportNumber: formData.passportNumber
        });
        hajiId = haji?.hajiId || '';
      } catch (err) {
        console.error("Error ensuring main Haji:", err);
      }
    }

    // Auto-save Visa Items to Master Database
    const updatedVisaItems = await Promise.all(formData.visaItems.map(async (item: any) => {
      try {
        const haji = await HajiService.ensureHaji({
          fullName: item.paxName,
          passportNumber: item.passportNumber
        });
        return {
          ...item,
          hajiId: haji?.hajiId || ''
        };
      } catch (err) {
        console.error("Error ensuring visa item Haji:", err);
        return item;
      }
    }));

    onSave({
      ...formData,
      type: VoucherType.ALL_IN_ONE,
      totalAmountPKR: totals.grandTotalPKR,
      status: VoucherStatus.POSTED,
      details: {
        ...formData,
        hajiId,
        visaItems: updatedVisaItems,
        ...totals
      }
    });
  };

  if (loading || !config) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto no-print">
      <div className="bg-[#f8fbff] dark:bg-slate-900 w-full max-w-7xl rounded-[2.5rem] shadow-2xl flex flex-col border border-white/20 animate-in zoom-in-95 duration-200 overflow-hidden h-[95vh]">
        
        <div className="px-8 pt-6 pb-2 flex justify-between items-center bg-[#f8fbff] dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
            <div>
                <h1 className="text-xl font-black font-orbitron text-slate-800 dark:text-white uppercase tracking-tighter">
                    ALL-IN-ONE VOUCHER
                </h1>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">Unified Travel Management - Hashmi Travel Solutions</p>
            </div>
            <button onClick={onCancel} className="bg-white dark:bg-slate-800 p-3 rounded-2xl text-slate-400 hover:text-rose-500 transition-colors shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1">
          
          {/* Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-white dark:bg-slate-800/50 p-6 rounded-3xl shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">VOUCHER DATE</label>
              <DateInput required className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-xs font-bold shadow-sm outline-none ring-1 ring-slate-100 dark:ring-slate-800" value={formData.date} onChange={val => setFormData({...formData, date: val})} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">CURRENCY</label>
              <select className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-xs font-bold shadow-sm outline-none appearance-none ring-1 ring-slate-100 dark:ring-slate-800" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value as Currency})}>
                <option value={Currency.PKR}>PKR (Pak Rupee)</option>
                <option value={Currency.SAR}>SAR (Saudi Riyal)</option>
              </select>
            </div>
            {formData.currency === Currency.SAR && (
              <div className="space-y-1 animate-in slide-in-from-left-2">
                <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest ml-1">ROE</label>
                <input type="number" step="0.0001" className="w-full bg-blue-50/50 dark:bg-blue-900/20 border-none rounded-xl p-3 text-xs font-black text-blue-600 outline-none ring-1 ring-blue-100" value={formData.roe} onChange={e => setFormData({...formData, roe: Number(e.target.value)})} />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">CUSTOMER (DEBIT)</label>
              <select required className="w-full bg-blue-50/30 dark:bg-slate-800 border-none rounded-xl p-3 text-xs font-black outline-none ring-1 ring-blue-100 dark:ring-slate-800" value={formData.customerId} onChange={e => setFormData({...formData, customerId: e.target.value})}>
                <option value="">Select Customer Account...</option>
                {customerAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">GROUP REF / FILE #</label>
              <input className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-xs font-black placeholder:text-slate-400 outline-none ring-1 ring-slate-100 dark:ring-slate-800" placeholder="e.g. GRP-24-001" value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value.toUpperCase()})} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-slate-800/50 p-6 rounded-3xl shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
             <div className="space-y-1">
               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">MAIN PAX NAME</label>
               <HajiSelector 
                 value={formData.paxName}
                 onSelect={(haji) => {
                   setFormData({...formData, paxName: haji.fullName || '', passportNumber: haji.passportNumber || formData.passportNumber});
                 }}
                 placeholder="Full Passenger Name"
               />
             </div>
             <div className="space-y-1">
               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">PASSPORT NUMBER</label>
               <input className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-xs font-black uppercase placeholder:text-slate-400 outline-none ring-1 ring-slate-100 dark:ring-slate-800" placeholder="e.g. AA1234567" value={formData.passportNumber} onChange={e => setFormData({...formData, passportNumber: e.target.value.toUpperCase()})} />
             </div>
          </div>

          {/* Visa Section */}
          <div className="bg-slate-50/50 dark:bg-slate-800/20 p-8 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
             <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-[0.2em]">🛂 Visa Processing</h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Manage multiple visa entries</p>
                </div>
                <button type="button" onClick={addVisaItem} className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 hover:scale-105 active:scale-95 transition-all">+ Add Visa</button>
             </div>
             
             <div className="space-y-4">
                {formData.visaItems.map((item: any, idx: number) => (
                   <div key={idx} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 flex flex-col md:flex-row gap-4 relative animate-in fade-in slide-in-from-bottom-2">
                       <button type="button" onClick={() => removeVisaItem(idx)} className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] shadow-lg">✕</button>
                       <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase">Pax Name</label>
                             <HajiSelector 
                               value={item.paxName}
                               onSelect={(haji) => {
                                 updateVisaItem(idx, 'paxName', haji.fullName || '');
                                 if (haji.passportNumber) updateVisaItem(idx, 'passportNumber', haji.passportNumber);
                               }}
                               placeholder="Pax Name"
                             />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase">Passport</label>
                             <input className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-black uppercase" value={item.passportNumber} onChange={e => updateVisaItem(idx, 'passportNumber', e.target.value.toUpperCase())} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase">Rate ({formData.currency})</label>
                             <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-black text-blue-600" value={item.rate} onChange={e => updateVisaItem(idx, 'rate', Number(e.target.value))} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase">Vendor (CR)</label>
                             <select className="w-full bg-indigo-50/50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-bold outline-none ring-1 ring-indigo-100" value={item.vendorId} onChange={e => updateVisaItem(idx, 'vendorId', e.target.value)}>
                                <option value="">Select Vendor...</option>
                                {vendorAccounts.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                             </select>
                          </div>
                       </div>
                   </div>
                ))}
             </div>
          </div>

          {/* Hotel Section */}
          <div className="bg-slate-50/50 dark:bg-slate-800/20 p-8 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
             <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-[0.2em]">🏨 Hotel Accommodation</h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Add Makkah, Madina or other stays</p>
                </div>
                <button type="button" onClick={addHotelItem} className="bg-emerald-600 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 hover:scale-105 active:scale-95 transition-all">+ Add Stays</button>
             </div>
             
             <div className="space-y-4">
                {formData.hotelItems.map((item: any, idx: number) => (
                   <div key={idx} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 space-y-4 relative animate-in fade-in slide-in-from-bottom-2">
                       <button type="button" onClick={() => removeHotelItem(idx)} className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] shadow-lg">✕</button>
                       
                       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase">Hotel Name</label>
                             <input list={`hotels-${idx}`} className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-bold" placeholder="e.g. Anwar Al Madina" value={item.hotelName} onChange={e => updateHotelItem(idx, 'hotelName', e.target.value)} />
                             <datalist id={`hotels-${idx}`}>
                               {item.city === 'Makkah' ? MAKKAH_HOTELS.map(h => <option key={h.name} value={h.name} />) : 
                                item.city === 'Madinah' ? MADINAH_HOTELS.map(h => <option key={h.name} value={h.name} />) : null}
                             </datalist>
                          </div>
                          <div className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase">City</label>
                             <select className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-bold" value={item.city} onChange={e => updateHotelItem(idx, 'city', e.target.value)}>
                                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                             </select>
                          </div>
                          <div className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase">Country</label>
                             <select className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-bold" value={item.country} onChange={e => updateHotelItem(idx, 'country', e.target.value)}>
                                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                             </select>
                          </div>
                          <div className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase">HB # / Booking Ref</label>
                             <input className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-black uppercase" placeholder="e.g. HB-12345" value={item.reference} onChange={e => updateHotelItem(idx, 'reference', e.target.value.toUpperCase())} />
                          </div>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase">Check-in</label>
                             <DateInput className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-bold" value={item.fromDate} onChange={val => updateHotelItem(idx, 'fromDate', val)} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase">Check-out</label>
                             <DateInput className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-bold" value={item.toDate} onChange={val => updateHotelItem(idx, 'toDate', val)} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase">Occupancy (Adults/Children)</label>
                             <div className="flex gap-2">
                               <input type="number" className="w-1/2 bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-black" value={item.adults} onChange={e => updateHotelItem(idx, 'adults', Number(e.target.value))} />
                               <input type="number" className="w-1/2 bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-black" value={item.children} onChange={e => updateHotelItem(idx, 'children', Number(e.target.value))} />
                             </div>
                          </div>
                          <div className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase">Meals</label>
                             <select className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-bold" value={Array.isArray(item.meals) ? item.meals[0] : item.meals} onChange={e => updateHotelItem(idx, 'meals', [e.target.value])}>
                                {MEALS.map(m => <option key={m} value={m}>{m}</option>)}
                             </select>
                          </div>
                       </div>

                       <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase">Rooms</label>
                             <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-black" value={item.numRooms} onChange={e => updateHotelItem(idx, 'numRooms', Number(e.target.value))} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase">Nights</label>
                             <input type="number" readOnly className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-black opacity-50" value={item.numNights} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase">Room Type</label>
                             <select className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-bold" value={item.roomType} onChange={e => updateHotelItem(idx, 'roomType', e.target.value)}>
                                {ROOM_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                             </select>
                          </div>
                          <div className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase">Rate/Night ({formData.currency})</label>
                             <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-black text-blue-600" value={item.unitRate} onChange={e => updateHotelItem(idx, 'unitRate', Number(e.target.value))} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase">Vendor (CR)</label>
                             <select className="w-full bg-emerald-50/50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-bold outline-none ring-1 ring-emerald-100" value={item.vendorId} onChange={e => updateHotelItem(idx, 'vendorId', e.target.value)}>
                                <option value="">Select Vendor...</option>
                                {vendorAccounts.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                             </select>
                          </div>
                       </div>
                       <div className="flex justify-end pt-2 border-t border-slate-50 dark:border-slate-800">
                          <div className="text-right">
                             <div className="text-[7px] font-black text-slate-400 uppercase">Segment Total</div>
                             <div className="text-sm font-black text-blue-600">{(item.unitRate * item.numRooms * item.numNights).toLocaleString()} {formData.currency}</div>
                          </div>
                       </div>
                   </div>
                ))}
             </div>
          </div>

          {/* Transport Section */}
          <div className="bg-slate-50/50 dark:bg-slate-800/20 p-8 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
             <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-[0.2em]">🚐 Ground Transport</h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Sector and Route arrangements</p>
                </div>
                <button type="button" onClick={addTransportItem} className="bg-rose-600 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-rose-600/20 hover:scale-105 active:scale-95 transition-all">+ Add Route</button>
             </div>
             
             <div className="space-y-4">
                {formData.transportItems.map((item: any, idx: number) => (
                   <div key={idx} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 flex flex-col md:flex-row gap-4 relative animate-in fade-in slide-in-from-bottom-2">
                       <button type="button" onClick={() => removeTransportItem(idx)} className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] shadow-lg">✕</button>
                       <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
                          <div className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase">Sector Arrangement</label>
                             <div className="flex gap-2">
                               <select 
                                 className="flex-1 bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-bold" 
                                 value={item.isMultiSector ? 'MULTI_SECTOR' : (item.sector === 'CUSTOM' ? 'CUSTOM' : item.sector)}
                                 onChange={e => {
                                   const val = e.target.value;
                                   if (val === 'MULTI_SECTOR') {
                                     updateTransportItem(idx, 'isMultiSector', true);
                                     updateTransportItem(idx, 'sector', 'MULTI_SECTOR');
                                     if (!item.subSectors || item.subSectors.length === 0) {
                                       updateTransportItem(idx, 'subSectors', [{ route: '', date: formData.date }]);
                                     }
                                   } else if (val === 'CUSTOM') {
                                     updateTransportItem(idx, 'isMultiSector', false);
                                     updateTransportItem(idx, 'sector', 'CUSTOM');
                                   } else {
                                     updateTransportItem(idx, 'isMultiSector', false);
                                     updateTransportItem(idx, 'sector', val);
                                     const sugg = SECTOR_SUGGESTIONS.find(s => s.sector === val);
                                     if (sugg) {
                                       updateTransportItem(idx, 'vehicle', sugg.vehicle);
                                       updateTransportItem(idx, 'rate', sugg.rate);
                                     }
                                   }
                                 }}
                               >
                                 <option value="">Select Sector...</option>
                                 <option value="CUSTOM">Custom Route</option>
                                 <option value="MULTI_SECTOR">Multi-Sector Trip</option>
                                 {SECTOR_SUGGESTIONS.map(s => <option key={s.label} value={s.sector}>{s.label}</option>)}
                               </select>
                             </div>
                          </div>

                          {item.sector === 'CUSTOM' && (
                            <div className="space-y-1">
                               <label className="text-[8px] font-black text-slate-400 uppercase">Custom Route Label</label>
                               <input className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-bold" value={item.customLabel} onChange={e => updateTransportItem(idx, 'customLabel', e.target.value)} />
                            </div>
                          )}

                          {item.isMultiSector && (
                            <div className="md:col-span-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-3 mt-4">
                               <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800 mb-2">
                                 <div className="text-[9px] font-black uppercase text-slate-500">Routing Template</div>
                                 <div className="flex gap-1 overflow-x-auto pb-1">
                                    {(typeof TRANSPORT_TEMPLATES !== 'undefined' ? TRANSPORT_TEMPLATES : []).map((t: any) => (
                                      <button key={t.id} type="button" onClick={() => handleTemplateSelect(idx, t)} className="text-[7px] font-bold px-2 py-1 rounded bg-slate-100 hover:bg-indigo-600 hover:text-white transition-all uppercase whitespace-nowrap">{t.name}</button>
                                    ))}
                                 </div>
                               </div>
                               <div className="grid grid-cols-1 gap-2">
                                  {(item.subSectors || []).map((ss: any, ssi: number) => (
                                    <div key={ssi} className="flex gap-2 items-end">
                                       <div className="flex-1 space-y-1">
                                          <label className="text-[7px] font-black text-slate-400 uppercase">Sector {ssi+1}</label>
                                          <input className="w-full bg-white dark:bg-slate-900 rounded-lg p-1.5 text-[9px] font-bold border border-slate-100 dark:border-slate-800 uppercase" value={ss.route} onChange={e => updateSubSector(idx, ssi, 'route', e.target.value)} />
                                       </div>
                                       <div className="w-28 space-y-1">
                                          <label className="text-[7px] font-black text-slate-400 uppercase">Date</label>
                                          <input type="date" className="w-full bg-white dark:bg-slate-900 rounded-lg p-1.5 text-[9px] font-bold border border-slate-100 dark:border-slate-800" value={ss.date} onChange={e => updateSubSector(idx, ssi, 'date', e.target.value)} />
                                       </div>
                                       <button type="button" onClick={() => removeSubSector(idx, ssi)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">🗑️</button>
                                    </div>
                                  ))}
                                  <button type="button" onClick={() => addSubSector(idx)} className="text-[8px] font-black text-blue-600 uppercase flex items-center gap-1 hover:gap-2 transition-all mt-2 w-fit">
                                    <span className="text-xs">+</span> Add Route Point
                                  </button>
                               </div>
                            </div>
                          )}

                          <div className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase">Vehicle Type</label>
                             <select className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-bold" value={item.vehicle} onChange={e => updateTransportItem(idx, 'vehicle', e.target.value)}>
                                {VEHICLES.map(v => <option key={v} value={v}>{v}</option>)}
                             </select>
                          </div>
                          <div className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase">Date</label>
                             <DateInput className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-bold" value={item.date} onChange={val => updateTransportItem(idx, 'date', val)} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase">Rate ({formData.currency})</label>
                             <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-black text-blue-600" value={item.rate} onChange={e => updateTransportItem(idx, 'rate', Number(e.target.value))} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[8px] font-black text-slate-400 uppercase">Vendor (CR)</label>
                             <select className="w-full bg-rose-50/50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-bold outline-none ring-1 ring-rose-100" value={item.vendorId} onChange={e => updateTransportItem(idx, 'vendorId', e.target.value)}>
                                <option value="">Select Vendor...</option>
                                {vendorAccounts.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                             </select>
                          </div>
                       </div>
                   </div>
                ))}
             </div>
          </div>

          {/* Income / Service Fee */}
          <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-2xl flex flex-col md:flex-row items-center gap-8 ring-4 ring-blue-600/20">
             <div className="flex-1 space-y-2">
                <h3 className="text-lg font-black uppercase tracking-tight leading-none italic">Managed Service Fee</h3>
                <p className="text-[10px] font-bold text-white/70 uppercase">Additional markup or handling charges (PKR Only)</p>
             </div>
             <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-white/50">Fee Account</label>
                  <select className="bg-white/10 border border-white/20 rounded-xl p-3 text-xs font-bold w-full md:w-60 outline-none" value={formData.incomeAccountId} onChange={e => setFormData({...formData, incomeAccountId: e.target.value})}>
                     <option value="" className="text-slate-900">Default Revenue</option>
                     {accounts.filter(a => a.type === AccountType.REVENUE).map(a => <option key={a.id} value={a.id} className="text-slate-900">{a.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-white/50">Amount (PKR)</label>
                  <input type="number" className="bg-white text-blue-600 border-none rounded-xl p-3 text-xs font-black w-full md:w-40 outline-none" value={formData.incomeAmountPKR} onChange={e => setFormData({...formData, incomeAmountPKR: Number(e.target.value)})} />
                </div>
             </div>
          </div>

        </form>

        {/* Footer Summary */}
        <div className="p-8 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
           <div className="flex flex-wrap gap-8 justify-center md:justify-start">
              <div className="text-center md:text-left">
                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Visa Total</p>
                 <p className="text-sm font-black text-slate-900 dark:text-white">{totals.visaTotal.toLocaleString()} {formData.currency}</p>
              </div>
              <div className="text-center md:text-left">
                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Hotel Total</p>
                 <p className="text-sm font-black text-slate-900 dark:text-white">{totals.hotelTotal.toLocaleString()} {formData.currency}</p>
              </div>
              <div className="text-center md:text-left">
                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Transport Total</p>
                 <p className="text-sm font-black text-slate-900 dark:text-white">{totals.transportTotal.toLocaleString()} {formData.currency}</p>
              </div>
              <div className="text-center md:text-left px-6 border-l border-slate-100 dark:border-slate-800">
                 <p className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] mb-1">Grand Total (PKR)</p>
                 <p className="text-2xl font-black font-orbitron text-blue-600 leading-none">
                   {Math.round(totals.grandTotalPKR).toLocaleString()}
                 </p>
              </div>
           </div>
           
           <div className="flex space-x-3 w-full md:w-auto">
              <button type="button" onClick={onCancel} className="flex-1 md:flex-none px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black rounded-2xl uppercase text-[10px] tracking-widest transition-all hover:bg-slate-200">Discard</button>
              <button 
                onClick={handleSubmit}
                className="flex-1 md:flex-none px-12 py-3 bg-slate-900 dark:bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-slate-900/20 dark:shadow-blue-600/20 uppercase text-[10px] tracking-[0.3em] font-orbitron transition-all active:scale-95"
              >
                Post Unified Voucher
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default AllInOneVoucherForm;
