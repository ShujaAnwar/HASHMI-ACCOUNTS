import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Account, AccountType, Voucher, Currency, AppConfig } from '../types';
import { AccountingService } from '../services/AccountingService';
import { getAccounts, getVouchers, getConfig } from '../services/db';

interface LedgerProps {
  type: AccountType;
  onEditVoucher: (v: Voucher) => void;
  onViewVoucher?: (v: Voucher) => void;
}

const Ledger: React.FC<LedgerProps> = ({ type, onEditVoucher, onViewVoucher }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formMode, setFormMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);
  const [accountList, setAccountList] = useState<Account[]>([]);
  const [allAccountsForCode, setAllAccountsForCode] = useState<Account[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewCurrency, setViewCurrency] = useState<Currency>(Currency.PKR);

  const [formData, setFormData] = useState<any>({ 
    name: '', cell: '', location: '', code: '', openingBalance: 0, 
    balanceType: type === AccountType.CUSTOMER ? 'dr' : 'cr',
    currency: Currency.PKR
  });

  const refreshAccountList = useCallback(async () => {
    const data = await getAccounts();
    setAllAccountsForCode(data);
    const filtered = data.filter(a => a.type === type);
    setAccountList(filtered);
    
    setSelectedAccount(prev => {
      if (!prev) return null;
      return data.find(a => a.id === prev.id) || null;
    });
  }, [type]);

  useEffect(() => {
    getConfig().then(setConfig);
    getVouchers().then(setVouchers);
  }, []);

  useEffect(() => {
    setSelectedAccount(null);
    setSearchTerm('');
    refreshAccountList();
  }, [type, refreshAccountList]);

  const generateNextCode = useCallback((targetType: AccountType) => {
    const prefix = targetType === AccountType.CUSTOMER ? '11' : '21';
    const startingCode = targetType === AccountType.CUSTOMER ? 1101 : 2101;
    
    const existingCodes = allAccountsForCode
      .filter(a => a.type === targetType && a.code && a.code.startsWith(prefix))
      .map(a => parseInt(a.code || '0', 10))
      .filter(num => !isNaN(num));

    if (existingCodes.length === 0) return startingCode.toString();
    
    const maxCode = Math.max(...existingCodes);
    return (maxCode + 1).toString();
  }, [allAccountsForCode]);

  const filteredAccounts = useMemo(() => {
    if (!searchTerm) return accountList;
    const lowSearch = searchTerm.toLowerCase();
    return accountList.filter(a => 
      a.name.toLowerCase().includes(lowSearch) || 
      a.location?.toLowerCase().includes(lowSearch) || 
      a.cell?.includes(searchTerm) ||
      a.code?.includes(searchTerm)
    );
  }, [accountList, searchTerm]);

  const handleDownloadPDF = () => {
    if (!selectedAccount) return;
    window.print();
  };

  const handleDownloadExcel = () => {
    if (!selectedAccount) return;
    let csv = "Date,Voucher #,Description,Debit,Credit,Balance\n";
    selectedAccount.ledger.forEach(entry => {
      csv += `${new Date(entry.date).toLocaleDateString()},${entry.voucherNum || '-'},${entry.description.replace(/,/g, ' ')},${entry.debit},${entry.credit},${entry.balanceAfter}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Statement_${selectedAccount.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleVoucherClick = (vNum: string) => {
    const voucher = vouchers.find(v => v.voucherNum === vNum);
    if (voucher) onEditVoucher(voucher);
  };

  const getConvertedVal = (val: number, roe: number = 74.5) => {
    if (viewCurrency === Currency.PKR) return val;
    return val / roe;
  };

  const currentROE = config?.defaultROE || 74.5;

  const totalDebitsPKR = useMemo(() => selectedAccount?.ledger.reduce((sum, e) => sum + e.debit, 0) || 0, [selectedAccount]);
  const totalCreditsPKR = useMemo(() => selectedAccount?.ledger.reduce((sum, e) => sum + e.credit, 0) || 0, [selectedAccount]);
  const totalTransactions = useMemo(() => selectedAccount?.ledger.filter(e => e.voucherId !== null).length || 0, [selectedAccount]);

  const handleEditClick = (acc: Account) => {
    const openingEntry = acc.ledger.find(e => e.description === 'Opening Balance (Initial Measurement)');
    setAccountToEdit(acc);
    setFormMode('EDIT');
    setFormData({
      name: acc.name,
      cell: acc.cell || '',
      location: acc.location || '',
      code: acc.code || '',
      currency: acc.currency || Currency.PKR,
      openingBalance: openingEntry ? (openingEntry.debit || openingEntry.credit) : 0,
      balanceType: (openingEntry && openingEntry.credit > 0) ? 'cr' : 'dr'
    });
    setShowAddModal(true);
  };

  const handleCloneClick = (acc: Account) => {
    const openingEntry = acc.ledger.find(e => e.description === 'Opening Balance (Initial Measurement)');
    setAccountToEdit(null);
    setFormMode('CREATE');
    setFormData({
      name: `${acc.name} (Clone)`,
      cell: acc.cell || '',
      location: acc.location || '',
      code: generateNextCode(type),
      currency: acc.currency || Currency.PKR,
      openingBalance: openingEntry ? (openingEntry.debit || openingEntry.credit) : 0,
      balanceType: (openingEntry && openingEntry.credit > 0) ? 'cr' : 'dr'
    });
    setShowAddModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (formMode === 'EDIT' && accountToEdit) {
        await AccountingService.updateAccount(accountToEdit.id, { ...formData, oldName: accountToEdit.name });
      } else {
        await AccountingService.createAccount(formData.name, type, formData.cell, formData.location, formData.openingBalance, formData.balanceType === 'dr', formData.code, formData.currency);
      }
      setShowAddModal(false);
      await refreshAccountList();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally { setIsSubmitting(false); }
  };

  if (!config) return null;

  return (
    <div className="space-y-6">
      {!selectedAccount ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print mb-8">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between overflow-hidden relative group">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Aggregate Position</p>
                <h4 className="text-xl font-bold text-slate-800 dark:text-white uppercase">{type === AccountType.CUSTOMER ? 'Customer' : 'Vendor'} Overview Head</h4>
              </div>
              <div className="mt-6">
                <p className={`text-4xl font-black font-orbitron tracking-tighter ${accountList.reduce((s,a) => s+a.balance,0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {Math.abs(accountList.reduce((s,a) => s+a.balance,0)).toLocaleString()}
                  <span className="text-sm font-sans tracking-widest ml-2 uppercase opacity-60">PKR</span>
                </p>
              </div>
            </div>
            <div className="bg-slate-900 dark:bg-blue-600/10 p-8 rounded-[2rem] shadow-xl flex flex-col justify-center border border-white/5">
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Profiles</p>
              <p className="text-5xl font-black font-orbitron text-white">{accountList.length}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-center">
               <button 
                onClick={() => { 
                  setFormMode('CREATE'); 
                  setAccountToEdit(null); 
                  setFormData({ name: '', cell: '', location: '', code: generateNextCode(type), openingBalance: 0, balanceType: type === AccountType.CUSTOMER ? 'dr' : 'cr', currency: Currency.PKR });
                  setShowAddModal(true); 
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black shadow-xl shadow-blue-500/25 transition-all text-xs uppercase tracking-widest"
              >
                + Create New Head
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print mb-6">
            <div className="relative flex-1 max-w-lg">
              <input type="text" placeholder="Filter profiles..." className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 pl-12 outline-none shadow-sm text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <span className="absolute left-4 top-4 text-xl opacity-40">🔍</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-xl no-print">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 text-[10px] uppercase tracking-widest font-black">
                <tr>
                  <th className="px-8 py-6">ID / Code</th>
                  <th className="px-8 py-6">Communication</th>
                  <th className="px-8 py-6">Currency</th>
                  <th className="px-8 py-6 text-right">Balance (PKR)</th>
                  <th className="px-8 py-6 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAccounts.map((acc) => (
                  <tr key={acc.id} className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all cursor-pointer" onClick={() => setSelectedAccount(acc)}>
                    <td className="px-8 py-6">
                      <div>
                        <p className="font-black text-slate-800 dark:text-white text-sm uppercase leading-none">{acc.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">{acc.code || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-[12px] text-slate-500 dark:text-slate-400 font-bold">{acc.cell || '-'}</td>
                    <td className="px-8 py-6"><span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase text-slate-500">{acc.currency || 'PKR'}</span></td>
                    <td className="px-8 py-6 text-right">
                      <p className={`font-orbitron font-black text-lg ${acc.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{Math.abs(acc.balance).toLocaleString()}</p>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex justify-center space-x-2">
                         <button onClick={(e) => { e.stopPropagation(); handleEditClick(acc); }} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-amber-500 hover:text-white">✏️</button>
                         <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete head?')) AccountingService.deleteAccount(acc.id).then(refreshAccountList); }} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-rose-600 hover:text-white">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col lg:flex-row justify-between items-center mb-8 gap-4 no-print bg-white dark:bg-slate-900 p-8 rounded-[3rem] border shadow-xl">
            <div className="flex items-center space-x-6">
              <button onClick={() => setSelectedAccount(null)} className="w-14 h-14 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 font-black text-2xl hover:text-blue-600">←</button>
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white leading-none">{selectedAccount.name}</h2>
                <div className="flex items-center space-x-4 mt-3">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">GL Code: {selectedAccount.code || 'N/A'}</p>
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shadow-inner">
                    <button onClick={() => setViewCurrency(Currency.PKR)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewCurrency === Currency.PKR ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-md' : 'text-slate-500'}`}>PKR View</button>
                    <button onClick={() => setViewCurrency(Currency.SAR)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewCurrency === Currency.SAR ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-md' : 'text-slate-500'}`}>SAR View</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={handleDownloadExcel} className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-xl text-[10px] font-black uppercase shadow-lg">Excel</button>
              <button onClick={handleDownloadPDF} className="px-10 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-all">Print PDF</button>
            </div>
          </div>

          {/* PRINT FORMAT MATCHING IMAGE */}
          <div className="bg-white p-14 text-black font-inter voucher-page shadow-2xl rounded-[1rem] border border-slate-100 min-h-[11in]">
            {/* TRAVELLDGER HEADER */}
            <div className="mb-12 border-b-2 border-slate-50 pb-8">
               <h1 className="text-5xl font-bold tracking-tighter uppercase leading-none text-slate-800">TRAVELLDGER</h1>
               <p className="text-[14px] text-slate-500 mt-2 font-medium">{config.companyAddress}</p>
               <p className="text-[14px] text-slate-500 font-medium">Contact: {config.companyCell} | Email: {config.companyEmail}</p>
            </div>

            <div className="mb-10">
               <h2 className="text-3xl font-bold uppercase text-slate-800 tracking-tight">{type === AccountType.VENDOR ? 'VENDOR' : 'CUSTOMER'} LEDGER STATEMENT</h2>
               <p className="text-[18px] font-bold text-slate-700 mt-3">Party: {selectedAccount.name} ({selectedAccount.code || 'N/A'})</p>
               <p className="text-[13px] text-slate-400 font-medium mt-1">Generated on: {new Date().toLocaleString()}</p>
            </div>

            <table className="w-full text-left border-collapse overflow-hidden border border-slate-200">
                <thead className="bg-[#0f172a] text-white text-[11px] uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3 border-r border-slate-700">Date</th>
                    <th className="px-4 py-3 border-r border-slate-700">Ref #</th>
                    <th className="px-4 py-3 border-r border-slate-700">Type</th>
                    <th className="px-4 py-3 border-r border-slate-700">Narration</th>
                    <th className="px-4 py-3 border-r border-slate-700">ROE</th>
                    <th className="px-4 py-3 border-r border-slate-700 text-right">Debit</th>
                    <th className="px-4 py-3 border-r border-slate-700 text-right">Credit</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="text-[12px] font-medium text-slate-700">
                  {selectedAccount.ledger.map((entry, i) => (
                    <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">{new Date(entry.date).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleVoucherClick(entry.voucherNum)} className="text-blue-600 font-bold hover:underline no-print">{entry.voucherNum || '-'}</button>
                        <span className="print-only">{entry.voucherNum || '-'}</span>
                      </td>
                      <td className="px-4 py-3">{entry.description.includes('Opening') ? 'Opening Balance' : (vouchers.find(v => v.voucherNum === entry.voucherNum)?.type || '-')}</td>
                      <td className="px-4 py-3 text-slate-500 italic">{entry.description}</td>
                      <td className="px-4 py-3 text-slate-400">{vouchers.find(v => v.voucherNum === entry.voucherNum)?.roe || '-'}</td>
                      <td className="px-4 py-3 text-right">{entry.debit > 0 ? getConvertedVal(entry.debit, currentROE).toLocaleString(undefined, { minimumFractionDigits: 0 }) : '-'}</td>
                      <td className="px-4 py-3 text-right">{entry.credit > 0 ? getConvertedVal(entry.credit, currentROE).toLocaleString(undefined, { minimumFractionDigits: 0 }) : '-'}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {Math.abs(getConvertedVal(entry.balanceAfter, currentROE)).toLocaleString(undefined, { minimumFractionDigits: 0 })} 
                        <span className="ml-1 text-[10px] opacity-40 uppercase">{entry.balanceAfter >= 0 ? 'Dr' : 'Cr'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
            </table>

            <div className="mt-12 bg-[#f8fafc] p-10 rounded-2xl border border-slate-100 relative min-h-[160px]">
               <h3 className="text-[18px] font-bold text-slate-800 uppercase tracking-tight mb-6">FINANCIAL SUMMARY</h3>
               <div className="space-y-2">
                 <p className="text-[14px] text-slate-500">Total Transactions: {totalTransactions}</p>
                 <p className="text-[14px] text-slate-500">Total Debits: Rs. {getConvertedVal(totalDebitsPKR, currentROE).toLocaleString(undefined, { minimumFractionDigits: 0 })}</p>
                 <p className="text-[14px] text-slate-500">Total Credits: Rs. {getConvertedVal(totalCreditsPKR, currentROE).toLocaleString(undefined, { minimumFractionDigits: 0 })}</p>
               </div>
               <div className="absolute right-10 bottom-10 text-right">
                  <p className="text-3xl font-bold text-slate-900">
                    Net Balance: Rs. {Math.abs(getConvertedVal(selectedAccount.balance, currentROE)).toLocaleString(undefined, { minimumFractionDigits: 0 })} 
                    <span className="ml-2 font-medium">{selectedAccount.balance >= 0 ? 'Dr' : 'Cr'}</span>
                  </p>
               </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl p-10 border border-white/10">
            <h3 className="text-3xl font-black font-orbitron text-blue-600 uppercase tracking-tighter mb-8">Register Head</h3>
            
            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Code</label>
                  <input className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 font-mono font-bold text-blue-600 outline-none" placeholder="1101" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Full Legal Name</label>
                  <input required className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 font-bold outline-none" placeholder="Title" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Contact No</label>
                  <input className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 text-sm font-bold outline-none" value={formData.cell} onChange={e => setFormData({...formData, cell: e.target.value})} />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Default Currency</label>
                  <select className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 text-sm font-bold outline-none cursor-pointer" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value as Currency})}>
                    <option value={Currency.PKR}>PKR (Domestic)</option>
                    <option value={Currency.SAR}>SAR (Saudi Riyal)</option>
                  </select>
                </div>
              </div>

              <div className="bg-blue-50/50 dark:bg-blue-900/10 p-6 rounded-3xl space-y-4">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest block">Opening Balance (PKR Equivalent)</label>
                <div className="flex items-center space-x-4">
                  <input type="number" step="0.01" className="flex-1 bg-white dark:bg-slate-800 rounded-xl p-4 font-bold text-lg" value={formData.openingBalance} onChange={e => setFormData({...formData, openingBalance: Number(e.target.value)})} />
                  <div className="flex bg-slate-200 dark:bg-slate-700 p-1.5 rounded-xl shadow-inner">
                    <button type="button" onClick={() => setFormData({...formData, balanceType: 'dr'})} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${formData.balanceType === 'dr' ? 'bg-white dark:bg-slate-600 text-blue-600 shadow-sm' : 'text-slate-500'}`}>DR</button>
                    <button type="button" onClick={() => setFormData({...formData, balanceType: 'cr'})} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${formData.balanceType === 'cr' ? 'bg-white dark:bg-slate-600 text-rose-500 shadow-sm' : 'text-slate-500'}`}>CR</button>
                  </div>
                </div>
              </div>
              <div className="flex space-x-4 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 p-5 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold uppercase text-[10px] tracking-widest">Discard</button>
                <button type="submit" disabled={isSubmitting} className="flex-[2] p-5 bg-blue-600 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest disabled:opacity-50">Post Registration</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ledger;