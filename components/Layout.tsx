import React, { useState, useEffect } from 'react';
import { AppConfig } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  config: AppConfig;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, config }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'coa', label: 'Chart of Accounts', icon: '📁' },
    { id: 'customers', label: 'Customers', icon: '👥' },
    { id: 'vendors', label: 'Vendors', icon: '🏢' },
    { id: 'vouchers', label: 'Vouchers', icon: '📝' },
    { id: 'reports', label: 'Reports', icon: '📈' },
    { id: 'control', label: 'Control Panel', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-950 transition-colors duration-300 font-inter">
      {/* Absolute Top Header - Bismillah Calligraphy (Updated: Small & Green) */}
      <header className="w-full bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 py-2 flex justify-center items-center z-30 transition-colors duration-300 no-print">
        <h2 className="text-xs md:text-sm font-bold text-emerald-600 dark:text-emerald-400 transition-colors duration-500 tracking-normal animate-in fade-in slide-in-from-top-1 duration-1000" dir="rtl">
          بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
        </h2>
      </header>

      <div className="flex flex-col md:flex-row flex-1">
        {/* Sidebar */}
        <aside className="no-print w-full md:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col md:h-[calc(100vh-48px)] md:sticky md:top-[48px] flex-shrink-0 z-20 transition-colors duration-300">
          <div className="p-6 flex-shrink-0">
            {config.companyLogo ? (
              <img src={config.companyLogo} alt="Logo" className="h-10 w-auto mb-2 object-contain" />
            ) : (
              <h1 className="text-2xl font-orbitron font-bold tracking-tighter uppercase break-words leading-tight">
                <span className="text-blue-600">{config.companyName.substring(0, Math.ceil(config.companyName.length / 2))}</span>
                <span className="text-slate-800 dark:text-white">{config.companyName.substring(Math.ceil(config.companyName.length / 2))}</span>
              </h1>
            )}
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1 opacity-80">
              {config.appSubtitle}
            </p>
          </div>
          
          <nav className="mt-4 px-3 space-y-1 flex-1 overflow-y-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  activeTab === item.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-xs font-bold uppercase tracking-widest">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-4 border-t dark:border-slate-800 flex items-center justify-between">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-600 transition-colors"
            >
              {isDarkMode ? '🌞' : '🌙'}
            </button>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter text-right">
              v2.5 Enterprise Edition
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;