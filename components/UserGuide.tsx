import React from 'react';

import { AppConfig } from '../types';

interface UserGuideProps {
  config: AppConfig;
}

const UserGuide: React.FC<UserGuideProps> = ({ config }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20 animate-in fade-in duration-700">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto flex items-center justify-center text-3xl shadow-xl shadow-blue-500/20">
          📖
        </div>
        <h1 className="text-4xl font-orbitron font-black uppercase tracking-tighter text-slate-900 dark:text-white">
          {config.companyName} Guide
        </h1>
        <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-xs">
          Learn how to master {config.appSubtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Section 1: Dashboard */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl space-y-4">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-xl">
            📊
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">1. Dashboard</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Your home screen. It shows your <strong>Total Balance</strong>, 
            <strong>Recent Transactions</strong>, and a summary of your business health. 
            Check this first thing every morning!
          </p>
        </div>

        {/* Section 2: Chart of Accounts */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl space-y-4">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-xl">
            📁
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">2. Chart of Accounts</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            This is where you manage your "Account Heads". You can create accounts for 
            <strong>Cash</strong>, <strong>Banks</strong>, <strong>Expenses</strong>, and <strong>Income</strong>. 
            Click on any account to view its full history (Ledger).
          </p>
        </div>

        {/* Section 3: Vouchers */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl space-y-4">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center text-xl">
            📝
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">3. Recording Vouchers</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Use <strong>Receipt Vouchers</strong> when you get money from customers. 
            Use <strong>Payment Vouchers</strong> when you pay for bills or vendors. 
            We also have special forms for <strong>Tickets</strong>, <strong>Hotels</strong>, and <strong>Visas</strong>.
          </p>
        </div>

        {/* Section 4: Ledger & Reports */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl space-y-4">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-xl">
            📈
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">4. Ledger & Reports</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            The <strong>General Ledger</strong> shows every single transaction. 
            The <strong>Reports</strong> section gives you a <strong>Profit & Loss</strong> 
            statement and a <strong>Trial Balance</strong> to make sure your math is correct.
          </p>
        </div>
      </div>

      {/* Pro Tips Section */}
      <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl space-y-6 border border-white/5">
        <h3 className="text-2xl font-orbitron font-bold uppercase tracking-tighter text-center">
          💡 Pro Tips for Success
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <p className="font-black text-blue-400 uppercase text-[10px] tracking-widest">Daily Backups</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Go to the <strong>Control Panel</strong> and download an <strong>Excel Backup</strong> 
              every single day before you go home.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-black text-emerald-400 uppercase text-[10px] tracking-widest">Search Power</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Use the search bars in the Ledger to find any transaction by 
              <strong>Account Name</strong> or <strong>Voucher Number</strong> instantly.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-black text-amber-400 uppercase text-[10px] tracking-widest">PDF Export</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              You can download a professional <strong>PDF Ledger</strong> for any customer 
              to send them their current statement.
            </p>
          </div>
        </div>
      </div>

      <div className="text-center">
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em]">
          TravelLedger Pro • Enterprise Edition
        </p>
      </div>
    </div>
  );
};

export default UserGuide;
