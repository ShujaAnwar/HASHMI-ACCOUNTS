import React, { useState, useMemo, useEffect } from 'react';
import { VoucherType, Currency, AccountType, Voucher, VoucherStatus, Account, AppConfig } from '../types';
import { getAccounts, getConfig } from '../services/db';
import DateInput from './DateInput';

interface VisaVoucherFormProps {
  initialData?: Partial<Voucher>;
  onSave: (data: any) => void;
  onCancel: () => void;
  isClone?: boolean;
}

const VisaVoucherForm: React.FC<VisaVoucherFormProps> = ({ initialData, onSave, onCancel, isClone }) => {
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
    roe: initialData?.roe || 74.5,
    customerId: initialData?.customerId || '',
    vendorId: initialData?.vendorId || '',
    description: initialData?.description || '',
    reference: isClone ? '' : (initialData?.reference || ''),
    items: initialData?.details?.items || [{ description: 'Adult', paxName: '', passportNumber: '', quantity: 1, rate: 0 }]
  });

  useEffect(() => {
    if (config && !initialData) {
      setFormData(prev => ({ ...prev, roe: config.defaultROE }));
    }
  }, [config, initialData]);

  const totalSelectedCurrency = useMemo(() => {
    return formData.items.reduce((sum: number, item: any) => sum + (Number(item.quantity) * Number(item.rate)), 0);
  }, [formData.items]);

  const totalPKR = useMemo(() => {
    const rate = formData.currency === Currency.SAR ? formData.roe : 1;
    return totalSelectedCurrency * rate;
  }, [totalSelectedCurrency, formData.roe, formData.currency]);

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', paxName: '', passportNumber: '', quantity: 1, rate: 0 }]
    });
  };

  const handleRemoveItem = (index: number) => {
    if (formData.items.length === 1) return;
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalPKR <= 0) return alert("Total amount must be greater than 0");
    if (!formData.customerId || !formData.vendorId) return alert("Select both Customer and Vendor");
    
    const missingPassport = formData.items.some((item: any) => !item.passportNumber);
    if (missingPassport) return alert("Passport Number is required for all entries");

    onSave({
      ...formData,
      type: VoucherType.VISA,
      totalAmountPKR: totalPKR,
      status: VoucherStatus.POSTED,
      details: {
        items: formData.items,
        totalSelectedCurrency,
        inputCurrency: formData.currency
      }
    });
  };

  if (loading || !config) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 overflow-y-auto no-print">
      <div className="bg-white dark:bg-slate-900 w-full max-w-6xl rounded-[3rem] shadow-2xl flex flex-col border border-white/10 animate-in zoom-in-95 duration-300 overflow-hidden">
        
        {/* Header */}
        <div className="p-8 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
              <span className="text-2xl">🛂</span>
            </div>
            <div>
              <h3 className="text-2xl font-orbitron font-bold text-slate-900 dark:text-white uppercase tracking-tighter">
                {isClone ? 'Clone' : (initialData ? 'Update' : 'New')} Visa Voucher
              </h3>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Travel Authorization & Immigration Filing</p>
            </div>
          </div>
          <button onClick={onCancel} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-400">
            <span className="text-xl">✕</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto max-h-[80vh]">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Voucher Date (DD-MM-YYYY)</label>
              <DateInput required className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold text-sm shadow-inner" value={formData.date} onChange={val => setFormData({...formData, date: val})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Currency</label>
              <select className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold text-sm shadow-inner cursor-pointer" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value as Currency})}>
                <option value={Currency.PKR}>PKR (Pak Rupee)</option>
                <option value={Currency.SAR}>SAR (Saudi Riyal)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest ml-1">ROE</label>
              <input type="number" step="0.01" disabled={formData.currency === Currency.PKR} className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold text-sm shadow-inner disabled:opacity-30" value={formData.roe} onChange={e => setFormData({...formData, roe: Number(e.target.value)})} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">Customer (Debit)</label>
                <select required className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold text-sm shadow-inner cursor-pointer" value={formData.customerId} onChange={e => setFormData({...formData, customerId: e.target.value})}>
                  <option value="">Select Customer Account...</option>
                  {accounts.filter(a => a.type === AccountType.CUSTOMER).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-rose-600 uppercase tracking-widest ml-1">Vendor / Visa Supplier (Credit)</label>
                <select required className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold text-sm shadow-inner cursor-pointer" value={formData.vendorId} onChange={e => setFormData({...formData, vendorId: e.target.value})}>
                  <option value="">Select Vendor...</option>
                  {accounts.filter(a => a.type === AccountType.VENDOR).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Description / Notes</label>
                <textarea className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-[2rem] p-6 font-medium text-sm shadow-inner h-[120px] resize-none" placeholder="Visa type, Embassy info..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 flex justify-between items-center border-b dark:border-slate-800">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visa Heads / Applicants</h4>
              <button type="button" onClick={handleAddItem} className="text-[10px] font-bold text-amber-600 hover:text-amber-500 uppercase tracking-widest">+ Add Head</button>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white dark:bg-slate-900 border-b dark:border-slate-800">
                  <th className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase">Head Name</th>
                  <th className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase">Pax Name</th>
                  <th className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase">Passport Number</th>
                  <th className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase w-20">Qty</th>
                  <th className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase w-32 text-right">Rate ({formData.currency})</th>
                  <th className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase w-32 text-right">Amount</th>
                  <th className="px-6 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {formData.items.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                    <td className="px-6 py-4">
                      <input 
                        className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-800 dark:text-slate-100"
                        placeholder="e.g. Adult"
                        value={item.description}
                        onChange={e => updateItem(idx, 'description', e.target.value)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input 
                        className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-800 dark:text-slate-100"
                        placeholder="Passenger Name"
                        value={item.paxName}
                        onChange={e => updateItem(idx, 'paxName', e.target.value)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input 
                        className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-800 dark:text-slate-100 uppercase"
                        placeholder="Passport #"
                        value={item.passportNumber}
                        onChange={e => updateItem(idx, 'passportNumber', e.target.value.toUpperCase())}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input 
                        type="number"
                        className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-800 dark:text-slate-100"
                        value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input 
                        type="number"
                        className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-right text-amber-600 font-orbitron"
                        value={item.rate}
                        onChange={e => updateItem(idx, 'rate', Number(e.target.value))}
                      />
                    </td>
                    <td className="px-6 py-4 text-right font-orbitron font-bold text-slate-900 dark:text-white">
                      {(item.quantity * item.rate).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button type="button" onClick={() => handleRemoveItem(idx)} className="text-slate-300 hover:text-rose-500 p-2">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-900 dark:bg-amber-950/40 p-8 rounded-[3rem] flex flex-col md:flex-row justify-between items-center text-white border border-white/5 shadow-2xl">
            <div className="flex flex-col items-center md:items-start mb-6 md:mb-0">
               <p className="text-[10px] font-bold uppercase opacity-50 tracking-[0.4em] mb-2">Total Customer Debit</p>
               <p className="text-5xl font-black font-orbitron tracking-tighter">
                 PKR {totalPKR.toLocaleString()}
               </p>
               {formData.currency === Currency.SAR && (
                 <p className="text-[10px] font-bold text-amber-500 mt-2 uppercase">
                   SAR {totalSelectedCurrency.toLocaleString()} @ {formData.roe}
                 </p>
               )}
            </div>
            <div className="flex space-x-4">
               <button type="button" onClick={onCancel} className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl uppercase text-[10px] tracking-widest transition-all">Discard</button>
               <button type="submit" className="px-12 py-4 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl shadow-xl shadow-amber-500/20 uppercase text-[10px] tracking-[0.3em] font-orbitron transition-all active:scale-95">Post Voucher</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VisaVoucherForm;