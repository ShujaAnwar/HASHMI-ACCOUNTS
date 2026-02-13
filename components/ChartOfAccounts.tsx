
import React, { useState, useMemo, useEffect } from 'react';
import { Account, AccountType } from '../types';
import { getAccounts } from '../services/db';
import { AccountingService } from '../services/AccountingService';

const ChartOfAccounts: React.FC = () => {
  const [accountList, setAccountList] = useState<Account[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: AccountType.CASH_BANK,
    openingBalance: 0,
    isDr: true
  });

  useEffect(() => {
    setAccountList(getAccounts());
  }, [showAddModal]);

  const categories = useMemo(() => {
    return [
      { id: '1', label: 'Assets', prefix: '1', color: 'blue' },
      { id: '2', label: 'Liabilities', prefix: '2', color: 'rose' },
      { id: '3', label: 'Equity', prefix: '3', color: 'indigo' },
      { id: '4', label: 'Income', prefix: '4', color: 'emerald' },
      { id: '5', label: 'Expenses', prefix: '5', color: 'amber' }
    ];
  }, []);

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    AccountingService.createAccount(
      formData.name,
      formData.type,
      '', '', // cell, location empty for COA structural accounts
      formData.openingBalance,
      formData.isDr,
      formData.code
    );
    setShowAddModal(false);
    setFormData({ code: '', name: '', type: AccountType.CASH_BANK, openingBalance: 0, isDr: true });
  };

  const getAccountsByCategory = (prefix: string) => {
    return accountList
      .filter(a => a.code?.startsWith(prefix))
      .sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="text-xl font-bold text-slate-500 uppercase tracking-widest">Enterprise Ledger Structure</h3>
          <p className="text-sm text-slate-400 mt-1">Hierarchical GL classification for IFRS Compliance</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3 rounded-2xl font-bold shadow-xl flex items-center space-x-2 transition-transform active:scale-95"
        >
          <span>➕</span>
          <span className="uppercase text-xs tracking-widest">Add Ledger Head</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {categories.map(cat => (
          <div key={cat.id} className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-lg overflow-hidden">
            <div className={`bg-${cat.color}-500/10 p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center`}>
              <div className="flex items-center space-x-3">
                <span className={`w-3 h-3 rounded-full bg-${cat.color}-500 shadow-lg shadow-${cat.color}-500/40`}></span>
                <h4 className={`text-lg font-orbitron font-bold text-${cat.color}-600 dark:text-${cat.color}-400 uppercase tracking-tight`}>
                  {cat.label} ({cat.prefix}000 Series)
                </h4>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type Category</span>
            </div>
            
            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {getAccountsByCategory(cat.prefix).map(acc => (
                <div key={acc.id} className="p-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all flex justify-between items-center">
                  <div className="flex items-center space-x-6">
                    <span className="text-xs font-mono font-bold text-slate-400 w-12">{acc.code}</span>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{acc.name}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-medium tracking-wider">{acc.type.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-orbitron font-bold ${acc.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {Math.abs(acc.balance).toLocaleString()} 
                      <span className="text-[10px] ml-1 opacity-50 font-sans">{acc.balance >= 0 ? 'DR' : 'CR'}</span>
                    </p>
                  </div>
                </div>
              ))}
              {getAccountsByCategory(cat.prefix).length === 0 && (
                <div className="p-10 text-center text-slate-300 italic text-sm">No accounts mapped to this heading.</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl p-10 border border-white/10 animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-orbitron font-bold text-slate-900 dark:text-white mb-8 uppercase tracking-tighter">Register New GL Head</h3>
            <form onSubmit={handleAddAccount} className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 mb-2 block">Account Code</label>
                  <input 
                    required autoFocus
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 font-mono font-bold text-blue-600"
                    placeholder="e.g. 1020"
                    value={formData.code}
                    onChange={e => setFormData({...formData, code: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 mb-2 block">Account Title</label>
                  <input 
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 font-bold"
                    placeholder="e.g. Prepaid Rent"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 mb-2 block">Classification Type</label>
                <select 
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 font-bold appearance-none cursor-pointer"
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value as AccountType})}
                >
                  {Object.values(AccountType).map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              </div>

              <div className="bg-blue-50/50 dark:bg-blue-900/10 p-6 rounded-3xl space-y-4">
                <label className="text-[10px] font-bold text-blue-600 uppercase tracking-widest px-1 block">Opening Measurement (PKR)</label>
                <div className="flex items-center space-x-4">
                  <input 
                    type="number"
                    className="flex-1 bg-white dark:bg-slate-800 border-none rounded-xl p-4 font-bold text-lg"
                    value={formData.openingBalance}
                    onChange={e => setFormData({...formData, openingBalance: Number(e.target.value)})}
                  />
                  <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-xl">
                    <button 
                      type="button" 
                      onClick={() => setFormData({...formData, isDr: true})}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${formData.isDr ? 'bg-white dark:bg-slate-600 text-blue-600 shadow-sm' : 'text-slate-500'}`}
                    >
                      DR
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setFormData({...formData, isDr: false})}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${!formData.isDr ? 'bg-white dark:bg-slate-600 text-rose-500 shadow-sm' : 'text-slate-500'}`}
                    >
                      CR
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 font-bold rounded-2xl text-xs uppercase tracking-widest">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl text-xs uppercase tracking-widest">Register Head</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartOfAccounts;
