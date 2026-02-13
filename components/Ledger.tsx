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
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<any>({ 
    name: '', cell: '', location: '', code: '', openingBalance: 0, 
    balanceType: type === AccountType.CUSTOMER ? 'dr' : 'cr' 
  });

  // Load app configuration and vouchers for reference
  useEffect(() => {
    getConfig().then(setConfig);
    getVouchers().then(setVouchers);
  }, []);

  const refreshAccountList = useCallback(async () => {
    const data = await getAccounts();
    const filtered = data.filter(a => a.type === type);
    setAccountList(filtered);
    
    // Also update selected account if we are currently viewing one
    if (selectedAccount) {
      const updatedSelected = data.find(a => a.id === selectedAccount.id);
      if (updatedSelected) {
        setSelectedAccount(updatedSelected);
      }
    }
  }, [type, selectedAccount]);

  useEffect(() => {
    setSelectedAccount(null);
    setSearchTerm('');
    refreshAccountList();
  }, [type]);

  useEffect(() => {
    if (!showAddModal) {
      refreshAccountList();
    }
  }, [showAddModal, refreshAccountList]);

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
    const originalTitle = document.title;
    const filename = `Statement_${selectedAccount?.name || 'Ledger'}_${new Date().toISOString().split('T')[0]}`;
    document.title = filename;
    setTimeout(() => {
      window.print();
      document.title = originalTitle;
    }, 150);
  };

  const handleDownloadExcel = () => {
    if (!selectedAccount) return;
    
    let csv = "Date,Voucher #,Description,Debit,Credit,Balance\n";
    selectedAccount.ledger.forEach(entry => {
      csv += `${new Date(entry.date).toLocaleDateString()},${entry.voucherNum || '-'},${entry.description.replace(/,/g, ' ')},${entry.debit},${entry.credit},${entry.balanceAfter}\n`;
    });
    
    csv += `\n,,TOTAL DEBITS,${totalDebits},,\n`;
    csv += `,,TOTAL CREDITS,${totalCredits},,\n`;
    csv += `,,NET BALANCE,${Math.abs(selectedAccount.balance)},${selectedAccount.balance >= 0 ? 'Dr' : 'Cr'},\n`;

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
    if (voucher) {
      // Direct Navigation to Edit Mode
      onEditVoucher(voucher);
    }
  };

  const totalDebits = useMemo(() => selectedAccount?.ledger.reduce((sum, e) => sum + e.debit, 0) || 0, [selectedAccount]);
  const totalCredits = useMemo(() => selectedAccount?.ledger.reduce((sum, e) => sum + e.credit, 0) || 0, [selectedAccount]);
  const totalTransactions = useMemo(() => selectedAccount?.ledger.filter(e => e.voucherId !== null).length || 0, [selectedAccount]);

  const typeLabel = type === AccountType.CUSTOMER ? 'Customer' : 'Vendor';

  const handleEditClick = (acc: Account) => {
    // Extract opening balance info from ledger history
    const openingEntry = acc.ledger.find(e => e.description === 'Opening Balance (Initial Measurement)');
    const initialAmount = openingEntry ? (openingEntry.debit || openingEntry.credit) : 0;
    const initialType = (openingEntry && openingEntry.credit > 0) ? 'cr' : 'dr';

    setAccountToEdit(acc);
    setFormMode('EDIT');
    setFormData({
      name: acc.name,
      cell: acc.cell || '',
      location: acc.location || '',
      code: acc.code || '',
      openingBalance: initialAmount,
      balanceType: initialType
    });
    setShowAddModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (formMode === 'EDIT' && accountToEdit) {
        await AccountingService.updateAccount(accountToEdit.id, {
          ...formData,
          oldName: accountToEdit.name 
        });
      } else {
        await AccountingService.createAccount(
          formData.name, 
          type, 
          formData.cell, 
          formData.location, 
          formData.openingBalance, 
          formData.balanceType === 'dr', 
          formData.code
        );
      }
      setShowAddModal(false);
      await refreshAccountList();
    } catch (err: any) {
      console.error(err);
      alert(`Account action failed: ${err.message || "Unknown error"}. Check if GL Code is unique.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!config) return null;

  return (
    <div className="space-y-6">
      {!selectedAccount ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
            <div className="relative flex-1 max-w-lg">
              <input 
                type="text" 
                placeholder={`Search ${typeLabel}s by name, cell or location...`} 
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 pl-12 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all text-sm font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="absolute left-4 top-4 text-xl opacity-40">🔍</span>
            </div>
            <button 
              onClick={() => { 
                setFormMode('CREATE'); 
                setAccountToEdit(null); 
                setFormData({ name: '', cell: '', location: '', code: '', openingBalance: 0, balanceType: type === AccountType.CUSTOMER ? 'dr' : 'cr' });
                setShowAddModal(true); 
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-blue-500/25 transition-all active:scale-95 text-sm uppercase tracking-wider"
            >
              + New {typeLabel} Account
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-xl no-print">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 text-xs uppercase tracking-widest font-bold">
                  <tr>
                    <th className="px-8 py-5">Name / Code</th>
                    <th className="px-8 py-5">Cell Number</th>
                    <th className="px-8 py-5">Location</th>
                    <th className="px-8 py-5 text-right">Balance</th>
                    <th className="px-8 py-5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredAccounts.map((acc) => (
                    <tr 
                      key={acc.id} 
                      className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all cursor-pointer"
                      onClick={() => setSelectedAccount(acc)}
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-blue-600 font-bold group-hover:bg-blue-600 group-hover:text-white transition-all text-[10px] uppercase font-mono">
                            {acc.code || acc.name.charAt(0)}
                          </div>
                          <div><p className="font-bold text-slate-800 dark:text-white">{acc.name}</p><p className="text-[10px] text-slate-400 font-mono tracking-widest">{acc.code || 'NO GL CODE'}</p></div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-sm text-slate-600 dark:text-slate-400 font-medium">{acc.cell || '-'}</td>
                      <td className="px-8 py-6"><span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500">{acc.location || 'N/A'}</span></td>
                      <td className="px-8 py-6 text-right"><p className={`font-orbitron font-bold text-lg ${acc.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{Math.abs(acc.balance).toLocaleString()} <span className="text-[10px] ml-1 opacity-60 font-sans uppercase">{acc.balance >= 0 ? 'Dr' : 'Cr'}</span></p></td>
                      <td className="px-8 py-6 text-center">
                        <div className="flex justify-center space-x-2">
                           <button onClick={(e) => { e.stopPropagation(); handleEditClick(acc); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-amber-500 transition-colors">✏️</button>
                           <button onClick={async (e) => { 
                             e.stopPropagation(); 
                             if(confirm('Warning: Deleting this account will remove all historical ledger entries. Continue?')) { 
                               await AccountingService.deleteAccount(acc.id); 
                               await refreshAccountList(); 
                             } 
                           }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-rose-500 transition-colors">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col lg:flex-row justify-between items-center mb-8 gap-4 no-print bg-white dark:bg-slate-900 p-6 rounded-3xl border shadow-sm">
            <div className="flex items-center space-x-6">
              <button onClick={() => setSelectedAccount(null)} className="w-12 h-12 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all font-black text-xl">
                ←
              </button>
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white leading-none">{selectedAccount.name}</h2>
                <div className="flex items-center space-x-4 mt-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-r pr-4 border-slate-200">{typeLabel} Ledger Statement</p>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Code: {selectedAccount.code || 'UNSPECIFIED'}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={(e) => { e.stopPropagation(); handleEditClick(selectedAccount); }} className="flex items-center space-x-3 px-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95">
                <span>✏️</span> <span>Edit Account</span>
              </button>
              <button onClick={handleDownloadExcel} className="flex items-center space-x-3 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95">
                <span>📁</span> <span>Export Excel</span>
              </button>
              <button onClick={handleDownloadPDF} className="flex items-center space-x-3 px-6 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95">
                <span>📥</span> <span>Print / PDF</span>
              </button>
            </div>
          </div>

          <div className="bg-white p-12 text-black font-inter voucher-page shadow-2xl rounded-3xl border border-slate-100">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">{config.companyName}</h1>
                <p className="text-[10px] font-black text-rose-600 uppercase tracking-[0.3em] mb-4">{config.appSubtitle}</p>
                <div className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed max-w-xs">
                  <p>{config.companyAddress}</p>
                  <p className="mt-1">Cell: {config.companyCell} | Email: {config.companyEmail}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="inline-block border-2 border-slate-900 px-6 py-4 rounded-xl text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1">Statement Date</p>
                  <p className="text-lg font-bold font-mono">{new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-8 mb-10 pb-8 border-b border-slate-100">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Account Description</p>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{selectedAccount.name}</h2>
                <p className="text-sm font-medium text-slate-600 mt-1">{selectedAccount.location || 'No Location Data'}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Account ID</p>
                <p className="text-lg font-mono font-bold text-blue-600">{selectedAccount.code || selectedAccount.id.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>

            <div className="overflow-hidden mb-12 rounded-xl border border-slate-100">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                    <th className="px-4 py-5 border-r border-slate-800">Date</th>
                    <th className="px-4 py-5 border-r border-slate-800">Voucher #</th>
                    <th className="px-4 py-5 border-r border-slate-800">Narration / Description</th>
                    <th className="px-4 py-5 border-r border-slate-800 text-right">Debit</th>
                    <th className="px-4 py-5 border-r border-slate-800 text-right">Credit</th>
                    <th className="px-4 py-5 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] font-medium text-slate-700">
                  {selectedAccount.ledger.map((entry, i) => (
                    <tr key={i} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                      <td className="px-4 py-4 border-r border-slate-50 whitespace-nowrap">{new Date(entry.date).toLocaleDateString()}</td>
                      <td className="px-4 py-4 border-r border-slate-50">
                        {entry.voucherNum ? (
                          <button 
                            onClick={() => handleVoucherClick(entry.voucherNum)}
                            className="font-black text-blue-600 hover:underline transition-all uppercase no-print"
                          >
                            {entry.voucherNum}
                          </button>
                        ) : '-'}
                        <span className="print-only">{entry.voucherNum || '-'}</span>
                      </td>
                      <td className="px-4 py-4 border-r border-slate-50 italic leading-relaxed">{entry.description}</td>
                      <td className="px-4 py-4 border-r border-slate-50 text-right font-bold text-emerald-600">
                        {entry.debit > 0 ? entry.debit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                      </td>
                      <td className="px-4 py-4 border-r border-slate-50 text-right font-bold text-rose-500">
                        {entry.credit > 0 ? entry.credit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                      </td>
                      <td className="px-4 py-4 text-right font-black text-slate-900 text-xs">
                        {Math.abs(entry.balanceAfter).toLocaleString(undefined, {minimumFractionDigits: 2})} <span className="text-[9px] opacity-40 uppercase ml-1">{entry.balanceAfter >= 0 ? 'Dr' : 'Cr'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-8">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex-1 w-full md:w-auto">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Statement Summary</h3>
                   <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                     <p className="text-xs font-bold text-slate-500 uppercase">Total Items:</p><p className="text-xs font-black text-slate-900">{totalTransactions}</p>
                     <p className="text-xs font-bold text-slate-500 uppercase">Total Debits:</p><p className="text-xs font-black text-slate-900">PKR {totalDebits.toLocaleString()}</p>
                     <p className="text-xs font-bold text-slate-500 uppercase">Total Credits:</p><p className="text-xs font-black text-slate-900">PKR {totalCredits.toLocaleString()}</p>
                   </div>
                </div>
                <div className="bg-slate-900 rounded-2xl p-8 flex-1 w-full md:w-auto text-center md:text-right text-white shadow-xl shadow-slate-900/10 border border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-60 mb-2">Net Financial Obligation</p>
                  <p className="text-3xl font-black font-orbitron tracking-tighter">
                    {Math.abs(selectedAccount.balance).toLocaleString()} <span className="text-sm font-sans tracking-widest ml-1">{selectedAccount.balance >= 0 ? 'DR' : 'CR'}</span>
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-20 flex justify-between items-end border-t pt-8">
               <div className="text-center w-48"><div className="border-b border-slate-900 mb-2"></div><p className="text-[9px] font-bold uppercase tracking-widest">Prepared By</p></div>
               <div className="text-center w-48"><div className="border-b border-slate-900 mb-2"></div><p className="text-[9px] font-bold uppercase tracking-widest">Client Signature</p></div>
               <div className="text-center w-48"><div className="border-b border-slate-900 mb-2"></div><p className="text-[9px] font-bold uppercase tracking-widest">Authorised Manager</p></div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 no-print">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl p-10 border border-white/10 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-3xl font-black font-orbitron text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-400 uppercase tracking-tighter leading-none">{formMode} {typeLabel} Profile</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Enterprise Ledger Registration</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-2xl hover:rotate-90 transition-transform">✕</button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">GL Code</label>
                  <input className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 font-mono font-bold text-blue-600 border-none shadow-inner" placeholder="E.g. 1011" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Full Legal Name</label>
                  <input required className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 font-bold border-none shadow-inner" placeholder="Company or Person Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Primary Contact</label>
                  <input className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border-none shadow-inner" placeholder="+92-..." value={formData.cell} onChange={e => setFormData({...formData, cell: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Location / City</label>
                  <input className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border-none shadow-inner" placeholder="Karachi, PK" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
                </div>
              </div>

              {(formMode === 'CREATE' || formMode === 'EDIT') && (
                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-6 rounded-[2rem] space-y-4 border border-blue-100 dark:border-blue-900/30">
                  <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest block">Opening Balance Setup (IFRS Measurement)</label>
                  <div className="flex items-center space-x-4">
                    <input type="number" step="0.01" className="flex-1 bg-white dark:bg-slate-800 rounded-xl p-4 font-bold text-lg shadow-sm" placeholder="0.00" value={formData.openingBalance} onChange={e => setFormData({...formData, openingBalance: Number(e.target.value)})} />
                    <div className="flex bg-slate-200 dark:bg-slate-700 p-1.5 rounded-xl shadow-inner">
                      <button type="button" onClick={() => setFormData({...formData, balanceType: 'dr'})} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${formData.balanceType === 'dr' ? 'bg-white dark:bg-slate-600 text-blue-600 shadow-sm' : 'text-slate-500'}`}>Dr (Rec)</button>
                      <button type="button" onClick={() => setFormData({...formData, balanceType: 'cr'})} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${formData.balanceType === 'cr' ? 'bg-white dark:bg-slate-600 text-rose-500 shadow-sm' : 'text-slate-500'}`}>Cr (Pay)</button>
                    </div>
                  </div>
                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider leading-relaxed">System will update the primary opening position and synchronize the contra-entry in General Reserve Fund (3001).</p>
                </div>
              )}

              <div className="flex space-x-4 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 p-5 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold uppercase text-[10px] tracking-widest">Discard</button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-[2] p-5 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-600/20 uppercase text-[10px] tracking-widest disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing...' : 'Finalize Profile Update'}
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