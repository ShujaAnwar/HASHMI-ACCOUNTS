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

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'coa', label: 'Chart of Accounts', icon: '📁' },
    { id: 'customers', label: 'Customers', icon: '👥' },
    { id: 'vendors', label: 'Vendors', icon: '🏢' },
    { id: 'vouchers', label: 'Vouchers', icon: '📝' },
    { id: 'reports', label: 'Reports', icon: '📈' },
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

  const handleNavClick = (id: string) => {
    setActiveTab(id);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-950 transition-colors duration-300 font-inter">
      {showAdminAuth && (
        <AdminAuthModal 
          onSuccess={() => { setIsAdminUnlocked(true); setShowAdminAuth(false); setActiveTab('control'); }}
          onClose={() => setShowAdminAuth(false)}
        />
      )}

      {/* Absolute Top Header - Bismillah Calligraphy */}
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
                onMouseDown={() => startLongPress(item.id)}
                onMouseUp={cancelLongPress}
                onMouseLeave={cancelLongPress}
                onTouchStart={() => startLongPress(item.id)}
                onTouchEnd={cancelLongPress}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                  activeTab === item.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className={`text-lg transition-transform ${isLongPressing && item.id === 'control' ? 'scale-125 animate-pulse' : ''}`}>{item.icon}</span>
                <span className="text-xs font-bold uppercase tracking-widest">{item.label}</span>
                { (item as any).isProtected && !isAdminUnlocked && (
                  <span className="absolute right-4 text-[8px] opacity-30 group-hover:opacity-100 transition-opacity">🔒</span>
                )}
                { (item as any).isProtected && isAdminUnlocked && (
                  <span className="absolute right-4 text-[8px] text-emerald-500">🔓</span>
                )}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t dark:border-slate-800 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
                <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-600 transition-colors"
                title="Toggle Theme"
                >
                {isDarkMode ? '🌞' : '🌙'}
                </button>
                {onLogout && (
                    <button 
                        onClick={onLogout}
                        className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
                        title="Sign Out"
                    >
                        🚪
                    </button>
                )}
            </div>
            <div 
              onClick={handleSecretClick}
              className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter text-center cursor-default select-none active:opacity-50 transition-opacity"
            >
              Enterprise v2.5 • {config.companyName}
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