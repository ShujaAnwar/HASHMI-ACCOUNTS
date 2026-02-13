
import React, { useState, useMemo, useEffect } from 'react';
import { Account, AccountType, Voucher, VoucherType, Currency } from '../types';
import { AccountingService } from '../services/AccountingService';
import { getAccounts, getVouchers } from '../services/db';

interface LedgerProps {
  type: AccountType;
}

const Ledger: React.FC<LedgerProps> = ({ type }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [viewingAccountDetails, setViewingAccountDetails] = useState<Account | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formMode, setFormMode] = useState<'CREATE' | 'EDIT' | 'CLONE'>('CREATE');
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [accountList, setAccountList] = useState<Account[]>([]);
  
  const [formData, setFormData] = useState({ 
    name: '', 
    cell: '', 
    location: '', 
    code: '',
    openingBalance: 0, 
    balanceType: type === AccountType.CUSTOMER ? 'dr' : 'cr' 
  });

  // Sync state with storage on mount and when modal closes
  useEffect(() => {
    setAccountList(getAccounts().filter(a => a.type === type));
  }, [type, showAddModal]);

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

  const handleOpenCreate = () => {
    setFormMode('CREATE');
    setAccountToEdit(null);
    setFormData({ 
      name: '', 
      cell: '', 
      location: '', 
      code: '',
      openingBalance: 0, 
      balanceType: type === AccountType.CUSTOMER ? 'dr' : 'cr' 
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (acc: Account, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFormMode('EDIT');
    setAccountToEdit(acc);
    setFormData({
      name: acc.name,
      cell: acc.cell || '',
      location: acc.location || '',
      code: acc.code || '',
      openingBalance: 0, // In edit mode we don't usually re-set opening balance
      balanceType: acc.balance >= 0 ? 'dr' : 'cr'
    });
    setShowAddModal(true);
  };

  const handleOpenClone = (acc: Account, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFormMode('CLONE');
    setAccountToEdit(acc);
    setFormData({
      name: `${acc.name} (Copy)`,
      cell: acc.cell || '',
      location: acc.location || '',
      code: acc.code ? `${acc.code}-CL` : '',
      openingBalance: Math.abs(acc.balance), // Carry over balance if desired, or set to 0
      balanceType: acc.balance >= 0 ? 'dr' : 'cr'
    });
    setShowAddModal(true);
  };

  const handleDelete = (acc: Account, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (window.confirm(`Are you sure you want to delete ${acc.name}? This will remove the account record from the system.`)) {
      AccountingService.deleteAccount(acc.id);
      setAccountList(getAccounts().filter(a => a.type === type));
    }
  };

  const handleViewDetails = (acc: Account, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setViewingAccountDetails(acc);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formMode === 'EDIT' && accountToEdit) {
      AccountingService.updateAccount(accountToEdit.id, {
        name: formData.name,
        cell: formData.cell,
        location: formData.location,
        code: formData.code
      });
    } else {
      // CREATE or CLONE
      AccountingService.createAccount(
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
  };

  const handleVoucherClick = (voucherNum: string) => {
    const vouchers = getVouchers();
    const found = vouchers.find(v => v.voucherNum === voucherNum);
    if (found) setSelectedVoucher(found);
  };

  const exportToExcel = () => {
    if (!selectedAccount) return;
    const headers = ["Date", "Voucher #", "Description", "Debit", "Credit", "Balance"];
    const rows = selectedAccount.ledger.map(e => [
      new Date(e.date).toLocaleDateString(),
      e.voucherNum,
      e.description,
      e.debit,
      e.credit,
      e.balanceAfter
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedAccount.name}_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const typeLabel = type === AccountType.CUSTOMER ? 'Customer' : 'Vendor';

  return (
    <div className="space-y-6">
      {!selectedAccount ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-lg">
              <input 
                type="text" 
                placeholder={`Search by Name, Code, Location...`} 
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 pl-12 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="absolute left-4 top-4 text-xl opacity-40">🔍</span>
            </div>
            <button 
              onClick={handleOpenCreate}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-blue-500/25 transition-all flex items-center justify-center space-x-2 active:scale-95"
            >
              <span className="text-xl">+</span> <span>New {typeLabel}</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-400 text-xs uppercase tracking-widest font-bold">
                  <tr>
                    <th className="px-8 py-5">Name / Code</th>
                    <th className="px-8 py-5">Location</th>
                    <th className="px-8 py-5 text-right">Outstanding Balance</th>
                    <th className="px-8 py-5 text-center no-print">Actions</th>
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
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-blue-600 font-bold group-hover:bg-blue-600 group-hover:text-white transition-all">
                            {acc.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 dark:text-white">{acc.name}</p>
                            <p className="text-xs text-slate-500 font-mono">{acc.code || 'NO CODE'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-500">
                          {acc.location || 'Not Specified'}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <p className={`font-orbitron font-bold text-lg ${acc.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {Math.abs(acc.balance).toLocaleString()} 
                          <span className="text-[10px] ml-1 opacity-60 font-sans">{acc.balance >= 0 ? 'DR' : 'CR'}</span>
                        </p>
                      </td>
                      <td className="px-8 py-6 no-print">
                        <div className="flex justify-center space-x-2">
                           <button onClick={(e) => handleViewDetails(acc, e)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-blue-500 transition-all" title="View Info">👁️</button>
                           <button onClick={(e) => handleOpenEdit(acc, e)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-amber-500 transition-all" title="Edit Record">✏️</button>
                           <button onClick={(e) => handleOpenClone(acc, e)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-emerald-500 transition-all" title="Clone Record">📑</button>
                           <button onClick={(e) => handleDelete(acc, e)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-rose-500 transition-all" title="Delete Record">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredAccounts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center text-slate-400">
                        <div className="flex flex-col items-center">
                          <span className="text-4xl mb-4">📂</span>
                          <p className="text-lg font-medium">No {typeLabel.toLowerCase()} records found</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center mb-6 no-print">
            <button onClick={() => setSelectedAccount(null)} className="flex items-center space-x-2 text-blue-600 font-bold hover:underline">
              <span className="text-xl">←</span> <span>Back to {typeLabel} List</span>
            </button>
            <div className="flex space-x-3">
              <button onClick={exportToExcel} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20">
                <span>Excel</span>
              </button>
              <button onClick={() => window.print()} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold shadow-lg shadow-slate-500/20">
                <span>Print PDF</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-xl">
            <div className="mb-8 border-b dark:border-slate-800 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div>
                <h2 className="text-3xl font-orbitron font-bold tracking-tight">{selectedAccount.name}</h2>
                <p className="text-slate-500 font-medium mt-1">
                  <span className="mr-4">📱 {selectedAccount.cell || 'N/A'}</span>
                  <span>📍 {selectedAccount.location || 'N/A'}</span>
                  <span className="ml-4 font-mono"># {selectedAccount.code || 'N/A'}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">Audit Adjusted Balance</p>
                <p className={`text-4xl font-orbitron font-bold ${selectedAccount.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {Math.abs(selectedAccount.balance).toLocaleString()} 
                  <span className="text-sm ml-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                    {selectedAccount.balance >= 0 ? 'DR' : 'CR'}
                  </span>
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800 text-xs uppercase tracking-wider">
                    <th className="py-4 font-bold">Post Date</th>
                    <th className="py-4 font-bold">Voucher #</th>
                    <th className="py-4 font-bold">Transaction Narrative</th>
                    <th className="py-4 font-bold text-right">Debit</th>
                    <th className="py-4 font-bold text-right">Credit</th>
                    <th className="py-4 font-bold text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {selectedAccount.ledger.map((entry, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 text-sm text-slate-400">{new Date(entry.date).toLocaleDateString()}</td>
                      <td className="py-4">
                        <button 
                          onClick={() => handleVoucherClick(entry.voucherNum)}
                          className="font-bold text-blue-600 hover:text-blue-400 underline underline-offset-4"
                        >
                          {entry.voucherNum}
                        </button>
                      </td>
                      <td className="py-4 text-sm max-w-md truncate font-medium">{entry.description}</td>
                      <td className="py-4 text-right font-medium text-emerald-600">{entry.debit > 0 ? entry.debit.toLocaleString() : '-'}</td>
                      <td className="py-4 text-right font-medium text-rose-600">{entry.credit > 0 ? entry.credit.toLocaleString() : '-'}</td>
                      <td className={`py-4 text-right font-bold ${entry.balanceAfter >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {Math.abs(entry.balanceAfter).toLocaleString()} <span className="text-[10px]">{entry.balanceAfter >= 0 ? 'Dr' : 'Cr'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit / Clone Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl p-10 border border-white/10">
            <h3 className="text-3xl font-bold font-orbitron text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-400 mb-8">
              {formMode === 'EDIT' ? 'Update' : (formMode === 'CLONE' ? 'Clone' : 'New')} {typeLabel} Profile
            </h3>
            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Code</label>
                  <input 
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-blue-500/30 rounded-2xl p-4 transition-all outline-none font-mono font-bold"
                    placeholder="e.g. 1010"
                    value={formData.code}
                    onChange={e => setFormData({...formData, code: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Full Legal Entity Name</label>
                  <input 
                    required autoFocus
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-blue-500/30 rounded-2xl p-4 transition-all outline-none font-medium"
                    placeholder="e.g. Skyline Travel Agency"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Cell (+92-XXX-XXXXXXX)</label>
                  <input 
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-blue-500/30 rounded-2xl p-4 transition-all outline-none"
                    placeholder="+92-300-1234567"
                    value={formData.cell}
                    onChange={e => setFormData({...formData, cell: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Office Location</label>
                  <input 
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-blue-500/30 rounded-2xl p-4 transition-all outline-none"
                    placeholder="City, Country"
                    value={formData.location}
                    onChange={e => setFormData({...formData, location: e.target.value})}
                  />
                </div>
              </div>
              
              {formMode !== 'EDIT' && (
                <div className="bg-blue-50/30 dark:bg-blue-900/10 p-6 rounded-[2rem] border border-blue-500/10 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-blue-600 uppercase tracking-widest px-1">Opening Balance (PKR)</label>
                    <input 
                      type="number"
                      className="w-full bg-white dark:bg-slate-800 border-none rounded-xl p-4 focus:ring-2 focus:ring-blue-500 transition-all outline-none font-bold text-xl"
                      value={formData.openingBalance}
                      onChange={e => setFormData({...formData, openingBalance: Number(e.target.value)})}
                    />
                  </div>
                  <div className="flex items-center space-x-6 px-1">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input 
                        type="radio" name="balanceType" value="dr" checked={formData.balanceType === 'dr'} 
                        onChange={() => setFormData({...formData, balanceType: 'dr'})}
                      />
                      <span className={`text-sm font-bold uppercase ${formData.balanceType === 'dr' ? 'text-emerald-500' : 'text-slate-500'}`}>Debit</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input 
                        type="radio" name="balanceType" value="cr" checked={formData.balanceType === 'cr'} 
                        onChange={() => setFormData({...formData, balanceType: 'cr'})}
                      />
                      <span className={`text-sm font-bold uppercase ${formData.balanceType === 'cr' ? 'text-rose-500' : 'text-slate-500'}`}>Credit</span>
                    </label>
                  </div>
                </div>
              )}
              
              <div className="flex space-x-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-4 bg-slate-100 dark:bg-slate-800 font-bold rounded-2xl">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl">
                  {formMode === 'EDIT' ? 'Update Profile' : 'Complete Setup'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Info Detail View Modal */}
      {viewingAccountDetails && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] p-10 border border-white/5 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-8">
              <div>
                <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-widest">{typeLabel} Intelligence</span>
                <h3 className="text-3xl font-orbitron font-bold text-slate-900 dark:text-white mt-2">{viewingAccountDetails.name}</h3>
                <p className="text-slate-400 text-sm font-mono mt-1">GL Code: {viewingAccountDetails.code || 'Not Assigned'}</p>
              </div>
              <button onClick={() => setViewingAccountDetails(null)} className="text-xl">✕</button>
            </div>
            
            <div className="grid grid-cols-2 gap-8 mb-10">
              <div className="space-y-4">
                <div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Contact Number</p>
                   <p className="font-bold text-lg">{viewingAccountDetails.cell || 'No Contact Data'}</p>
                </div>
                <div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Corporate Address</p>
                   <p className="font-bold text-lg">{viewingAccountDetails.location || 'Not Specified'}</p>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Outstanding Exposure</p>
                <p className={`text-4xl font-orbitron font-bold ${viewingAccountDetails.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                   {Math.abs(viewingAccountDetails.balance).toLocaleString()}
                </p>
                <p className="text-xs font-bold uppercase text-slate-400 mt-1">{viewingAccountDetails.balance >= 0 ? 'Debit Balance' : 'Credit Balance'}</p>
              </div>
            </div>

            <div className="flex space-x-4">
              <button onClick={() => { setViewingAccountDetails(null); handleOpenEdit(viewingAccountDetails); }} className="flex-1 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl text-xs uppercase tracking-widest">Edit Details</button>
              <button onClick={() => setViewingAccountDetails(null)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 font-bold rounded-2xl text-xs uppercase tracking-widest">Close Information</button>
            </div>
          </div>
        </div>
      )}

      {/* Voucher Modal */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] p-10 border border-white/5">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-3xl font-orbitron font-bold text-blue-600">{selectedVoucher.voucherNum}</h3>
                <p className="text-slate-400 text-sm">Transaction recorded on {new Date(selectedVoucher.date).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedVoucher(null)} className="text-xl">✕</button>
            </div>
            <div className="space-y-6">
              <div className="border-b dark:border-slate-800 pb-6">
                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Narrative</p>
                <p className="text-xl font-bold">{selectedVoucher.description}</p>
                <p className="text-4xl font-orbitron font-bold text-blue-600 mt-4">
                  PKR {selectedVoucher.totalAmountPKR.toLocaleString()}
                </p>
              </div>
              <button onClick={() => setSelectedVoucher(null)} className="w-full py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold">Close Record</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ledger;
