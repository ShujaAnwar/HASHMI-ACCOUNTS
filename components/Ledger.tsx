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

  const getConvertedVal = (val: number, roe: number = currentROE) => {
    if (viewCurrency === Currency.PKR) return val;
    return val / (roe || 1);
  };

  const getNarrativeForLedger = (entry: any, voucher: Voucher | undefined) => {
    if (!voucher || !voucher.details) return entry.description || '-';
    
    if (voucher.type === VoucherType.HOTEL) {
      const pax = voucher.details.paxName || 'N/A';
      const hotel = voucher.details.hotelName || 'N/A';
      const ci = voucher.details.fromDate || '-';
      const co = voucher.details.toDate || '-';
      const rb = voucher.details.numRooms || '0';
      const ngt = voucher.details.numNights || '0';
      const loc = voucher.details.city || 'N/A';
      const countrySuffix = (loc.toLowerCase().includes('makkah') || loc.toLowerCase().includes('madinah') || loc.toLowerCase().includes('jeddah')) ? ' -KSA' : '';
      
      return `${pax.toUpperCase()} | ${hotel.toUpperCase()} |Checkin: ${ci} | Checkout: ${co} | R/B: ${rb} | Nights:${ngt} | ${loc.toUpperCase()}${countrySuffix}`;
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
      margin: 0,
      filename: fileName,
      image: { type: 'jpeg', quality: 1.0 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        letterRendering: true, 
        backgroundColor: '#ffffff',
        logging: false,
        scrollY: 0,
        windowWidth: 1600 
      },
      jsPDF: { unit: 'mm', format: 'a3', orientation: 'landscape' },
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
    <div className="space-y-6">
      {!selectedAccount ? (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 no-print">
            <div className="relative flex-1 max-w-lg w-full">
              <input type="text" placeholder="Filter profiles..." className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 pl-12 outline-none shadow-sm text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <span className="absolute left-4 top-4 text-xl opacity-40">🔍</span>
            </div>
            
            <div className="flex gap-4 w-full md:w-auto">
               <div className="bg-white dark:bg-slate-900 p-4 px-8 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center min-w-[140px]">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total {type === AccountType.CUSTOMER ? 'Customers' : 'Vendors'}</p>
                  <p className="text-2xl font-orbitron font-bold text-blue-600">{listStats.count}</p>
               </div>
               <div className="bg-white dark:bg-slate-900 p-4 px-8 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center min-w-[200px]">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Aggregate Balance</p>
                  <p className="text-2xl font-orbitron font-bold text-slate-800 dark:text-white">
                    {Math.abs(listStats.totalBalance).toLocaleString()}
                    <span className="text-xs font-sans ml-1 opacity-50 uppercase">{listStats.totalBalance >= 0 ? 'Dr' : 'Cr'}</span>
                  </p>
               </div>
               <button 
                  onClick={() => { 
                    setFormMode('CREATE'); 
                    setFormData({ name: '', cell: '', location: '', code: generateNextCode(type), openingBalance: 0, balanceType: type === AccountType.CUSTOMER ? 'dr' : 'cr', currency: Currency.PKR });
                    setShowAddModal(true); 
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-blue-500/20 uppercase tracking-widest text-[11px] transition-all active:scale-95"
                >
                  + Create New Head
                </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-xl no-print">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 text-[10px] uppercase tracking-widest font-black">
                <tr>
                  <th className="px-8 py-6">Code</th>
                  <th className="px-8 py-6">Account Name</th>
                  <th className="px-8 py-6">Currency</th>
                  <th className="px-8 py-6 text-right">Balance (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAccounts.map((acc) => (
                  <tr key={acc.id} className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all cursor-pointer" onClick={() => setSelectedAccount(acc)}>
                    <td className="px-8 py-6 font-mono text-xs font-bold text-blue-600">{acc.code || '-'}</td>
                    <td className="px-8 py-6 font-black text-slate-800 dark:text-white uppercase text-sm">{acc.name}</td>
                    <td className="px-8 py-6"><span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase">{acc.currency || 'PKR'}</span></td>
                    <td className="px-8 py-6 text-right font-orbitron font-black text-lg">
                      {Math.abs(acc.balance).toLocaleString()}
                      <span className="text-[10px] font-sans ml-1 opacity-40 uppercase">{acc.balance >= 0 ? 'Dr' : 'Cr'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center mb-6 no-print bg-white dark:bg-slate-900 p-6 px-10 rounded-[2.5rem] border shadow-lg">
            <div className="flex items-center space-x-6">
              <button onClick={() => setSelectedAccount(null)} className="w-12 h-12 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 font-black hover:text-blue-600 transition-all shadow-sm">←</button>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white leading-none">{selectedAccount.name}</h2>
                <div className="flex items-center space-x-4 mt-2">
                   <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">GL Code: {selectedAccount.code || 'N/A'}</p>
                   <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg shadow-inner">
                      <button onClick={() => setViewCurrency(Currency.PKR)} className={`px-3 py-1 rounded-md text-[8px] font-black uppercase transition-all ${viewCurrency === Currency.PKR ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}>PKR View</button>
                      <button onClick={() => setViewCurrency(Currency.SAR)} className={`px-3 py-1 rounded-md text-[8px] font-black uppercase transition-all ${viewCurrency === Currency.SAR ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}>SAR View</button>
                   </div>
                </div>
              </div>
            </div>
            <button 
              onClick={handleDownloadPDF} 
              disabled={isExporting}
              className="px-8 py-3 bg-[#0f172a] dark:bg-white text-white dark:text-slate-900 rounded-xl text-[9px] font-black uppercase shadow-md hover:scale-105 transition-all disabled:opacity-50"
            >
              {isExporting ? 'Generating Ultra-Wide PDF...' : 'Export Wide Ledger (A3)'}
            </button>
          </div>

          <div className="flex justify-center items-start py-4 bg-slate-100/50 dark:bg-slate-950/50 rounded-[3rem] overflow-x-auto min-h-screen">
            <div 
              ref={pdfRef} 
              className="bg-white px-[20mm] py-20 text-[#0f172a] font-inter w-[420mm] mx-auto flex flex-col box-border shadow-none transition-transform min-h-fit overflow-visible items-center text-center"
            >
              {/* Header */}
              <div className="w-full mb-12 border-b-2 border-slate-100 pb-12 flex-shrink-0 flex flex-col items-center">
                 <h1 className="text-[64px] font-black tracking-tighter uppercase leading-none text-[#0f172a] mb-6">{config.companyName}</h1>
                 <div className="flex items-center justify-center text-[15px] font-bold text-slate-500 tracking-[0.15em] uppercase w-full">
                   <span>CONTACT: {config.companyCell}</span>
                   <span className="mx-14 opacity-30">|</span>
                   <span>EMAIL: {config.companyEmail}</span>
                 </div>
              </div>

              {/* Title Section */}
              <div className="w-full mb-12 flex-shrink-0 flex flex-col items-center">
                 <h2 className="text-[38px] font-black uppercase text-[#0f172a] tracking-tight mb-6">
                   {type === AccountType.VENDOR ? 'VENDOR' : 'CUSTOMER'} LEDGER STATEMENT
                 </h2>
                 <div className="flex flex-col items-center space-y-3 w-full">
                    <p className="text-[24px] font-black text-slate-800 uppercase tracking-tight">PARTY: {selectedAccount.name} ({selectedAccount.code || 'N/A'})</p>
                    <p className="text-[13px] text-slate-400 font-bold uppercase tracking-[0.5em] opacity-80">
                      GENERATED ON: {new Date().toLocaleString('en-US', { hour12: true })}
                    </p>
                 </div>
              </div>

              {/* Table Body */}
              <div className="w-full flex-1 overflow-visible mb-16 flex justify-center px-4">
                <table className="w-full text-left border-collapse border border-slate-200 table-auto page-break-inside-auto">
                    <thead className="bg-[#0f172a] text-white text-[11px] uppercase font-black tracking-widest">
                      <tr>
                        <th className="px-4 py-6 border-r border-slate-700 text-center min-w-[100px]">DATE</th>
                        <th className="px-4 py-6 border-r border-slate-700 text-blue-400 text-center min-w-[140px]">REF #</th>
                        <th className="px-3 py-6 border-r border-slate-700 text-center min-w-[60px]">TYPE</th>
                        <th className="px-8 py-6 border-r border-slate-700 text-center">TRANSACTION NARRATION</th>
                        <th className="px-3 py-6 border-r border-slate-700 text-right min-w-[120px]">RATE(SAR)</th>
                        <th className="px-3 py-6 border-r border-slate-700 text-center min-w-[60px]">ROE</th>
                        <th className="px-4 py-6 border-r border-slate-700 text-right min-w-[140px]">DEBIT</th>
                        <th className="px-4 py-6 border-r border-slate-700 text-right min-w-[140px]">CREDIT</th>
                        <th className="px-4 py-6 text-right min-w-[160px]">BALANCE</th>
                      </tr>
                    </thead>
                    <tbody className="text-[12px] font-medium text-slate-700">
                      {ledgerWithRunningBalance.map((entry, i) => {
                        const voucher = vouchers.find(v => v.id === entry.voucherId || (entry.voucherNum !== '-' && v.voucherNum === entry.voucherNum));
                        const displayVNum = voucher?.voucherNum || entry.voucherNum || '-';
                        const displayDescription = getNarrativeForLedger(entry, voucher);
                        const displayType = voucher?.type || (entry.description?.includes('Opening') ? 'OP' : '-');
                        const displayROE = voucher?.roe || (viewCurrency === Currency.PKR ? '-' : currentROE);
                        
                        let sarRateVal = voucher?.details?.unitRate || 0;
                        if (voucher?.currency === Currency.PKR) {
                          sarRateVal = sarRateVal / (voucher.roe || 1);
                        }

                        return (
                          <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'} break-inside-avoid`}>
                            <td className="px-4 py-4 whitespace-nowrap text-slate-500 font-bold text-center">
                              {entry.date === '-' ? '-' : new Date(entry.date).toLocaleDateString('en-GB')}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap font-black text-blue-600 text-center">
                              {displayVNum}
                            </td>
                            <td className="px-3 py-4 text-center uppercase font-bold text-slate-400">{displayType}</td>
                            <td className="px-8 py-4 text-slate-600 italic text-[12px] leading-relaxed font-medium text-center">
                              {displayDescription}
                            </td>
                            <td className="px-3 py-4 text-right font-bold text-slate-600">
                              {sarRateVal > 0 ? sarRateVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '-'}
                            </td>
                            <td className="px-3 py-4 text-center text-slate-400 font-bold">{displayROE}</td>
                            <td className="px-4 py-4 text-right text-emerald-600 font-black">
                              {entry.debit > 0 ? getConvertedVal(entry.debit).toLocaleString(undefined, { minimumFractionDigits: 0 }) : '-'}
                            </td>
                            <td className="px-4 py-4 text-right text-rose-600 font-black">
                              {entry.credit > 0 ? getConvertedVal(entry.credit).toLocaleString(undefined, { minimumFractionDigits: 0 }) : '-'}
                            </td>
                            <td className="px-4 py-4 text-right font-black text-slate-900 whitespace-nowrap">
                              {Math.abs(getConvertedVal(entry.balanceAfter)).toLocaleString(undefined, { minimumFractionDigits: 0 })} 
                              <span className="ml-2 text-[10px] opacity-60 uppercase font-black">{entry.balanceAfter >= 0 ? 'DR' : 'CR'}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 text-slate-900 font-black text-[13px] uppercase">
                      <tr className="border-t-2 border-slate-900">
                        <td colSpan={6} className="px-8 py-6 text-right border border-slate-200">TOTAL FOR PERIOD STATEMENT:</td>
                        <td className="px-4 py-6 text-right border border-slate-200 text-emerald-600 bg-emerald-50/30">
                          {getConvertedVal(totalVisibleDebit).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-6 text-right border border-slate-200 text-rose-600 bg-rose-50/30">
                          {getConvertedVal(totalVisibleCredit).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-6 text-right border border-slate-200 bg-slate-100 font-black">
                           {Math.abs(getConvertedVal(selectedAccount.balance)).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                           <span className="ml-2 text-[10px] opacity-60">{selectedAccount.balance >= 0 ? 'DR' : 'CR'}</span>
                        </td>
                      </tr>
                    </tfoot>
                </table>
              </div>

              {/* Financial Position Summary */}
              <div className="w-full mt-10 bg-[#f8fbff] p-16 rounded-[4rem] border border-slate-100 flex flex-col items-center flex-shrink-0 box-border break-inside-avoid shadow-none overflow-visible px-28">
                 <h3 className="text-[18px] font-black text-[#0f172a] uppercase tracking-[0.6em] mb-14 border-b border-slate-100 pb-5 w-full text-center">FINANCIAL POSITION SUMMARY</h3>
                 
                 <div className="grid grid-cols-3 gap-24 w-full mb-16">
                    <div className="flex flex-col items-center">
                        <p className="text-[14px] text-slate-400 font-bold uppercase tracking-widest mb-3 w-full text-center">Account Transactions</p>
                        <p className="text-4xl font-black text-[#0f172a] w-full text-center">{totalTransactions}</p>
                    </div>
                    <div className="flex flex-col items-center">
                        <p className="text-[14px] text-slate-500 font-bold uppercase tracking-widest mb-3 text-rose-500 w-full text-center">Total Credits Post</p>
                        <p className="text-4xl font-black text-rose-600 w-full text-center">Rs. {getConvertedVal(selectedAccount.ledger.reduce((s,e) => s+e.credit, 0)).toLocaleString(undefined, { minimumFractionDigits: 0 })}</p>
                    </div>
                    <div className="flex flex-col items-center">
                        <p className="text-[14px] text-slate-500 font-bold uppercase tracking-widest mb-3 text-emerald-500 w-full text-center">Total Debits Post</p>
                        <p className="text-4xl font-black text-emerald-600 w-full text-center">Rs. {getConvertedVal(selectedAccount.ledger.reduce((s,e) => s+e.debit, 0)).toLocaleString(undefined, { minimumFractionDigits: 0 })}</p>
                    </div>
                 </div>

                 <div className="flex flex-col items-center pt-14 border-t border-slate-100 w-full">
                    <p className="text-slate-400 text-[15px] uppercase tracking-[0.8em] font-black mb-6 w-full text-center">NET ACCOUNT BALANCE POSITION</p>
                    <div className="flex items-baseline justify-center space-x-12 w-full">
                       <p className="text-[88px] font-black text-[#0f172a] leading-none tracking-tighter">
                         Rs. {Math.abs(getConvertedVal(selectedAccount.balance)).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                       </p>
                       <span className="font-black uppercase text-6xl text-slate-500 leading-none">{selectedAccount.balance >= 0 ? 'DR' : 'CR'}</span>
                    </div>
                 </div>
              </div>
              
              <div className="w-full mt-28 flex justify-between items-center px-32 pt-24 border-t border-slate-50 opacity-30">
                  <div className="text-[15px] font-black uppercase tracking-[0.4em] border-t border-slate-300 pt-6 px-24 text-center">Authorized System Signatory</div>
                  <div className="text-[15px] font-black uppercase tracking-[0.4em] border-t border-slate-300 pt-6 px-24 text-center">Corporate Office Stamp</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 no-print">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl p-10 border border-white/10 animate-in zoom-in-95 duration-300">
            <h3 className="text-3xl font-black font-orbitron text-blue-600 uppercase tracking-tighter mb-8">Register Head</h3>
            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Code</label>
                  <input className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 font-mono font-bold text-blue-600 outline-none" placeholder="1101" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Full Legal Name</label>
                  <input required className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 font-bold outline-none uppercase" placeholder="TITLE" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Contact No</label>
                  <input className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 text-sm font-bold outline-none" placeholder="CELL #" value={formData.cell} onChange={e => setFormData({...formData, cell: e.target.value})} />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Location / City</label>
                  <input className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 text-sm font-bold outline-none uppercase" placeholder="CITY" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
                </div>
              </div>

              <div className="bg-blue-50/50 dark:bg-blue-900/10 p-6 rounded-3xl space-y-4">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest block">Opening Balance (PKR Measurement)</label>
                <div className="flex items-center space-x-4">
                  <input type="number" step="0.01" className="flex-1 bg-white dark:bg-slate-800 rounded-xl p-4 font-bold text-lg" value={formData.openingBalance} onChange={e => setFormData({...formData, openingBalance: Number(e.target.value)})} />
                  <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-xl shadow-inner">
                    <button type="button" onClick={() => setFormData({...formData, balanceType: 'dr'})} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${formData.balanceType === 'dr' ? 'bg-white dark:bg-slate-600 text-blue-600 shadow-sm' : 'text-slate-50'}`}>DR</button>
                    <button type="button" onClick={() => setFormData({...formData, balanceType: 'cr'})} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${formData.balanceType === 'cr' ? 'bg-white dark:bg-slate-600 text-rose-500 shadow-sm' : 'text-slate-50'}`}>CR</button>
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