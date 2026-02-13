
import React, { useState, useCallback } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Ledger from './components/Ledger';
import Vouchers from './components/Vouchers';
import Reports from './components/Reports';
import ControlPanel from './components/ControlPanel';
import ChartOfAccounts from './components/ChartOfAccounts';
import { AccountType, AppConfig } from './types';
import { getConfig } from './services/db';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [config, setConfig] = useState<AppConfig>(getConfig());

  const refreshConfig = useCallback(() => {
    setConfig(getConfig());
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'coa':
        return <ChartOfAccounts />;
      case 'customers':
        return <Ledger type={AccountType.CUSTOMER} />;
      case 'vendors':
        return <Ledger type={AccountType.VENDOR} />;
      case 'vouchers':
        return <Vouchers />;
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
