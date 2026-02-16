import React, { useMemo, useState, useEffect, useRef } from 'react';
import { getAccounts, getVouchers, getConfig } from '../services/db';
import { AccountType, VoucherType, Currency, Account, Voucher, AppConfig } from '../types';

interface ReportsProps {
  onViewVoucher?: (v: Voucher) => void;
  onEditVoucher?: (v: Voucher) => void;
}

const Reports: React.FC<ReportsProps> = ({ onViewVoucher, onEditVoucher }) => {
  const [activeSection, setActiveSection] = useState<'TB' | 'PL' | 'BS' | 'GL'>('TB');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0]; 
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedLedgerId, setSelectedLedgerId] = useState<string>('');

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [accs, vchs, conf] = await Promise.all([
        getAccounts(),
        getVouchers(),
        getConfig()
      ]);
      setAccounts(accs);
      setVouchers(vchs);
      setConfig(conf);
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    
    setIsExporting(true);
    const element = reportRef.current;
    const titleMap = { 'TB': 'Trial_Balance', 'PL': 'Profit_Loss', 'BS': 'Balance_Sheet', 'GL': 'General_Ledger' };
    const sectionName = titleMap[activeSection];
    const fileName = `${sectionName}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    const opt = {
      margin: [10, 10, 10, 10],
      filename: fileName,
      image: { type: 'jpeg', quality: 1.0 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#ffffff',
        logging: false,
        letterRendering: true
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      // @ts-ignore
      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error("PDF Export Error:", err);
      alert("Export failed. Ensure the report has loaded completely.");
    } finally {
      setIsExporting(false);
    }
  };

  const filteredVouchers = useMemo(() => {
    const start = new Date(fromDate).getTime();
    const end = new Date(toDate).getTime() + 86400000;
    return vouchers.filter(v => {
      const vTime = new Date(v.date).getTime();
      return vTime >= start && vTime <= end;
    });
  }, [vouchers, fromDate, toDate]);

  const trialBalance = useMemo(() => {
    let totalDr = 0;
    let totalCr = 0;
    const items = accounts.map(acc => {
      const balance = acc.balance;
      const dr = balance > 0 ? balance : 0;
      const cr = balance < 0 ? Math.abs(balance) : 0;
      totalDr += dr;
      totalCr += cr;
      return { id: acc.id, code: acc.code || 'N/A', name: acc.name, dr, cr };
    }).sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    
    const diff = Math.abs(totalDr - totalCr);
    
    return { items, totalDr, totalCr, diff };
  }, [accounts]);

  const profitLoss = useMemo(() => {
    const income = filteredVouchers
      .filter(v => [VoucherType.HOTEL, VoucherType.TRANSPORT, VoucherType.VISA, VoucherType.TICKET].includes(v.type))
      .reduce((sum, v) => sum + v.totalAmountPKR, 0);
    const expenses = filteredVouchers
      .filter(v => v.type === VoucherType.PAYMENT)
      .reduce((sum, v) => sum + v.totalAmountPKR, 0);
    return { income, expenses, netProfit: income - expenses };
  }, [filteredVouchers]);

  const balanceSheet = useMemo(() => {
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalRevenue = 0;
    let totalExpense = 0;

    const assetItems: Account[] = [];
    const liabilityItems: Account[] = [];
    const equityItems: Account[] = [];

    accounts.forEach(a => {
      const b = a.balance;
      if (a.type === AccountType.CUSTOMER || a.type === AccountType.CASH_BANK) {
        if (b >= 0) { totalAssets += b; assetItems.push(a); }
        else { totalLiabilities += Math.abs(b); liabilityItems.push(a); }
      } else if (a.type === AccountType.VENDOR) {
        if (b <= 0) { totalLiabilities += Math.abs(b); liabilityItems.push(a); }
        else { totalAssets += b; assetItems.push(a); }
      } else if (a.type === AccountType.EQUITY) {
        const equityVal = b < 0 ? Math.abs(b) : -b;
        totalEquity += equityVal;
        equityItems.push(a);
      } else if (a.type === AccountType.REVENUE) {
        totalRevenue += Math.abs(b);
      } else if (a.type === AccountType.EXPENSE) {
        totalExpense += b;
      }
    });

    const netProfit = totalRevenue - totalExpense;
    return { 
      assets: assetItems, 
      liabilities: liabilityItems, 
      equity: equityItems, 
      totalAssets, 
      totalLiabilities, 
      totalEquity, 
      netProfit,
      totalLE: totalLiabilities + totalEquity + netProfit
    };
  }, [accounts]);

  const selectedAccount = useMemo(() => accounts.find(a => a.id === selectedLedgerId), [accounts, selectedLedgerId]);

  // Calculate Running (Accumulated) Balance for the General Ledger
  const glLedgerWithAccumulated = useMemo(() => {
    if (!selectedAccount) return [];
    
    // Sort chronologically
    const sortedEntries = [...selectedAccount.ledger].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let runningTotal = 0;
    return sortedEntries.map(entry => {
      runningTotal += (entry.debit - entry.credit);
      return {
        ...entry,
        accumulatedBalance: runningTotal
      };
    });
  }, [selectedAccount]);

  const navigateToLedger = (id: string) => {
    setSelectedLedgerId(id);
    setActiveSection('GL');
  };

  if (loading || !config) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const ReportHeader = ({ title, subtitle }: { title: string, subtitle: string }) => (
    <div className="border-b-2 border-slate-900 pb-6 mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
      <div>
        <p className="text-blue-600 font-bold text-[10px] uppercase tracking-[0.3em] mb-1">{config.companyName}</p>
        <h2 className="text-3xl md:text-4xl font-orbitron font-bold text-slate-900 uppercase tracking-tighter">{title}</h2>
        <p className="text-slate-400 text-[10px] mt-1 font-bold tracking-[0.2em] uppercase">{subtitle}</p>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reporting Date</p>
        <p className="font-bold text-sm bg-slate-100 px-3 py-1 rounded-lg mt-1 inline-block text-slate-900">
          As of {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      <div className="no-print bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-800 flex flex-wrap items-end gap-6">
        <div className="flex-1 min-w-[200px]"><label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Statement From</label><input type="date" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
        <div className="flex-1 min-w-[200px]"><label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Statement To</label><input type="date" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
        <button 
          onClick={handleExportPDF} 
          disabled={isExporting}
          className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3 rounded-xl font-bold shadow-lg hover:scale-105 transition-all flex items-center space-x-2 border border-white/10 disabled:opacity-50"
        >
          <span>{isExporting ? '⏳' : '📥'}</span> 
          <span className="uppercase text-xs tracking-widest">{isExporting ? 'Generating...' : 'Export Report'}</span>
        </button>
      </div>
      
      <div className="no-print flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
        {[{ id: 'TB', label: 'Trial Balance', icon: '⚖️' }, { id: 'PL', label: 'Profit & Loss', icon: '📊' }, { id: 'BS', label: 'Balance Sheet', icon: '🏛️' }, { id: 'GL', label: 'General Ledger', icon: '📖' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveSection(tab.id as any)} className={`px-6 py-4 rounded-2xl font-bold transition-all flex items-center space-x-3 whitespace-nowrap border-b-4 ${activeSection === tab.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20 border-blue-700 translate-y-[-2px]' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <span className="text-lg">{tab.icon}</span><span className="text-xs uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 min-h-[600px] transition-all relative overflow-hidden">
        <div ref={reportRef} className="bg-white p-8 md:p-14 text-slate-900">
          {activeSection === 'TB' && (
            <div className="animate-in fade-in duration-500">
              <ReportHeader title="Trial Balance" subtitle="Consolidated Account Headings & Codes" />
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="text-slate-400 text-[10px] font-bold uppercase border-b-2 tracking-widest"><th className="py-5 text-left pl-4">Code</th><th className="py-5 text-left">Account Head</th><th className="py-5 text-right">Debit (PKR)</th><th className="py-5 text-right pr-4">Credit (PKR)</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">{trialBalance.items.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors group">
                      <td className="py-4 pl-4 font-mono text-xs font-bold text-blue-600">{item.code}</td>
                      <td className="py-4 font-bold text-slate-700 text-sm">
                        <button 
                          onClick={() => navigateToLedger(item.id)}
                          className="hover:text-blue-600 hover:underline transition-all text-left"
                        >
                          {item.name}
                        </button>
                      </td>
                      <td className="py-4 text-right font-orbitron font-medium">
                        {item.dr > 0 ? (
                          <button 
                            onClick={() => navigateToLedger(item.id)}
                            className="text-emerald-600 hover:text-emerald-800 hover:underline transition-all"
                          >
                            {item.dr.toLocaleString()}
                          </button>
                        ) : '-'}
                      </td>
                      <td className="py-4 text-right pr-4 font-orbitron font-medium">
                        {item.cr > 0 ? (
                          <button 
                            onClick={() => navigateToLedger(item.id)}
                            className="text-rose-500 hover:text-rose-700 hover:underline transition-all"
                          >
                            {item.cr.toLocaleString()}
                          </button>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}</tbody>
                  <tfoot className="border-t-4 border-slate-900 bg-slate-50">
                    <tr className="text-xl font-bold">
                      <td colSpan={2} className="py-8 px-6 font-orbitron uppercase text-sm tracking-widest">Verification Totals</td>
                      <td className="py-8 px-4 text-right font-orbitron underline decoration-double decoration-blue-500 underline-offset-8">{trialBalance.totalDr.toLocaleString()}</td>
                      <td className="py-8 px-6 text-right font-orbitron underline decoration-double decoration-blue-500 underline-offset-8">{trialBalance.totalCr.toLocaleString()}</td>
                    </tr>
                    {trialBalance.diff > 0.01 && (
                      <tr className="bg-rose-50 animate-pulse">
                        <td colSpan={4} className="py-4 text-center">
                           <p className="text-rose-600 font-black uppercase text-[10px] tracking-[0.3em]">
                             ⚠️ Ledger Out of Balance! Current Discrepancy: PKR {trialBalance.diff.toLocaleString()}
                           </p>
                           <p className="text-[9px] text-rose-400 font-bold mt-1">Check Opening Balances (A/C 3001) or multi-currency vouchers.</p>
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {activeSection === 'PL' && (
            <div className="animate-in slide-in-from-right-4 duration-500">
              <ReportHeader title="Income Statement" subtitle="Operating Revenue & Expense Measurement" />
              <div className="space-y-12">
                <div><h4 className="text-emerald-500 font-bold uppercase tracking-[0.2em] mb-4 border-b border-emerald-100 pb-2 text-[10px]">Operating Revenues</h4><div className="space-y-4">{[{ label: 'Hotel Booking Services', type: VoucherType.HOTEL }, { label: 'Visa Processing Services', type: VoucherType.VISA }, { label: 'Transport / Car Hire Services', type: VoucherType.TRANSPORT }, { label: 'Airline Ticketing Services', type: VoucherType.TICKET }].map(inc => {
                  const val = filteredVouchers.filter(v => v.type === inc.type).reduce((s, v) => s + v.totalAmountPKR, 0);
                  return (<div key={inc.type} className="flex justify-between items-center px-4 hover:bg-slate-50 py-2 rounded-xl transition-all"><span className="text-slate-600 font-medium text-sm">{inc.label}</span><span className="font-orbitron font-bold text-slate-800">{val.toLocaleString()}</span></div>);
                })}<div className="flex justify-between items-center p-5 bg-emerald-50 rounded-2xl border border-emerald-100"><span className="font-bold text-emerald-700 uppercase text-xs tracking-widest">Gross Post Income</span><span className="font-orbitron font-bold text-2xl text-emerald-600">{profitLoss.income.toLocaleString()}</span></div></div></div>
                <div><h4 className="text-rose-500 font-bold uppercase tracking-[0.2em] mb-4 border-b border-rose-100 pb-2 text-[10px]">Operating Costs</h4><div className="space-y-4"><div className="flex justify-between items-center px-4 hover:bg-slate-50 py-2 rounded-xl transition-all"><span className="text-slate-600 font-medium text-sm">General Ledger Expenses</span><span className="font-orbitron font-bold text-slate-800">{profitLoss.expenses.toLocaleString()}</span></div><div className="flex justify-between items-center p-5 bg-rose-50 rounded-2xl border border-rose-100"><span className="font-bold text-rose-700 uppercase text-xs tracking-widest">Total Operating Outflow</span><span className="font-orbitron font-bold text-2xl text-rose-600">{profitLoss.expenses.toLocaleString()}</span></div></div></div>
                <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center border border-white/5"><div><h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">IFRS Period Result</h5><p className="text-4xl font-orbitron font-bold uppercase tracking-tighter">Net Profit / (Loss)</p></div><div className="text-right mt-6 md:mt-0"><p className={`text-5xl font-orbitron font-bold ${profitLoss.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{profitLoss.netProfit.toLocaleString()}</p></div></div>
              </div>
            </div>
          )}

          {activeSection === 'BS' && (
            <div className="animate-in slide-in-from-left-4 duration-500">
              <ReportHeader title="Balance Sheet" subtitle="Financial Position Measurement" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div>
                    <h4 className="text-blue-600 font-bold uppercase tracking-widest border-b-2 border-blue-600 mb-6 pb-2 text-[10px]">Asset Portfolio</h4>
                    <div className="space-y-4">
                      {balanceSheet.assets.map(a => (
                        <div key={a.id} className="flex justify-between items-center border-b pb-3 hover:bg-slate-50 px-2 rounded transition-all">
                          <button onClick={() => navigateToLedger(a.id)} className="text-slate-600 font-medium text-sm hover:text-blue-600 hover:underline">{a.name}</button>
                          <span className="font-orbitron font-bold text-slate-800">{Math.abs(a.balance).toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="flex justify-between pt-6 border-t-2 border-slate-900">
                        <span className="text-xl font-bold uppercase font-orbitron">Total Assets</span>
                        <span className="text-3xl font-orbitron font-bold text-blue-600">{balanceSheet.totalAssets.toLocaleString()}</span>
                      </div>
                    </div>
                </div>
                
                <div className="space-y-8">
                    <div>
                      <h4 className="text-rose-600 font-bold uppercase tracking-widest border-b-2 border-rose-600 mb-6 pb-2 text-[10px]">Liabilities</h4>
                      <div className="space-y-4">
                        {balanceSheet.liabilities.map(a => (
                          <div key={a.id} className="flex justify-between items-center border-b pb-3 hover:bg-slate-50 px-2 rounded transition-all">
                            <button onClick={() => navigateToLedger(a.id)} className="text-slate-600 font-medium text-sm hover:text-blue-600 hover:underline">{a.name}</button>
                            <span className="font-orbitron font-bold text-rose-500">{Math.abs(a.balance).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-slate-900 font-bold uppercase tracking-widest border-b-2 border-slate-900 mb-6 pb-2 text-[10px]">Equity & Earnings</h4>
                      <div className="space-y-4">
                        {balanceSheet.equity.map(a => (
                          <div key={a.id} className="flex justify-between items-center border-b pb-3 hover:bg-slate-50 px-2 rounded transition-all">
                            <button onClick={() => navigateToLedger(a.id)} className="text-slate-600 font-medium text-sm hover:text-blue-600 hover:underline">{a.name}</button>
                            <span className="font-orbitron font-bold text-slate-800">{Math.abs(a.balance).toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center border-b pb-3 hover:bg-slate-50 px-2 rounded transition-all bg-emerald-50/50">
                          <span className="text-emerald-700 font-bold text-sm italic">Current Period Earnings (Net Profit)</span>
                          <span className="font-orbitron font-bold text-emerald-600">{balanceSheet.netProfit.toLocaleString()}</span>
                        </div>
                        
                        <div className="flex justify-between pt-6 border-t-2 border-slate-900">
                          <span className="text-xl font-bold uppercase font-orbitron">Total L&E</span>
                          <span className="text-3xl font-orbitron font-bold text-slate-900">{(balanceSheet.totalLE).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                </div>
              </div>
              
              <div className="mt-12 p-6 rounded-2xl border-2 border-dashed flex items-center justify-center space-x-4 bg-slate-50">
                <span className={`w-4 h-4 rounded-full ${Math.abs(balanceSheet.totalAssets - balanceSheet.totalLE) < 0.01 ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-rose-500 shadow-lg shadow-rose-500/50'}`}></span>
                <p className="font-bold text-xs uppercase tracking-widest text-slate-500">
                  {Math.abs(balanceSheet.totalAssets - balanceSheet.totalLE) < 0.01 
                    ? 'System Balance Verified (IFRS Compliant)' 
                    : `Discrepancy Detected: PKR ${Math.abs(balanceSheet.totalAssets - balanceSheet.totalLE).toLocaleString()}`}
                </p>
              </div>
            </div>
          )}

          {activeSection === 'GL' && (
            <div className="animate-in fade-in duration-500">
              <ReportHeader title="General Ledger" subtitle="Transactional IFRS Audit History" />
              <div className="no-print mb-8">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Search Account by Name or Code</label>
                <select className="w-full lg:w-96 bg-slate-50 border-none rounded-xl p-4 font-bold shadow-inner cursor-pointer" value={selectedLedgerId} onChange={(e) => setSelectedLedgerId(e.target.value)}>
                  <option value="">Select Ledger...</option>
                  {accounts.sort((a,b) => (a.code || '').localeCompare(b.code || '')).map(acc => (<option key={acc.id} value={acc.id}>{acc.code ? `${acc.code} - ` : ''}{acc.name}</option>))}
                </select>
              </div>
              {selectedAccount ? (
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-slate-50 p-8 rounded-[2rem] flex flex-col md:flex-row justify-between items-center border border-slate-100 gap-4">
                      <div className="text-center md:text-left"><p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Audit Profile</p><h5 className="text-2xl font-bold font-orbitron uppercase tracking-tighter text-slate-900">{selectedAccount.name}</h5>{selectedAccount.code && <p className="text-xs font-mono text-slate-400 mt-1 font-bold">Standard COA Code: {selectedAccount.code}</p>}</div>
                      <div className="text-center md:text-right"><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Ledger Closing Balance</p><p className={`text-4xl font-orbitron font-bold ${selectedAccount.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{Math.abs(selectedAccount.balance).toLocaleString()} <span className="text-sm font-sans font-bold bg-slate-200 px-2 py-0.5 rounded ml-2 text-slate-700">{selectedAccount.balance >= 0 ? 'DR' : 'CR'}</span></p></div>
                    </div>
                    <div className="overflow-x-auto"><table className="w-full"><thead className="text-slate-400 text-[10px] font-bold uppercase border-b-2 tracking-widest"><tr><th className="py-4 text-left">Post Date</th><th className="py-4 text-left">Voucher #</th><th className="py-4 text-left">Narrative</th><th className="py-4 text-right">Debit</th><th className="py-4 text-right">Credit</th><th className="py-4 text-right pr-4">Accumulated Balance</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {glLedgerWithAccumulated.map((entry, idx) => {
                          const voucher = vouchers.find(v => v.id === entry.voucherId);
                          return (
                            <tr key={idx} className="hover:bg-slate-50 transition-all text-sm">
                              <td className="py-4 text-slate-500">{new Date(entry.date).toLocaleDateString()}</td>
                              <td className="py-4">
                                {voucher ? (
                                  <button 
                                    onClick={() => onViewVoucher?.(voucher)}
                                    className="font-bold text-blue-600 hover:text-blue-800 hover:underline transition-all text-left uppercase"
                                  >
                                    {entry.voucherNum}
                                  </button>
                                ) : (
                                  <span className="font-bold text-slate-400">{entry.voucherNum}</span>
                                )}
                              </td>
                              <td className="py-4 text-slate-700 italic max-w-xs truncate">{entry.description}</td>
                              <td className="py-4 text-right font-medium text-emerald-500">{entry.debit > 0 ? entry.debit.toLocaleString() : '-'}</td>
                              <td className="py-4 text-right font-medium text-rose-500">{entry.credit > 0 ? entry.credit.toLocaleString() : '-'}</td>
                              <td className="py-4 text-right pr-4 font-bold text-slate-800">
                                {Math.abs(entry.accumulatedBalance).toLocaleString()} 
                                <span className="text-[10px] opacity-60 font-sans ml-1">
                                  {entry.accumulatedBalance >= 0 ? 'Dr' : 'Cr'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table></div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-32 text-slate-400 opacity-20"><span className="text-9xl mb-6">📖</span><p className="text-xl font-bold uppercase tracking-widest font-orbitron">Query Ledger History</p></div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;