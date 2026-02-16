import React, { useState, useCallback, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Ledger from './components/Ledger';
import Vouchers from './components/Vouchers';
import Reports from './components/Reports';
import ControlPanel from './components/ControlPanel';
import ChartOfAccounts from './components/ChartOfAccounts';
import LoginForm from './components/LoginForm';
import { AccountType, AppConfig, Voucher } from './types';
import { getConfig } from './services/db';
import { supabase } from './services/supabase';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Cross-tab action state
  const [intent, setIntent] = useState<{ type: 'EDIT' | 'VIEW', voucher: Voucher } | null>(null);

  const refreshConfig = useCallback(async () => {
    const freshConfig = await getConfig();
    setConfig(freshConfig);
  }, []);

  useEffect(() => {
    // Initial data load
    refreshConfig();

    // Check current Supabase Auth Session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setLoading(false);
    });

    // Listen for Auth state changes (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'coa':
        return <ChartOfAccounts />;
      case 'customers':
        return <Ledger type={AccountType.CUSTOMER} onEditVoucher={handleEditVoucher} onViewVoucher={handleViewVoucher} />;
      case 'vendors':
        return <Ledger type={AccountType.VENDOR} onEditVoucher={handleEditVoucher} onViewVoucher={handleViewVoucher} />;
      case 'vouchers':
        return <Vouchers externalIntent={intent} clearIntent={() => setIntent(null)} />;
      case 'reports':
        return <Reports onViewVoucher={handleViewVoucher} onEditVoucher={handleEditVoucher} />;
      case 'control':
        return <ControlPanel onConfigUpdate={refreshConfig} />;
      default:
        return <Dashboard />;
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
      <div className="animate-in fade-in duration-500">
        {renderContent()}
      </div>
    </Layout>
  );
};

export default App;