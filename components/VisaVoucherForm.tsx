import React, { useState, useMemo, useEffect } from 'react';
import { VoucherType, Currency, AccountType, Voucher, VoucherStatus, Account, AppConfig } from '../types';
import { getAccounts, getConfig } from '../services/db';

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
    amount: initialData?.details?.unitRate || 0,
    customerId: initialData?.customerId || '',
    vendorId: initialData?.vendorId || '',
    description: initialData?.description || '',
    reference: isClone ? '' : (initialData?.reference || ''),
    headName: initialData?.details?.headName || ''
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
    if (formData.amount <= 0) return alert("Visa Price required");
    if (!formData.customerId || !formData.vendorId) return alert("Select both Customer and Vendor");
    if (!formData.headName) return alert("Head Name (Passport Holder) is required");

    onSave({
      ...formData,
      type: VoucherType.VISA,
      totalAmountPKR: totalPKR,
      status: VoucherStatus.POSTED,
      details: {
        headName: formData.headName,
        unitRate: formData.amount,
        inputCurrency: formData.currency
      }
    });
  };

  if (loading || !config) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 overflow-y-auto no-print">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[3rem] shadow-2xl flex flex-col border border-white/10 animate-in zoom-in-95 duration-300 overflow-hidden">
        
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
        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Voucher Date</label>
              <input type="date" required className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold text-sm shadow-inner" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Currency</label>
              <select className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold text-sm shadow-inner cursor-pointer" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value as Currency})}>
                <option value={Currency.PKR}>PKR (Pak Rupee)</option>
                <option value={Currency.SAR}>SAR (Saudi Riyal)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest ml-1">Visa Price ({formData.currency})</label>
              <input type="number" step="0.01" required className="w-full bg-amber-50/50 dark:bg-amber-900/20 border-none rounded-2xl p-4 font-orbitron font-bold text-xl text-amber-600 shadow-inner" placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
               <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Head Name (Passport Holder)</label>
                <input required className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold text-sm shadow-inner" placeholder="Full Name of Applicant" value={formData.headName} onChange={e => setFormData({...formData, headName: e.target.value})} />
              </div>
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
              {formData.currency === Currency.SAR && (
                <div className="p-6 bg-slate-900 dark:bg-amber-950/40 rounded-3xl border border-white/5 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ROE (Exchange Rate)</span>
                    <input type="number" step="0.01" className="bg-white/10 text-white rounded-lg p-2 font-bold w-24 text-right" value={formData.roe} onChange={e => setFormData({...formData, roe: Number(e.target.value)})} />
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-white/10">
                    <span className="text-xs font-black text-amber-500 uppercase tracking-widest">Measured PKR</span>
                    <span className="text-2xl font-orbitron font-bold text-white">{totalPKR.toLocaleString()}</span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Description / Notes</label>
                <textarea className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-[2rem] p-6 font-medium text-sm shadow-inner h-[120px] resize-none" placeholder="Passport details, Visa type, Embassy info..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-4">
            <button type="button" onClick={onCancel} className="flex-1 py-5 bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-500 font-bold rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all uppercase text-xs tracking-widest">
              Discard
            </button>
            <button type="submit" className="flex-[2] py-5 bg-amber-500 text-white font-bold rounded-2xl shadow-xl shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase text-xs tracking-widest">
              Commit Visa Transaction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VisaVoucherForm;