import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Account, AccountType, Voucher, Currency, AppConfig, VoucherType } from '../types';
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
  const [isExporting, setIsExporting] = useState(false);
  
  const [viewCurrency, setViewCurrency] = useState<Currency>(Currency.PKR);
  const pdfRef = useRef<HTMLDivElement>(null);

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
    const existing = allAccountsForCode.filter(a => a.code?.startsWith(prefix));
    if (existing.length === 0) return `${prefix}01`;
    const codes = existing.map(a => parseInt(a.code || '0')).filter(n => !isNaN(n));
    return (Math.max(...codes) + 1).toString();
  }, [allAccountsForCode]);

  const filteredAccounts = useMemo(() => {
    if (!searchTerm) return accountList;
    const lowSearch = searchTerm.toLowerCase();
    return accountList.filter(a => 
      a.name.toLowerCase().includes(lowSearch) || 
      a.code?.includes(searchTerm)
    );
  }, [accountList, searchTerm]);

  const listStats = useMemo(() => {
    const count = filteredAccounts.length;
    const totalBalance = filteredAccounts.reduce((sum, acc) => sum + acc.balance, 0);
    return { count, totalBalance };
  }, [filteredAccounts]);

  const currentROE = config?.defaultROE || 74.5;

  // Improved conversion logic
  const getConvertedVal = useCallback((val: number, roeOverride?: number) => {
    if (viewCurrency === Currency.PKR) return val;
    const roe = roeOverride || currentROE;
    return val / (roe || 1);
  }, [viewCurrency, currentROE]);

  const getNarrativeForLedger = (entry: any, voucher: Voucher | undefined) => {
    if (!voucher || !voucher.details) return entry.description || '-';
    
    if (voucher.type === VoucherType.HOTEL) {
      const pax = voucher.details.paxName || 'N/A';
      const hotel = voucher.details.hotelName || 'N/A';
      const loc = voucher.details.city || 'N/A';
      const countrySuffix = (loc.toLowerCase().includes('makkah') || loc.toLowerCase().includes('madinah') || loc.toLowerCase().includes('jeddah')) ? ' -KSA' : '';
      
      return `${pax.toUpperCase()} | ${hotel.toUpperCase()} | ${loc.toUpperCase()}${countrySuffix}`;
    }
    
    return entry.description && entry.description !== '-' ? entry.description : (voucher.description || '-');
  };

  const ledgerWithRunningBalance = useMemo(() => {
    if (!selectedAccount) return [];
    const sortedLedger = [...selectedAccount.ledger].sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
    let running = 0;
    return sortedLedger.map(entry => {
      running += (entry.debit - entry.credit);
      return { ...entry, balanceAfter: running };
    });
  }, [selectedAccount]);

  const handleDownloadPDF = async () => {
    if (!pdfRef.current || !selectedAccount) return;
    
    setIsExporting(true);
    const element = pdfRef.current;
    const fileName = `Ledger_${selectedAccount.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    const opt = {
      margin: [10, 0, 10, 0], // Top, Right, Bottom, Left margins
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        letterRendering: true, 
        backgroundColor: '#ffffff',
        logging: false,
        scrollY: 0,
        width: 793, // A4 width in pixels at 96 DPI
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    try {
      // @ts-ignore
      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error("PDF Export Error:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (formMode === 'EDIT' && accountToEdit) {
        await AccountingService.updateAccount(accountToEdit.id, formData);
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

  const totalVisibleDebit = ledgerWithRunningBalance.reduce((sum, entry) => sum + entry.debit, 0);
  const totalVisibleCredit = ledgerWithRunningBalance.reduce((sum, entry) => sum + entry.credit, 0);
  const totalTransactions = ledgerWithRunningBalance.filter(e => e.voucherId).length;

  return (
    <div className="space-y-4 max-w-full">
      {!selectedAccount ? (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 no-print">
            <div className="relative flex-1 max-w-xs w-full">
              <input type="text" placeholder="Filter profiles..." className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 pl-9 outline-none shadow-sm text-xs" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <span className="absolute left-3 top-2 text-xs opacity-40">🔍</span>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
               <div className="bg-white dark:bg-slate-900 p-1.5 px-3 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center min-w-[70px]">
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Count</p>
                  <p className="text-xs font-orbitron font-bold text-blue-600 leading-none mt-0.5">{listStats.count}</p>
               </div>
               <div className="bg-white dark:bg-slate-900 p-1.5 px-4 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center min-w-[120px]">
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Aggregate Balance</p>
                  <p className="text-xs font-orbitron font-bold text-slate-800 dark:text-white leading-none mt-0.5">
                    {Math.abs(listStats.totalBalance).toLocaleString()}
                    <span className="text-[8px] font-sans ml-1 opacity-50 uppercase">{listStats.totalBalance >= 0 ? 'Dr' : 'Cr'}</span>
                  </p>
               </div>
               <button 
                  onClick={() => { 
                    setFormMode('CREATE'); 
                    setFormData({ name: '', cell: '', location: '', code: generateNextCode(type), openingBalance: 0, balanceType: type === AccountType.CUSTOMER ? 'dr' : 'cr', currency: Currency.PKR });
                    setShowAddModal(true); 
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg font-black shadow-lg shadow-blue-500/10 uppercase tracking-widest text-[9px] transition-all active:scale-95 whitespace-nowrap"
                >
                  + Create Head
                </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm no-print overflow-x-auto">
            <table className="w-full text-left table-auto">
              <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 text-[8px] uppercase tracking-widest font-black border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-2 w-24">Code</th>
                  <th className="px-4 py-2">Account Name</th>
                  <th className="px-4 py-2">Location</th>
                  <th className="px-4 py-2 text-right">Balance (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAccounts.map((acc) => (
                  <tr key={acc.id} className="group hover:bg-blue-50/10 dark:hover:bg-blue-900/10 transition-all cursor-pointer" onClick={() => setSelectedAccount(acc)}>
                    <td className="px-4 py-1.5 font-mono text-[10px] font-bold text-blue-600">{acc.code || '-'}</td>
                    <td className="px-4 py-1.5 font-black text-slate-800 dark:text-white uppercase text-[11px] leading-none">{acc.name}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-400 uppercase leading-none">{acc.location || '-'}</td>
                    <td className="px-4 py-1.5 text-right font-orbitron font-black text-[11px]">
                      {Math.abs(acc.balance).toLocaleString()}
                      <span className="text-[8px] font-sans ml-1 opacity-40 uppercase">{acc.balance >= 0 ? 'Dr' : 'Cr'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-1 duration-300">
          <div className="flex justify-between items-center mb-3 no-print bg-white dark:bg-slate-900 p-2 px-5 rounded-xl border shadow-sm">
            <div className="flex items-center space-x-3">
              <button onClick={() => setSelectedAccount(null)} className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 font-black hover:text-blue-600 transition-all text-xs">←</button>
              <div>
                <h2 className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white leading-none">{selectedAccount.name}</h2>
                <p className="text-[7px] font-black text-blue-600 uppercase tracking-widest mt-1">GL Code: {selectedAccount.code || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg shadow-inner">
                <button onClick={() => setViewCurrency(Currency.PKR)} className={`px-2 py-1 rounded-md text-[7px] font-black uppercase transition-all ${viewCurrency === Currency.PKR ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}>PKR</button>
                <button onClick={() => setViewCurrency(Currency.SAR)} className={`px-2 py-1 rounded-md text-[7px] font-black uppercase transition-all ${viewCurrency === Currency.SAR ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}>SAR</button>
              </div>
              <button 
                onClick={handleDownloadPDF} 
                disabled={isExporting}
                className="px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-[8px] font-black uppercase shadow-sm transition-all active:scale-95 disabled:opacity-50"
              >
                {isExporting ? 'Preparing...' : 'Export PDF'}
              </button>
            </div>
          </div>

          <div className="flex justify-center items-start py-6 bg-slate-100/30 dark:bg-slate-950/20 rounded-xl overflow-x-auto min-h-screen">
            <div 
              ref={pdfRef} 
              className="bg-white text-[#0f172a] font-inter w-[210mm] mx-auto flex flex-col items-center p-[10mm] shadow-md box-border overflow-hidden"
              style={{ minHeight: 'auto', width: '210mm', boxSizing: 'border-box' }}
            >
              {/* Header */}
              <div className="w-full mb-10 flex flex-col items-center">
                 <h1 className="text-[36px] font-black tracking-tighter uppercase leading-none text-[#0f172a] mb-4 text-center">
                   {config.companyName || 'HASHMI BOOKS'}
                 </h1>
                 <div className="flex items-center justify-center text-[8.5px] font-bold text-slate-400 tracking-widest uppercase w-full">
                   <span>CONTACT: {config.companyCell}</span>
                   <span className="mx-8 opacity-40">|</span>
                   <span>EMAIL: {config.companyEmail}</span>
                 </div>
              </div>

              {/* Statement Title */}
              <div className="w-full mb-6 border-t-2 border-slate-50 pt-10 flex flex-col items-center">
                 <h2 className="text-[22px] font-black uppercase text-[#0f172a] tracking-tight mb-4 text-center">
                   {type === AccountType.VENDOR ? 'VENDOR' : 'CUSTOMER'} LEDGER STATEMENT
                 </h2>
                 <div className="flex flex-col items-center w-full">
                    <p className="text-[14px] font-black text-slate-800 uppercase tracking-tight leading-none text-center">
                      PARTY: {selectedAccount.name} ({selectedAccount.code || '1101'})
                    </p>
                    <p className="text-[8px] text-slate-300 font-bold uppercase tracking-[0.2em] mt-3 text-center">
                      GENERATED ON: {new Date().toLocaleDateString('en-GB')} , {new Date().toLocaleTimeString()}
                    </p>
                 </div>
              </div>

              {/* Data Table */}
              <div className="w-full mb-10 mt-6">
                <table className="w-full text-left border-collapse table-fixed">
                    <thead className="bg-[#0f172a] text-white text-[7.5px] uppercase font-black tracking-wider">
                      <tr>
                        <th className="px-2 py-3 w-16 text-center">DATE</th>
                        <th className="px-2 py-3 w-20 text-center">REF #</th>
                        <th className="px-1 py-3 w-12 text-center">TYPE</th>
                        <th className="px-3 py-3">TRANSACTION NARRATION</th>
                        <th className="px-2 py-3 w-20 text-center">RATE(SAR)</th>
                        <th className="px-2 py-3 w-12 text-center">ROE</th>
                        <th className="px-2 py-3 w-24 text-right">DEBIT</th>
                        <th className="px-2 py-3 w-24 text-right">CREDIT</th>
                        <th className="px-2 py-3 w-24 text-right">BALANCE</th>
                      </tr>
                    </thead>
                    <tbody className="text-[8.5px] font-medium text-slate-600">
                      {ledgerWithRunningBalance.map((entry, i) => {
                        const voucher = vouchers.find(v => v.id === entry.voucherId);
                        const displayVNum = voucher?.voucherNum || entry.voucherNum || '-';
                        const displayDescription = getNarrativeForLedger(entry, voucher);
                        const displayType = voucher?.type || (entry.description?.includes('Opening') ? 'OP' : '-');
                        
                        // ROE and Conversion Handling
                        const itemRoe = voucher?.roe || currentROE;
                        const isSar = voucher?.currency === Currency.SAR;

                        return (
                          <tr key={i} className="border-b border-slate-100">
                            <td className="px-2 py-2 text-center font-bold text-slate-400">
                              {entry.date === '-' ? '-' : new Date(entry.date).toLocaleDateString('en-GB')}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button 
                                onClick={() => voucher && onEditVoucher(voucher)}
                                className="font-black text-blue-600/60 hover:text-blue-800 hover:underline cursor-pointer no-print-btn"
                              >
                                {displayVNum}
                              </button>
                            </td>
                            <td className="px-1 py-2 text-center uppercase font-bold text-slate-400 text-[6.5px]">
                              {displayType}
                            </td>
                            <td className="px-3 py-2 uppercase leading-snug font-bold text-slate-800 text-[7px]">
                              {displayDescription}
                            </td>
                            <td className="px-2 py-2 text-center font-bold text-slate-400">
                              {isSar ? (voucher?.details?.unitRate || (entry.debit + entry.credit) / (voucher?.roe || 1)).toLocaleString(undefined, { minimumFractionDigits: 0 }) : '-'}
                            </td>
                            <td className="px-2 py-2 text-center font-bold text-slate-400">
                              {isSar ? itemRoe : '-'}
                            </td>
                            <td className="px-2 py-2 text-right font-black text-slate-900">
                              {entry.debit > 0 ? getConvertedVal(entry.debit, itemRoe).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'}
                            </td>
                            <td className="px-2 py-2 text-right font-black text-slate-900">
                              {entry.credit > 0 ? getConvertedVal(entry.credit, itemRoe).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'}
                            </td>
                            <td className="px-2 py-2 text-right font-black text-slate-900">
                              {Math.abs(getConvertedVal(entry.balanceAfter, itemRoe)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              <span className="ml-1 text-[5px] opacity-40 uppercase">{entry.balanceAfter >= 0 ? 'DR' : 'CR'}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="text-slate-900 font-black text-[9px] uppercase">
                      <tr>
                        <td colSpan={6} className="px-4 py-4 text-right font-black tracking-tight">TOTAL FOR PERIOD STATEMENT:</td>
                        <td className="px-2 py-4 text-right text-emerald-600 border-l border-slate-50 bg-slate-50/30">
                          {getConvertedVal(totalVisibleDebit).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-4 text-right text-rose-600 border-l border-slate-50 bg-slate-50/30">
                          {getConvertedVal(totalVisibleCredit).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-4 text-right border-l border-slate-50 bg-slate-50/30">
                           {Math.abs(getConvertedVal(selectedAccount.balance)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                           <span className="ml-1 text-[6px] opacity-50">{selectedAccount.balance >= 0 ? 'DR' : 'CR'}</span>
                        </td>
                      </tr>
                    </tfoot>
                </table>
              </div>

              {/* Financial Position Summary */}
              <div className="w-full bg-[#fcfdff] p-10 rounded-[3rem] border border-slate-100 flex flex-col items-center mt-10 break-inside-avoid shadow-none ring-1 ring-slate-100">
                 <h3 className="text-[12px] font-black text-[#0f172a] uppercase tracking-[0.4em] mb-10 text-center">FINANCIAL POSITION SUMMARY</h3>
                 
                 <div className="grid grid-cols-3 gap-12 md:gap-24 w-full mb-10">
                    <div className="flex flex-col items-center">
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-2 text-center">ACCOUNT TRANSACTIONS</p>
                        <p className="text-2xl font-black text-[#0f172a]">{totalTransactions}</p>
                    </div>
                    <div className="flex flex-col items-center">
                        <p className="text-[8px] text-rose-500 font-bold uppercase tracking-widest mb-2 text-center">TOTAL CREDITS POST</p>
                        <p className="text-2xl font-black text-rose-500">
                          {viewCurrency === Currency.PKR ? 'Rs. ' : 'SAR '} 
                          {getConvertedVal(totalVisibleCredit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                    </div>
                    <div className="flex flex-col items-center">
                        <p className="text-[8px] text-emerald-500 font-bold uppercase tracking-widest mb-2 text-center">TOTAL DEBITS POST</p>
                        <p className="text-2xl font-black text-emerald-500">
                          {viewCurrency === Currency.PKR ? 'Rs. ' : 'SAR '} 
                          {getConvertedVal(totalVisibleDebit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                    </div>
                 </div>

                 <div className="flex flex-col items-center w-full mt-4">
                    <p className="text-slate-400 text-[10px] uppercase tracking-[0.3em] font-bold mb-4 text-center">NET ACCOUNT BALANCE POSITION</p>
                    <div className="flex items-baseline justify-center space-x-4">
                       <p className="text-4xl md:text-6xl font-black text-[#0f172a] leading-none tracking-tighter text-center">
                         {viewCurrency === Currency.PKR ? 'Rs. ' : 'SAR '}
                         {Math.abs(getConvertedVal(selectedAccount.balance)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                       </p>
                       <span className="font-black uppercase text-xl md:text-2xl text-slate-400 leading-none">{selectedAccount.balance >= 0 ? 'DR' : 'CR'}</span>
                    </div>
                 </div>
              </div>
              
              {/* Signature Section */}
              <div className="w-full mt-24 flex justify-between items-center px-[10mm] pb-10">
                  <div className="flex flex-col items-center">
                    <div className="w-[60mm] h-[0.5mm] bg-slate-100 mb-3"></div>
                    <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">AUTHORIZED SYSTEM SIGNATORY</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-[60mm] h-[0.5mm] bg-slate-100 mb-3"></div>
                    <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">CORPORATE OFFICE STAMP</p>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 no-print">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl p-6 border border-white/10 animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-black font-orbitron text-blue-600 uppercase tracking-tighter mb-4">Register Account Head</h3>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="text-[7px] font-bold text-slate-400 uppercase tracking-widest block mb-1 px-1">Code</label>
                  <input className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 font-mono font-bold text-blue-600 outline-none text-[10px]" placeholder="1101" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="text-[7px] font-bold text-slate-400 uppercase tracking-widest block mb-1 px-1">Title</label>
                  <input required className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 font-bold outline-none uppercase text-[10px]" placeholder="ACCOUNT NAME" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[7px] font-bold text-slate-400 uppercase tracking-widest block mb-1 px-1">Contact No</label>
                  <input className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-bold outline-none" placeholder="CELL #" value={formData.cell} onChange={e => setFormData({...formData, cell: e.target.value})} />
                </div>
                <div>
                  <label className="text-[7px] font-bold text-slate-400 uppercase tracking-widest block mb-1 px-1">Location</label>
                  <input className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-[10px] font-bold outline-none uppercase" placeholder="CITY" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
                </div>
              </div>

              <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-xl space-y-2">
                <label className="text-[8px] font-black text-blue-600 uppercase tracking-widest block px-1">Opening Balance (PKR)</label>
                <div className="flex items-center space-x-2">
                  <input type="number" step="0.01" className="flex-1 bg-white dark:bg-slate-800 rounded-lg p-2 font-bold text-xs outline-none" value={formData.openingBalance} onChange={e => setFormData({...formData, openingBalance: Number(e.target.value)})} />
                  <div className="flex bg-slate-200 dark:bg-slate-700 p-0.5 rounded-lg">
                    <button type="button" onClick={() => setFormData({...formData, balanceType: 'dr'})} className={`px-2 py-1 rounded-md text-[8px] font-black uppercase transition-all ${formData.balanceType === 'dr' ? 'bg-white dark:bg-slate-600 text-blue-600 shadow-sm' : 'text-slate-500'}`}>DR</button>
                    <button type="button" onClick={() => setFormData({...formData, balanceType: 'cr'})} className={`px-2 py-1 rounded-md text-[8px] font-black uppercase transition-all ${formData.balanceType === 'cr' ? 'bg-white dark:bg-slate-600 text-rose-500 shadow-sm' : 'text-slate-500'}`}>CR</button>
                  </div>
                </div>
              </div>
              <div className="flex space-x-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg font-bold uppercase text-[8px] tracking-widest">Discard</button>
                <button type="submit" disabled={isSubmitting} className="flex-[2] py-2 bg-blue-600 text-white rounded-lg font-bold uppercase text-[8px] tracking-[0.2em] shadow-lg shadow-blue-500/20 active:scale-95 transition-all">Register Head</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ledger;