import React, { useState, useMemo, useEffect } from 'react';
import { Account, AccountType, Voucher, Currency } from '../types';
import { AccountingService } from '../services/AccountingService';
import { getAccounts, getVouchers, getConfig } from '../services/db';

interface LedgerProps {
  type: AccountType;
  onEditVoucher: (v: Voucher) => void;
}

const Ledger: React.FC<LedgerProps> = ({ type, onEditVoucher }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formMode, setFormMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);
  const [accountList, setAccountList] = useState<Account[]>([]);
  
  const config = useMemo(() => getConfig(), []);
  const allVouchers = useMemo(() => getVouchers(), []);

  const [formData, setFormData] = useState({ 
    name: '', cell: '', location: '', code: '', openingBalance: 0, 
    balanceType: type === AccountType.CUSTOMER ? 'dr' : 'cr' 
  });

  useEffect(() => {
    setSelectedAccount(null);
    setSearchTerm('');
    setAccountList(getAccounts().filter(a => a.type === type));
  }, [type]);

  useEffect(() => {
    if (!showAddModal) {
      setAccountList(getAccounts().filter(a => a.type === type));
    }
  }, [showAddModal, type]);

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
    // Browser uses the document title as the suggested filename when saving as PDF
    const filename = `Statement_${selectedAccount?.name || 'Ledger'}_${new Date().toISOString().split('T')[0]}`;
    document.title = filename;
    
    // Small delay to ensure the title is updated before the print dialog opens
    setTimeout(() => {
      window.print();
      document.title = originalTitle;
    }, 150);
  };

  const totalDebits = useMemo(() => selectedAccount?.ledger.reduce((sum, e) => sum + e.debit, 0) || 0, [selectedAccount]);
  const totalCredits = useMemo(() => selectedAccount?.ledger.reduce((sum, e) => sum + e.credit, 0) || 0, [selectedAccount]);
  const totalTransactions = useMemo(() => selectedAccount?.ledger.filter(e => e.voucherId !== 'opening').length || 0, [selectedAccount]);

  const typeLabel = type === AccountType.CUSTOMER ? 'Customer' : 'Vendor';

  return (
    <div className="space-y-6">
      {!selectedAccount ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
            <div className="relative flex-1 max-w-lg">
              <input 
                type="text" 
                placeholder={`Search ${typeLabel}s...`} 
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 pl-12 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="absolute left-4 top-4 text-xl opacity-40">🔍</span>
            </div>
            <button 
              onClick={() => { setFormMode('CREATE'); setAccountToEdit(null); setShowAddModal(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-blue-500/25 transition-all active:scale-95 text-sm"
            >
              + New {typeLabel}
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-xl no-print">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 text-xs uppercase tracking-widest font-bold">
                  <tr>
                    <th className="px-8 py-5">Name / Code</th>
                    <th className="px-8 py-5">Location</th>
                    <th className="px-8 py-5 text-right">Outstanding Balance</th>
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
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-blue-600 font-bold group-hover:bg-blue-600 group-hover:text-white transition-all text-xs">
                            {acc.code || acc.name.charAt(0)}
                          </div>
                          <div><p className="font-bold text-slate-800 dark:text-white">{acc.name}</p><p className="text-xs text-slate-500 font-mono">{acc.code || 'NO CODE'}</p></div>
                        </div>
                      </td>
                      <td className="px-8 py-6"><span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-500">{acc.location || 'Not Specified'}</span></td>
                      <td className="px-8 py-6 text-right"><p className={`font-orbitron font-bold text-lg ${acc.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{Math.abs(acc.balance).toLocaleString()} <span className="text-[10px] ml-1 opacity-60 font-sans">{acc.balance >= 0 ? 'DR' : 'CR'}</span></p></td>
                      <td className="px-8 py-6 text-center">
                        <div className="flex justify-center space-x-2">
                           <button onClick={(e) => { e.stopPropagation(); setAccountToEdit(acc); setFormMode('EDIT'); setFormData({ name: acc.name, cell: acc.cell || '', location: acc.location || '', code: acc.code || '', openingBalance: 0, balanceType: acc.balance >= 0 ? 'dr' : 'cr' }); setShowAddModal(true); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-amber-500">✏️</button>
                           <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete account?')) { AccountingService.deleteAccount(acc.id); setAccountList(getAccounts().filter(a => a.type === type)); } }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-rose-500">🗑️</button>
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
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 no-print">
            <div className="flex items-center space-x-4">
              <button onClick={() => setSelectedAccount(null)} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-blue-600 transition-colors">
                <span className="text-xl font-bold">←</span>
              </button>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">{selectedAccount.name}</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Statement Overview</p>
              </div>
            </div>
            <button onClick={handleDownloadPDF} className="flex items-center space-x-3 px-8 py-4 bg-[#10b981] hover:bg-[#059669] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">
              <span>📥</span> <span>Download PDF Statement</span>
            </button>
          </div>

          {/* Ledger Statement matches Screenshot */}
          <div className="bg-white p-12 text-black font-inter voucher-page shadow-2xl rounded-xl">
            {/* Header Area */}
            <div className="mb-6">
              <h1 className="text-4xl font-bold text-slate-900 tracking-tighter uppercase">{config.companyName}</h1>
              <p className="text-sm font-medium text-slate-700">{config.companyAddress}</p>
              <p className="text-sm font-medium text-slate-700">Contact: {config.companyCell} | Email: {config.companyEmail}</p>
            </div>
            <hr className="border-slate-100 mb-8" />
            
            {/* Title Area */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">{typeLabel} Ledger Statement</h2>
              <p className="text-lg font-bold text-slate-800 mt-2">Party: {selectedAccount.name} ({selectedAccount.code || 'N/A'})</p>
              <p className="text-xs text-slate-400 mt-1">Generated on: {new Date().toLocaleString()}</p>
            </div>

            {/* Table Area */}
            <div className="overflow-hidden mb-12">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0f172a] text-white text-[11px] font-black uppercase tracking-wider">
                    <th className="px-4 py-4 border-r border-slate-700">Date</th>
                    <th className="px-4 py-4 border-r border-slate-700">Ref #</th>
                    <th className="px-4 py-4 border-r border-slate-700">Type</th>
                    <th className="px-4 py-4 border-r border-slate-700">Narration</th>
                    <th className="px-4 py-4 border-r border-slate-700 text-center">ROE</th>
                    <th className="px-4 py-4 border-r border-slate-700 text-right">Debit</th>
                    <th className="px-4 py-4 border-r border-slate-700 text-right">Credit</th>
                    <th className="px-4 py-4 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] font-medium text-slate-700">
                  {selectedAccount.ledger.map((entry, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3 border-r border-slate-50">{entry.voucherId === 'opening' ? '-' : new Date(entry.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 border-r border-slate-50">{entry.voucherId === 'opening' ? '-' : entry.voucherNum}</td>
                      <td className="px-4 py-3 border-r border-slate-50">{entry.voucherId === 'opening' ? 'Opening Balance' : 'Hotel'}</td>
                      <td className="px-4 py-3 border-r border-slate-50 italic">{entry.description}</td>
                      <td className="px-4 py-3 border-r border-slate-50 text-center">{entry.roe > 1 ? entry.roe.toFixed(1) : '-'}</td>
                      <td className="px-4 py-3 border-r border-slate-50 text-right">{entry.debit > 0 ? entry.debit.toLocaleString() : '-'}</td>
                      <td className="px-4 py-3 border-r border-slate-50 text-right">{entry.credit > 0 ? entry.credit.toLocaleString() : '-'}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {Math.abs(entry.balanceAfter).toLocaleString()} {entry.balanceAfter >= 0 ? 'Dr' : 'Cr'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary Box matches Screenshot */}
            <div className="mt-8">
              <h3 className="text-lg font-bold text-slate-900 uppercase tracking-widest mb-4 ml-2">Financial Summary</h3>
              <div className="bg-slate-50 rounded-[2rem] p-8 flex justify-between items-center border border-slate-100">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-600">Total Transactions: <span className="text-slate-900 font-bold">{totalTransactions}</span></p>
                  <p className="text-sm font-medium text-slate-600">Total Debits: <span className="text-slate-900 font-bold">Rs. {totalDebits.toLocaleString()}</span></p>
                  <p className="text-sm font-medium text-slate-600">Total Credits: <span className="text-slate-900 font-bold">Rs. {totalCredits.toLocaleString()}</span></p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-slate-900 tracking-tighter">
                    Net Balance: Rs. {Math.abs(selectedAccount.balance).toLocaleString()} {selectedAccount.balance >= 0 ? 'Dr' : 'Cr'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 no-print">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl p-10 border border-white/10">
            <h3 className="text-3xl font-bold font-orbitron text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-400 mb-8 uppercase tracking-tighter">{formMode} {typeLabel} Profile</h3>
            <form onSubmit={(e) => { e.preventDefault(); if(formMode === 'EDIT' && accountToEdit) AccountingService.updateAccount(accountToEdit.id, formData); else AccountingService.createAccount(formData.name, type, formData.cell, formData.location, formData.openingBalance, formData.balanceType === 'dr', formData.code); setShowAddModal(false); }} className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <input className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 font-mono font-bold" placeholder="Code" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
                <input required className="col-span-2 bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 font-bold" placeholder="Legal Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4" placeholder="Contact Cell" value={formData.cell} onChange={e => setFormData({...formData, cell: e.target.value})} />
                <input className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4" placeholder="Location" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
              </div>
              <div className="flex space-x-4"><button type="button" onClick={() => setShowAddModal(false)} className="flex-1 p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold">Cancel</button><button type="submit" className="flex-1 p-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl">Complete Setup</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ledger;