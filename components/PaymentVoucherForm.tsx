import React, { useState, useMemo, useEffect } from 'react';
import { VoucherType, Currency, AccountType, Voucher, VoucherStatus, Account } from '../types';
import { getAccounts, getConfig } from '../services/db';

interface PaymentVoucherFormProps {
  initialData?: Partial<Voucher>;
  onSave: (data: any) => void;
  onCancel: () => void;
  isClone?: boolean;
}

const PaymentVoucherForm: React.FC<PaymentVoucherFormProps> = ({ initialData, onSave, onCancel, isClone }) => {
  const accounts = useMemo(() => getAccounts(), []);
  const config = useMemo(() => getConfig(), []);
  
  // Accounts for selection
  const expenseAccounts = useMemo(() => accounts.filter(a => a.type === AccountType.EXPENSE), [accounts]);
  const vendorAccounts = useMemo(() => accounts.filter(a => a.type === AccountType.VENDOR), [accounts]);
  const cashBankAccounts = useMemo(() => config.banks, [config]);

  const [formData, setFormData] = useState({
    date: initialData?.date?.split('T')[0] || new Date().toISOString().split('T')[0],
    currency: initialData?.currency || Currency.PKR,
    roe: initialData?.roe || config.defaultROE,
    amount: initialData?.details?.unitRate || 0,
    expenseId: initialData?.details?.expenseId || '',
    bankId: initialData?.details?.bankId || cashBankAccounts[0]?.id || '',
    description: initialData?.description || '',
    reference: isClone ? '' : (initialData?.reference || '')
  });

  const totalPKR = useMemo(() => {
    const rate = formData.currency === Currency.SAR ? formData.roe : 1;
    return formData.amount * rate;
  }, [formData.amount, formData.roe, formData.currency]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.amount <= 0) return alert("Amount must be greater than 0");
    if (!formData.expenseId) return alert("Please select a Debit Account (Expense or Vendor)");
    if (formData.currency === Currency.SAR && formData.roe <= 0) return alert("Invalid ROE");

    onSave({
      ...formData,
      type: VoucherType.PAYMENT,
      totalAmountPKR: totalPKR,
      status: VoucherStatus.POSTED,
      details: {
        expenseId: formData.expenseId,
        bankId: formData.bankId,
        unitRate: formData.amount
      }
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl p-8 md:p-12 border border-slate-100 dark:border-white/5 animate-in zoom-in-95 duration-300">
      <div className="flex justify-between items-start mb-10">
        <div>
          <span className="px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[10px] font-bold uppercase tracking-widest">
            Financial Disbursal Authorisation
          </span>
          <h3 className="text-3xl font-orbitron font-bold text-slate-900 dark:text-white mt-2">
            {isClone ? 'Clone' : (initialData ? 'Edit' : 'Create')} Payment Voucher
          </h3>
          <p className="text-slate-400 text-sm">Settlement of Payables or Operating Expenses</p>
        </div>
        <button onClick={onCancel} className="text-2xl hover:rotate-90 transition-transform">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Voucher Date</label>
            <input 
              type="date"
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold text-sm shadow-inner"
              value={formData.date}
              onChange={e => setFormData({...formData, date: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Currency Mode</label>
            <select 
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold text-sm appearance-none cursor-pointer shadow-inner"
              value={formData.currency}
              onChange={e => setFormData({...formData, currency: e.target.value as Currency})}
            >
              <option value={Currency.PKR}>PKR (Domestic)</option>
              <option value={Currency.SAR}>SAR (International)</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em] ml-1">Amount ({formData.currency})</label>
            <input 
              type="number"
              step="0.01"
              required
              className="w-full bg-blue-50/50 dark:bg-blue-900/20 border-2 border-transparent focus:border-blue-500 rounded-2xl p-4 font-orbitron font-bold text-xl text-blue-600 outline-none transition-all"
              placeholder="0.00"
              value={formData.amount}
              onChange={e => setFormData({...formData, amount: Number(e.target.value)})}
            />
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
              <p className="text-[10px] font-bold uppercase opacity-80">Final PKR Disbursal</p>
              <p className="text-3xl font-orbitron font-bold">{totalPKR.toLocaleString()}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Debit Account (Expense or Vendor)</label>
              <select 
                required
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold text-sm appearance-none cursor-pointer shadow-inner"
                value={formData.expenseId}
                onChange={e => setFormData({...formData, expenseId: e.target.value})}
              >
                <option value="">Select Account...</option>
                <optgroup label="Operating Expenses">
                  {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </optgroup>
                <optgroup label="Vendor Settlements">
                  {vendorAccounts.map(a => <option key={a.id} value={a.id}>{a.name} (Bal: {a.balance.toLocaleString()})</option>)}
                </optgroup>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Source of Funds (Credit)</label>
              <select 
                required
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold text-sm appearance-none cursor-pointer shadow-inner"
                value={formData.bankId}
                onChange={e => setFormData({...formData, bankId: e.target.value})}
              >
                {cashBankAccounts.map(b => (
                  <option key={b.id} value={b.id}>{b.name} - {b.accountNumber}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Reference / Bill #</label>
              <input 
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-medium text-sm shadow-inner"
                placeholder="Bill # or Transfer ID"
                value={formData.reference}
                onChange={e => setFormData({...formData, reference: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Transaction Narrative</label>
              <textarea 
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-medium text-sm shadow-inner h-[110px]"
                placeholder="Explanation of payment..."
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-4 pt-6 border-t dark:border-slate-800">
          <button 
            type="button" 
            onClick={onCancel}
            className="flex-1 px-8 py-5 bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold rounded-3xl hover:bg-slate-200 transition-all uppercase text-xs tracking-[0.2em]"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="flex-[2] px-8 py-5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold rounded-3xl shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all uppercase text-xs tracking-[0.2em] border border-white/10"
          >
            Post Disbursal
          </button>
        </div>
      </form>
    </div>
  );
};

export default PaymentVoucherForm;
