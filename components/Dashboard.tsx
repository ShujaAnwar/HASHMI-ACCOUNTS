import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend, Label
} from 'recharts';
import { getVouchers, getAccounts } from '../services/db';
import { supabase } from '../services/supabase';
import { VoucherType, AccountType, Voucher, Account } from '../types';

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

const Dashboard: React.FC<{ onEditVoucher?: (v: Voucher) => void; onViewVoucher?: (v: Voucher) => void }> = ({ onEditVoucher, onViewVoucher }) => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState({
    today: true,
    tomorrow: true,
    previous: false,
    all: false
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
    } catch (error) {
      console.error("Failed to sync dashboard:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Real-time Subscription and Initial Load
  useEffect(() => {
    fetchData();

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

    const isSameDay = (d1: Date, d2: Date) => {
      return d1.getFullYear() === d2.getFullYear() &&
             d1.getMonth() === d2.getMonth() &&
             d1.getDate() === d2.getDate();
    };

    return vouchers
      .filter(v => [VoucherType.HOTEL, VoucherType.TRANSPORT, VoucherType.VISA, VoucherType.TICKET].includes(v.type))
      .map(v => {
        const vendor = accounts.find(a => a.id === v.vendorId);
        const customer = accounts.find(a => a.id === v.customerId);
        
        // For Hotel, use fromDate if available, otherwise voucher date
        let bookingDate = new Date(v.date);
        if (v.type === VoucherType.HOTEL && v.details?.fromDate) {
          bookingDate = new Date(v.details.fromDate);
        }

        let statusColor = 'text-slate-600 dark:text-slate-400';
        let bgColor = 'bg-white dark:bg-slate-900';
        let isToday = isSameDay(bookingDate, today);
        let isTomorrow = isSameDay(bookingDate, tomorrow);
        let isPrevious = bookingDate < today;

        if (isToday) {
          statusColor = 'text-emerald-600 dark:text-emerald-400';
          bgColor = 'bg-emerald-50/50 dark:bg-emerald-900/10';
        } else if (isTomorrow) {
          statusColor = 'text-amber-600 dark:text-amber-400';
          bgColor = 'bg-amber-50/50 dark:bg-amber-900/10';
        } else if (isPrevious) {
          statusColor = 'text-rose-600 dark:text-rose-400';
          bgColor = 'bg-rose-50/50 dark:bg-rose-900/10';
        }

        return {
          ...v,
          vendorName: vendor?.name || 'N/A',
          customerName: customer?.name || 'N/A',
          bookingDate,
          statusColor,
          bgColor,
          isToday,
          isTomorrow,
          isPrevious,
          paxName: v.details?.paxName || v.details?.headName || 'N/A',
          hotelName: v.details?.hotelName || v.details?.airline || v.details?.items?.[0]?.vehicle || 'N/A',
          roomType: v.details?.roomType || v.details?.items?.[0]?.sector || '-',
          numNights: v.details?.numNights || '-',
        };
      })
      .filter(b => {
        if (filters.all) return true;
        if (filters.today && b.isToday) return true;
        if (filters.tomorrow && b.isTomorrow) return true;
        if (filters.previous && b.isPrevious) return true;
        return false;
      })
      .sort((a, b) => b.bookingDate.getTime() - a.bookingDate.getTime());
  }, [vouchers, accounts, filters]);

  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;
    setIsExporting(true);
    
    const element = dashboardRef.current;
    const fileName = `Dashboard_Report_${new Date().toISOString().split('T')[0]}.pdf`;

    const opt = {
      margin: [10, 10, 10, 10],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        letterRendering: true,
        backgroundColor: '#f8fafc' // slate-50 background for PDF
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    try {
      // @ts-ignore
      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error("Dashboard Export Error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-96 space-y-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Computing Analytics...</p>
    </div>
  );

  return (
    <div ref={dashboardRef} className="space-y-6 p-1">
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
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleExportPDF}
            disabled={isExporting}
            className="no-print flex items-center space-x-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-xl font-black uppercase text-[10px] transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-lg shadow-slate-900/10"
          >
            <span>{isExporting ? '⏳' : '📥'}</span>
            <span>{isExporting ? 'Exporting...' : 'Export PDF Report'}</span>
          </button>
          <div className="flex items-center space-x-2 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-xl border border-blue-100 dark:border-blue-900/30">
            <div className={`w-2 h-2 rounded-full bg-emerald-500 animate-blink shadow-[0_0_8px_rgba(16,185,129,0.5)]`}></div>
            <span className="text-[10px] font-black uppercase tracking-tighter text-blue-600 dark:text-blue-400">Live Sync Enabled</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Receivables', value: animReceivables, icon: '↗️', color: 'text-blue-600' },
          { label: 'Total Payables', value: animPayables, icon: '↘️', color: 'text-rose-500' },
          { label: 'Total Revenue', value: animIncome, icon: '💰', color: 'text-emerald-500' },
          { label: 'Cash/Bank', value: animCash, icon: '🏦', color: 'text-blue-500' }
        ].map((card, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-xl transition-all hover:-translate-y-1 relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
              <span className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-xl group-hover:scale-110 transition-transform">{card.icon}</span>
            </div>
            <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{card.label}</h3>
            <p className={`text-2xl font-orbitron font-bold mt-1 tracking-tighter uppercase ${card.color}`}>
              PKR {Math.floor(card.value).toLocaleString()}
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
          </div>
        </div>

        {/* Exposure Breakdown Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center min-w-0">
          <div className="w-full flex justify-between items-center mb-2 px-2">
            <h3 className="text-lg font-bold">Exposure Donut</h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Liability Ratio</span>
          </div>
          <div className="flex-1 w-full h-72 min-h-[300px] relative">
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
          </div>
          <div className="grid grid-cols-2 gap-4 w-full mt-2 px-4">
            {pieData.map((item, i) => (
              <div key={i} className="flex flex-col items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{item.name}</p>
                </div>
                <p className="text-xs font-black uppercase truncate">PKR {Math.floor(item.value).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Booking Schedule Table */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h3 className="text-lg font-bold">Booking Schedule</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Operational Timeline</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
            {[
              { id: 'today', label: 'Today', color: 'bg-emerald-500' },
              { id: 'tomorrow', label: 'Tomorrow', color: 'bg-amber-500' },
              { id: 'previous', label: 'Previous', color: 'bg-rose-500' },
              { id: 'all', label: 'All Bookings', color: 'bg-blue-500' }
            ].map(f => (
              <label key={f.id} className="flex items-center space-x-2 cursor-pointer group">
                <div className="relative flex items-center">
                  <input 
                    type="checkbox" 
                    checked={filters[f.id as keyof typeof filters]}
                    onChange={(e) => setFilters(prev => ({ ...prev, [f.id]: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${f.color}`}></span>
                  <span className={`text-[10px] font-black uppercase tracking-tight transition-colors ${filters[f.id as keyof typeof filters] ? 'text-slate-900 dark:text-white' : 'text-slate-400 group-hover:text-slate-600'}`}>
                    {f.label}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left table-auto border-collapse">
            <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 text-[9px] uppercase tracking-[0.2em] font-black border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-4 py-4">Check-in</th>
                <th className="px-4 py-4">Pax Name</th>
                <th className="px-4 py-4">Service/Hotel</th>
                <th className="px-4 py-4">Vendor</th>
                <th className="px-4 py-4">Room/Sector</th>
                <th className="px-4 py-4 text-center">Nights</th>
                <th className="px-4 py-4 text-right">Amount</th>
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
                      {booking.bookingDate.toLocaleDateString('en-GB')}
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
                        {booking.totalAmountPKR.toLocaleString()}
                      </p>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">
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