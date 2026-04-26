import React, { useState, useMemo, useEffect } from 'react';
import { VoucherType, Currency, AccountType, Voucher, VoucherStatus, Account, AppConfig } from '../types';
import { getAccounts, getConfig } from '../services/db';
import DateInput from './DateInput';

interface TransportVoucherFormProps {
  initialData?: Partial<Voucher>;
  onSave: (data: any) => void;
  onCancel: () => void;
  isClone?: boolean;
}

const SECTOR_SUGGESTIONS = [
  { label: 'Makkah → Jeddah', sector: 'Makkah → Jeddah', vehicle: 'Car', rate: 150 },
  { label: 'Makkah → Madinah', sector: 'Makkah → Madinah', vehicle: 'Car', rate: 350 },
  { label: 'Madinah → Makkah', sector: 'Madinah → Makkah', vehicle: 'Car', rate: 350 },
  { label: 'Madinah → Jeddah', sector: 'Madinah → Jeddah', vehicle: 'Car', rate: 400 },
  { label: 'Madinah Hotel → Madinah Airport', sector: 'Madinah Hotel → Madinah Airport', vehicle: 'Car', rate: 100 },
  { label: 'Jeddah Airport → Makkah', sector: 'Jeddah Airport → Makkah Hotel', vehicle: 'Car', rate: 150 },
  { label: 'Ziyarat Makkah', sector: 'Ziyarat Makkah', vehicle: 'H1', rate: 200 },
  { label: 'Ziyarat Madinah', sector: 'Ziyarat Madinah', vehicle: 'H1', rate: 150 },
];

const MULTI_SECTOR_COMBINATIONS = [
  { label: 'JED → MAK | MAK → MED | MED → MAK | MAK → JED', routes: ['JED → MAK', 'MAK → MED', 'MED → MAK', 'MAK → JED'] },
  { label: 'JED → MAK | MAK → MED | MED HTL → MED AIRPORT', routes: ['JED → MAK', 'MAK → MED', 'MED HTL → MED AIRPORT'] },
  { label: 'JED → MAK | MAK → MED | MED HTL → JED AIRPORT', routes: ['JED → MAK', 'MAK → MED', 'MED HTL → JED AIRPORT'] },
  { label: 'MED AIRPORT → MED HTL | MED HTL → MAK | MAK → JED', routes: ['MED AIRPORT → MED HTL', 'MED HTL → MAK', 'MAK → JED'] },
];

// Fixed InputLabel by moving it outside the component and making children optional to satisfy strict TS checks
const InputLabel = ({ children }: { children?: React.ReactNode }) => (
  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block ml-1">
    {children}{children === 'Date' ? ' (DD-MM-YYYY)' : ''}
  </label>
);

