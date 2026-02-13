import React, { useState, useMemo, useEffect } from 'react';
import { VoucherType, Currency, AccountType, Voucher, VoucherStatus, Account, AppConfig } from '../types';
import { getAccounts, getConfig } from '../services/db';

interface ReceiptVoucherFormProps {
  initialData?: Partial<Voucher>;
  onSave: (data: any) => void;
  onCancel: () => void;
  isClone?: boolean;
}

const ReceiptVoucherForm: React.FC<ReceiptVoucherFormProps> = ({ initialData, onSave, onCancel, isClone }) => {
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
    bankId: initialData?.details?.bankId || '',
    description: initialData?.description || '',
    reference: isClone ? '' : (initialData?.reference || '')
  });

  const customerAccounts = useMemo(() => accounts.filter(a => a.type === AccountType.CUSTOMER), [accounts]);
  const cashBankAccounts = useMemo(() => accounts.filter(a => a.type === AccountType.CASH_BANK), [accounts]);

  useEffect(() => {
    if (config && !initialData && cashBankAccounts.length > 0) {
      setFormData(prev => ({ 
        ...prev, 
        roe: config.defaultROE, 
        bankId: prev.bankId || cashBankAccounts[0]?.id || '' 
      }));
    }
  }, [config, initialData, cashBankAccounts]);

  const totalPKR = useMemo(() => {
    const rate = formData.currency === Currency.SAR ? formData.roe : 1;
    return formData.amount * rate;
  }, [formData.amount, formData.roe, formData.currency]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.amount <= 0) return alert("Amount required");
    if (!formData.customerId || !formData.bankId) return alert("Select both accounts");

    onSave({
      ...formData,
      type: VoucherType.RECEIPT,
      totalAmountPKR: totalPKR,
      status: VoucherStatus.POSTED,
      details: {
        bankId: formData.bankId,
        unitRate: formData.amount
      }
    });
  };

  if (loading || !config) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto no-print">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl p-8 md:p-12 border border-slate-100 dark:border-white/5 animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-start mb-10">
          <div>
            <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-widest">
              Revenue Inflow Confirmation
            </span>
            <h3 className="text-3xl font-orbitron font-bold text-slate-900 dark:text-white mt-2">
              {isClone ? 'Clone' : (initialData ? 'Edit' : 'Create')} Receipt Voucher
            </h3>
            <p className="text-slate-400 text-sm">Recording payments from customers to cash/bank</p>
          </div>
          <button onClick={onCancel} className="text-2xl hover:rotate-90 transition-transform">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Date</label>
              <input type="date" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold text-sm shadow-inner" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Currency</label>
              <select className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold text-sm shadow-inner" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value as Currency})}>
                <option value={Currency.PKR}>PKR</option>
                <option value={Currency.SAR}>SAR</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em] ml-1">Amount ({formData.currency})</label>
              <input type="number" step="0.01" required className="w-full bg-blue-50/50 dark:bg-blue-900/20 border-2 border-transparent focus:border-blue-500 rounded-2xl p-4 font-orbitron font-bold text-xl text-blue-600 outline-none" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} />
            </div>
          </div>

          {formData.currency === Currency.SAR && (
            <div className="p-6 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-3xl text-white flex justify-between items-center animate-in slide-in-from-top-2">
              <div>
                <p className="text-[10px] font-bold uppercase opacity-80">Exchange Rate (ROE)</p>
                <input 
                  type="number" step="0.01"
                  className="bg-white/20 border-none rounded-xl p-2 font-bold text-2xl w-32 focus:ring-2 focus:ring-white outline-none mt-1"
                  value={formData.roe}
                  onChange={e => setFormData({...formData, roe: Number(e.target.value)})}
                />
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase opacity-80">Measured PKR Receipt</p>
                <p className="text-3xl font-orbitron font-bold">{totalPKR.toLocaleString()}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Payer (Credit Account)</label>
                <select required className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold text-sm shadow-inner" value={formData.customerId} onChange={e => setFormData({...formData, customerId: e.target.value})}>
                  <option value="">Select Payer...</option>
                  {customerAccounts.map(a => <option key={a.id} value={a.id}>{a.code ? `${a.code} - ` : ''}{a.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Deposit To (Debit Account)</label>
                <select required className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold text-sm shadow-inner" value={formData.bankId} onChange={e => setFormData({...formData, bankId: e.target.value})}>
                  <option value="">Select Cash/Bank Account...</option>
                  {cashBankAccounts.map(a => <option key={a.id} value={a.id}>{a.code ? `${a.code} - ` : ''}{a.name}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-6">
              <input className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-medium text-sm shadow-inner" placeholder="Reference # (Cheque/TT)" value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} />
              <textarea className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-medium text-sm shadow-inner h-[110px]" placeholder="Transaction Narrative..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>
          </div>

          <div className="bg-slate-900 p-8 rounded-[2rem] flex justify-between items-center text-white">
            <div><p className="text-[10px] font-bold uppercase opacity-60">Final Posting (PKR)</p><p className="text-4xl font-orbitron font-bold">PKR {totalPKR.toLocaleString()}</p></div>
            <div className="flex space-x-3">
               <button type="button" onClick={onCancel} className="px-8 py-4 bg-slate-800 text-slate-400 font-bold rounded-xl uppercase text-xs">Discard</button>
               <button type="submit" className="px-8 py-4 bg-blue-600 text-white font-bold rounded-xl uppercase text-xs shadow-lg shadow-blue-500/20">Confirm Receipt</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReceiptVoucherForm;