
import React, { useState, useRef, useEffect } from 'react';
import { getConfig, saveConfig, exportFullDatabase, importFullDatabase, getAccounts, saveAccounts } from '../services/db';
import { AppConfig, Account, AccountType } from '../types';
import { AccountingService } from '../services/AccountingService';

interface ControlPanelProps {
  onConfigUpdate?: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ onConfigUpdate }) => {
  const [config, setConfig] = useState<AppConfig>(getConfig());
  const [saveStatus, setSaveStatus] = useState('');
  const [activeTab, setActiveTab] = useState<'branding' | 'financial' | 'disaster'>('branding');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  // Auto-save notification logic
  const triggerNotification = (msg: string) => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(''), 4000);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    saveConfig(config);
    triggerNotification('System configuration updated successfully.');
    if (onConfigUpdate) onConfigUpdate();
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 200;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL('image/png');
          const newConfig = { ...config, companyLogo: base64 };
          setConfig(newConfig);
          saveConfig(newConfig);
          triggerNotification('Brand logo uploaded and optimized.');
          if (onConfigUpdate) onConfigUpdate();
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleBackup = (format: 'json' | 'csv') => {
    const data = exportFullDatabase();
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TLP_Backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    } else {
      const accounts = getAccounts();
      const headers = ["Code", "Name", "Type", "Balance"];
      const rows = accounts.map(a => [a.code || '', a.name, a.type, a.balance]);
      const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TLP_Accounts_Export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    }
    triggerNotification(`Full database exported as ${format.toUpperCase()}.`);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.accounts && data.vouchers && data.config) {
          const confirmed = window.confirm(
            "CRITICAL SECURITY WARNING:\n\nThis will completely OVERWRITE your current ledger, vouchers, and settings with the data from this backup. This action cannot be undone.\n\nType 'CONFIRM' to proceed."
          );
          if (confirmed) {
            importFullDatabase(data);
            alert("Database restored successfully. The application will now reload to apply changes.");
            window.location.reload();
          }
        } else {
          alert("Invalid File Format: This file does not appear to be a valid TravelLedger Pro backup.");
        }
      } catch (err) {
        alert("Restore Failed: The file could not be read as valid JSON.");
      }
    };
    reader.readAsText(file);
    if (restoreInputRef.current) restoreInputRef.current.value = '';
  };

  const addBank = () => {
    const bankId = crypto.randomUUID();
    const bankName = 'New Bank';
    const newBank = { id: bankId, name: bankName, accountNumber: '00000000000000' };
    
    // Also create a GL account for this bank to ensure it reflects in totals
    AccountingService.createAccount(bankName, AccountType.CASH_BANK, '', '', 0, true, '');
    // Replace the random ID with the one generated for consistency if needed, 
    // but here we just ensure a CASH_BANK account exists.
    
    const newConfig = { ...config, banks: [...config.banks, newBank] };
    setConfig(newConfig);
    saveConfig(newConfig);
    triggerNotification('New bank profile added & registered in General Ledger.');
  };

  const removeBank = (id: string) => {
    const newConfig = { ...config, banks: config.banks.filter(b => b.id !== id) };
    setConfig(newConfig);
    saveConfig(newConfig);
    triggerNotification('Bank profile removed from config.');
  };

  const updateBank = (id: string, field: 'name' | 'accountNumber', value: string) => {
    const newBanks = config.banks.map(b => b.id === id ? { ...b, [field]: value } : b);
    setConfig({ ...config, banks: newBanks });
  };

  return (
    <div className="max-w-6xl space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded-r-2xl mb-6">
        <div className="flex">
          <div className="flex-shrink-0 text-amber-500 text-xl">⚠️</div>
          <div className="ml-3">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-400 uppercase tracking-widest">Administrative Mission Control</p>
            <p className="text-xs text-amber-700 dark:text-amber-500 mt-1 font-medium">Restricted Access. Changes made here impact the global double-entry integrity and system branding.</p>
          </div>
        </div>
      </div>

      <div className="flex space-x-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm w-fit overflow-x-auto no-print">
        {[
          { id: 'branding', label: 'Identity & Branding', icon: '🎨' },
          { id: 'financial', label: 'Financial Controls', icon: '🏧' },
          { id: 'disaster', label: 'Security & Recovery', icon: '🛡️' }
        ].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id as any)}
            className={`px-6 py-3 rounded-xl font-bold text-xs transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === t.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleUpdate} className="space-y-8">
        {activeTab === 'branding' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-left-4 duration-500">
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col items-center sticky top-8">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Master Brand Asset</p>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-48 h-48 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:border-blue-500 transition-all overflow-hidden bg-slate-50 dark:bg-slate-800 group relative"
                >
                  {config.companyLogo ? (
                    <>
                      <img src={config.companyLogo} alt="Logo" className="w-full h-full object-contain p-4" />
                      <div className="absolute inset-0 bg-blue-600/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                         <span className="text-white font-bold text-xs uppercase tracking-widest">Update Logo</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-4">
                      <span className="text-4xl block mb-2 opacity-30 group-hover:scale-110 transition-transform">🖼️</span>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Upload Asset</p>
                    </div>
                  )}
                </div>
                <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={handleLogoUpload} />
                <p className="text-[10px] text-slate-400 mt-4 text-center px-4 italic">Optimized for Sidebar (200x200 max)</p>
                {config.companyLogo && (
                  <button 
                    type="button"
                    onClick={() => {
                      setConfig({...config, companyLogo: undefined});
                      triggerNotification('Logo removed.');
                    }}
                    className="mt-6 text-[10px] font-bold text-rose-500 uppercase hover:underline"
                  >
                    Delete Asset
                  </button>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border border-slate-100 dark:border-slate-800 shadow-xl space-y-8">
                <h3 className="text-2xl font-orbitron font-bold">Institutional Identity</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">Company Name</label>
                    <input 
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 font-bold uppercase shadow-inner"
                      value={config.companyName}
                      onChange={e => setConfig({...config, companyName: e.target.value.toUpperCase()})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">App Subtitle</label>
                    <input 
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 font-bold shadow-inner"
                      value={config.appSubtitle}
                      onChange={e => setConfig({...config, appSubtitle: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Support Contact Phone</label>
                    <input 
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 font-bold shadow-inner"
                      value={config.companyPhone}
                      onChange={e => setConfig({...config, companyPhone: e.target.value})}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Registered Corporate Address</label>
                    <textarea 
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 h-24 font-medium text-sm shadow-inner"
                      value={config.companyAddress}
                      onChange={e => setConfig({...config, companyAddress: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'financial' && (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border border-slate-100 dark:border-slate-800 shadow-xl">
               <div className="flex justify-between items-center mb-10 pb-6 border-b dark:border-slate-800">
                  <div>
                    <h3 className="text-2xl font-orbitron font-bold">Monetary Standards</h3>
                    <p className="text-slate-400 text-sm mt-1">Configure global ROE and bank repositories</p>
                  </div>
                  <div className="w-64">
                    <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2 text-right">Default SAR Exchange Rate</label>
                    <div className="relative">
                      <input 
                        type="number" step="0.01"
                        className="w-full bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500/20 rounded-2xl p-4 font-orbitron font-bold text-2xl text-center outline-none"
                        value={config.defaultROE}
                        onChange={e => setConfig({...config, defaultROE: Number(e.target.value)})}
                      />
                    </div>
                  </div>
               </div>

               <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Connected Bank Accounts</h4>
                    <button type="button" onClick={addBank} className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:scale-105 transition-all">Add Bank Profile</button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {config.banks.map((bank) => (
                      <div key={bank.id} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all group relative">
                        <button 
                          type="button" 
                          onClick={() => removeBank(bank.id)}
                          className="absolute top-4 right-4 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity hover:scale-120"
                        >
                          ✕
                        </button>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Institution Name</label>
                            <input 
                              className="w-full bg-white dark:bg-slate-900 rounded-xl p-3 font-bold text-sm shadow-sm"
                              value={bank.name}
                              onChange={e => updateBank(bank.id, 'name', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Account Number (IBAN/Title)</label>
                            <input 
                              className="w-full bg-white dark:bg-slate-900 rounded-xl p-3 font-mono text-xs shadow-sm"
                              value={bank.accountNumber}
                              onChange={e => updateBank(bank.id, 'accountNumber', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'disaster' && (
          <div className="space-y-8 animate-in zoom-in-95 duration-500">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-900 text-white rounded-[2.5rem] p-12 border border-slate-800 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 text-8xl transition-transform group-hover:rotate-12 group-hover:scale-110">💾</div>
                  <h3 className="text-3xl font-orbitron font-bold mb-4">Export Vault</h3>
                  <p className="text-slate-400 mb-10 text-sm leading-relaxed">Secure your financial ecosystem by generating a comprehensive snapshot of all ledger entries, vouchers, and settings.</p>
                  <div className="flex flex-col space-y-4">
                    <button type="button" onClick={() => handleBackup('json')} className="w-full py-4 bg-white text-slate-900 font-bold rounded-2xl hover:scale-105 transition-all text-xs uppercase tracking-widest">Download Full JSON Backup</button>
                    <button type="button" onClick={() => handleBackup('csv')} className="w-full py-4 bg-slate-800 text-white font-bold rounded-2xl border border-slate-700 hover:bg-slate-700 transition-all text-xs uppercase tracking-widest">Export Accounts as CSV</button>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-12 border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5 text-8xl transition-transform group-hover:-rotate-12 group-hover:scale-110">📤</div>
                  <h3 className="text-3xl font-orbitron font-bold mb-4 text-slate-900 dark:text-white">System Restoration</h3>
                  <p className="text-slate-400 mb-10 text-sm leading-relaxed">Revert system state to a previous backup point. Warning: This process is irreversible and will purge current session data.</p>
                  <button 
                    type="button" 
                    onClick={() => restoreInputRef.current?.click()} 
                    className="w-full py-4 bg-rose-600 text-white font-bold rounded-2xl shadow-xl shadow-rose-500/20 hover:bg-rose-700 transition-all text-xs uppercase tracking-widest"
                  >
                    Upload Restoration Package
                  </button>
                  <input type="file" hidden ref={restoreInputRef} accept=".json" onChange={handleRestore} />
                  <p className="text-[10px] text-rose-500 font-bold mt-4 uppercase text-center tracking-tighter italic">Required: .json TravelLedger Format Only</p>
                </div>
             </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-8 border-t dark:border-slate-800 no-print">
          <div className="flex items-center space-x-3">
             {saveStatus && (
               <div className="flex items-center space-x-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 px-4 py-2 rounded-full border border-emerald-100 animate-in fade-in slide-in-from-left-2">
                 <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                 <p className="font-bold text-[10px] uppercase tracking-widest">{saveStatus}</p>
               </div>
             )}
          </div>
          <button 
            type="submit" 
            className="px-12 py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-3xl shadow-2xl hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-[0.2em] text-[10px] border border-white/10"
          >
            Commit Changes to Global Ledger
          </button>
        </div>
      </form>
    </div>
  );
};

export default ControlPanel;
