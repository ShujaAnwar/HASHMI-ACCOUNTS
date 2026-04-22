  import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
  import { Account, AccountType, Voucher, Currency, AppConfig, VoucherType } from '../types';
  import { formatCurrency, formatDate } from '../utils/format';
import DateInput from './DateInput';
  import { AccountingService } from '../services/AccountingService';
  import { getAccounts, getVouchers, getConfig } from '../services/db';
  import { supabase } from '../services/supabase';

  interface LedgerProps {
    config: AppConfig;
    refreshKey?: number;
    type?: AccountType;
    onEditVoucher: (v: Voucher) => void;
    onViewVoucher?: (v: Voucher) => void;
    initialAccountId?: string | null;
    clearInitialAccount?: () => void;
  }

  const Ledger: React.FC<LedgerProps> = ({ config, refreshKey, type, onEditVoucher, onViewVoucher, initialAccountId, clearInitialAccount }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [formMode, setFormMode] = useState<'CREATE' | 'EDIT'>('CREATE');
    const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);
    const [accountList, setAccountList] = useState<Account[]>([]);
    const [allAccountsForCode, setAllAccountsForCode] = useState<Account[]>([]);
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    
    const [viewCurrency, setViewCurrency] = useState<Currency>(Currency.PKR);
    const [fromDate, setFromDate] = useState<string>('');
    const [toDate, setToDate] = useState<string>('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none');
    const pdfRef = useRef<HTMLDivElement>(null);

    const [formData, setFormData] = useState<any>({ 
      name: '', cell: '', location: '', code: '', openingBalance: 0, 
      balanceType: type === AccountType.CUSTOMER ? 'dr' : 'cr',
      currency: Currency.PKR,
      type: type || AccountType.CASH_BANK
    });

    const refreshAccountList = useCallback(async () => {
      const data = await getAccounts();
      setAllAccountsForCode(data);
      const filtered = type ? data.filter(a => a.type === type) : data;
      setAccountList(filtered);
      
      setSelectedAccount(prev => {
        if (!prev) return null;
        return data.find(a => a.id === prev.id) || null;
      });
    }, [type]);

    useEffect(() => {
      getVouchers().then(setVouchers);
    }, []);

    useEffect(() => {
      setSelectedAccount(null);
      setSearchTerm('');
      refreshAccountList();
    }, [type, refreshAccountList]);

    useEffect(() => {
      if (initialAccountId && accountList.length > 0) {
        const acc = accountList.find(a => a.id === initialAccountId);
        if (acc) {
          setSelectedAccount(acc);
          clearInitialAccount?.();
        }
      }
    }, [initialAccountId, accountList, clearInitialAccount]);

    useEffect(() => {
      refreshAccountList();
      getVouchers().then(setVouchers);
    }, [refreshKey, refreshAccountList]);

    const generateNextCode = useCallback((targetType?: AccountType) => {
      if (!targetType) return '';
      const prefix = targetType === AccountType.CUSTOMER ? '11' : '21';
      const existing = allAccountsForCode.filter(a => a.code?.startsWith(prefix));
      if (existing.length === 0) return `${prefix}01`;
      const codes = existing.map(a => parseInt(a.code || '0')).filter(n => !isNaN(n));
      return (Math.max(...codes) + 1).toString();
    }, [allAccountsForCode]);

    const handleEditAccount = (acc: Account) => {
      setFormMode('EDIT');
      setAccountToEdit(acc);
      
      const obEntry = acc.ledger?.find(e => e.description === 'Opening Balance (Initial Measurement)');
      
      setFormData({
        name: acc.name,
        cell: acc.cell || '',
        location: acc.location || '',
        code: acc.code || '',
        openingBalance: obEntry ? (obEntry.debit || obEntry.credit) : 0,
        balanceType: obEntry ? (obEntry.debit > 0 ? 'dr' : 'cr') : (acc.balance >= 0 ? 'dr' : 'cr'),
        currency: acc.currency || Currency.PKR
      });
      setShowAddModal(true);
    };

    const handleCloneAccount = (acc: Account) => {
      setFormMode('CREATE');
      setAccountToEdit(null);
      setFormData({
        name: `${acc.name} (Clone)`,
        cell: acc.cell || '',
        location: acc.location || '',
        code: generateNextCode(type),
        openingBalance: 0,
        balanceType: type === AccountType.CUSTOMER ? 'dr' : 'cr',
        currency: acc.currency || Currency.PKR
      });
      setShowAddModal(true);
    };

    const handleDeleteAccount = async (id: string) => {
      if (window.confirm('Delete account head? This will purge all transaction history associated with this ID.')) {
        try {
          await AccountingService.deleteAccount(id);
          await refreshAccountList();
        } catch (err: any) {
          alert(`Deletion Error: ${err.message}`);
        }
      }
    };

    const filteredAccounts = useMemo(() => {
      let result = [...accountList];
      
      if (searchTerm) {
        const lowSearch = searchTerm.toLowerCase();
        result = result.filter(a => 
          a.name.toLowerCase().includes(lowSearch) || 
          a.code?.includes(searchTerm)
        );
      }

      if (sortOrder === 'asc') {
        result.sort((a, b) => a.balance - b.balance);
      } else if (sortOrder === 'desc') {
        result.sort((a, b) => b.balance - a.balance);
      }

      return result;
    }, [accountList, searchTerm, sortOrder]);

    const listStats = useMemo(() => {
      const count = filteredAccounts.length;
      const totalBalance = filteredAccounts.reduce((sum, acc) => sum + acc.balance, 0);
      return { count, totalBalance };
    }, [filteredAccounts]);

    const currentROE = config?.defaultROE || 74.5;

    const getConvertedVal = useCallback((val: number, roeOverride?: number) => {
      if (viewCurrency === Currency.PKR) return val;
      const roe = roeOverride || currentROE;
      return val / (roe || 1);
    }, [viewCurrency, currentROE]);

    const getNarrativeForLedger = (entry: any, voucher: Voucher | undefined) => {
      // Prioritize the stored description if it's already detailed or exists
      if (entry.description && entry.description !== '-' && entry.description.trim() !== '') {
        return entry.description;
      }

      if (!voucher || !voucher.details) return entry.description || '-';
      
      if (voucher.type === VoucherType.HOTEL) {
        const items = voucher.details.items || [];
        const firstItem = items[0] || {};
        
        const pax = (voucher.details.paxName || firstItem.paxName || 'N/A').toUpperCase();
        const hotel = (firstItem.hotelName || voucher.details.hotelName || 'N/A').toUpperCase();
        const ci = firstItem.fromDate || voucher.details.fromDate || '-';
        const co = firstItem.toDate || voucher.details.toDate || '-';
        const nights = firstItem.numNights || voucher.details.numNights || '0';
        const mealsRaw = firstItem.meals || voucher.details.meals;
        const meals = Array.isArray(mealsRaw) 
          ? mealsRaw.join(', ') 
          : (mealsRaw && mealsRaw !== 'NONE' ? mealsRaw : 'N/A');
        
        return `${pax} | ${hotel} | Checkin: ${ci} | Checkout: ${co} | Nights: ${nights} | Meals: ${meals}`;
      }

      if (voucher.type === VoucherType.TRANSPORT) {
        const tPax = (voucher.details.paxName || '-').toUpperCase();
        const sector = (voucher.details.items?.[0]?.sector || 'N/A').toUpperCase();
        const vehicle = (voucher.details.items?.[0]?.vehicle || 'N/A').toUpperCase();
        return `${tPax} | ${sector} | ${vehicle}`;
      }

      if (voucher.type === VoucherType.VISA) {
        return entry.description || 'VISA PROCESSING';
      }

      if (voucher.type === VoucherType.TICKET) {
        const pax = (voucher.details.paxName || 'N/A').toUpperCase();
        const airline = (voucher.details.airline || 'N/A').toUpperCase();
        const sector = (voucher.details.sector || 'N/A').toUpperCase();
        const pnr = (voucher.reference || 'N/A').toUpperCase();
        return `${pax} | ${airline} | ${sector} | PNR: ${pnr}`;
      }
      
      return entry.description && entry.description !== '-' ? entry.description : (voucher.description || '-');
    };

    const ledgerWithRunningBalance = useMemo(() => {
      if (!selectedAccount) return [];
      const sortedLedger = [...selectedAccount.ledger].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        
        // Prioritize Opening Balance if dates are identical
        const isObA = a.description?.includes('Opening Balance');
        const isObB = b.description?.includes('Opening Balance');
        if (isObA && !isObB) return -1;
        if (!isObA && isObB) return 1;
        
        // Use createdAt as secondary sort key for same-day transactions
        if (a.createdAt && b.createdAt) {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        
        // Stable tie-breaker
        return (a.id || '').localeCompare(b.id || '');
      });

      let running = 0;
      const fullLedger = sortedLedger.map(entry => {
        running += (entry.debit - entry.credit);
        return { ...entry, balanceAfter: running };
      });

      if (!fromDate && !toDate) return fullLedger;

      const start = fromDate ? new Date(fromDate).getTime() : 0;
      const end = toDate ? new Date(toDate).getTime() : Infinity;

      const preEntries = fullLedger.filter(e => new Date(e.date).getTime() < start);
      const periodEntries = fullLedger.filter(e => {
        const t = new Date(e.date).getTime();
        return t >= start && t <= end;
      });

      if (preEntries.length === 0) return periodEntries;

      const lastPreEntry = preEntries[preEntries.length - 1];
      const openingBalanceRow = {
        id: 'period-opening',
        date: fromDate,
        description: 'Balance Brought Forward',
        debit: lastPreEntry.balanceAfter > 0 ? lastPreEntry.balanceAfter : 0,
        credit: lastPreEntry.balanceAfter < 0 ? Math.abs(lastPreEntry.balanceAfter) : 0,
        balanceAfter: lastPreEntry.balanceAfter,
        isOpening: true
      };

      return [openingBalanceRow, ...periodEntries];
    }, [selectedAccount, fromDate, toDate]);

    const handleDownloadPDF = async () => {
      if (!pdfRef.current || !selectedAccount) return;
      
      setIsExporting(true);
      const element = pdfRef.current;
      const fileName = `Ledger_${selectedAccount.name.replace(/\s+/g, '_')}_${formatDate(new Date())}.pdf`;
      
      const opt = {
        margin: 0,
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          backgroundColor: '#ffffff',
          width: 1122, 
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
        pagebreak: { mode: ['css', 'legacy'] }
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

    const handleWhatsAppShare = async () => {
      if (!pdfRef.current || !selectedAccount) return;
      
      setIsSharing(true);
      const element = pdfRef.current;
      const fileName = `Ledger_${selectedAccount.name.replace(/\s+/g, '_')}_${formatDate(new Date())}.pdf`;
      
      const opt = {
        margin: 0,
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          backgroundColor: '#ffffff',
          width: 1122, 
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
        pagebreak: { mode: ['css', 'legacy'] }
      };

      try {
        // @ts-ignore
        const blob = await html2pdf().set(opt).from(element).output('blob');
        const file = new File([blob], fileName, { type: 'application/pdf' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: fileName,
            text: `Please find the attached Ledger for ${selectedAccount.name}.`,
          });
        } else {
          // Fallback for desktop or unsupported browsers
          // Download the file
          // @ts-ignore
          await html2pdf().set(opt).from(element).save();
          
          // Then open WhatsApp
          const message = encodeURIComponent(`I've sent you the Ledger for ${selectedAccount.name}. Please check your downloads and attach the file.`);
          const whatsappUrl = /Android|iPhone|iPad/i.test(navigator.userAgent) 
            ? `whatsapp://send?text=${message}`
            : `https://web.whatsapp.com/send?text=${message}`;
          
          window.open(whatsappUrl, '_blank');
        }
      } catch (err) {
        console.error("WhatsApp Share Error:", err);
      } finally {
        setIsSharing(false);
      }
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
        if (formMode === 'EDIT' && accountToEdit) {
          await AccountingService.updateAccount(accountToEdit.id, formData);
        } else {
          await AccountingService.createAccount(
            formData.name, 
            type || formData.type, 
            formData.cell, 
            formData.location, 
            formData.openingBalance, 
            formData.balanceType === 'dr', 
            formData.code, 
            formData.currency
          );
        }
        setShowAddModal(false);
        await refreshAccountList();
      } catch (err: any) {
        alert(`Error: ${err.message}`);
      } finally { setIsSubmitting(false); }
    };

    const handleRecalculate = async () => {
      try {
        const { error } = await supabase.rpc('recalculate_all_balances');
        if (error) throw error;
        await refreshAccountList();
        alert("Database balances synchronized and recalculated successfully.");
      } catch (err) {
        console.error("Recalculation failed:", err);
        alert("Failed to recalculate balances. Please ensure the SQL script has been run in Supabase.");
      }
    };

    if (!config) return null;

    const totalVisibleDebit = ledgerWithRunningBalance.filter(e => !(e as any).isOpening).reduce((sum, entry) => sum + entry.debit, 0);
    const totalVisibleCredit = ledgerWithRunningBalance.filter(e => !(e as any).isOpening).reduce((sum, entry) => sum + entry.credit, 0);
    const totalTransactions = ledgerWithRunningBalance.filter(e => e.voucherId).length;

    return (
      <div className="space-y-6 max-w-full">
        {!selectedAccount ? (
          <>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
              <div className="relative flex-1 max-w-sm w-full">
                <input 
                  type="text" 
                  placeholder={`Search ${type ? type.toLowerCase() + 's' : 'all accounts'}...`} 
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 pl-10 outline-none shadow-sm text-sm focus:ring-2 focus:ring-blue-500/20 transition-all" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
                <span className="absolute left-3.5 top-3.5 text-sm opacity-40">🔍</span>
              </div>
              
              {/* Sorting Controls */}
              <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm no-print">
                <button 
                  onClick={() => setSortOrder('none')}
                  className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${sortOrder === 'none' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Default
                </button>
                <button 
                  onClick={() => setSortOrder('asc')}
                  className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${sortOrder === 'asc' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Asc ⬆️
                </button>
                <button 
                  onClick={() => setSortOrder('desc')}
                  className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${sortOrder === 'desc' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Desc ⬇️
                </button>
              </div>
              
              <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                <div className="bg-white dark:bg-slate-900 p-2.5 px-5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center min-w-[90px]">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Heads</p>
                    <p className="text-lg font-orbitron font-bold text-blue-600 leading-none mt-1">{listStats.count}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2.5 px-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center min-w-[160px]">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aggregated Exposure</p>
                    <p className="text-lg font-orbitron font-bold text-slate-800 dark:text-white leading-none mt-1">
                      {formatCurrency(listStats.totalBalance)}
                      <span className="text-[10px] font-sans ml-1.5 opacity-50 uppercase font-black">{listStats.totalBalance >= 0 ? 'Dr' : 'Cr'}</span>
                    </p>
                </div>
                <button 
                    onClick={() => { 
                      setFormMode('CREATE'); 
                      setFormData({ 
                        name: '', cell: '', location: '', 
                        code: type ? generateNextCode(type) : '', 
                        openingBalance: 0, 
                        balanceType: type === AccountType.CUSTOMER ? 'dr' : 'cr', 
                        currency: Currency.PKR,
                        type: type || AccountType.CASH_BANK
                      });
                      setShowAddModal(true); 
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-black shadow-lg shadow-blue-500/20 uppercase tracking-widest text-[11px] transition-all active:scale-95 whitespace-nowrap"
                  >
                    + Create {type ? (type === AccountType.CUSTOMER ? 'Customer' : 'Vendor') : 'Account'} Head
                  </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm no-print overflow-x-auto">
              <table className="w-full text-left table-auto">
                <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 text-[10px] uppercase tracking-[0.2em] font-black border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-8 py-6 w-32">G/L Code</th>
                    <th className="px-8 py-6">Account Designation</th>
                    <th className="px-8 py-6">Origin/Location</th>
                    <th className="px-8 py-6 text-right flex items-center justify-end space-x-2">
                      <span>Balance Position (PKR)</span>
                      <span className="text-[8px] opacity-30">
                        {sortOrder === 'asc' ? '⬆️' : sortOrder === 'desc' ? '⬇️' : '↕️'}
                      </span>
                    </th>
                    <th className="px-8 py-6 text-center">Command</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredAccounts.map((acc) => (
                    <tr 
                      key={acc.id} 
                      className="group hover:bg-blue-50/10 dark:hover:bg-blue-900/10 transition-all cursor-pointer" 
                      onClick={() => setSelectedAccount(acc)}
                    >
                      <td className="px-8 py-7 font-mono text-[13px] font-bold text-blue-600 group-hover:scale-110 origin-left transition-transform">{acc.code || '-'}</td>
                      <td className="px-8 py-7">
                        <p className="font-black text-slate-800 dark:text-white text-base leading-none tracking-tight">{acc.name}</p>
                        {acc.cell && <p className="text-[10px] text-slate-400 font-bold mt-1.5 uppercase tracking-widest">{acc.cell}</p>}
                      </td>
                      <td className="px-8 py-7 text-[12px] text-slate-500 dark:text-slate-400 font-bold uppercase leading-none tracking-wide">{acc.location || '-'}</td>
                      <td className="px-8 py-7 text-right">
                        <p className="font-orbitron font-black text-lg text-slate-900 dark:text-white tracking-tighter">
                          {formatCurrency(acc.balance)}
                          <span className="text-[11px] font-sans ml-2 opacity-40 uppercase font-black">{acc.balance >= 0 ? 'Dr' : 'Cr'}</span>
                        </p>
                      </td>
                      <td className="px-8 py-7">
                        <div className="flex justify-center items-center space-x-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleEditAccount(acc); }}
                            className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-amber-500 hover:text-white transition-all text-xs"
                            title="Edit Profile"
                          >✏️</button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleCloneAccount(acc); }}
                            className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-indigo-600 hover:text-white transition-all text-xs"
                            title="Clone Profile"
                          >👯</button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteAccount(acc.id); }}
                            className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-rose-600 hover:text-white transition-all text-xs"
                            title="Delete Profile"
                          >🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredAccounts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs italic">
                        No matching account profiles found.
                      </td>
                    </tr>
                  )}
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
                <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border dark:border-slate-700 shadow-inner">
                  <div className="flex flex-col px-1">
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">From Date (DD-MM-YYYY)</span>
                    <DateInput 
                      className="bg-transparent border-none text-[10px] font-bold outline-none text-slate-700 dark:text-slate-200 p-0 h-5 w-24"
                      value={fromDate}
                      onChange={val => setFromDate(val)}
                    />
                  </div>
                  <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                  <div className="flex flex-col px-1">
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">To Date (DD-MM-YYYY)</span>
                    <DateInput 
                      className="bg-transparent border-none text-[10px] font-bold outline-none text-slate-700 dark:text-slate-200 p-0 h-5 w-24"
                      value={toDate}
                      onChange={val => setToDate(val)}
                    />
                  </div>
                  {(fromDate || toDate) && (
                    <button 
                      onClick={() => { setFromDate(''); setToDate(''); }}
                      className="ml-1 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                      title="Clear Filters"
                    >
                      <span className="text-xs">✕</span>
                    </button>
                  )}
                </div>

                <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg shadow-inner">
                  <button onClick={() => setViewCurrency(Currency.PKR)} className={`px-2 py-1 rounded-md text-[7px] font-black uppercase transition-all ${viewCurrency === Currency.PKR ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}>PKR</button>
                  <button onClick={() => setViewCurrency(Currency.SAR)} className={`px-2 py-1 rounded-md text-[7px] font-black uppercase transition-all ${viewCurrency === Currency.SAR ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}>SAR</button>
                </div>
                <button 
                  onClick={handleRecalculate}
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase shadow-sm transition-all active:scale-95"
                  title="Sync & Recalculate Balances"
                >
                  Sync DB
                </button>
                <button 
                  onClick={handleDownloadPDF} 
                  disabled={isExporting}
                  className="px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-[8px] font-black uppercase shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {isExporting ? 'Preparing...' : 'Export PDF'}
                </button>
                <button 
                  onClick={handleWhatsAppShare} 
                  disabled={isSharing}
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-[8px] font-black uppercase shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSharing ? 'Sharing...' : 'Share WhatsApp'}
                </button>
              </div>
            </div>

            <div className="flex justify-center items-start py-6 bg-slate-100/30 dark:bg-slate-950/20 rounded-xl overflow-x-auto min-h-screen">
              <div 
                ref={pdfRef} 
                className="bg-white text-[#0f172a] font-inter w-[297mm] mx-auto p-[5mm] box-border overflow-visible flex flex-col items-center"
                style={{ minHeight: 'auto', width: '297mm', position: 'relative', margin: '0 auto' }}
              >
                <div className="w-full mb-4 flex flex-col items-center text-center">
                  <h1 className="text-[32px] font-black tracking-tighter uppercase leading-none text-[#0f172a] mb-1">
                    {config.companyName}
                  </h1>
                  <div className="flex items-center justify-center text-[8px] font-bold text-slate-400 tracking-[0.2em] uppercase w-full">
                    <span>CONTACT: {config.companyCell}</span>
                    <span className="mx-6 opacity-30">|</span>
                    <span>EMAIL: {config.companyEmail}</span>
                  </div>
                </div>

                <div className="w-full mb-4 border-t border-slate-100 pt-4 flex flex-col items-center text-center">
                  <h2 className="text-[18px] font-black uppercase text-[#0f172a] tracking-tight mb-0.5">
                    {type ? (type === AccountType.VENDOR ? 'VENDOR' : 'CUSTOMER') : 'GENERAL'} LEDGER STATEMENT
                  </h2>
                  <p className="text-[12px] font-black text-slate-700 tracking-tight leading-none uppercase">
                    ACCOUNT: {selectedAccount.name} ({selectedAccount.code || 'N/A'})
                  </p>
                  <p className="text-[7px] text-slate-300 font-bold uppercase tracking-[0.2em] mt-1">
                    PERIOD: {fromDate ? formatDate(fromDate) : 'START'} TO {toDate ? formatDate(toDate) : 'END'}
                    <span className="mx-4">|</span>
                    PRINT DATE: {formatDate(new Date())} {new Date().toLocaleTimeString()}
                  </p>
                </div>

                <div className="w-full mb-6">
                  <table className="w-full text-left border-collapse table-auto mx-auto" style={{ pageBreakInside: 'auto' }}>
                      <thead className="bg-[#0f172a] text-white text-[10px] uppercase font-black tracking-wider" style={{ display: 'table-header-group' }}>
                        <tr>
                          <th className="px-1 py-3 text-center w-[80px]">DATE</th>
                          <th className="px-1 py-3 text-center w-[80px]" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>REF #</th>
                          <th className="px-1 py-3 text-center w-[40px]">TYPE</th>
                          <th className="px-2 py-3 min-w-[300px]">TRANSACTION NARRATION</th>
                          <th className="px-1 py-3 text-center w-[80px]">RATE(SAR)</th>
                          <th className="px-1 py-3 text-center w-[60px]">NIGHTS</th>
                          <th className="px-1 py-3 text-center w-[60px]">ROE</th>
                          <th className="px-1 py-3 text-right w-[100px]">DEBIT</th>
                          <th className="px-1 py-3 text-right w-[100px]">CREDIT</th>
                          <th className="px-2 py-3 text-right w-[120px]">ACCUMULATED BALANCE</th>
                        </tr>
                      </thead>
                      <tbody className="text-[11px] font-medium text-slate-600">
                        {ledgerWithRunningBalance.map((entry, i) => {
                          const voucher = vouchers.find(v => v.id === entry.voucherId);
                          const displayVNum = voucher?.voucherNum || entry.voucherNum || '-';
                          const displayDescription = getNarrativeForLedger(entry, voucher);
                          const displayType = voucher?.type || ((entry.description?.includes('Opening') || (entry as any).isOpening) ? 'OP' : '-');
                          
                          const itemRoe = voucher?.roe || currentROE;
                          const isSar = voucher?.currency === Currency.SAR;

                          return (
                            <tr key={i} className={`border-b border-slate-50 ${(entry as any).isOpening ? 'bg-slate-50/50' : ''}`} style={{ pageBreakInside: 'avoid', pageBreakAfter: 'auto' }}>
                              <td className="px-1 py-2 text-center font-bold text-slate-400">
                                {(entry as any).isOpening ? '-' : (entry.date === '-' ? '-' : formatDate(entry.date))}
                              </td>
                              <td className="px-1 py-2 text-center" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                {voucher ? (
                                  <button 
                                    onClick={(e) => {
                                      e.preventDefault();
                                      onEditVoucher?.(voucher);
                                    }}
                                    className="font-black text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-center uppercase"
                                    style={{ 
                                      background: 'none', 
                                      border: 'none', 
                                      padding: 0, 
                                      whiteSpace: 'normal', 
                                      fontSize: 'inherit',
                                      wordBreak: 'break-word',
                                      overflowWrap: 'break-word',
                                      maxWidth: '100%'
                                    }}
                                  >
                                    {displayVNum}
                                  </button>
                                ) : (
                                  <span className="font-bold text-slate-400 uppercase">{displayVNum}</span>
                                )}
                              </td>
                              <td className="px-1 py-2 text-center uppercase font-bold text-slate-400 text-[9px]">
                                {displayType}
                              </td>
                              <td className="px-3 py-3 uppercase leading-normal font-bold text-slate-800 text-[10px]" style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                {displayDescription}
                              </td>
                              <td className="px-1 py-2 text-center font-bold text-slate-400">
                                {isSar ? (voucher?.details?.unitRate || (entry.debit + entry.credit) / (voucher?.roe || 1)).toLocaleString(undefined, { minimumFractionDigits: 0 }) : '-'}
                              </td>
                              <td className="px-1 py-2 text-center font-bold text-slate-400">
                                {voucher?.type === VoucherType.HOTEL ? (voucher.details?.items?.[0]?.numNights || voucher.details?.numNights || '-') : '-'}
                              </td>
                              <td className="px-1 py-2 text-center font-bold text-slate-400">
                                {isSar ? itemRoe : '-'}
                              </td>
                              <td className="px-1 py-2 text-right font-black text-slate-900">
                                {entry.debit > 0 ? getConvertedVal(entry.debit, itemRoe).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'}
                              </td>
                              <td className="px-1 py-2 text-right font-black text-slate-900">
                                {entry.credit > 0 ? getConvertedVal(entry.credit, itemRoe).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'}
                              </td>
                              <td className="px-2 py-2 text-right font-black text-slate-900">
                                {formatCurrency(getConvertedVal(entry.balanceAfter))}
                                <span className="ml-0.5 text-[8px] opacity-40 uppercase">{entry.balanceAfter >= 0 ? 'DR' : 'CR'}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="text-[#0f172a] font-black text-[11px] uppercase" style={{ display: 'table-header-group' }}>
                        <tr>
                          <td colSpan={7} className="px-4 py-4 text-right font-black tracking-tight border-t-2 border-slate-900">TOTAL FOR PERIOD:</td>
                          <td className="px-1 py-4 text-right text-emerald-700 bg-slate-50/50 border-t-2 border-slate-900">
                            {getConvertedVal(totalVisibleDebit).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-1 py-4 text-right text-rose-700 bg-slate-50/50 border-t-2 border-slate-900">
                            {getConvertedVal(totalVisibleCredit).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-2 py-4 text-right bg-slate-50 border-t-2 border-slate-900">
                            {formatCurrency(getConvertedVal(ledgerWithRunningBalance.length > 0 ? ledgerWithRunningBalance[ledgerWithRunningBalance.length - 1].balanceAfter : selectedAccount.balance))}
                            <span className="ml-1 text-[8px] opacity-50">
                              {(ledgerWithRunningBalance.length > 0 ? ledgerWithRunningBalance[ledgerWithRunningBalance.length - 1].balanceAfter : selectedAccount.balance) >= 0 ? 'DR' : 'CR'}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                  </table>
                </div>

                <div 
                  className="w-full bg-[#fcfdff] p-8 rounded-[2rem] border border-slate-100 flex flex-col items-center mt-4 mx-auto" 
                  style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                >
                  <h3 className="text-[10px] font-black text-[#0f172a] uppercase tracking-[0.3em] mb-8 text-center">FINANCIAL POSITION SUMMARY</h3>
                  
                  <div className="grid grid-cols-3 gap-8 w-full mb-8">
                      <div className="flex flex-col items-center">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 text-center">ACCOUNT TRANSACTIONS</p>
                          <p className="text-xl font-black text-[#0f172a]">{totalTransactions}</p>
                      </div>
                      <div className="flex flex-col items-center">
                          <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest mb-1 text-center">TOTAL CREDITS</p>
                          <p className="text-xl font-black text-rose-600">
                            {viewCurrency === Currency.PKR ? 'Rs. ' : 'SAR '} 
                            {getConvertedVal(totalVisibleCredit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </p>
                      </div>
                      <div className="flex flex-col items-center">
                          <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mb-1 text-center">TOTAL DEBITS</p>
                          <p className="text-xl font-black text-emerald-600">
                            {viewCurrency === Currency.PKR ? 'Rs. ' : 'SAR '} 
                            {getConvertedVal(totalVisibleDebit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </p>
                      </div>
                  </div>

                  <div className="flex flex-col items-center w-full text-center">
                      <p className="text-slate-400 text-[11px] uppercase tracking-[0.2em] font-bold mb-3">NET ACCOUNT BALANCE POSITION</p>
                      <div className="flex items-baseline justify-center space-x-3">
                        <p className="text-4xl font-black text-[#0f172a] leading-none tracking-tighter uppercase">
                          {viewCurrency === Currency.PKR ? 'Rs. ' : 'SAR '}
                          {formatCurrency(getConvertedVal(ledgerWithRunningBalance.length > 0 ? ledgerWithRunningBalance[ledgerWithRunningBalance.length - 1].balanceAfter : selectedAccount.balance))}
                        </p>
                        <span className="font-black uppercase text-lg text-slate-300 leading-none">
                          {(ledgerWithRunningBalance.length > 0 ? ledgerWithRunningBalance[ledgerWithRunningBalance.length - 1].balanceAfter : selectedAccount.balance) >= 0 ? 'DR' : 'CR'}
                        </span>
                      </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 no-print">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl p-6 border border-white/10 animate-in zoom-in-95 duration-200">
              <h3 className="text-sm font-black font-orbitron text-blue-600 uppercase tracking-tighter mb-4">
                {formMode === 'EDIT' ? 'Update' : 'Register'} Account Head
              </h3>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                {!type && formMode === 'CREATE' && (
                  <div>
                    <label className="text-[7px] font-bold text-slate-400 uppercase tracking-widest block mb-1 px-1">Account Type</label>
                    <select 
                      className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 font-bold outline-none text-[10px]"
                      value={formData.type}
                      onChange={e => setFormData({...formData, type: e.target.value as AccountType})}
                    >
                      {Object.values(AccountType).map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label className="text-[7px] font-bold text-slate-400 uppercase tracking-widest block mb-1 px-1">Code</label>
                    <input className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 font-mono font-bold text-blue-600 outline-none text-[10px]" placeholder="1101" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[7px] font-bold text-slate-400 uppercase tracking-widest block mb-1 px-1">Title</label>
                    <input required className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 font-bold outline-none text-[10px]" placeholder="Account Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
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
                    <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
                      <button type="button" onClick={() => setFormData({...formData, balanceType: 'dr'})} className={`px-2 py-1 rounded-md text-[8px] font-black uppercase transition-all ${formData.balanceType === 'dr' ? 'bg-white dark:bg-slate-600 text-blue-600 shadow-sm' : 'text-slate-500'}`}>DR</button>
                      <button type="button" onClick={() => setFormData({...formData, balanceType: 'cr'})} className={`px-2 py-1 rounded-md text-[8px] font-black uppercase transition-all ${formData.balanceType === 'cr' ? 'bg-white dark:bg-slate-600 text-rose-500 shadow-sm' : 'text-slate-500'}`}>CR</button>
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg font-bold uppercase text-[8px] tracking-widest">Discard</button>
                  <button type="submit" disabled={isSubmitting} className="flex-[2] py-2 bg-blue-600 text-white rounded-lg font-bold uppercase text-[8px] tracking-[0.2em] shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                    {formMode === 'EDIT' ? 'Update Head' : 'Register Head'}
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