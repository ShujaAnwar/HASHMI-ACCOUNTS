import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend, Label
} from 'recharts';
import { formatCurrency, formatDate } from '../utils/format';
import DateInput from './DateInput';
import { getVouchers, getAccounts } from '../services/db';
import { supabase } from '../services/supabase';
import { VoucherType, AccountType, Voucher, Account, AppConfig, Currency } from '../types';

/**
 * Custom hook for smooth animated numbers (Running numbers effect)
 */
const useAnimatedNumber = (targetValue: number, duration: number = 1000) => {
  const [displayValue, setDisplayValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(0);

  useEffect(() => {
    startTimeRef.current = null;
    startValueRef.current = displayValue;
    
    const animate = (currentTime: number) => {
      if (!startTimeRef.current) startTimeRef.current = currentTime;
      const progress = Math.min((currentTime - startTimeRef.current) / duration, 1);
      
      // Easing function: outExpo
      const easedProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const currentValue = startValueRef.current + (targetValue - startValueRef.current) * easedProgress;
      
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [targetValue, duration]);

  return displayValue;
};

const Dashboard: React.FC<{ 
  config: AppConfig; 
  refreshKey?: number;
  onRefresh?: () => void;
  onEditVoucher?: (v: Voucher) => void; 
  onViewVoucher?: (v: Voucher) => void;
  onNavigate?: (tab: string) => void;
}> = ({ config, refreshKey, onRefresh, onEditVoucher, onViewVoucher, onNavigate }) => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingSchedule, setIsExportingSchedule] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [dbConnectionError, setDbConnectionError] = useState(false);
  const dashboardDataRef = useRef<HTMLDivElement>(null);
  const bookingScheduleRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState({
    today: true,
    tomorrow: true,
    previous: false,
    afterTomorrow: false,
    all: false,
    fromDate: '',
    toDate: ''
  });

  // Derived Metrics Calculation (Real-time computed)
  const stats = useMemo(() => {
    const totalReceivables = accounts
      .filter(a => a.type === AccountType.CUSTOMER && a.balance > 0)
      .reduce((sum, a) => sum + a.balance, 0);

    const totalPayables = accounts
      .filter(a => a.type === AccountType.VENDOR && a.balance < 0)
      .reduce((sum, a) => sum + Math.abs(a.balance), 0);

    const totalCash = accounts
      .filter(a => a.type === AccountType.CASH_BANK)
      .reduce((sum, a) => sum + a.balance, 0);

    const totalIncome = vouchers
      .filter(v => [VoucherType.HOTEL, VoucherType.TRANSPORT, VoucherType.VISA, VoucherType.TICKET].includes(v.type))
      .reduce((sum, v) => sum + v.totalAmountPKR, 0);

    return { totalReceivables, totalPayables, totalCash, totalIncome };
  }, [accounts, vouchers]);

  // Animated numbers for the summary cards
  const animReceivables = useAnimatedNumber(stats.totalReceivables);
  const animPayables = useAnimatedNumber(stats.totalPayables);
  const animIncome = useAnimatedNumber(stats.totalIncome);
  const animCash = useAnimatedNumber(stats.totalCash);

  const [showMobileDailySummary, setShowMobileDailySummary] = useState(false);
  const [scheduleClickCount, setScheduleClickCount] = useState(0);
  const [lastScheduleClick, setLastScheduleClick] = useState(0);

  const fetchData = useCallback(async (isBackground = false) => {
    if (isBackground) setIsRefreshing(true);
    else setLoading(true);
    
    try {
      const [v, accs] = await Promise.all([
        getVouchers(),
        getAccounts()
      ]);
      setVouchers(v);
      setAccounts(accs);
      setLastUpdated(new Date());
      setDbConnectionError(false);
    } catch (error: any) {
      console.error("Failed to sync dashboard:", error);
      if (error?.message === 'TypeError: Failed to fetch') {
        setDbConnectionError(true);
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(refreshKey !== undefined && refreshKey > 0);
  }, [fetchData, refreshKey]);

  // Real-time Subscription
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime-v4')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vouchers' }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ledger_entries' }, () => fetchData(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Automatic 5-second sync (User Request)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const pieData = useMemo(() => [
    { name: 'Receivables', value: Math.max(stats.totalReceivables, 0.1), color: '#3B82F6' },
    { name: 'Payables', value: Math.max(stats.totalPayables, 0.1), color: '#EF4444' }
  ], [stats]);

  const lineData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const last6Months = [];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      last6Months.push({
        name: months[d.getMonth()],
        year: d.getFullYear(),
        monthNum: d.getMonth(),
        revenue: 0,
        receivables: 0,
        payables: 0
      });
    }

    // Revenue Trends (Service Vouchers)
    vouchers.forEach(v => {
      const vDate = new Date(v.date);
      const targetMonth = last6Months.find(m => m.monthNum === vDate.getMonth() && m.year === vDate.getFullYear());
      if (targetMonth) {
        if ([VoucherType.HOTEL, VoucherType.VISA, VoucherType.TRANSPORT, VoucherType.TICKET].includes(v.type)) {
          targetMonth.revenue += v.totalAmountPKR;
        }
      }
    });

    // Account Activity Trends (Change in balance)
    accounts.forEach(acc => {
      acc.ledger.forEach(entry => {
        const eDate = new Date(entry.date);
        const targetMonth = last6Months.find(m => m.monthNum === eDate.getMonth() && m.year === eDate.getFullYear());
        if (targetMonth) {
          if (acc.type === AccountType.CUSTOMER) {
            targetMonth.receivables += (entry.debit - entry.credit);
          } else if (acc.type === AccountType.VENDOR) {
            targetMonth.payables += (entry.credit - entry.debit);
          }
        }
      });
    });

    return last6Months;
  }, [vouchers, accounts]);

  const bookingSchedule = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const afterTomorrow = new Date(tomorrow);
    afterTomorrow.setDate(afterTomorrow.getDate() + 1);

    const isSameDay = (d1: Date, d2: Date) => {
      return d1.getFullYear() === d2.getFullYear() &&
             d1.getMonth() === d2.getMonth() &&
             d1.getDate() === d2.getDate();
    };

    return vouchers
      .filter(v => [VoucherType.HOTEL, VoucherType.TRANSPORT, VoucherType.VISA, VoucherType.TICKET].includes(v.type))
      .flatMap(v => {
        const vendor = accounts.find(a => a.id === v.vendorId);
        const customer = accounts.find(a => a.id === v.customerId);
        
        const items = v.details?.items || [];
        
        // If no items, treat as a single entry
        if (items.length === 0) {
          let bookingDate = new Date(v.date);
          let checkoutDate: Date | null = null;
          if (v.type === VoucherType.HOTEL && v.details?.fromDate) {
            bookingDate = new Date(v.details.fromDate);
          }
          if (v.type === VoucherType.HOTEL && v.details?.toDate) {
            checkoutDate = new Date(v.details.toDate);
          } else if (v.type === VoucherType.HOTEL && v.details?.numNights) {
            checkoutDate = new Date(bookingDate);
            checkoutDate.setDate(checkoutDate.getDate() + Number(v.details.numNights));
          }

          let statusColor = 'text-slate-600 dark:text-slate-400';
          let bgColor = 'bg-white dark:bg-slate-900';
          let isToday = isSameDay(bookingDate, today);
          let isTomorrow = isSameDay(bookingDate, tomorrow);
          let isPrevious = bookingDate < today;
          let isAfterTomorrow = bookingDate >= afterTomorrow;

          if (isToday) {
            statusColor = 'text-emerald-600 dark:text-emerald-400';
            bgColor = 'bg-emerald-50/50 dark:bg-emerald-900/10';
          } else if (isTomorrow) {
            statusColor = 'text-amber-600 dark:text-amber-400';
            bgColor = 'bg-amber-50/50 dark:bg-amber-900/10';
          } else if (isPrevious) {
            statusColor = 'text-rose-600 dark:text-rose-400';
            bgColor = 'bg-rose-50/50 dark:bg-rose-900/10';
          } else if (isAfterTomorrow) {
            statusColor = 'text-purple-600 dark:text-purple-400';
            bgColor = 'bg-purple-50/50 dark:bg-purple-900/10';
          }

          return [{
            ...v,
            vendorName: vendor?.name || 'N/A',
            customerName: customer?.name || 'N/A',
            bookingDate,
            statusColor,
            bgColor,
            isToday,
            isTomorrow,
            isPrevious,
            isAfterTomorrow,
            checkoutDate,
            paxName: v.details?.paxName || v.details?.headName || 'N/A',
            hotelName: v.details?.hotelName || v.details?.airline || 'N/A',
            roomType: v.details?.roomType || v.details?.sector || '-',
            numNights: v.details?.numNights || '-',
            totalAmountPKR: v.totalAmountPKR
          }];
        }

        // Process multiple items
        return items.map((item: any, idx: number) => {
          let bookingDate = new Date(v.date);
          let checkoutDate: Date | null = null;
          if (v.type === VoucherType.HOTEL && item.fromDate) {
            bookingDate = new Date(item.fromDate);
          } else if (v.type === VoucherType.HOTEL && v.details?.fromDate) {
            bookingDate = new Date(v.details.fromDate);
          }

          if (v.type === VoucherType.HOTEL && item.toDate) {
            checkoutDate = new Date(item.toDate);
          } else if (v.type === VoucherType.HOTEL && v.details?.toDate) {
            checkoutDate = new Date(v.details.toDate);
          } else if (v.type === VoucherType.HOTEL && (item.numNights || v.details?.numNights)) {
            checkoutDate = new Date(bookingDate);
            checkoutDate.setDate(checkoutDate.getDate() + Number(item.numNights || v.details.numNights));
          }

          let statusColor = 'text-slate-600 dark:text-slate-400';
          let bgColor = 'bg-white dark:bg-slate-900';
          let isToday = isSameDay(bookingDate, today);
          let isTomorrow = isSameDay(bookingDate, tomorrow);
          let isPrevious = bookingDate < today;
          let isAfterTomorrow = bookingDate >= afterTomorrow;

          if (isToday) {
            statusColor = 'text-emerald-600 dark:text-emerald-400';
            bgColor = 'bg-emerald-50/50 dark:bg-emerald-900/10';
          } else if (isTomorrow) {
            statusColor = 'text-amber-600 dark:text-amber-400';
            bgColor = 'bg-amber-50/50 dark:bg-amber-900/10';
          } else if (isPrevious) {
            statusColor = 'text-rose-600 dark:text-rose-400';
            bgColor = 'bg-rose-50/50 dark:bg-rose-900/10';
          } else if (isAfterTomorrow) {
            statusColor = 'text-purple-600 dark:text-purple-400';
            bgColor = 'bg-purple-50/50 dark:bg-purple-900/10';
          }

          // Calculate line amount
          let lineAmount = 0;
          const rate = v.currency === Currency.SAR ? v.roe : 1;
          if (v.type === VoucherType.HOTEL) {
            lineAmount = (Number(item.unitRate || 0) * Number(item.numRooms || 1) * Number(item.numNights || 1)) * rate;
          } else if (v.type === VoucherType.TRANSPORT) {
            lineAmount = Number(item.rate || item.amount || 0) * rate;
          } else if (v.type === VoucherType.VISA) {
            lineAmount = (Number(item.quantity || 1) * Number(item.rate || 0)) * rate;
          } else {
            lineAmount = v.totalAmountPKR / (items.length || 1);
          }

          return {
            ...v,
            id: `${v.id}-${idx}`, // Unique ID for each row segment
            vendorName: vendor?.name || 'N/A',
            customerName: customer?.name || 'N/A',
            bookingDate,
            statusColor,
            bgColor,
            isToday,
            isTomorrow,
            isPrevious,
            isAfterTomorrow,
            checkoutDate,
            paxName: item.paxName || v.details?.paxName || 'N/A',
            hotelName: item.hotelName || (v.type === VoucherType.VISA ? 'VISA PROCESSING' : item.vehicle) || v.details?.hotelName || v.details?.airline || 'N/A',
            roomType: item.roomType || item.sector || item.description || v.details?.roomType || v.details?.sector || '-',
            numNights: item.numNights || v.details?.numNights || '-',
            totalAmountPKR: lineAmount
          };
        });
      })
      .filter(b => {
        if (filters.fromDate && filters.toDate) {
          const start = new Date(filters.fromDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(filters.toDate);
          end.setHours(23, 59, 59, 999);
          return b.bookingDate >= start && b.bookingDate <= end;
        }
        if (filters.all) return true;
        if (filters.today && b.isToday) return true;
        if (filters.tomorrow && b.isTomorrow) return true;
        if (filters.previous && b.isPrevious) return true;
        if (filters.afterTomorrow && b.isAfterTomorrow) return true;
        return false;
      })
      .sort((a, b) => b.bookingDate.getTime() - a.bookingDate.getTime());
  }, [vouchers, accounts, filters]);

  const handleExportPDF = async () => {
    if (!dashboardDataRef.current) return;
    setIsExporting(true);
    
    const element = dashboardDataRef.current;
    element.classList.add('exporting', 'pdf-export-container');
    const fileName = `Dashboard_Metrics_${formatDate(new Date())}.pdf`;

    const opt = {
      margin: [10, 10, 10, 10],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        letterRendering: true,
        backgroundColor: '#ffffff'
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    try {
      // Small delay to allow classes like 'exporting' to apply and DOM to settle
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // @ts-ignore
      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error("Dashboard Export Error:", err);
    } finally {
      element.classList.remove('exporting', 'pdf-export-container');
      setIsExporting(false);
    }
  };

  const handleExportBookingSchedulePDF = async () => {
    if (!bookingScheduleRef.current) return;
    setIsExportingSchedule(true);
    
    const element = bookingScheduleRef.current;
    element.classList.add('exporting', 'pdf-export-container');
    
    // Force auto height and visible overflow to ensure full table capture
    const originalStyle = element.style.height;
    const originalOverflow = element.style.overflow;
    const originalWidth = element.style.width;
    const originalMaxW = element.style.maxWidth;
    const originalPos = element.style.position;
    const originalMarg = element.style.margin;
    
    element.style.height = 'auto';
    element.style.overflow = 'visible';
    element.style.width = '1050px'; // Optimization for A4 Landscape
    element.style.maxWidth = 'none';
    element.style.position = 'relative';
    element.style.margin = '0 auto';
    element.style.backgroundColor = 'white';

    const fileName = `Booking_Schedule_${formatDate(new Date())}.pdf`;

    const opt = {
      margin: [10, 5, 10, 5],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        letterRendering: true,
        backgroundColor: '#ffffff',
        scrollY: 0,
        scrollX: 0,
        windowWidth: 1100
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape', compress: true }
    };

    try {
      // Delay to allow layout settling
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // @ts-ignore
      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error("Booking Schedule Export Error:", err);
    } finally {
      element.classList.remove('exporting', 'pdf-export-container');
      element.style.height = originalStyle;
      element.style.overflow = originalOverflow;
      element.style.width = originalWidth;
      element.style.maxWidth = originalMaxW;
      element.style.position = originalPos;
      element.style.margin = originalMarg;
      setIsExportingSchedule(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-96 space-y-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Computing Analytics...</p>
    </div>
  );

  const renderMobileDashboard = () => (
    <div className="md:hidden space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      {dbConnectionError && (
        <div className="bg-rose-100 dark:bg-rose-900/40 p-4 rounded-3xl border border-rose-200 dark:border-rose-900/50 flex items-center space-x-3">
          <span className="text-xl">📡</span>
          <div className="flex-1">
            <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase leading-none">Database Offline</p>
            <p className="text-[8px] text-rose-500 dark:text-rose-500 font-bold uppercase mt-1">Failed to fetch data from cloud. Check connection.</p>
          </div>
          <button onClick={() => fetchData()} className="bg-white/50 dark:bg-rose-900/20 px-3 py-1 rounded-lg text-[9px] font-black text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">RETRY</button>
        </div>
      )}
      {/* Mobile Balance Cards (Horizontal Scroll) */}
      <div className="flex space-x-3 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4">
        {[
          { label: 'CASH/BANK (Rs.)', value: animCash, color: 'text-rose-600', bg: 'bg-rose-50/50 dark:bg-rose-900/20', tab: 'ledger' },
          { label: 'RECEIVABLE (Rs.)', value: animReceivables, color: 'text-blue-600', bg: 'bg-blue-50/50 dark:bg-blue-900/20', tab: 'customers' },
          { label: 'PAYABLE (Rs.)', value: animPayables, color: 'text-slate-800 dark:text-white', bg: 'bg-slate-50/50 dark:bg-slate-800/50', tab: 'vendors' }
        ].map((card, idx) => (
          <div 
            key={idx} 
            onClick={() => onNavigate?.(card.tab)}
            className={`flex-shrink-0 w-[240px] p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm cursor-pointer active:scale-95 transition-all ${card.bg}`}
          >
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{card.label}</p>
             <p className={`text-2xl font-orbitron font-bold tracking-tighter ${card.color}`}>
               {formatCurrency(Math.floor(card.value))}
             </p>
          </div>
        ))}
      </div>

      {/* Daily Summary Toggle */}
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-800">
        <button 
          onClick={() => setShowMobileDailySummary(!showMobileDailySummary)}
          className="w-full flex justify-between items-center"
        >
          <div className="text-left">
            <h3 className="text-sm font-black text-emerald-600 uppercase tracking-tight">Daily Summary</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Graphical Dashboard View</p>
          </div>
          <span className={`transition-transform duration-300 text-slate-300 ${showMobileDailySummary ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {showMobileDailySummary && (
          <div className="mt-6 space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <XAxis dataKey="name" hide />
                  <YAxis hide />
                  <Tooltip 
                    formatter={(value: number) => [`PKR ${value.toLocaleString()}`]}
                    contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '10px' }} 
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="receivables" stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {pieData.map((item, i) => (
                <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[8px] text-slate-400 font-black uppercase mb-1">{item.name}</p>
                  <p className="text-xs font-black text-slate-800 dark:text-white uppercase truncate">Rs {formatCurrency(Math.floor(item.value))}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Booking Schedule Banner */}
      <div 
        onClick={() => {
          // Secret Trigger: Control Panel
          const now = Date.now();
          if (now - lastScheduleClick < 1000) {
            const newCount = scheduleClickCount + 1;
            setScheduleClickCount(newCount);
            if (newCount >= 8) {
              onNavigate?.('control');
              setScheduleClickCount(0);
            }
          } else {
            setScheduleClickCount(1);
          }
          setLastScheduleClick(now);

          bookingScheduleRef.current?.scrollIntoView({ behavior: 'smooth' });
        }}
        className="bg-white dark:bg-slate-900 rounded-[2rem] p-5 shadow-xl border border-blue-50 dark:border-blue-900/20 flex items-center space-x-4 cursor-pointer active:scale-[0.98] transition-all"
      >
        <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-2xl shadow-inner">📅</div>
        <div className="flex-1">
          <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Booking Schedule</h3>
          <p className="text-[9px] text-slate-400 font-bold uppercase leading-tight mt-1">View live operational feed</p>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleExportBookingSchedulePDF();
            }}
            disabled={isExportingSchedule}
            className="w-10 h-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center rounded-xl shadow-sm active:scale-95 transition-all disabled:opacity-50"
          >
            {isExportingSchedule ? '⏳' : '📥'}
          </button>
          <button className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-blue-500/20">Open List</button>
        </div>
      </div>

      {/* Action Grid: Create */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-black text-blue-600 uppercase tracking-wider">Create</h3>
          <span className="text-slate-300">▼</span>
        </div>
        <div className="grid grid-cols-4 gap-y-8 gap-x-4">
          {[
            { label: 'Hotel', icon: '🏨', tab: 'vouchers' },
            { label: 'Ticket', icon: '🎫', tab: 'vouchers' },
            { label: 'Visa', icon: '🛂', tab: 'vouchers' },
            { label: 'Transport', icon: '🚌', tab: 'vouchers' },
            { label: 'Cash In', icon: '📥', tab: 'ledger' },
            { label: 'Cash Out', icon: '📤', tab: 'ledger' },
            { label: 'Vendor', icon: '🏢', tab: 'coa' },
            { label: 'Customer', icon: '👥', tab: 'coa' }
          ].map((action, idx) => (
            <button key={idx} onClick={() => onNavigate?.(action.tab)} className="flex flex-col items-center space-y-2 group active:scale-90 transition-transform">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/80 flex items-center justify-center text-2xl border border-slate-100 dark:border-slate-800 group-hover:bg-blue-50 transition-colors shadow-sm">
                {action.icon}
              </div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter text-center leading-none">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Action Grid: View & Share */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-black text-emerald-600 uppercase tracking-wider">View & Share</h3>
          <span className="text-slate-300">▼</span>
        </div>
        <div className="grid grid-cols-4 gap-y-8 gap-x-4">
          {[
            { label: 'Vouchers', icon: '📋', tab: 'vouchers' },
            { label: 'Ledger', icon: '📖', tab: 'ledger' },
            { label: 'Customers', icon: '👥', tab: 'customers' },
            { label: 'Vendors', icon: '🏢', tab: 'vendors' }
          ].map((action, idx) => (
            <button key={idx} onClick={() => onNavigate?.(action.tab)} className="flex flex-col items-center space-y-2 group active:scale-90 transition-transform">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 flex items-center justify-center text-2xl border border-emerald-100 dark:border-emerald-900/20 group-hover:bg-emerald-100 transition-colors shadow-sm">
                {action.icon}
              </div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter text-center leading-none">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Daily Summary Preview */}
      <div className="bg-slate-900 text-white rounded-[2rem] p-6 shadow-2xl relative overflow-hidden group">
        <div className="relative z-10">
          <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-1">Daily Summary</h3>
          <p className="text-lg font-bold">Know your business in one click</p>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-emerald-500/20 to-transparent flex items-center justify-center">
            <span className="text-2xl group-hover:translate-x-2 transition-transform">➔</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-1">
      {renderMobileDashboard()}
      
      {/* Desktop Dashboard (Keep existing) */}
      <div className="hidden md:block">
        {dbConnectionError && (
          <div className="mb-6 bg-rose-100 dark:bg-rose-900/40 p-5 rounded-[2rem] border border-rose-200 dark:border-rose-900/50 flex items-center justify-between animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white dark:bg-rose-900/30 rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-rose-100 dark:border-rose-900/40">📡</div>
              <div>
                <h4 className="text-sm font-black text-rose-600 dark:text-rose-400 uppercase tracking-tighter">Connectivity Failure Initialized</h4>
                <p className="text-[10px] text-rose-500 font-bold uppercase">The system failed to reach the database cluster (Failed to fetch). Retrying automatically...</p>
              </div>
            </div>
            <button 
              onClick={() => fetchData()} 
              className="bg-rose-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 active:scale-95 transition-all shadow-lg shadow-rose-600/20"
            >
              Manual Force Sync
            </button>
          </div>
        )}
        <div className="space-y-6">
          {/* Dashboard Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
            <div>
              <h2 className="text-2xl font-black font-orbitron text-slate-900 dark:text-white uppercase tracking-tighter leading-none">Intelligence Hub</h2>
              <div className="flex items-center space-x-2 mt-2">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
                  Data Refresh: {lastUpdated.toLocaleTimeString()}
                </p>
                {isRefreshing && <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={onRefresh}
                className="no-print flex items-center space-x-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] transition-all hover:scale-105 active:scale-95 shadow-lg shadow-emerald-600/10"
              >
                <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
                <span>Refresh Database</span>
              </button>
              <button 
                onClick={handleExportPDF}
                disabled={isExporting}
                className="no-print flex items-center space-x-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-xl font-black uppercase text-[10px] transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-lg shadow-slate-900/10"
              >
                <span>{isExporting ? '⏳' : '📥'}</span>
                <span>{isExporting ? 'Exporting...' : 'Export Dashboard'}</span>
              </button>
              <button 
                onClick={handleExportBookingSchedulePDF}
                disabled={isExportingSchedule}
                className="no-print flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-lg shadow-blue-600/10"
              >
                <span>{isExportingSchedule ? '⏳' : '📅'}</span>
                <span>{isExportingSchedule ? 'Exporting...' : 'Export Booking Schedule PDF'}</span>
              </button>
              <div className="flex items-center space-x-2 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <div className={`w-2 h-2 rounded-full bg-emerald-500 animate-blink shadow-[0_0_8px_rgba(16,185,129,0.5)]`}></div>
                <span className="text-[10px] font-black uppercase tracking-tighter text-blue-600 dark:text-blue-400">Live Sync Enabled</span>
              </div>
            </div>
          </div>

          <div ref={dashboardDataRef} className="space-y-6">
            {/* Hidden Export Header */}
            <div className="hidden show-on-export bg-white p-8 border-b-2 border-slate-900 mb-6 flex flex-col items-center text-center">
              <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">{config.companyName}</h1>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">{config.appSubtitle}</p>
              <div className="flex gap-4 mt-2 text-[10px] font-bold text-slate-400 uppercase">
                <span>{config.companyCell}</span>
                <span>|</span>
                <span>{config.companyEmail}</span>
              </div>
              <h2 className="text-xl font-black mt-6 uppercase tracking-tight text-blue-600">Dashboard Financial Metrics</h2>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Receivables', value: animReceivables, icon: '↗️', color: 'text-blue-600', tab: 'customers' },
                { label: 'Total Payables', value: animPayables, icon: '↘️', color: 'text-rose-500', tab: 'vendors' },
                { label: 'Total Revenue', value: animIncome, icon: '💰', color: 'text-emerald-500', tab: 'reports' },
                { label: 'Cash/Bank', value: animCash, icon: '🏦', color: 'text-blue-500', tab: 'ledger' }
              ].map((card, i) => (
                <div 
                  key={i} 
                  onClick={() => onNavigate?.(card.tab)}
                  className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-xl transition-all hover:-translate-y-1 relative overflow-hidden group cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-xl group-hover:scale-110 transition-transform">{card.icon}</span>
                    <span className="text-[10px] font-black text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">View Details →</span>
                  </div>
                  <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{card.label}</h3>
                  <p className={`text-2xl font-orbitron font-bold mt-1 tracking-tighter uppercase ${card.color}`}>
                    PKR {formatCurrency(Math.floor(card.value))}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Income Trends Chart */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm min-w-0">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold">Consolidated Trends</h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Revenue vs Exposure</span>
                </div>
                <div className="h-72 w-full min-h-[300px] min-w-0">
                  {vouchers.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768 && (
                    <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={{ stroke: '#94a3b8', strokeWidth: 1 }} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                        dy={10}
                      />
                      <YAxis 
                        axisLine={{ stroke: '#94a3b8', strokeWidth: 1 }} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                        tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        formatter={(value: number) => [`PKR ${value.toLocaleString()}`]}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }} 
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: '10px' }} />
                      
                      <Line 
                        name="Revenue" 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="#3B82F6" 
                        strokeWidth={4} 
                        dot={{ r: 4, fill: '#3B82F6', strokeWidth: 0 }} 
                        activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} 
                      />
                      <Line 
                        name="Receivables" 
                        type="monotone" 
                        dataKey="receivables" 
                        stroke="#10B981" 
                        strokeWidth={2} 
                        strokeDasharray="5 5"
                        dot={{ r: 3, fill: '#10B981', strokeWidth: 0 }} 
                      />
                      <Line 
                        name="Payables" 
                        type="monotone" 
                        dataKey="payables" 
                        stroke="#F43F5E" 
                        strokeWidth={2} 
                        strokeDasharray="3 3"
                        dot={{ r: 3, fill: '#F43F5E', strokeWidth: 0 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                </div>
              </div>

              {/* Exposure Breakdown Chart */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center min-w-0">
                <div className="w-full flex justify-between items-center mb-2 px-2">
                  <h3 className="text-lg font-bold">Exposure Donut</h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Liability Ratio</span>
                </div>
                <div className="flex-1 w-full h-72 min-h-[300px] relative">
                  {vouchers.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768 && (
                    <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={pieData} 
                        innerRadius={70} 
                        outerRadius={95} 
                        paddingAngle={8} 
                        dataKey="value"
                        animationDuration={1500}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                        ))}
                        <Label 
                          value="Exposure" 
                          position="center" 
                          fill="#94a3b8" 
                          style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }} 
                          dy={-10}
                        />
                        <Label 
                          value={`${((stats.totalReceivables / (stats.totalReceivables + stats.totalPayables || 1)) * 100).toFixed(0)}% DR`} 
                          position="center" 
                          fill="#3B82F6" 
                          style={{ fontSize: '16px', fontWeight: 900 }} 
                          dy={12}
                        />
                      </Pie>
                      <Tooltip formatter={(value: number) => `PKR ${value.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                </div>
                <div className="grid grid-cols-2 gap-4 w-full mt-2 px-4">
                  {pieData.map((item, i) => (
                    <div key={i} className="flex flex-col items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center space-x-2 mb-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{item.name}</p>
                      </div>
                      <p className="text-xs font-black uppercase truncate">PKR {formatCurrency(Math.floor(item.value))}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Schedule Table - Visible on ALL screens */}
      <div id="booking-schedule-section" ref={bookingScheduleRef} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Hidden Export Header */}
        <div className="hidden show-on-export bg-white p-8 border-b-2 border-slate-900 mb-6 flex flex-col items-center text-center">
          <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">{config.companyName}</h1>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">{config.appSubtitle}</p>
          <div className="flex gap-4 mt-2 text-[10px] font-bold text-slate-400 uppercase">
            <span>{config.companyCell}</span>
            <span>|</span>
            <span>{config.companyEmail}</span>
          </div>
          <h2 className="text-xl font-black mt-6 uppercase tracking-tight text-blue-600">Booking Schedule Report</h2>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="w-full flex justify-between items-center px-1">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">Booking Schedule</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Live Operational Feed</p>
            </div>
            <button 
              onClick={handleExportBookingSchedulePDF}
              disabled={isExportingSchedule}
              className="md:hidden flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
              title="Download PDF"
            >
              {isExportingSchedule ? <span className="animate-spin text-xs">⏳</span> : <span>📥</span>}
            </button>
          </div>
          <div className="w-full md:w-auto flex flex-wrap items-center gap-2 md:gap-4 bg-slate-50 dark:bg-slate-800/50 p-2 md:p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
            {[
              { id: 'today', label: 'Today', color: 'bg-emerald-500' },
              { id: 'tomorrow', label: 'Tmrw', color: 'bg-amber-500' },
              { id: 'afterTomorrow', label: 'Day After', color: 'bg-indigo-500' },
              { id: 'previous', label: 'Prev', color: 'bg-rose-500' },
              { id: 'all', label: 'All', color: 'bg-blue-500' }
            ].map(f => (
              <label key={f.id} className="flex items-center space-x-1.5 cursor-pointer group px-2 py-1 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800">
                <input 
                  type="checkbox" 
                  checked={filters[f.id as keyof typeof filters] as boolean}
                  onChange={(e) => setFilters(prev => ({ ...prev, [f.id]: e.target.checked }))}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className={`text-[9px] font-black uppercase tracking-tight transition-colors ${filters[f.id as keyof typeof filters] ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                  {f.label}
                </span>
              </label>
            ))}

            <div className="w-full md:w-auto flex items-center space-x-2 mt-2 md:mt-0 md:ml-2 md:pl-4 md:border-l border-slate-200 dark:border-slate-700">
              <DateInput 
                className="flex-1 md:w-28 bg-white dark:bg-slate-900 border-none rounded-lg p-2 text-[10px] font-bold outline-none ring-1 ring-slate-100 dark:ring-slate-800"
                value={filters.fromDate}
                onChange={val => setFilters(prev => ({ ...prev, fromDate: val }))}
              />
              <span className="text-[9px] font-bold text-slate-300">➜</span>
              <DateInput 
                className="flex-1 md:w-28 bg-white dark:bg-slate-900 border-none rounded-lg p-2 text-[10px] font-bold outline-none ring-1 ring-slate-100 dark:ring-slate-800"
                value={filters.toDate}
                onChange={val => setFilters(prev => ({ ...prev, toDate: val }))}
              />
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto -mx-6 px-6 no-scrollbar">
          <table className="w-full text-left table-auto border-collapse min-w-[800px]">
            <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 text-[9px] uppercase tracking-[0.2em] font-black border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-4 py-4">Check In</th>
                <th className="px-4 py-4">Check Out</th>
                <th className="px-4 py-4">Pax Group</th>
                <th className="px-4 py-4">Service</th>
                <th className="px-4 py-4">Vendor Partner</th>
                <th className="px-4 py-4">Client Name</th>
                <th className="px-4 py-4">Allocation</th>
                <th className="px-4 py-4 text-center">Nights</th>
                <th className="px-4 py-4 text-right">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {bookingSchedule.length > 0 ? (
                bookingSchedule.map((booking, idx) => (
                  <tr 
                    key={idx} 
                    className={`${booking.bgColor} transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer`}
                    onClick={() => onEditVoucher?.(booking as unknown as Voucher)}
                  >
                    <td className={`px-4 py-4 text-[11px] font-bold ${booking.statusColor}`}>
                      {formatDate(booking.bookingDate)}
                    </td>
                    <td className="px-4 py-4 text-[11px] font-bold text-slate-500">
                      {booking.checkoutDate ? formatDate(booking.checkoutDate as Date) : '-'}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-[11px] font-black text-slate-800 dark:text-white uppercase leading-none">{booking.paxName}</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className={`w-fit px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest mb-1 border ${
                          booking.type === VoucherType.HOTEL ? 'border-blue-200 text-blue-600 bg-blue-50/50' :
                          booking.type === VoucherType.TRANSPORT ? 'border-purple-200 text-purple-600 bg-purple-50/50' :
                          booking.type === VoucherType.VISA ? 'border-emerald-200 text-emerald-600 bg-emerald-50/50' :
                          'border-slate-200 text-slate-600 bg-slate-50/50'
                        }`}>
                          {booking.type}
                        </span>
                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase line-clamp-1">{booking.hotelName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase leading-none">{booking.vendorName}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase leading-none">{booking.customerName}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium uppercase">
                        {booking.roomType}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        {booking.numNights}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="text-[11px] font-orbitron font-black text-slate-900 dark:text-white">
                        {formatCurrency(booking.totalAmountPKR)}
                      </p>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">
                    No bookings found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;