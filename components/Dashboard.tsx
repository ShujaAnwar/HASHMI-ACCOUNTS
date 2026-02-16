import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { getVouchers, getAccounts } from '../services/db';
import { supabase } from '../services/supabase';
import { VoucherType, AccountType, Voucher, Account } from '../types';

const Dashboard: React.FC = () => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

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

    // Subscribe to real-time changes in ledger and vouchers
    const channel = supabase
      .channel('dashboard-realtime-v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vouchers' }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ledger_entries' }, () => fetchData(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        income: 0
      });
    }

    vouchers.forEach(v => {
      const vDate = new Date(v.date);
      const targetMonth = last6Months.find(m => m.monthNum === vDate.getMonth() && m.year === vDate.getFullYear());
      if (targetMonth && [VoucherType.HOTEL, VoucherType.VISA, VoucherType.TRANSPORT, VoucherType.TICKET].includes(v.type)) {
        targetMonth.income += v.totalAmountPKR;
      }
    });

    return last6Months;
  }, [vouchers]);

  if (loading) return (
    <div className="flex flex-col justify-center items-center h-96 space-y-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Computing Analytics...</p>
    </div>
  );

  return (
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
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-xl border border-blue-100 dark:border-blue-900/30">
            <div className={`w-2 h-2 rounded-full bg-emerald-500 animate-blink shadow-[0_0_8px_rgba(16,185,129,0.5)]`}></div>
            <span className="text-[10px] font-black uppercase tracking-tighter text-blue-600 dark:text-blue-400">Live Sync Enabled</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Receivables', value: stats.totalReceivables, icon: '↗️' },
          { label: 'Total Payables', value: stats.totalPayables, icon: '↘️' },
          { label: 'Total Revenue', value: stats.totalIncome, icon: '💰' },
          { label: 'Cash/Bank', value: stats.totalCash, icon: '🏦' }
        ].map((card, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-xl transition-all hover:-translate-y-1 relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
              <span className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-xl group-hover:scale-110 transition-transform">{card.icon}</span>
            </div>
            <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{card.label}</h3>
            <p className="text-2xl font-orbitron font-bold mt-1 tracking-tighter uppercase">
              PKR {card.value.toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Trends Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm min-w-0">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold">Income Trends</h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last 6 Months</span>
          </div>
          <div className="h-72 w-full min-h-[300px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(value: number) => [`PKR ${value.toLocaleString()}`, "Revenue"]}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                />
                <Line type="monotone" dataKey="income" stroke="#3B82F6" strokeWidth={4} dot={{ r: 6, fill: '#3B82F6', strokeWidth: 0 }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Exposure Breakdown Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center min-w-0">
          <div className="flex-1 w-full h-72 min-h-[300px] min-w-0">
            <h3 className="text-lg font-bold mb-4">Exposure Breakdown</h3>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `PKR ${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4 md:pl-6 w-full md:w-48 mt-4 md:mt-0">
            {pieData.map((item, i) => (
              <div key={i} className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 truncate">{item.name}</p>
                  <p className="text-sm font-bold truncate uppercase">PKR {item.value.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;