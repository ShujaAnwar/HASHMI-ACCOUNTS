import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppConfig } from '../types';
import { supabase } from '../services/supabase';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  config: AppConfig;
  onLogout?: () => void;
}

const AdminAuthModal: React.FC<{ 
  onSuccess: () => void; 
  onClose: () => void 
}> = ({ onSuccess, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 border border-white/10 animate-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-rose-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-xl shadow-rose-500/20">
            <span className="text-2xl">🛡️</span>
          </div>
          <h3 className="text-xl font-black font-orbitron text-slate-900 dark:text-white uppercase tracking-tighter">Admin Verification</h3>
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">Elevated Privileges Required</p>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-5">
          {error && (
            <p className="text-[10px] font-bold text-rose-500 uppercase text-center bg-rose-50 dark:bg-rose-900/20 p-3 rounded-xl">{error}</p>
          )}
          <input 
            type="email" 
            placeholder="Admin Email" 
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500 transition-all"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input 
            type="password" 
            placeholder="Secure Key" 
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500 transition-all"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <div className="flex space-x-3">
            <button type="button" onClick={onClose} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold rounded-xl uppercase text-[10px]">Cancel</button>
            <button type="submit" disabled={isLoading} className="flex-[2] py-4 bg-rose-600 text-white font-black rounded-xl shadow-xl uppercase text-[10px] tracking-widest disabled:opacity-50">
              {isLoading ? 'Verifying...' : 'Authorize'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, config, onLogout }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [secretClickCount, setSecretClickCount] = useState(0);
  const [voucherCount, setVoucherCount] = useState<number | null>(null);
  const longPressTimer = useRef<number | null>(null);

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

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const { data } = await supabase.from('vouchers').select('id', { count: 'exact', head: true });
        setVoucherCount(data?.length || 0);
      } catch (err) {
        console.error("Failed to fetch voucher count:", err);
      }
    };
    fetchCount();
    // Refresh count occasionally or on certain events if needed
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'haji-tracking', label: 'Haji Tracking', icon: '☪️' },
    { id: 'coa', label: 'Chart of Accounts', icon: '📁' },
    { id: 'ledger', label: 'General Ledger', icon: '📖' },
    { id: 'customers', label: 'Customers', icon: '👥' },
    { id: 'vendors', label: 'Vendors', icon: '🏢' },
    { id: 'vouchers', label: 'Vouchers', icon: '📝', count: voucherCount },
    { id: 'reports', label: 'Reports', icon: '📈' },
    { id: 'help', label: 'Help / Guide', icon: '📖' },
    ...(isAdminUnlocked ? [{ id: 'control', label: 'Control Panel', icon: '⚙️' }] : []),
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + Shift + C
      if (e.altKey && e.shiftKey && e.code === 'KeyC') {
        setShowAdminAuth(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSecretClick = () => {
    const newCount = secretClickCount + 1;
    if (newCount >= 5) {
      setShowAdminAuth(true);
      setSecretClickCount(0);
    } else {
      setSecretClickCount(newCount);
      // Reset count after 2 seconds of inactivity
      setTimeout(() => setSecretClickCount(0), 2000);
    }
  };

  const startLongPress = useCallback((id: string) => {
    // Hidden trigger handles unlocking now
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsLongPressing(false);
  }, []);

  const [scheduleClicks, setScheduleClicks] = useState(0);
  const [lastScheduleClickTime, setLastScheduleClickTime] = useState(0);

  const handleNavClick = (id: string) => {
    if (id === 'schedule') {
      // Secret Trigger: Control Panel
      const now = Date.now();
      if (now - lastScheduleClickTime < 1000) {
        const nextCount = scheduleClicks + 1;
        setScheduleClicks(nextCount);
        if (nextCount >= 8) {
          setActiveTab('control');
          setScheduleClicks(0);
          return;
        }
      } else {
        setScheduleClicks(1);
      }
      setLastScheduleClickTime(now);

      setActiveTab('dashboard');
      setTimeout(() => {
        const el = document.getElementById('booking-schedule-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return;
    }
    setActiveTab(id);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-950 transition-colors duration-300 font-inter pb-20 md:pb-0">
      {showAdminAuth && (
        <AdminAuthModal 
          onSuccess={() => { setIsAdminUnlocked(true); setShowAdminAuth(false); setActiveTab('control'); }}
          onClose={() => setShowAdminAuth(false)}
        />
      )}

      {/* Modern Mobile Top Bar (Visible only on mobile) */}
      <header className="md:hidden sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-3 flex justify-between items-center transition-colors duration-300 no-print">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/20">
            {config.companyName.charAt(0)}
          </div>
          <div>
            <h1 className="text-sm font-black font-orbitron text-slate-800 dark:text-white uppercase tracking-tighter truncate max-w-[150px]">
              {config.companyName}
            </h1>
            <div className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest leading-none">System Operational</p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 border border-slate-100 dark:border-slate-700">
            {isDarkMode ? '🌞' : '🌙'}
          </button>
          <button onClick={onLogout} className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-500 border border-rose-100 dark:border-rose-900/30">
            🚪
          </button>
        </div>
      </header>

      {/* Desktop Navigation & Calligraphy Header */}
      <header className="hidden md:flex w-full bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-2 justify-between items-center z-30 transition-colors duration-300 no-print">
        <div className="flex-1"></div>
        <h2 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tracking-normal animate-in fade-in slide-in-from-top-1 duration-1000" dir="rtl">
          بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
        </h2>
        <div className="flex-1 flex justify-end items-center space-x-3 pr-2">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)} 
            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 border border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95 flex items-center justify-center min-w-[40px] min-h-[40px] shadow-sm"
            title="Toggle theme"
          >
            {isDarkMode ? '🌞' : '🌙'}
          </button>
          <button 
            onClick={onLogout} 
            className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-500 border border-rose-100 dark:border-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all active:scale-95 flex items-center justify-center min-h-[40px] px-4 shadow-sm"
          >
            <span className="text-lg">🚪</span>
            <span className="text-[10px] font-black uppercase ml-2 tracking-widest">Logout</span>
          </button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row flex-1">
        {/* Sidebar (Desktop only) */}
        <aside className="no-print hidden md:flex w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col h-[calc(100vh-48px)] sticky top-[48px] flex-shrink-0 z-20 transition-colors duration-300">
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
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                  activeTab === item.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-xs font-bold uppercase tracking-widest flex-1 text-left">{item.label}</span>
                {(item as any).count !== undefined && (item as any).count !== null && (
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black leading-none ${activeTab === item.id ? 'bg-white text-blue-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-blue-50'}`}>
                    {(item as any).count}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t dark:border-slate-800">
            <div 
              onClick={handleSecretClick}
              className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter text-center cursor-default select-none active:opacity-50 transition-opacity"
            >
              Enterprise v2.6 • {config.companyName}
            </div>
          </div>
        </aside>

        {/* Fixed Bottom Navigation (Mobile only) */}
        <nav className="md:hidden fixed bottom-4 left-4 right-4 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 p-1.5 rounded-[2.5rem] shadow-2xl flex items-center justify-between no-print transition-all">
          {[
            { id: 'dashboard', label: 'Home', icon: '🏠' },
            { id: 'haji-tracking', label: 'Tracking', icon: '☪️' },
            { id: 'vouchers', label: 'Vouchers', icon: '📝', count: voucherCount },
            { id: 'reports', label: 'Reports', icon: '📈' },
            { id: 'schedule', label: 'Schedule', icon: '📅' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-3 rounded-[2rem] transition-all duration-300 relative ${
                (activeTab === item.id || (item.id === 'schedule' && activeTab === 'dashboard' && false)) 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 -translate-y-1' 
                  : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              {item.count !== undefined && item.count !== null && (
                <span className={`absolute top-2 right-4 flex items-center justify-center px-1.5 py-0.5 rounded-full text-[7px] font-black leading-none min-w-[14px] ${activeTab === item.id ? 'bg-white text-blue-600' : 'bg-rose-500 text-white shadow-sm ring-1 ring-white/20'}`}>
                  {item.count}
                </span>
              )}
              <span className="text-xl mb-0.5">{item.icon}</span>
              <span className={`text-[7px] font-black uppercase tracking-widest transition-opacity duration-300 ${activeTab === item.id ? 'opacity-100' : 'opacity-50'}`}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden md:h-[calc(100vh-48px)] md:overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;