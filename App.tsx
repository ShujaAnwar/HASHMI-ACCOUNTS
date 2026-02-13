import React, { useState, useCallback } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Ledger from './components/Ledger';
import Vouchers from './components/Vouchers';
import Reports from './components/Reports';
import ControlPanel from './components/ControlPanel';
import ChartOfAccounts from './components/ChartOfAccounts';
import { AccountType, AppConfig, Voucher } from './types';
import { getConfig } from './services/db';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [config, setConfig] = useState<AppConfig>(getConfig());
  
  // Cross-tab action state
  const [intent, setIntent] = useState<{ type: 'EDIT' | 'VIEW', voucher: Voucher } | null>(null);

  const refreshConfig = useCallback(() => {
    setConfig(getConfig());
  }, []);

  const handleEditVoucher = (v: Voucher) => {
    setIntent({ type: 'EDIT', voucher: v });
    setActiveTab('vouchers');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'coa':
        return <ChartOfAccounts />;
      case 'customers':
        return <Ledger type={AccountType.CUSTOMER} onEditVoucher={handleEditVoucher} />;
      case 'vendors':
        return <Ledger type={AccountType.VENDOR} onEditVoucher={handleEditVoucher} />;
      case 'vouchers':
        return <Vouchers externalIntent={intent} clearIntent={() => setIntent(null)} />;
      case 'reports':
        return <Reports />;
      case 'control':
        return <ControlPanel onConfigUpdate={refreshConfig} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} config={config}>
      <div className="animate-in fade-in duration-500">
        {renderContent()}
      </div>
    </Layout>
  );
};

export default App;