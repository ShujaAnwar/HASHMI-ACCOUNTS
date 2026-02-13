
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
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 dark:bg-slate-950 transition-colors duration-300 font-inter">
      {/* Sidebar */}
      <aside className="no-print w-full md:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col md:h-screen md:sticky md:top-0 flex-shrink-0 z-20 transition-colors duration-300">
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
              <span className="font-semibold text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Improved Theme Toggle Bar */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700"
          >
            <div className="flex items-center space-x-2">
              <span className="text-lg">{isDarkMode ? '🌙' : '☀️'}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">{isDarkMode ? 'Dark Mode' : 'Light Mode'}</span>
            </div>
            <div className={`w-10 h-5 rounded-full relative transition-colors ${isDarkMode ? 'bg-blue-600' : 'bg-slate-300'}`}>
              <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-300 ${isDarkMode ? 'right-1' : 'left-1'}`} />
            </div>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <header className="flex justify-between items-center mb-8 no-print">
          <div>
            <h2 className="text-xl md:text-3xl font-bold text-slate-800 dark:text-white capitalize">
              {activeTab === 'coa' ? 'Chart of Accounts' : activeTab}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-widest mt-1">Environment: {config.companyName}</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold shadow-lg ring-4 ring-white dark:ring-slate-800">
              {config.companyName.charAt(0)}
            </div>
          </div>
        </header>

        <div className="max-w-full">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
