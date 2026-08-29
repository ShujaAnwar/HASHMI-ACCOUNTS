import React, { useState, useMemo, useRef, useEffect } from 'react';
import { formatCurrency, formatDate } from '../utils/format';
import DateInput from './DateInput';
import { AccountType, VoucherType, Currency, Account, Voucher, AppConfig } from '../types';

export interface TaskItem {
  id: string;
  text: string;
  date: string;
  priority: 'HIGH' | 'MEDIUM' | 'NORMAL';
  completed: boolean;
  assignedTo?: string;
  createdAt: string;
}

interface DailyTaskReportProps {
  config: AppConfig;
  accounts: Account[];
  vouchers: Voucher[];
  onViewVoucher?: (v: Voucher) => void;
  onEditVoucher?: (v: Voucher) => void;
  onNavigateToLedger?: (accountId: string) => void;
  initialDate?: string;
}

export const DailyTaskReport: React.FC<DailyTaskReportProps> = ({
  config,
  accounts,
  vouchers,
  onViewVoucher,
  onEditVoucher,
  onNavigateToLedger,
  initialDate
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return initialDate || new Date().toISOString().split('T')[0];
  });
  
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<string>('ALL');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    try {
      const saved = localStorage.getItem('tlp_daily_tasks');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [
      { id: '1', text: 'Top 5 debtors ko WhatsApp payment reminders send karna', date: new Date().toISOString().split('T')[0], priority: 'HIGH', completed: false, createdAt: new Date().toISOString() },
      { id: '2', text: 'Aaj kay transport vouchers ki movement aur flights confirm karna', date: new Date().toISOString().split('T')[0], priority: 'MEDIUM', completed: false, createdAt: new Date().toISOString() },
      { id: '3', text: 'Bank cash deposits aur customer receipt vouchers verify karna', date: new Date().toISOString().split('T')[0], priority: 'NORMAL', completed: false, createdAt: new Date().toISOString() }
    ];
  });

  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'HIGH' | 'MEDIUM' | 'NORMAL'>('HIGH');
  const [isExporting, setIsExporting] = useState(false);
  const reportContainerRef = useRef<HTMLDivElement>(null);

  // Save tasks to localStorage whenever changed
  useEffect(() => {
    try {
      localStorage.setItem('tlp_daily_tasks', JSON.stringify(tasks));
    } catch (e) {
      console.error(e);
    }
  }, [tasks]);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const newTask: TaskItem = {
      id: Date.now().toString(),
      text: newTaskText.trim(),
      date: selectedDate,
      priority: newTaskPriority,
      completed: false,
      createdAt: new Date().toISOString()
    };
    setTasks(prev => [newTask, ...prev]);
    setNewTaskText('');
  };

  const handleToggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  // Vouchers created / dated on selected date
  const dateVouchers = useMemo(() => {
    return vouchers.filter(v => {
      const vDate = v.date?.split('T')[0] || '';
      return vDate === selectedDate;
    });
  }, [vouchers, selectedDate]);

  // Vouchers filtered by type
  const filteredDateVouchers = useMemo(() => {
    if (voucherTypeFilter === 'ALL') return dateVouchers;
    return dateVouchers.filter(v => v.type === voucherTypeFilter);
  }, [dateVouchers, voucherTypeFilter]);

  // Financial summary for selected date
  const summary = useMemo(() => {
    let totalSalesPKR = 0;
    let totalReceiptsPKR = 0;
    let totalPaymentsPKR = 0;
    let countReceipts = 0;
    let countHotels = 0;
    let countTransports = 0;
    let countVisas = 0;
    let countPackages = 0;
    let countPayments = 0;
    let countTickets = 0;

    dateVouchers.forEach(v => {
      if (v.status === 'VOID') return;
      const amt = Number(v.totalAmountPKR) || 0;
      if (v.type === VoucherType.RECEIPT || v.type === ('RV' as any)) {
        totalReceiptsPKR += amt;
        countReceipts++;
      } else if (v.type === VoucherType.PAYMENT || v.type === ('PV' as any)) {
        totalPaymentsPKR += amt;
        countPayments++;
      } else {
        totalSalesPKR += amt;
        if (v.type === VoucherType.HOTEL || v.type === ('HV' as any)) countHotels++;
        else if (v.type === VoucherType.TRANSPORT || v.type === ('TV' as any)) countTransports++;
        else if (v.type === VoucherType.VISA || v.type === ('VV' as any)) countVisas++;
        else if (v.type === VoucherType.PACKAGE || v.type === ('PKV' as any)) countPackages++;
        else if (v.type === VoucherType.TICKET || v.type === ('TK' as any)) countTickets++;
      }
    });

    return {
      totalVouchers: dateVouchers.length,
      totalSalesPKR,
      totalReceiptsPKR,
      totalPaymentsPKR,
      countReceipts,
      countHotels,
      countTransports,
      countVisas,
      countPackages,
      countPayments,
      countTickets
    };
  }, [dateVouchers]);

  // Outstanding Customers (Receivables) sorted by highest balance first
  const customerDebtors = useMemo(() => {
    return accounts
      .filter(a => a.type === AccountType.CUSTOMER && a.balance > 0)
      .sort((a, b) => b.balance - a.balance);
  }, [accounts]);

  const filteredDebtors = useMemo(() => {
    if (!customerSearch.trim()) return customerDebtors;
    const query = customerSearch.toLowerCase();
    return customerDebtors.filter(c => 
      c.name.toLowerCase().includes(query) || 
      (c.cell && c.cell.toLowerCase().includes(query)) ||
      (c.location && c.location.toLowerCase().includes(query))
    );
  }, [customerDebtors, customerSearch]);

  const totalReceivables = useMemo(() => {
    return customerDebtors.reduce((sum, a) => sum + a.balance, 0);
  }, [customerDebtors]);

  // Today's Hotel Check-in / Check-outs & Movements
  const movements = useMemo(() => {
    const hotelCheckins: any[] = [];
    const transportMovements: any[] = [];
    const visaPendings: any[] = [];

    vouchers.forEach(v => {
      // Hotel items
      if (v.type === VoucherType.HOTEL || v.type === ('HV' as any)) {
        const items = v.details?.items || [v.details];
        items.forEach((item: any) => {
          if (!item) return;
          const ci = item.fromDate?.split('T')[0];
          const co = item.toDate?.split('T')[0];
          if (ci === selectedDate || co === selectedDate) {
            const cust = accounts.find(a => a.id === v.customerId);
            hotelCheckins.push({
              voucherNum: v.voucherNum,
              type: ci === selectedDate ? 'CHECK-IN' : 'CHECK-OUT',
              hotelName: item.hotelName || v.details?.hotelName || 'N/A',
              city: item.city || v.details?.city || '',
              paxName: item.paxName || v.details?.paxName || cust?.name || 'N/A',
              rooms: item.numRooms || v.details?.numRooms || 1,
              nights: item.numNights || v.details?.numNights || 1,
              customerName: cust?.name || 'Customer'
            });
          }
        });
      }

      // Transport items
      if (v.type === VoucherType.TRANSPORT || v.type === ('TV' as any)) {
        const items = v.details?.items || [v.details];
        items.forEach((item: any) => {
          if (!item) return;
          const moveDate = item.date?.split('T')[0] || v.details?.departureDate?.split('T')[0] || v.date?.split('T')[0];
          if (moveDate === selectedDate) {
            const cust = accounts.find(a => a.id === v.customerId);
            let sector = item.sector === 'CUSTOM' ? item.customLabel : item.sector;
            if (item.isMultiSector && item.subSectors?.length > 0) {
              sector = item.subSectors.map((s: any) => s.route).join(' -> ');
            }
            transportMovements.push({
              voucherNum: v.voucherNum,
              sector: sector || 'Movement',
              vehicle: item.vehicle || 'Vehicle',
              numVehicles: item.numVehicles || 1,
              paxName: v.details?.paxName || item.paxName || cust?.name || 'N/A',
              flightNum: v.details?.flightNum || '',
              customerName: cust?.name || 'Customer'
            });
          }
        });
      }

      // Visa pending embassy
      if (v.type === VoucherType.VISA || v.type === ('VV' as any)) {
        if (v.details?.sendToEmbassy && v.date?.split('T')[0] === selectedDate) {
          const cust = accounts.find(a => a.id === v.customerId);
          visaPendings.push({
            voucherNum: v.voucherNum,
            paxName: v.details?.paxName || cust?.name || 'N/A',
            country: v.details?.country || 'Saudi Arabia',
            quantity: v.details?.quantity || 1,
            customerName: cust?.name || 'Customer'
          });
        }
      }
    });

    return { hotelCheckins, transportMovements, visaPendings };
  }, [vouchers, accounts, selectedDate]);

  // Generate WhatsApp Payment Reminder Message for a Customer
  const generateWhatsAppReminder = (customer: Account) => {
    const pkrBal = customer.balance.toLocaleString();
    const sarBal = (customer.balance / (config.defaultROE || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 });
    
    let bankDetails = '';
    if (config.banks && config.banks.length > 0) {
      bankDetails = `\n\n*Bank Accounts for Transfer:*\n` + 
        config.banks.map(b => `• *${b.name}*: ${b.accountNumber} (${b.address || 'Pakistan'})`).join('\n');
    }

    const message = `*Assalam-o-Alaikum ${customer.name} Sahab,*\n\n` +
      `Umeed hay aap khariat se hongey. *${config.companyName}* ki janib se aap kay ledger balance ka payment reminder:\n\n` +
      `💰 *Total Pending Balance:* PKR ${pkrBal} (Approx SAR ${sarBal})\n` +
      `📅 *As of Date:* ${formatDate(new Date())}\n\n` +
      `Baraye meharbani payment transfer kar kay deposit slip share farma dain taake aap ka account update kiya ja sakay.${bankDetails}\n\n` +
      `_Shukriya,_\n*${config.companyName}*\n📞 ${config.companyPhone || config.companyCell || ''}`;

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

  // Generate WhatsApp Daily Work Summary for Admin / Boss
  const handleShareDailySummaryWhatsApp = () => {
    const msg = `*📊 DAILY WORK & TASK SUMMARY - ${config.companyName}*\n` +
      `📅 *Date:* ${formatDate(selectedDate)}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 *Total Vouchers Created:* ${summary.totalVouchers}\n` +
      `💵 *Cash/Receipts Collected:* PKR ${summary.totalReceiptsPKR.toLocaleString()}\n` +
      `💳 *Payments Made:* PKR ${summary.totalPaymentsPKR.toLocaleString()}\n` +
      `📈 *New Billings / Bookings:* PKR ${summary.totalSalesPKR.toLocaleString()}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `*Vouchers Breakdown:*\n` +
      `• Receipts (RV): ${summary.countReceipts}\n` +
      `• Hotels (HV): ${summary.countHotels}\n` +
      `• Transport (TV): ${summary.countTransports}\n` +
      `• Visas (VV): ${summary.countVisas}\n` +
      `• Packages (PKV): ${summary.countPackages}\n` +
      `• Payments (PV): ${summary.countPayments}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🚨 *Total Outstanding Market Receivables:* PKR ${totalReceivables.toLocaleString()}\n` +
      `*Top Pending Debtors:*\n` +
      customerDebtors.slice(0, 5).map((c, i) => `${i + 1}. ${c.name}: PKR ${c.balance.toLocaleString()}`).join('\n') +
      `\n━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Generated automatically from TravelLedger Enterprise_`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const handleExportPDF = async () => {
    if (!reportContainerRef.current) return;
    setIsExporting(true);
    const element = reportContainerRef.current;
    const fileName = `Daily_Task_Report_${selectedDate}.pdf`;
    
    const opt = {
      margin: [8, 8, 8, 8],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      // @ts-ignore
      if (window.html2pdf) {
        // @ts-ignore
        await window.html2pdf().set(opt).from(element).save();
      } else {
        window.print();
      }
    } catch (err) {
      console.error("PDF Export Error:", err);
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Top Date Selection & Action Bar */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 no-print">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-indigo-500/20">
            📋
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-orbitron font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                Daily Task & Operations Report
              </h2>
              {isToday && (
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white animate-pulse">
                  Today's Live
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              Rozana Kaam, Vouchers, Pending Reminders & Recovery Log
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Quick Date Switchers */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isToday ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 1);
                setSelectedDate(d.toISOString().split('T')[0]);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedDate === new Date(Date.now() - 86400000).toISOString().split('T')[0] 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Yesterday
            </button>
          </div>

          <div className="w-40">
            <DateInput
              value={selectedDate}
              onChange={(val) => setSelectedDate(val)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs font-bold text-slate-900 dark:text-white"
            />
          </div>

          <button
            onClick={handleShareDailySummaryWhatsApp}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-95"
            title="Share today's work summary on WhatsApp"
          >
            <span>💬</span>
            <span className="uppercase tracking-wider">Share Daily Log</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 active:scale-95 disabled:opacity-50"
          >
            <span>{isExporting ? '⏳' : '📥'}</span>
            <span className="uppercase tracking-wider">{isExporting ? 'Exporting...' : 'Export PDF'}</span>
          </button>
        </div>
      </div>

      {/* Printable Report Container */}
      <div ref={reportContainerRef} className="space-y-6">
        {/* Printable Header */}
        <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-4">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-blue-600 font-bold text-xs uppercase tracking-widest">{config.companyName}</p>
              <h1 className="text-2xl font-bold font-orbitron uppercase text-slate-900">Daily Task & Operations Report</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Date: {formatDate(selectedDate)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Generated On</p>
              <p className="text-xs font-bold text-slate-800">{new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* 4 Core Metric KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-xl -mr-6 -mt-6"></div>
            <div className="flex justify-between items-start">
              <span className="text-2xl">📝</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-lg">
                Activity
              </span>
            </div>
            <p className="text-2xl font-orbitron font-black text-slate-900 dark:text-white mt-3">
              {summary.totalVouchers}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
              Vouchers Created on {formatDate(selectedDate)}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl -mr-6 -mt-6"></div>
            <div className="flex justify-between items-start">
              <span className="text-2xl">💵</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-lg">
                Cash Inflow
              </span>
            </div>
            <p className="text-2xl font-orbitron font-black text-emerald-600 dark:text-emerald-400 mt-3">
              PKR {summary.totalReceiptsPKR.toLocaleString()}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
              Receipts / Collections Received ({summary.countReceipts} RV)
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-xl -mr-6 -mt-6"></div>
            <div className="flex justify-between items-start">
              <span className="text-2xl">💳</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 dark:bg-rose-900/30 px-2 py-0.5 rounded-lg">
                Cash Outflow
              </span>
            </div>
            <p className="text-2xl font-orbitron font-black text-rose-600 dark:text-rose-400 mt-3">
              PKR {summary.totalPaymentsPKR.toLocaleString()}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
              Payments Disbursed ({summary.countPayments} PV)
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl -mr-6 -mt-6"></div>
            <div className="flex justify-between items-start">
              <span className="text-2xl">📈</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-lg">
                Gross Billings
              </span>
            </div>
            <p className="text-2xl font-orbitron font-black text-indigo-600 dark:text-indigo-400 mt-3">
              PKR {summary.totalSalesPKR.toLocaleString()}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
              Total Booking Value Generated on Date
            </p>
          </div>
        </div>

        {/* SECTION 1: Sabsay Ziada Kisse Amount Receive Karna Hai (Top Outstanding Customer Debtors & WhatsApp Reminders) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-xl font-bold">
                ⚠️
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-orbitron font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                    Recovery & Payment Reminders (Kisse Paisay Lene Hain)
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500 text-white">
                    {customerDebtors.length} Customers Due
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  Total Market Outstanding: <strong className="text-rose-600 font-bold">PKR {totalReceivables.toLocaleString()}</strong> (Highest Debtors Listed First)
                </p>
              </div>
            </div>

            <div className="w-full sm:w-64 no-print">
              <input
                type="text"
                placeholder="Search debtor name/phone..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase text-slate-400 tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">Customer Name</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3 text-right">Balance (PKR)</th>
                  <th className="py-3 px-3 text-right">Approx (SAR)</th>
                  <th className="py-3 px-3 text-center no-print">Action / Reminder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {filteredDebtors.length > 0 ? (
                  filteredDebtors.slice(0, 15).map((customer, index) => {
                    const sarBalance = customer.balance / (config.defaultROE || 1);
                    return (
                      <tr key={customer.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-3 text-xs font-bold text-slate-400">
                          {index + 1}
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => onNavigateToLedger?.(customer.id)}
                            className="text-xs font-bold text-slate-900 dark:text-white hover:text-blue-600 text-left transition-colors"
                          >
                            {customer.name}
                          </button>
                          {customer.location && (
                            <p className="text-[10px] text-slate-400 font-medium">{customer.location}</p>
                          )}
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-400 font-mono">
                          {customer.cell || customer.contactNumber || '-'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="text-xs font-orbitron font-black text-rose-600 dark:text-rose-400">
                            PKR {customer.balance.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="text-xs font-orbitron font-bold text-slate-500 dark:text-slate-400">
                            SAR {sarBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center no-print">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => generateWhatsAppReminder(customer)}
                              className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-600 hover:text-white text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm"
                              title="Send pre-filled polite payment reminder via WhatsApp"
                            >
                              <span>💬</span>
                              <span>WhatsApp Reminder</span>
                            </button>
                            <button
                              onClick={() => onNavigateToLedger?.(customer.id)}
                              className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold uppercase transition-all"
                              title="Open Customer Ledger"
                            >
                              Ledger
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 text-xs font-medium">
                      No matching customer balances found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 2: Vouchers Created on Selected Date (Aaj Kon Kon Say Vouchers Banay) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center text-xl font-bold">
                📑
              </div>
              <div>
                <h3 className="text-base font-orbitron font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                  Vouchers Generated on {formatDate(selectedDate)}
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Showing {filteredDateVouchers.length} vouchers created / recorded on this date
                </p>
              </div>
            </div>

            {/* Type Filters */}
            <div className="flex flex-wrap gap-1.5 no-print">
              {[
                { id: 'ALL', label: 'All' },
                { id: VoucherType.RECEIPT, label: 'Receipt (RV)' },
                { id: VoucherType.HOTEL, label: 'Hotel (HV)' },
                { id: VoucherType.TRANSPORT, label: 'Transport (TV)' },
                { id: VoucherType.VISA, label: 'Visa (VV)' },
                { id: VoucherType.PACKAGE, label: 'Package (PKV)' },
                { id: VoucherType.PAYMENT, label: 'Payment (PV)' },
                { id: VoucherType.TICKET, label: 'Ticket (TK)' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setVoucherTypeFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                    voucherTypeFilter === f.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase text-slate-400 tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <th className="py-3 px-3">Voucher #</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Party / Customer / Vendor</th>
                  <th className="py-3 px-3">Details / Passenger / Narrative</th>
                  <th className="py-3 px-3 text-right">Amount (PKR)</th>
                  <th className="py-3 px-3 text-right">SAR Value</th>
                  <th className="py-3 px-3 text-center no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {filteredDateVouchers.length > 0 ? (
                  filteredDateVouchers.map((v) => {
                    const cust = accounts.find(a => a.id === v.customerId);
                    const vendor = accounts.find(a => a.id === v.vendorId);
                    const partyName = cust?.name || vendor?.name || 'Cash / Bank Party';
                    const sarValue = v.currency === Currency.SAR ? (v.details?.totalSAR || v.totalAmountPKR / (v.roe || 1)) : (v.totalAmountPKR / (v.roe || config.defaultROE || 1));

                    return (
                      <tr key={v.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-3">
                          <button
                            onClick={() => onViewVoucher?.(v)}
                            className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {v.voucherNum}
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            v.type === VoucherType.RECEIPT ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                            v.type === VoucherType.PAYMENT ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' :
                            v.type === VoucherType.HOTEL ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' :
                            v.type === VoucherType.TRANSPORT ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                            v.type === VoucherType.VISA ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' :
                            'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          }`}>
                            {v.type}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs font-bold text-slate-800 dark:text-slate-200">
                          {partyName}
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">
                          {v.details?.paxName ? `Pax: ${v.details.paxName} | ` : ''}
                          {v.description || '-'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className={`text-xs font-orbitron font-black ${
                            v.type === VoucherType.RECEIPT ? 'text-emerald-600 dark:text-emerald-400' :
                            v.type === VoucherType.PAYMENT ? 'text-rose-600 dark:text-rose-400' :
                            'text-slate-900 dark:text-white'
                          }`}>
                            PKR {v.totalAmountPKR.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="text-xs font-orbitron font-bold text-slate-500 dark:text-slate-400">
                            SAR {sarValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center no-print">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => onViewVoucher?.(v)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-blue-600 transition-colors"
                              title="View Voucher"
                            >
                              👁️
                            </button>
                            <button
                              onClick={() => onEditVoucher?.(v)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 hover:text-amber-600 transition-colors"
                              title="Edit Voucher"
                            >
                              ✏️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-xs font-medium">
                      No vouchers found for this date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 3: Operations & Movements for Today (Hotels, Transports, Visas) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hotel Check-ins / Outs */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6">
            <div className="flex items-center space-x-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="text-2xl">🏨</span>
              <div>
                <h3 className="text-sm font-orbitron font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                  Hotel Check-ins & Outs ({formatDate(selectedDate)})
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Active booking schedules</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {movements.hotelCheckins.length > 0 ? (
                movements.hotelCheckins.map((item, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex justify-between items-center text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                          item.type === 'CHECK-IN' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {item.type}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">{item.hotelName} {item.city ? `(${item.city})` : ''}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">Pax: <strong>{item.paxName}</strong> • {item.rooms} Room(s) • Client: {item.customerName}</p>
                    </div>
                    <span className="font-mono text-[10px] font-bold text-blue-600">{item.voucherNum}</span>
                  </div>
                ))
              ) : (
                <p className="text-center py-6 text-slate-400 text-xs">No hotel check-ins or check-outs on this date.</p>
              )}
            </div>
          </div>

          {/* Transport Movements */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6">
            <div className="flex items-center space-x-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="text-2xl">🚐</span>
              <div>
                <h3 className="text-sm font-orbitron font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                  Transport Movements ({formatDate(selectedDate)})
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Sector transfers & vehicles</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {movements.transportMovements.length > 0 ? (
                movements.transportMovements.map((item, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex justify-between items-center text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white uppercase">{item.sector}</span>
                        <span className="px-2 py-0.5 rounded text-[8px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                          {item.numVehicles > 1 ? `${item.numVehicles}x ` : ''}{item.vehicle}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">Pax: <strong>{item.paxName}</strong> {item.flightNum ? `• Flt: ${item.flightNum}` : ''} • Client: {item.customerName}</p>
                    </div>
                    <span className="font-mono text-[10px] font-bold text-blue-600">{item.voucherNum}</span>
                  </div>
                ))
              ) : (
                <p className="text-center py-6 text-slate-400 text-xs">No transport movements scheduled on this date.</p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 4: Custom Tasks & Daily Checklist */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 no-print">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">✅</span>
              <div>
                <h3 className="text-base font-orbitron font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                  Daily Tasks & Action Checklist (Aaj Kay Zaroori Kaam)
                </h3>
                <p className="text-xs text-slate-400 font-medium">Keep track of to-dos, customer calls, and pending tasks</p>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-400">
              {tasks.filter(t => t.completed).length} / {tasks.length} Done
            </span>
          </div>

          <form onSubmit={handleAddTask} className="mt-4 flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Add new task (e.g. Call Haji Bilal for passport, verify cash deposit in MCB...)"
              value={newTaskText}
              onChange={e => setNewTaskText(e.target.value)}
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={newTaskPriority}
              onChange={e => setNewTaskPriority(e.target.value as any)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="HIGH">High Priority 🔴</option>
              <option value="MEDIUM">Medium Priority 🟡</option>
              <option value="NORMAL">Normal 🟢</option>
            </select>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20 active:scale-95"
            >
              + Add Task
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {tasks.length > 0 ? (
              tasks.map(task => (
                <div
                  key={task.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    task.completed
                      ? 'bg-slate-50/50 dark:bg-slate-800/20 border-slate-100 dark:border-slate-800 opacity-60'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/60 shadow-sm'
                  }`}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggleTask(task.id)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className={`text-xs font-medium ${task.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                      {task.text}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                      task.priority === 'HIGH' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30' :
                      task.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-800'
                    }`}>
                      {task.priority}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="text-slate-400 hover:text-rose-500 text-sm p-1 transition-colors"
                    title="Delete task"
                  >
                    🗑️
                  </button>
                </div>
              ))
            ) : (
              <p className="text-center py-4 text-slate-400 text-xs">No tasks added yet. Add tasks above!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyTaskReport;
