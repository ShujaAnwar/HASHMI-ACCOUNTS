import React, { useState, useMemo, useEffect } from 'react';
import { formatCurrency, formatDate } from '../utils/format';
import { Account, Voucher, AppConfig, AccountType, VoucherType, Currency } from '../types';
import { TaskItem } from './DailyTaskReport';

interface DailyBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  accounts: Account[];
  vouchers: Voucher[];
  onNavigateToReports: () => void;
  onNavigateToLedger: (accountId: string) => void;
  onViewVoucher: (voucher: Voucher) => void;
}

export const DailyBriefingModal: React.FC<DailyBriefingModalProps> = ({
  isOpen,
  onClose,
  config,
  accounts,
  vouchers,
  onNavigateToReports,
  onNavigateToLedger,
  onViewVoucher
}) => {
  const [autoOpenOnStartup, setAutoOpenOnStartup] = useState<boolean>(() => {
    return localStorage.getItem('tlp_auto_open_daily_briefing') !== 'false';
  });

  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    try {
      const saved = localStorage.getItem('tlp_daily_tasks');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Vouchers made today
  const todayVouchers = useMemo(() => {
    return vouchers.filter(v => v.date?.split('T')[0] === todayStr && v.status !== 'VOID');
  }, [vouchers, todayStr]);

  // Today's collections
  const todayCollections = useMemo(() => {
    return todayVouchers
      .filter(v => v.type === VoucherType.RECEIPT || v.type === ('RV' as any))
      .reduce((sum, v) => sum + v.totalAmountPKR, 0);
  }, [todayVouchers]);

  // Customer Debtors sorted by highest balance
  const topDebtors = useMemo(() => {
    return accounts
      .filter(a => a.type === AccountType.CUSTOMER && a.balance > 0)
      .sort((a, b) => b.balance - a.balance);
  }, [accounts]);

  const totalReceivables = useMemo(() => {
    return topDebtors.reduce((sum, a) => sum + a.balance, 0);
  }, [topDebtors]);

  // Today's Movements
  const todayMovements = useMemo(() => {
    const movements: any[] = [];
    vouchers.forEach(v => {
      if (v.status === 'VOID') return;
      if (v.type === VoucherType.TRANSPORT || v.type === ('TV' as any)) {
        const items = v.details?.items || [v.details];
        items.forEach((item: any) => {
          if (!item) return;
          const moveDate = item.date?.split('T')[0] || v.details?.departureDate?.split('T')[0] || v.date?.split('T')[0];
          if (moveDate === todayStr) {
            const cust = accounts.find(a => a.id === v.customerId);
            let sector = item.sector === 'CUSTOM' ? item.customLabel : item.sector;
            if (item.isMultiSector && item.subSectors?.length > 0) {
              sector = item.subSectors.map((s: any) => s.route).join(' -> ');
            }
            movements.push({
              voucherNum: v.voucherNum,
              sector: sector || 'Movement',
              vehicle: item.vehicle || 'Vehicle',
              paxName: v.details?.paxName || item.paxName || cust?.name || 'N/A',
              customerName: cust?.name || 'Customer'
            });
          }
        });
      }
      if (v.type === VoucherType.HOTEL || v.type === ('HV' as any)) {
        const items = v.details?.items || [v.details];
        items.forEach((item: any) => {
          if (!item) return;
          const ci = item.fromDate?.split('T')[0];
          if (ci === todayStr) {
            const cust = accounts.find(a => a.id === v.customerId);
            movements.push({
              voucherNum: v.voucherNum,
              sector: `CHECK-IN: ${item.hotelName || 'Hotel'} (${item.city || ''})`,
              vehicle: `${item.numRooms || 1} Rooms`,
              paxName: item.paxName || cust?.name || 'N/A',
              customerName: cust?.name || 'Customer'
            });
          }
        });
      }
    });
    return movements;
  }, [vouchers, accounts, todayStr]);

  const handleAutoOpenToggle = (val: boolean) => {
    setAutoOpenOnStartup(val);
    localStorage.setItem('tlp_auto_open_daily_briefing', val ? 'true' : 'false');
  };

  // WhatsApp Reminder Generator
  const sendWhatsAppReminder = (customer: Account) => {
    const pkrBal = customer.balance.toLocaleString();
    const sarBal = (customer.balance / (config.defaultROE || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 });
    
    let bankDetails = '';
    if (config.banks && config.banks.length > 0) {
      bankDetails = `\n\n*Bank Accounts:*\n` + 
        config.banks.map(b => `• *${b.name}*: ${b.accountNumber}`).join('\n');
    }

    const message = `*Assalam-o-Alaikum ${customer.name} Sahab,*\n\n` +
      `*${config.companyName}* ki janib se aap kay ledger balance ka payment reminder:\n\n` +
      `💰 *Pending Balance:* PKR ${pkrBal} (Approx SAR ${sarBal})\n` +
      `📅 *Date:* ${formatDate(new Date())}\n\n` +
      `Baraye meharbani payment transfer kar dein taake booking active rahay.${bankDetails}\n\n` +
      `_Shukriya,_ *${config.companyName}*`;

    const encoded = encodeURIComponent(message);
    const cleanPhone = (customer.cell || customer.contactNumber || '').replace(/[^0-9]/g, '');
    
    if (cleanPhone) {
      const url = `https://wa.me/${cleanPhone.startsWith('0') ? '92' + cleanPhone.substring(1) : cleanPhone}?text=${encoded}`;
      window.open(url, '_blank');
    } else {
      const url = `https://api.whatsapp.com/send?text=${encoded}`;
      window.open(url, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-6 pb-4 bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-900 text-white flex justify-between items-start flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-2xl shadow-inner">
              ☀️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">
                  {config.companyName} • Daily Briefing
                </span>
                <span className="px-2 py-0.5 rounded-full text-[8px] font-black bg-emerald-500 text-white animate-pulse">
                  TODAY
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-orbitron font-bold uppercase tracking-tight text-white mt-0.5">
                Aaj Kay Zaroori Kaam & Action Plan
              </h2>
              <p className="text-xs text-slate-300 font-medium">
                {formatDate(new Date())} • Priority Tasks, High Debtors & Movements
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 rounded-2xl">
              <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest block">Market Due</span>
              <p className="text-base sm:text-lg font-orbitron font-black text-rose-600 dark:text-rose-400 mt-1 truncate">
                PKR {totalReceivables.toLocaleString()}
              </p>
              <span className="text-[9px] text-slate-400 font-bold">{topDebtors.length} Customers</span>
            </div>

            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl">
              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block">Today Cash In</span>
              <p className="text-base sm:text-lg font-orbitron font-black text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                PKR {todayCollections.toLocaleString()}
              </p>
              <span className="text-[9px] text-slate-400 font-bold">Receipts Received</span>
            </div>

            <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-2xl">
              <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest block">Today Vouchers</span>
              <p className="text-base sm:text-lg font-orbitron font-black text-blue-600 dark:text-blue-400 mt-1">
                {todayVouchers.length}
              </p>
              <span className="text-[9px] text-slate-400 font-bold">Vouchers Created</span>
            </div>

            <div className="p-3.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 rounded-2xl">
              <span className="text-[9px] font-black text-purple-600 uppercase tracking-widest block">Movements Today</span>
              <p className="text-base sm:text-lg font-orbitron font-black text-purple-600 dark:text-purple-400 mt-1">
                {todayMovements.length}
              </p>
              <span className="text-[9px] text-slate-400 font-bold">Sectors / Check-ins</span>
            </div>
          </div>

          {/* PRIORITY 1: Sabsay Ziada Kis Se Amount Receive Karni Hai */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-3xl p-5 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center space-x-2">
                <span className="text-lg">🚨</span>
                <div>
                  <h3 className="text-sm font-orbitron font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                    Top Priority: Highest Pending Receivables (Sabsay Ziada Kisse Paisay Lene Hain)
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Send instant WhatsApp payment reminders with one click</p>
                </div>
              </div>
              <span className="text-[10px] font-black text-rose-500 uppercase">Top 5 Debtors</span>
            </div>

            <div className="mt-3 space-y-2">
              {topDebtors.length > 0 ? (
                topDebtors.slice(0, 5).map((customer, index) => {
                  const sarVal = (customer.balance / (config.defaultROE || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 });
                  return (
                    <div
                      key={customer.id}
                      className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 flex items-center justify-center text-xs font-black">
                          #{index + 1}
                        </span>
                        <div>
                          <button
                            onClick={() => {
                              onClose();
                              onNavigateToLedger(customer.id);
                            }}
                            className="text-xs font-bold text-slate-900 dark:text-white hover:text-blue-600 text-left"
                          >
                            {customer.name}
                          </button>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {customer.cell || customer.contactNumber || customer.location || 'No Phone Registered'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-right">
                          <p className="text-xs font-orbitron font-black text-rose-600 dark:text-rose-400">
                            PKR {customer.balance.toLocaleString()}
                          </p>
                          <p className="text-[9px] text-slate-400 font-orbitron">
                            SAR {sarVal}
                          </p>
                        </div>

                        <button
                          onClick={() => sendWhatsAppReminder(customer)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                          title="Send polite WhatsApp reminder"
                        >
                          <span>💬</span>
                          <span>Send Reminder</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center py-4 text-xs text-slate-400">Sab accounts clear hain! Koi pending balance nahi hay.</p>
              )}
            </div>
          </div>

          {/* PRIORITY 2: Today's Travel & Hotel Movements */}
          {todayMovements.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-3xl p-5 border border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-200 dark:border-slate-700">
                <span className="text-lg">🚐</span>
                <h3 className="text-sm font-orbitron font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                  Aaj Kay Travel Movements & Hotel Check-ins
                </h3>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {todayMovements.map((m, idx) => (
                  <div key={idx} className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-slate-900 dark:text-white uppercase">{m.sector}</span>
                      <span className="text-[9px] font-mono text-blue-600 font-bold">{m.voucherNum}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Pax: <strong>{m.paxName}</strong> • {m.vehicle} • Party: {m.customerName}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PRIORITY 3: Today's Work & Vouchers Created */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-3xl p-5 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center space-x-2">
                <span className="text-lg">📝</span>
                <h3 className="text-sm font-orbitron font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                  Aaj Ka Kaam (Vouchers Created Today: {todayVouchers.length})
                </h3>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onNavigateToReports();
                }}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                View Full Log →
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {todayVouchers.length > 0 ? (
                todayVouchers.slice(0, 4).map(v => (
                  <div
                    key={v.id}
                    className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-blue-600">{v.voucherNum}</span>
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {v.type}
                      </span>
                      <span className="text-slate-600 dark:text-slate-400 truncate max-w-[180px]">
                        {v.details?.paxName ? `Pax: ${v.details.paxName}` : v.description || '-'}
                      </span>
                    </div>
                    <span className="font-orbitron font-black text-slate-900 dark:text-white">
                      PKR {v.totalAmountPKR.toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center py-4 text-xs text-slate-400">
                  Aaj abhi tak koi voucher create nahi hua. Naya voucher banane kay liye 'Vouchers' menu use karein.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 flex-shrink-0">
          <label className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoOpenOnStartup}
              onChange={e => handleAutoOpenToggle(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="font-medium">App open hotay hi yeh daily briefing automatically show karein</span>
          </label>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={() => {
                onClose();
                onNavigateToReports();
              }}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20 active:scale-95"
            >
              📑 Open Full Daily Report
            </button>
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
            >
              Got It / Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DailyBriefingModal;
