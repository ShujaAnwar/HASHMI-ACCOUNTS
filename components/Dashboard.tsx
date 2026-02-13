import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { getAccounts, getVouchers, getDashboardMetrics } from '../services/db';
import { AccountType, VoucherType, DashboardStats, Voucher, Account } from '../types';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalReceivables: 0,
    totalPayables: 0,
    totalIncome: 0,
    totalCash: 0
  });
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [s, v] = await Promise.all([
        getDashboardMetrics(),
        getVouchers()
      ]);
      setStats(s);
      setVouchers(v);
      setLoading(false);
    };
    fetchData();
  }, []);

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

  if (loading) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Receivables', value: stats.totalReceivables, color: 'blue', icon: '↗️' },
          { label: 'Total Payables', value: stats.totalPayables, color: 'red', icon: '↘️' },
          { label: 'Total Revenue', value: stats.totalIncome, color: 'green', icon: '💰' },
          { label: 'Cash/Bank', value: stats.totalCash, color: 'purple', icon: '🏦' }
        ].map((card, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-xl transition-all hover:-translate-y-1">
            <div className="flex justify-between items-start mb-4">
              <span className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-xl">{card.icon}</span>
              <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Live</span>
            </div>
            <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{card.label}</h3>
            <p className="text-2xl font-orbitron font-bold mt-1">
              PKR {card.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm min-w-0">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold">Real-time Income Trends</h3>
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
                  <p className="text-sm font-bold truncate">PKR {item.value.toLocaleString()}</p>
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