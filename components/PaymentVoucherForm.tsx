import React, { useState, useMemo, useEffect } from 'react';
import { VoucherType, Currency, AccountType, Voucher, VoucherStatus, Account, AppConfig } from '../types';
import { getAccounts, getConfig } from '../services/db';

interface PaymentVoucherFormProps {
  initialData?: Partial<Voucher>;
  onSave: (data: any) => void;
  onCancel: () => void;
  isClone?: boolean;
}

const InputLabel = ({ children }: { children?: React.ReactNode }) => (
  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block ml-1">{children}</label>
);

const PaymentVoucherForm: React.FC<PaymentVoucherFormProps> = ({ initialData, onSave, onCancel, isClone }) => {
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
    bankId: initialData?.details?.bankId || '',
    description: initialData?.description || '',
    reference: isClone ? '' : (initialData?.reference || ''),
    items: initialData?.details?.items || [{ accountId: '', description: '', amount: 0 }]
  });

  const expenseAccounts = useMemo(() => accounts.filter(a => a.type === AccountType.EXPENSE), [accounts]);
  const vendorAccounts = useMemo(() => accounts.filter(a => a.type === AccountType.VENDOR), [accounts]);
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

  const totalAmount = useMemo(() => formData.items.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0), [formData.items]);

  const totalPKR = useMemo(() => {
    const rate = formData.currency === Currency.SAR ? formData.roe : 1;
    return totalAmount * rate;
  }, [totalAmount, formData.roe, formData.currency]);

  const handleAddItem = () => {
    setFormData({ ...formData, items: [...formData.items, { accountId: '', description: '', amount: 0 }] });
  };

  const handleRemoveItem = (index: number) => {
    if (formData.items.length === 1) {
      setFormData({ ...formData, items: [{ accountId: '', description: '', amount: 0 }] });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalAmount <= 0) return alert("Total amount must be greater than 0");
    if (!formData.bankId) return alert("Select source (Cash/Bank) account");
    if (formData.items.some((it: any) => !it.accountId)) return alert("Select accounts for all items");

    onSave({
      ...formData,
      type: VoucherType.PAYMENT,
      totalAmountPKR: totalPKR,
      status: VoucherStatus.POSTED,
      details: {
        bankId: formData.bankId,
        items: formData.items,
        totalSelectedCurrency: totalAmount
      }
    });
  };

  if (loading || !config) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4 overflow-y-auto no-print">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl flex flex-col border border-slate-200 dark:border-white/5 animate-in zoom-in-95 duration-200 max-h-[95vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-8 py-6 border-b dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white shadow-lg">
              <span className="text-xl">💸</span>
            </div>
            <div>
              <h3 className="text-xl font-orbitron font-bold text-slate-900 dark:text-white uppercase tracking-tighter">
                {isClone ? 'Clone' : (initialData ? 'Edit' : 'Post')} Payment Voucher
              </h3>
              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.2em]">Petty Cash & Expense Disbursal Engine</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-rose-500 transition-colors">
            <span className="text-xl">✕</span>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6">
          
          {/* Controls Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border dark:border-slate-800">
            <div>
              <InputLabel>Disbursal Date</InputLabel>
              <input type="date" required className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-rose-500 outline-none transition-all" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
            </div>
            <div>
              <InputLabel>Currency</InputLabel>
              <select className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-rose-500 cursor-pointer outline-none transition-all" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value as Currency})}>
                <option value={Currency.PKR}>PKR (Domestic)</option>
                <option value={Currency.SAR}>SAR (Riyal)</option>
              </select>
            </div>
            <div>
              <InputLabel>ROE</InputLabel>
              <input type="number" step="0.01" disabled={formData.currency === Currency.PKR} className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-rose-600 focus:ring-2 focus:ring-rose-500 disabled:opacity-30 outline-none transition-all" value={formData.roe} onChange={e => setFormData({...formData, roe: Number(e.target.value)})} />
            </div>
            <div>
              <InputLabel>Fund Source (Credit)</InputLabel>
              <select required className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-rose-500 cursor-pointer outline-none transition-all" value={formData.bankId} onChange={e => setFormData({...formData, bankId: e.target.value})}>
                <option value="">Select Cash/Bank...</option>
                {cashBankAccounts.map(a => <option key={a.id} value={a.id}>{a.code ? `${a.code} - ` : ''}{a.name}</option>)}
              </select>
            </div>
          </div>

          {/* Itemized Expenses Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 flex justify-between items-center border-b dark:border-slate-800">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expense Line Items (Debits)</h4>
               <button type="button" onClick={handleAddItem} className="text-[10px] font-bold text-rose-600 hover:text-rose-500 uppercase tracking-widest">+ Add Expense Head</button>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white dark:bg-slate-900 border-b dark:border-slate-800">
                  <th className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase w-12">#</th>
                  <th className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase w-64">Expense Head</th>
                  <th className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase">Description / Narration</th>
                  <th className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase w-36 text-right">Amount</th>
                  <th className="px-6 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {formData.items.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all">
                    <td className="px-6 py-4 text-xs font-mono text-slate-300">{idx + 1}</td>
                    <td className="px-6 py-4">
                      <select 
                        required
                        className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
                        value={item.accountId}
                        onChange={e => updateItem(idx, 'accountId', e.target.value)}
                      >
                        <option value="">Select Account...</option>
                        <optgroup label="Operating Expenses">
                          {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code ? `${a.code} - ` : ''}{a.name}</option>)}
                        </optgroup>
                        <optgroup label="Vendor Settlements">
                          {vendorAccounts.map(a => <option key={a.id} value={a.id}>{a.code ? `${a.code} - ` : ''}{a.name}</option>)}
                        </optgroup>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <input 
                        className="w-full bg-transparent border-none focus:ring-0 text-xs font-medium text-slate-600 dark:text-slate-400"
                        placeholder="Purpose of expense..."
                        value={item.description}
                        onChange={e => updateItem(idx, 'description', e.target.value)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input type="number" step="0.01" className="w-full bg-transparent border-none focus:ring-0 text-right font-orbitron font-bold text-rose-600" value={item.amount} onChange={e => updateItem(idx, 'amount', Number(e.target.value))} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button type="button" onClick={() => handleRemoveItem(idx)} className="text-slate-300 hover:text-rose-500 p-2">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Narrative */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <InputLabel>General Voucher Remarks</InputLabel>
              <textarea className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-sm font-medium h-24 resize-none focus:ring-2 focus:ring-rose-500 outline-none" placeholder="Master narration for this disbursal..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>
            <div className="space-y-4">
               <div className="bg-slate-900 dark:bg-rose-950/40 p-6 rounded-3xl border border-white/5 shadow-xl text-center">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Combined Disbursal</p>
                  <p className="text-3xl font-orbitron font-bold text-rose-400 leading-none">PKR {totalPKR.toLocaleString()}</p>
                  <p className="text-[8px] font-bold text-white/40 mt-2 uppercase">Verified Transaction</p>
               </div>
            </div>
          </div>
        </form>

        {/* Action Bar */}
        <div className="px-8 py-6 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex justify-between items-center gap-4">
          <div className="text-left">
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Aggregate {formData.currency}</p>
            <p className="text-sm font-orbitron font-bold text-slate-700 dark:text-slate-300">{totalAmount.toLocaleString()} <span className="text-[10px]">{formData.currency}</span></p>
          </div>
          <div className="flex space-x-3">
            <button type="button" onClick={onCancel} className="px-6 py-3 bg-white dark:bg-slate-800 text-slate-500 font-bold rounded-xl uppercase text-[10px] tracking-widest border dark:border-slate-700">Discard</button>
            <button type="button" onClick={handleSubmit} className="px-12 py-3 bg-rose-600 text-white font-bold rounded-xl uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-rose-600/20 active:scale-95 transition-all font-orbitron">Post Disbursal</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentVoucherForm;