const TransportVoucherForm: React.FC<TransportVoucherFormProps> = ({ initialData, onSave, onCancel, isClone }) => {
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
    currency: initialData?.currency || Currency.SAR,
    roe: initialData?.roe || 74.5,
    customerId: initialData?.customerId || '',
    vendorId: initialData?.vendorId || '',
    incomeAccountId: initialData?.details?.incomeAccountId || '',
    description: initialData?.description || '',
    reference: isClone ? '' : (initialData?.reference || ''),
    paxName: initialData?.details?.paxName || '',
    serviceFee: initialData?.details?.serviceFee || 0,
    items: initialData?.details?.items || [{ sector: '', vehicle: 'Car', rate: 0, customLabel: '', date: initialData?.date?.split('T')[0] || new Date().toISOString().split('T')[0], isMultiSector: false, subSectors: [] }]
  });

  const incomeAccounts = useMemo(() => accounts.filter(a => a.type === AccountType.REVENUE), [accounts]);

  useEffect(() => {
    if (config && !initialData) {
      setFormData(prev => ({ 
        ...prev, 
        roe: config.defaultROE,
        incomeAccountId: incomeAccounts.find(a => a.name.toLowerCase().includes('service'))?.id || incomeAccounts[0]?.id || ''
      }));
    }
  }, [config, initialData, incomeAccounts]);

  const vendorSubtotal = useMemo(() => formData.items.reduce((sum: number, item: any) => sum + (Number(item.rate) || 0), 0), [formData.items]);
  const totalSelectedCurrency = useMemo(() => vendorSubtotal + (Number(formData.serviceFee) || 0), [vendorSubtotal, formData.serviceFee]);

  const totalPKR = useMemo(() => {
    const rate = formData.currency === Currency.SAR ? formData.roe : 1;
    return totalSelectedCurrency * rate;
  }, [totalSelectedCurrency, formData.roe, formData.currency]);

  const vendorAmountPKR = useMemo(() => {
    const rate = formData.currency === Currency.SAR ? formData.roe : 1;
    return vendorSubtotal * rate;
  }, [vendorSubtotal, formData.roe, formData.currency]);

  const incomeAmountPKR = useMemo(() => {
    const rate = formData.currency === Currency.SAR ? formData.roe : 1;
    return (Number(formData.serviceFee) || 0) * rate;
  }, [formData.serviceFee, formData.roe, formData.currency]);

  const handleAddItem = (isMulti: boolean = false) => {
    setFormData({ 
      ...formData, 
      items: [
        ...formData.items, 
        { 
          sector: isMulti ? 'MULTI_SECTOR' : '', 
          vehicle: 'Car', 
          rate: 0, 
          customLabel: '', 
          date: formData.date, 
          isMultiSector: isMulti, 
          subSectors: isMulti ? [{ route: '', date: formData.date, note: '' }] : [] 
        }
      ] 
    });
  };

  const handleRemoveItem = (index: number) => {
    if (formData.items.length === 1) {
      setFormData({ 
        ...formData, 
        items: [{ 
          sector: '', 
          vehicle: 'Car', 
          rate: 0, 
          customLabel: '', 
          date: formData.date, 
          isMultiSector: false, 
          subSectors: [] 
        }] 
      });
      return;
    }
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const handleSectorChange = (index: number, sectorLabel: string) => {
    const newItems = [...formData.items];
    
    if (sectorLabel === 'MULTI_SECTOR') {
      newItems[index] = {
        ...newItems[index],
        sector: 'MULTI_SECTOR',
        isMultiSector: true,
        subSectors: [{ route: '', date: formData.date, note: '' }],
        customLabel: ''
      };
    } else {
      const suggestion = SECTOR_SUGGESTIONS.find(s => s.label === sectorLabel);
      if (suggestion) {
        const calculatedRate = formData.currency === Currency.SAR ? suggestion.rate : Math.round(suggestion.rate * formData.roe);
        newItems[index] = { 
          ...newItems[index],
          sector: suggestion.label, 
          vehicle: suggestion.vehicle, 
          rate: calculatedRate,
          isMultiSector: false,
          subSectors: [],
          customLabel: ''
        };
      } else {
        newItems[index] = { 
          ...newItems[index], 
          sector: sectorLabel, 
          isMultiSector: false,
          subSectors: [],
          customLabel: sectorLabel === 'CUSTOM' ? '' : newItems[index].customLabel 
        };
      }
    }
    
    setFormData({ ...formData, items: newItems });
  };

  const handleMultiSectorTemplateChange = (index: number, templateLabel: string) => {
    const newItems = [...formData.items];
    if (templateLabel === 'CUSTOM') {
      newItems[index].subSectors = [{ route: '', date: formData.date, note: '' }];
    } else {
      const template = MULTI_SECTOR_COMBINATIONS.find(t => t.label === templateLabel);
      if (template) {
        newItems[index].subSectors = template.routes.map(r => ({ route: r, date: formData.date, note: '' }));
      }
    }
    setFormData({ ...formData, items: newItems });
  };

  const updateSubSector = (itemIndex: number, subIndex: number, field: string, value: any) => {
    const newItems = [...formData.items];
    const subSectors = [...newItems[itemIndex].subSectors];
    subSectors[subIndex] = { ...subSectors[subIndex], [field]: value };
    newItems[itemIndex].subSectors = subSectors;
    setFormData({ ...formData, items: newItems });
  };

  const addSubSector = (itemIndex: number) => {
    const newItems = [...formData.items];
    newItems[itemIndex].subSectors.push({ route: '', date: formData.date, note: '' });
    setFormData({ ...formData, items: newItems });
  };

  const removeSubSector = (itemIndex: number, subIndex: number) => {
    const newItems = [...formData.items];
    if (newItems[itemIndex].subSectors.length > 1) {
      newItems[itemIndex].subSectors.splice(subIndex, 1);
      setFormData({ ...formData, items: newItems });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalPKR <= 0) return alert("Total amount must be greater than 0");
    if (!formData.customerId || !formData.vendorId) return alert("Select both Customer and Vendor");

    onSave({
      ...formData,
      type: VoucherType.TRANSPORT,
      totalAmountPKR: totalPKR,
      status: VoucherStatus.POSTED,
      details: {
        paxName: formData.paxName,
        items: formData.items,
        vendorAmountPKR: vendorAmountPKR,
        incomeAmountPKR: incomeAmountPKR,
        incomeAccountId: formData.incomeAccountId,
        serviceFee: formData.serviceFee,
        totalSelectedCurrency: totalSelectedCurrency,
        inputCurrency: formData.currency
      }
    });
  };

  if (loading || !config) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4 overflow-y-auto no-print">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-[2rem] shadow-2xl flex flex-col border border-slate-200 dark:border-white/5 animate-in zoom-in-95 duration-200 max-h-[95vh] overflow-hidden">
        
        {/* Header - More compact */}
        <div className="px-8 py-6 border-b dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
              <span className="text-xl">🚐</span>
            </div>
            <div>
              <h3 className="text-xl font-orbitron font-bold text-slate-900 dark:text-white uppercase tracking-tighter">
                {isClone ? 'Clone' : (initialData ? 'Edit' : 'Post')} Transport Voucher
              </h3>
              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.2em]">Hashmi Books Logistics Engine</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-rose-500 transition-colors">
            <span className="text-xl">✕</span>
          </button>
        </div>

        {/* Form Body - More smart layout */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {/* Primary Info Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border dark:border-slate-800">
            <div>
              <InputLabel>Date</InputLabel>
              <DateInput required className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.date} onChange={val => setFormData({...formData, date: val})} />
            </div>
            <div>
              <InputLabel>Currency</InputLabel>
              <select className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 cursor-pointer outline-none transition-all" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value as Currency})}>
                <option value={Currency.SAR}>SAR (Riyal)</option>
                <option value={Currency.PKR}>PKR (Rupee)</option>
              </select>
            </div>
            <div>
              <InputLabel>ROE</InputLabel>
              <input type="number" step="0.01" disabled={formData.currency === Currency.PKR} className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500 disabled:opacity-30 outline-none transition-all" value={formData.roe} onChange={e => setFormData({...formData, roe: Number(e.target.value)})} />
            </div>
            <div>
              <InputLabel>Pax Name</InputLabel>
              <input required className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="Guest Name" value={formData.paxName} onChange={e => setFormData({...formData, paxName: e.target.value})} />
            </div>
          </div>

          {/* Account Mapping Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <InputLabel>Client (Debit)</InputLabel>
              <select required className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 cursor-pointer outline-none transition-all" value={formData.customerId} onChange={e => setFormData({...formData, customerId: e.target.value})}>
                <option value="">Select Customer...</option>
                {accounts.filter(a => a.type === AccountType.CUSTOMER).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <InputLabel>Vendor (Credit)</InputLabel>
              <select required className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 cursor-pointer outline-none transition-all" value={formData.vendorId} onChange={e => setFormData({...formData, vendorId: e.target.value})}>
                <option value="">Select Vendor...</option>
                {accounts.filter(a => a.type === AccountType.VENDOR).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <InputLabel>Revenue (Credit)</InputLabel>
              <select required className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 cursor-pointer outline-none transition-all" value={formData.incomeAccountId} onChange={e => setFormData({...formData, incomeAccountId: e.target.value})}>
                {incomeAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          {/* Dynamic Row Table - Smarter spacing */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 flex justify-between items-center border-b dark:border-slate-800">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Itinerary Details</h4>
               <div className="flex space-x-4">
                 <button type="button" onClick={() => handleAddItem(false)} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-500 uppercase tracking-widest">+ Single Sector</button>
                 <button type="button" onClick={() => handleAddItem(true)} className="text-[10px] font-bold text-blue-600 hover:text-blue-500 uppercase tracking-widest">🚐 + Multi-Sector</button>
               </div>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white dark:bg-slate-900 border-b dark:border-slate-800">
                  <th className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase w-12">#</th>
                  <th className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase">Sector / Trip Type</th>
                  <th className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase w-32">Vehicle</th>
                  <th className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase w-36 text-right">Amount ({formData.currency})</th>
                  <th className="px-6 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {formData.items.map((item: any, idx: number) => (
                  <React.Fragment key={idx}>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all border-b border-transparent">
                      <td className="px-6 py-4 text-xs font-mono text-slate-300">{idx + 1}</td>
                      <td className="px-6 py-4">
                        <select 
                          className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
                          value={item.sector}
                          onChange={e => handleSectorChange(idx, e.target.value)}
                        >
                          <option value="">Choose trip type...</option>
                          <optgroup label="Single Sector">
                            {SECTOR_SUGGESTIONS.map((s, si) => (
                              <option key={si} value={s.label}>{s.label}</option>
                            ))}
                            <option value="CUSTOM">Custom / Other Single...</option>
                          </optgroup>
                          <optgroup label="Advanced Operations">
                            <option value="MULTI_SECTOR">🚐 Multi-Sector Transport</option>
                          </optgroup>
                        </select>
                        {item.sector === 'CUSTOM' && (
                          <input 
                            className="mt-2 w-full bg-indigo-50/50 dark:bg-indigo-900/10 rounded-lg p-2 text-xs font-bold border-none"
                            placeholder="Type custom sector..."
                            value={item.customLabel}
                            onChange={e => updateItem(idx, 'customLabel', e.target.value)}
                          />
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <select className="w-full bg-transparent border-none focus:ring-0 text-xs font-semibold cursor-pointer text-slate-600 dark:text-slate-400" value={item.vehicle} onChange={e => updateItem(idx, 'vehicle', e.target.value)}>
                          {['Car', 'H1', 'GMC', 'Coaster', 'Bus', 'SUV', 'Pickup'].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <input type="number" step="0.01" className="w-full bg-transparent border-none focus:ring-0 text-right font-orbitron font-bold text-indigo-600" value={item.rate} onChange={e => updateItem(idx, 'rate', Number(e.target.value))} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button type="button" onClick={() => handleRemoveItem(idx)} className="text-slate-300 hover:text-rose-500 p-2">✕</button>
                      </td>
                    </tr>
                    
                    {/* Multi-Sector Details Row */}
                    {item.isMultiSector && (
                      <tr className="bg-blue-50/30 dark:bg-blue-900/5">
                        <td className="px-6 py-0 pb-4" colSpan={5}>
                          <div className="ml-12 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-blue-900/30 shadow-sm space-y-4">
                            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl mb-4">
                              <select 
                                className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-slate-500 focus:ring-0 cursor-pointer"
                                onChange={(e) => handleMultiSectorTemplateChange(idx, e.target.value)}
                              >
                                <option value="">Select Predefined Template...</option>
                                {MULTI_SECTOR_COMBINATIONS.map((template, ti) => (
                                  <option key={ti} value={template.label}>{template.label}</option>
                                ))}
                                <option value="CUSTOM">Custom Multi-Sector Configuration</option>
                              </select>
                              <button type="button" onClick={() => addSubSector(idx)} className="text-[9px] font-black text-blue-600 uppercase">+ Add Sector</button>
                            </div>
                            
                            <div className="space-y-2">
                              {item.subSectors.map((sub: any, si: number) => (
                                <div key={si} className="flex flex-col md:flex-row gap-2 border-b dark:border-slate-800 pb-2 animate-in fade-in slide-in-from-left-2">
                                  <div className="flex-1">
                                    <input 
                                      className="w-full bg-transparent border-none p-1 text-[11px] font-bold uppercase placeholder-slate-300 focus:ring-0" 
                                      placeholder="Route (e.g. JED -> MAK)"
                                      value={sub.route}
                                      onChange={e => updateSubSector(idx, si, 'route', e.target.value.toUpperCase())}
                                    />
                                  </div>
                                  <div className="w-full md:w-32">
                                    <DateInput 
                                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-1 text-[10px] font-bold text-blue-600"
                                      value={sub.date}
                                      onChange={val => updateSubSector(idx, si, 'date', val)}
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <input 
                                      className="w-full bg-transparent border-none p-1 text-[10px] font-medium placeholder-slate-400 focus:ring-0" 
                                      placeholder="Note (Hotel, Timing, etc)"
                                      value={sub.note}
                                      onChange={e => updateSubSector(idx, si, 'note', e.target.value)}
                                    />
                                  </div>
                                  <button type="button" onClick={() => removeSubSector(idx, si)} className="px-2 text-slate-300 hover:text-rose-500">×</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    
                    {/* Single Sector Date Selection */}
                    {!item.isMultiSector && item.sector && (
                      <tr className="bg-slate-50/50 dark:bg-slate-800/10">
                        <td className="px-6 py-0 pb-2" colSpan={5}>
                          <div className="ml-12 flex items-center space-x-4 p-2">
                             <div className="flex items-center space-x-2">
                               <span className="text-[9px] font-black text-slate-400 uppercase">Movement Date:</span>
                               <DateInput 
                                 className="bg-transparent border-none p-0 text-[10px] font-bold text-indigo-600 focus:ring-0 w-24"
                                 value={item.date}
                                 onChange={val => updateItem(idx, 'date', val)}
                               />
                             </div>
                             <div className="flex-1">
                               <input 
                                 className="w-full bg-transparent border-none p-0 text-[10px] font-medium text-slate-500 focus:ring-0 italic" 
                                 placeholder="Optional notes for this movement..."
                                 value={item.note || ''}
                                 onChange={e => updateItem(idx, 'note', e.target.value)}
                               />
                             </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Financial & Narration Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <InputLabel>Transaction Remarks</InputLabel>
              <textarea className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-sm font-medium h-32 resize-none focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Enter driver details, contact numbers, or specific route instructions..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>
            <div className="space-y-4">
               <div>
                 <InputLabel>Service Fee ({formData.currency})</InputLabel>
                 <input type="number" step="0.01" className="w-full bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-4 font-orbitron font-bold text-lg text-amber-600 text-center focus:ring-2 focus:ring-amber-500 outline-none" value={formData.serviceFee} onChange={e => setFormData({...formData, serviceFee: Number(e.target.value)})} />
               </div>
               <div className="bg-slate-900 dark:bg-indigo-950/40 p-6 rounded-3xl border border-white/5 shadow-xl text-center">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Final Customer Dr</p>
                  <p className="text-3xl font-orbitron font-bold text-emerald-400 leading-none">PKR {totalPKR.toLocaleString()}</p>
                  <p className="text-[8px] font-bold text-white/40 mt-2 uppercase">Including Service Revenue</p>
               </div>
            </div>
          </div>
        </form>

        {/* Smart Summary Footer */}
        <div className="px-8 py-6 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex space-x-8">
            <div className="text-center md:text-left">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Vendor Payable</p>
              <p className="text-sm font-orbitron font-bold text-rose-500">PKR {vendorAmountPKR.toLocaleString()}</p>
            </div>
            <div className="text-center md:text-left">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Service Profit</p>
              <p className="text-sm font-orbitron font-bold text-amber-500">PKR {incomeAmountPKR.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex space-x-3 w-full md:w-auto">
            <button type="button" onClick={onCancel} className="px-6 py-3 bg-white dark:bg-slate-800 text-slate-500 font-bold rounded-xl uppercase text-[10px] tracking-widest border dark:border-slate-700">Discard</button>
            <button type="button" onClick={handleSubmit} className="flex-1 md:flex-none px-12 py-3 bg-indigo-600 text-white font-bold rounded-xl uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-indigo-600/20 active:scale-95 transition-all font-orbitron">Post Transaction</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransportVoucherForm;