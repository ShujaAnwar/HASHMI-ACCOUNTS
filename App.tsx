import React, { useState, useCallback, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Ledger from './components/Ledger';
import Vouchers from './components/Vouchers';
import Reports from './components/Reports';
import ControlPanel from './components/ControlPanel';
import ChartOfAccounts from './components/ChartOfAccounts';
import HajiTracking from './components/HajiTracking';
import LoginForm from './components/LoginForm';
import UserGuide from './components/UserGuide';
import AutoBackupManager from './components/AutoBackupManager';
import AutoRefreshManager from './components/AutoRefreshManager';
import { AccountType, AppConfig, Voucher } from './types';
import { getConfig } from './services/db';
import { supabase } from './services/supabase';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Cross-tab action state
  const [intent, setIntent] = useState<{ type: 'EDIT' | 'VIEW', voucher: Voucher } | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const refreshConfig = useCallback(async () => {
    const freshConfig = await getConfig();
    setConfig(freshConfig);
  }, []);

  const handleGlobalRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    // Initial data load
    refreshConfig();

    // Check current Supabase Auth Session
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Supabase Session Error:", error.message);
          
          // Handle various forms of "Refresh Token Not Found" or expired session errors
          if (
            error.message.includes('Refresh Token Not Found') || 
            error.message.includes('refresh_token_not_found') ||
            error.message.includes('invalid_grant')
          ) {
             console.warn("Auth session corrupted or expired. Performing emergency clear-down.");
             
             // Clear all potential auth storage to prevent loops
             localStorage.removeItem('tlp-sb-auth-token');
             localStorage.removeItem('supabase.auth.token');
             await supabase.auth.signOut();
             
             setIsAuthenticated(false);
             setLoading(false);
             return;
          }
          throw error;
        }
        
        setIsAuthenticated(!!session);
      } catch (err: any) {
        console.error("Session check failed:", err);
        // If we hit a critical auth error, reset state
        if (err.message && (err.message.includes('Refresh') || err.message.includes('token'))) {
           setIsAuthenticated(false);
        }
      } finally {
        setLoading(false);
      }
    };
    
    checkSession();

    // Global suppression for MetaMask errors within App
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && (
        event.reason.message?.includes('MetaMask') || 
        event.reason.message?.includes('ethereum')
      )) {
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleRejection);

    // Listen for Auth state changes (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [refreshConfig]);

  const handleLogin = (success: boolean) => {
    if (success) setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
  };

  const handleEditVoucher = (v: Voucher) => {
    setIntent({ type: 'EDIT', voucher: v });
    setActiveTab('vouchers');
  };

  const handleViewVoucher = (v: Voucher) => {
    setIntent({ type: 'VIEW', voucher: v });
    setActiveTab('vouchers');
  };

  const handleNavigateToLedger = (accountId: string, type: AccountType) => {
    setSelectedAccountId(accountId);
    if (type === AccountType.CUSTOMER) {
      setActiveTab('customers');
    } else if (type === AccountType.VENDOR) {
      setActiveTab('vendors');
    } else {
      setActiveTab('ledger');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard config={config} refreshKey={refreshKey} onRefresh={handleGlobalRefresh} onEditVoucher={handleEditVoucher} onViewVoucher={handleViewVoucher} onNavigate={setActiveTab} />;
      case 'coa':
        return <ChartOfAccounts config={config} refreshKey={refreshKey} onNavigateToLedger={handleNavigateToLedger} />;
      case 'ledger':
        return <Ledger config={config} refreshKey={refreshKey} onEditVoucher={handleEditVoucher} onViewVoucher={handleViewVoucher} initialAccountId={selectedAccountId} clearInitialAccount={() => setSelectedAccountId(null)} />;
      case 'customers':
        return <Ledger config={config} refreshKey={refreshKey} type={AccountType.CUSTOMER} onEditVoucher={handleEditVoucher} onViewVoucher={handleViewVoucher} initialAccountId={selectedAccountId} clearInitialAccount={() => setSelectedAccountId(null)} />;
      case 'vendors':
        return <Ledger config={config} refreshKey={refreshKey} type={AccountType.VENDOR} onEditVoucher={handleEditVoucher} onViewVoucher={handleViewVoucher} initialAccountId={selectedAccountId} clearInitialAccount={() => setSelectedAccountId(null)} />;
      case 'vouchers':
        return <Vouchers config={config} refreshKey={refreshKey} externalIntent={intent} clearIntent={() => setIntent(null)} />;
      case 'haji-tracking':
        return <HajiTracking />;
      case 'reports':
        return <Reports config={config} refreshKey={refreshKey} onViewVoucher={handleViewVoucher} onEditVoucher={handleEditVoucher} initialAccountId={selectedAccountId} clearInitialAccount={() => setSelectedAccountId(null)} />;
      case 'control':
        return <ControlPanel config={config} onConfigUpdate={refreshConfig} />;
      case 'help':
        return <UserGuide config={config} />;
      default:
        return <Dashboard config={config} />;
    }
  };

  if (loading || !config) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-orbitron text-white">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
        <p className="opacity-50 text-[10px] uppercase tracking-[0.5em] font-bold tracking-widest">Secure Handshake...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} companyName={config.companyName} />;
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} config={config} onLogout={handleLogout}>
      <AutoBackupManager config={config} />
      <AutoRefreshManager config={config} onRefresh={handleGlobalRefresh} />
      <div className="animate-in fade-in duration-500">
        {renderContent()}
      </div>
    </Layout>
  );
};

export default App;