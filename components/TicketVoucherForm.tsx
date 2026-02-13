import React, { useState, useMemo, useEffect } from 'react';
import { VoucherType, Currency, AccountType, Voucher, VoucherStatus, Account, AppConfig } from '../types';
import { getAccounts, getConfig } from '../services/db';

interface TicketVoucherFormProps {
  initialData?: Partial<Voucher>;
  onSave: (data: any) => void;
  onCancel: () => void;
  isClone?: boolean;
}

const InputLabel = ({ children }: { children?: React.ReactNode }) => (
  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block ml-1">{children}</label>
);

const TicketVoucherForm: React.FC<TicketVoucherFormProps> = ({ initialData, onSave, onCancel, isClone }) => {
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
    reference: isClone ? '' : (initialData?.reference || ''), // PNR / E-Ticket
    paxName: initialData?.details?.paxName || '',
    airline: initialData?.details?.airline || '',
    sector: initialData?.details?.sector || '',
    amount: initialData?.details?.unitRate || 0
  });

  useEffect(() => {
    if (config && !initialData) {
      setFormData(prev => ({ ...prev, roe: config.defaultROE }));
    }
  }, [config, initialData]);

  const totalPKR = useMemo(() => {
    const rate = formData.currency === Currency.SAR ? formData.roe : 1;
    return (formData.amount || 0) * rate;
  }, [formData.amount, formData.roe, formData.currency]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalPKR <= 0) return alert("Ticket amount required");
    if (!formData.customerId || !formData.vendorId) return alert("Select Customer and Vendor");

    onSave({
      ...formData,
      type: VoucherType.TICKET,
      totalAmountPKR: totalPKR,
      status: VoucherStatus.POSTED,
      details: {
        ...formData,
        unitRate: formData.amount
      }
    });
  };

  if (loading || !config) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4 overflow-y-auto no-print">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl flex flex-col border border-slate-200 dark:border-white/5 animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header */}
        <div className="px-8 py-6 border-b dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600 flex items-center justify-center text-white shadow-lg">
              <span className="text-xl">✈️</span>
            </div>
            <div>
              <h3 className="text-xl font-orbitron font-bold text-slate-900 dark:text-white uppercase tracking-tighter">
                {isClone ? 'Clone' : (initialData ? 'Edit' : 'Post')} Ticket Voucher
              </h3>
              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.2em]">Hashmi Books Aviation Ledger</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-rose-500 transition-colors">
            <span className="text-xl">✕</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border dark:border-slate-800">
            <div className="col-span-1">
              <InputLabel>Date</InputLabel>
              <input type="date" required className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
            </div>
            <div>
              <InputLabel>Currency</InputLabel>
              <select className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value as Currency})}>
                <option value={Currency.PKR}>PKR</option>
                <option value={Currency.SAR}>SAR</option>
              </select>
            </div>
            <div>
              <InputLabel>ROE</InputLabel>
              <input type="number" step="0.01" disabled={formData.currency === Currency.PKR} className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-cyan-600" value={formData.roe} onChange={e => setFormData({...formData, roe: Number(e.target.value)})} />
            </div>
            <div>
              <InputLabel>PNR / Ticket #</InputLabel>
              <input required className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold uppercase" placeholder="e.g. 125-1234567890" value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value.toUpperCase()})} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
               <div>
                  <InputLabel>Passenger Name</InputLabel>
                  <input required className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl p-4 font-bold" placeholder="Guest Name" value={formData.paxName} onChange={e => setFormData({...formData, paxName: e.target.value})} />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <InputLabel>Airline</InputLabel>
                   <input className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl p-4 font-bold" placeholder="e.g. PIA, SAUDI" value={formData.airline} onChange={e => setFormData({...formData, airline: e.target.value})} />
                 </div>
                 <div>
                   <InputLabel>Sector</InputLabel>
                   <input className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl p-4 font-bold" placeholder="KHI-JED-KHI" value={formData.sector} onChange={e => setFormData({...formData, sector: e.target.value})} />
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <InputLabel>Customer (Debit)</InputLabel>
                    <select required className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl p-4 font-bold" value={formData.customerId} onChange={e => setFormData({...formData, customerId: e.target.value})}>
                      <option value="">Select...</option>
                      {accounts.filter(a => a.type === AccountType.CUSTOMER).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                 </div>
                 <div>
                    <InputLabel>Vendor (Credit)</InputLabel>
                    <select required className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl p-4 font-bold" value={formData.vendorId} onChange={e => setFormData({...formData, vendorId: e.target.value})}>
                      <option value="">Select...</option>
                      {accounts.filter(a => a.type === AccountType.VENDOR).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                 </div>
               </div>
            </div>

            <div className="space-y-4">
               <div className="p-8 bg-slate-900 rounded-[2.5rem] border border-white/5 text-center shadow-xl">
                  <InputLabel><span className="text-slate-400">Total Fare ({formData.currency})</span></InputLabel>
                  <input type="number" step="0.01" className="bg-transparent text-white text-5xl font-orbitron font-bold text-center border-none w-full outline-none" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} />
                  <div className="mt-6 pt-6 border-t border-white/10">
                     <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-1">Measured PKR Post</p>
                     <p className="text-2xl font-orbitron font-bold text-white">PKR {totalPKR.toLocaleString()}</p>
                  </div>
               </div>
               <div>
                  <InputLabel>Additional Narrative</InputLabel>
                  <textarea className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 h-24 text-sm font-medium border-none shadow-inner" placeholder="Any specific flight notes..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
               </div>
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
             <button type="button" onClick={onCancel} className="flex-1 py-4 bg-white dark:bg-slate-800 text-slate-500 font-bold rounded-xl uppercase text-[10px] tracking-widest border dark:border-slate-700">Discard</button>
             <button type="submit" className="flex-[2] py-4 bg-cyan-600 text-white font-bold rounded-xl uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-cyan-600/20 active:scale-95 transition-all font-orbitron">Authorize & Post</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TicketVoucherForm;
