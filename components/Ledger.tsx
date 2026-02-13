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

  const [formData, setFormData] = useState<any>({ 
    name: '', cell: '', location: '', code: '', openingBalance: 0, 
    balanceType: type === AccountType.CUSTOMER ? 'dr' : 'cr' 
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

  const aggregateTotals = useMemo(() => {
    const net = accountList.reduce((sum, acc) => sum + acc.balance, 0);
    const count = accountList.length;
    return { net, count };
  }, [accountList]);

  const handleDownloadPDF = () => {
    if (!selectedAccount) return;
    const originalTitle = document.title;
    const cleanName = selectedAccount.name.replace(/[/\\?%*:|"<>]/g, '-').trim();
    document.title = `Statement_${cleanName}_${selectedAccount.code || ''}`;
    window.print();
    setTimeout(() => { document.title = originalTitle; }, 500);
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

  const totalDebits = useMemo(() => selectedAccount?.ledger.reduce((sum, e) => sum + e.debit, 0) || 0, [selectedAccount]);
  const totalCredits = useMemo(() => selectedAccount?.ledger.reduce((sum, e) => sum + e.credit, 0) || 0, [selectedAccount]);
  const totalTransactions = useMemo(() => selectedAccount?.ledger.filter(e => e.voucherId !== null).length || 0, [selectedAccount]);

  const typeLabel = type === AccountType.CUSTOMER ? 'Customer' : 'Vendor';

  const handleEditClick = (acc: Account) => {
    const openingEntry = acc.ledger.find(e => e.description === 'Opening Balance (Initial Measurement)');
    setAccountToEdit(acc);
    setFormMode('EDIT');
    setFormData({
      name: acc.name,
      cell: acc.cell || '',
      location: acc.location || '',
      code: acc.code || '',
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
        await AccountingService.createAccount(formData.name, type, formData.cell, formData.location, formData.openingBalance, formData.balanceType === 'dr', formData.code);
      }
      setShowAddModal(false);
      await refreshAccountList();
    } catch (err: any) {
      alert(`Error: ${err.message || "Unique Code constraint violation."}`);
    } finally { setIsSubmitting(false); }
  };

  if (!config) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      {!selectedAccount ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print mb-8">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between overflow-hidden relative group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/5 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Aggregate Ledger Position</p>
                <h4 className="text-xl font-bold text-slate-800 dark:text-white uppercase">{typeLabel} Overview</h4>
              </div>
              <div className="mt-6">
                <p className={`text-4xl font-black font-orbitron tracking-tighter ${aggregateTotals.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {Math.abs(aggregateTotals.net).toLocaleString()}
                  <span className="text-sm font-sans tracking-widest ml-2 uppercase opacity-60">{aggregateTotals.net >= 0 ? 'Dr' : 'Cr'}</span>
                </p>
              </div>
            </div>
            <div className="bg-slate-900 dark:bg-blue-600/10 p-8 rounded-[2rem] shadow-xl flex flex-col justify-center border border-white/5 relative overflow-hidden group">
               <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Active Heads</p>
              <p className="text-5xl font-black font-orbitron text-white">{aggregateTotals.count}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-center">
               <button 
                onClick={() => { 
                  setFormMode('CREATE'); 
                  setAccountToEdit(null); 
                  setFormData({ name: '', cell: '', location: '', code: generateNextCode(type), openingBalance: 0, balanceType: type === AccountType.CUSTOMER ? 'dr' : 'cr' });
                  setShowAddModal(true); 
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black shadow-xl shadow-blue-500/25 transition-all active:scale-95 text-xs uppercase tracking-widest"
              >
                + Register New {typeLabel}
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print mb-6">
            <div className="relative flex-1 max-w-lg">
              <input type="text" placeholder={`Search ${typeLabel}s by name, cell, code...`} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 pl-12 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all text-sm font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <span className="absolute left-4 top-4 text-xl opacity-40">🔍</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-xl no-print">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 text-[10px] uppercase tracking-[0.2em] font-black">
                  <tr>
                    <th className="px-8 py-6">Identity / GL Code</th>
                    <th className="px-8 py-6">Communication</th>
                    <th className="px-8 py-6">Origin</th>
                    <th className="px-8 py-6 text-right">Current Position</th>
                    <th className="px-8 py-6 text-center">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredAccounts.map((acc) => (
                    <tr key={acc.id} className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all cursor-pointer" onClick={() => setSelectedAccount(acc)}>
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-blue-600 font-black group-hover:bg-blue-600 group-hover:text-white transition-all text-[11px] font-mono">{acc.code || '?' }</div>
                          <div>
                            <p className="font-black text-slate-800 dark:text-white text-sm uppercase leading-none">{acc.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono tracking-widest mt-1">{acc.code || 'UNCODED'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-[12px] text-slate-500 dark:text-slate-400 font-bold">{acc.cell || 'N/A'}</td>
                      <td className="px-8 py-6"><span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-500">{acc.location || 'Local'}</span></td>
                      <td className="px-8 py-6 text-right">
                        <p className={`font-orbitron font-black text-lg leading-none ${acc.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{Math.abs(acc.balance).toLocaleString()}</p>
                        <p className="text-[9px] text-slate-400 uppercase font-black mt-1 tracking-widest">PKR {acc.balance >= 0 ? 'Dr' : 'Cr'}</p>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <div className="flex justify-center space-x-2">
                           <button onClick={(e) => { e.stopPropagation(); handleEditClick(acc); }} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-amber-500 hover:text-white transition-all text-sm">✏️</button>
                           <button onClick={(e) => { e.stopPropagation(); handleCloneClick(acc); }} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-emerald-600 hover:text-white transition-all text-sm">👯</button>
                           <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete account? All ledger entries will be lost.')) AccountingService.deleteAccount(acc.id).then(refreshAccountList); }} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-rose-600 hover:text-white transition-all text-sm">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredAccounts.length === 0 && (
                <div className="py-24 text-center text-slate-300 italic flex flex-col items-center">
                  <span className="text-6xl mb-4 opacity-20">📭</span>
                  <p className="font-orbitron font-bold uppercase tracking-widest text-sm">No profiles found</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col lg:flex-row justify-between items-center mb-8 gap-4 no-print bg-white dark:bg-slate-900 p-8 rounded-[3rem] border shadow-xl">
            <div className="flex items-center space-x-6">
              <button onClick={() => setSelectedAccount(null)} className="w-14 h-14 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all font-black text-2xl">←</button>
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white leading-none">{selectedAccount.name}</h2>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2">GL Code: {selectedAccount.code || 'N/A'}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => handleEditClick(selectedAccount)} className="px-8 py-4 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-amber-600 transition-all active:scale-95">✏️ Update</button>
              <button onClick={() => handleCloneClick(selectedAccount)} className="px-8 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all active:scale-95">👯 Clone</button>
              <button onClick={handleDownloadExcel} className="px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">📁 Excel</button>
              <button onClick={handleDownloadPDF} className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-all">📥 Print</button>
            </div>
          </div>

          <div className="bg-white p-14 text-black font-inter voucher-page shadow-2xl rounded-[3rem] border border-slate-100">
            <div className="flex justify-between items-start mb-12">
               <div>
                  <h1 className="text-4xl font-black tracking-tighter uppercase leading-none">{config.companyName}</h1>
                  <p className="text-[11px] font-black text-rose-600 uppercase tracking-[0.4em] mt-2">{config.appSubtitle}</p>
                  <div className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed max-w-xs space-y-1 mt-6">
                    <p>{config.companyAddress}</p>
                    <p>CELL: {config.companyCell}</p>
                  </div>
               </div>
               <div className="text-right border-2 border-slate-900 p-6 rounded-2xl shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-slate-400">Statement Date</p>
                  <p className="text-xl font-bold font-mono uppercase">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-12 pb-10 border-b border-slate-100">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Subsidiary Ledger Head</p>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{selectedAccount.name}</h2>
                <p className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-wider">{selectedAccount.location || 'Local'}</p>
              </div>
              <div className="text-right flex flex-col items-end">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">GL Account Code</p>
                <p className="text-2xl font-mono font-black text-blue-600 border-b-4 border-blue-600 leading-none pb-1">{selectedAccount.code || 'N/A'}</p>
              </div>
            </div>

            <table className="w-full text-left border-collapse rounded-2xl overflow-hidden border border-slate-100">
                <thead className="bg-slate-900 text-white text-[10px] uppercase font-black tracking-widest">
                  <tr>
                    <th className="px-6 py-5 border-r border-slate-800">Date</th>
                    <th className="px-6 py-5 border-r border-slate-800">Voucher #</th>
                    <th className="px-6 py-5 border-r border-slate-800">Description</th>
                    <th className="px-6 py-5 border-r border-slate-800 text-right">Debit (PKR)</th>
                    <th className="px-6 py-5 border-r border-slate-800 text-right">Credit (PKR)</th>
                    <th className="px-6 py-5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] font-medium text-slate-700">
                  {selectedAccount.ledger.map((entry, i) => (
                    <tr key={i} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-400">{new Date(entry.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <button onClick={() => handleVoucherClick(entry.voucherNum)} className="font-black text-blue-600 uppercase no-print hover:underline">{entry.voucherNum}</button>
                        <span className="print-only font-black">{entry.voucherNum}</span>
                      </td>
                      <td className="px-6 py-4 italic leading-relaxed">{entry.description}</td>
                      <td className="px-6 py-4 text-right text-emerald-600 font-black text-xs">{entry.debit > 0 ? entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                      <td className="px-6 py-4 text-right text-rose-500 font-black text-xs">{entry.credit > 0 ? entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</td>
                      <td className="px-6 py-4 text-right font-black text-slate-900 text-xs">
                        {Math.abs(entry.balanceAfter).toLocaleString(undefined, { minimumFractionDigits: 2 })} 
                        <span className="text-[9px] opacity-40 uppercase ml-1">{entry.balanceAfter >= 0 ? 'Dr' : 'Cr'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
            </table>

            <div className="mt-12 flex flex-col md:flex-row justify-between items-center gap-8">
               <div className="flex-1 w-full space-y-3 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 mb-2">Statement Summary</h3>
                  <div className="grid grid-cols-2 gap-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Audit Records:</p><p className="text-xs font-black text-slate-900">{totalTransactions}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Total Debits:</p><p className="text-xs font-black text-emerald-600">PKR {totalDebits.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Total Credits:</p><p className="text-xs font-black text-rose-600">PKR {totalCredits.toLocaleString()}</p>
                  </div>
               </div>
               <div className="bg-slate-900 rounded-[2rem] p-10 min-w-[320px] text-center md:text-right text-white shadow-2xl border border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-50 mb-3">Net Ledger Position</p>
                  <p className={`text-5xl font-black font-orbitron tracking-tighter ${selectedAccount.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {Math.abs(selectedAccount.balance).toLocaleString()} 
                  </p>
                  <p className="text-[10px] font-black tracking-widest mt-2 uppercase opacity-40">PKR {selectedAccount.balance >= 0 ? 'Debit balance (REC)' : 'Credit balance (PAY)'}</p>
               </div>
            </div>

            <div className="mt-24 flex justify-between items-end border-t border-slate-100 pt-10 no-print-visible">
               <div className="text-center w-56"><div className="border-b-2 border-slate-900 mb-3"></div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Accountant</p></div>
               <div className="text-center w-56"><div className="border-b-2 border-slate-900 mb-3"></div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Manager Signature</p></div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl p-10 border border-white/10 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-3xl font-black font-orbitron text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-400 uppercase tracking-tighter leading-none">{formMode === 'EDIT' ? 'Update' : 'Register'} Profile</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Enterprise Ledger Registration</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-2xl hover:rotate-90 transition-transform">✕</button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">GL Code</label>
                  <input className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 font-mono font-bold text-blue-600 border-none shadow-inner focus:ring-2 focus:ring-blue-500 transition-all outline-none" placeholder="E.g. 1105" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Full Legal Name</label>
                  <input required className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 font-bold border-none shadow-inner focus:ring-2 focus:ring-blue-500 transition-all outline-none" placeholder="Legal Identity" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Communication</label>
                  <input className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 text-sm shadow-inner outline-none" placeholder="Contact #" value={formData.cell} onChange={e => setFormData({...formData, cell: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Location</label>
                  <input className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 text-sm shadow-inner outline-none" placeholder="City / Origin" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
                </div>
              </div>
              <div className="bg-blue-50/50 dark:bg-blue-900/10 p-6 rounded-[2rem] space-y-4 border border-blue-100 dark:border-blue-900/30">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest block">Opening Balance (IFRS Initial Measurement)</label>
                <div className="flex items-center space-x-4">
                  <input type="number" step="0.01" className="flex-1 bg-white dark:bg-slate-800 rounded-xl p-4 font-bold text-lg shadow-sm" placeholder="0.00" value={formData.openingBalance} onChange={e => setFormData({...formData, openingBalance: Number(e.target.value)})} />
                  <div className="flex bg-slate-200 dark:bg-slate-700 p-1.5 rounded-xl shadow-inner">
                    <button type="button" onClick={() => setFormData({...formData, balanceType: 'dr'})} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${formData.balanceType === 'dr' ? 'bg-white dark:bg-slate-600 text-blue-600 shadow-sm' : 'text-slate-500'}`}>DR (Rec)</button>
                    <button type="button" onClick={() => setFormData({...formData, balanceType: 'cr'})} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${formData.balanceType === 'cr' ? 'bg-white dark:bg-slate-600 text-rose-500 shadow-sm' : 'text-slate-500'}`}>CR (Pay)</button>
                  </div>
                </div>
              </div>
              <div className="flex space-x-4 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 p-5 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">Discard</button>
                <button type="submit" disabled={isSubmitting} className="flex-[2] p-5 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-600/20 uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-95">
                  {isSubmitting ? 'Processing...' : 'Post Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ledger;