import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getConfig, saveConfig, exportFullDatabase, importFullDatabase, getAccounts, getVouchers } from '../services/db';
import { formatCurrency, formatDate } from '../utils/format';
import { AppConfig, Account, Voucher } from '../types';
import { supabase } from '../services/supabase';
import * as XLSX from 'xlsx';

interface ControlPanelProps {
  config: AppConfig;
  onConfigUpdate?: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ config: initialConfig, onConfigUpdate }) => {
  const [config, setConfig] = useState<(AppConfig & { fontSize?: number }) | null>(initialConfig);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [saveStatus, setSaveStatus] = useState('');
  const [syncError, setSyncError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'branding' | 'financial' | 'security' | 'disaster' | 'diagnostics'>('branding');
  
  // Security Tab State
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [securityStatus, setSecurityStatus] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const [accs, vchs] = await Promise.all([
        getAccounts(),
        getVouchers()
      ]);
      setAccounts(accs);
      setVouchers(vchs);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    setConfig(initialConfig);
  }, [initialConfig]);

  const integrityStats = useMemo(() => {
    const totalDr = accounts.reduce((s, a) => s + (a.balance > 0 ? a.balance : 0), 0);
    const totalCr = accounts.reduce((s, a) => s + (a.balance < 0 ? Math.abs(a.balance) : 0), 0);
    const diff = totalDr - totalCr;
    return { totalDr, totalCr, diff };
  }, [accounts]);

  const triggerNotification = (msg: string) => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(''), 4000);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    try {
      setSaveStatus('Saving changes...');
      setSyncError(false);
      await saveConfig(config);
      triggerNotification('System configuration updated successfully.');
      if (onConfigUpdate) onConfigUpdate();
    } catch (err: any) {
      if (err.message === 'SCHEMA_OUT_OF_SYNC') {
        setSyncError(true);
        triggerNotification('Warning: Settings saved but some new features are disabled (Sync needed).');
      } else {
        console.error("Save failed:", err);
        triggerNotification('Error: Could not save configuration.');
      }
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityStatus(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
      });
      if (error) throw error;
      setSecurityStatus({ msg: `Successfully created user: ${data.user?.email}`, type: 'success' });
      setNewUserEmail('');
      setNewUserPassword('');
    } catch (err: any) {
      setSecurityStatus({ msg: err.message || "Failed to create user.", type: 'error' });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !config) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const newConfig = { ...config, companyLogo: base64 };
      setConfig(newConfig);
      try {
        await saveConfig(newConfig);
        triggerNotification('Brand logo uploaded.');
        if (onConfigUpdate) onConfigUpdate();
      } catch (err) {
        triggerNotification('Logo upload failed.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleBackupJSON = async () => {
    const data = await exportFullDatabase();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TLP_Backup_${formatDate(new Date())}.json`;
    a.click();
    triggerNotification(`Database exported as JSON.`);
  };

  const handleBackupExcel = async () => {
    const data = await exportFullDatabase();
    const workbook = XLSX.utils.book_new();

    // Accounts Sheet
    const accountsData = data.accounts.map(a => ({
      ID: a.id,
      Code: a.code,
      Name: a.name,
      Type: a.type,
      Cell: a.cell,
      Location: a.location,
      Currency: a.currency,
      Balance: a.balance
    }));
    const accountsSheet = XLSX.utils.json_to_sheet(accountsData);
    XLSX.utils.book_append_sheet(workbook, accountsSheet, "Accounts");

    // Vouchers Sheet
    const vouchersData = data.vouchers.map(v => ({
      ID: v.id,
      Type: v.type,
      VoucherNum: v.voucherNum,
      Date: v.date,
      Currency: v.currency,
      ROE: v.roe,
      TotalAmountPKR: v.totalAmountPKR,
      Description: v.description,
      Status: v.status,
      Reference: v.reference,
      CustomerID: v.customerId,
      VendorID: v.vendorId,
      Details: JSON.stringify(v.details),
      CreatedAt: v.createdAt
    }));
    const vouchersSheet = XLSX.utils.json_to_sheet(vouchersData);
    XLSX.utils.book_append_sheet(workbook, vouchersSheet, "Vouchers");

    // Ledger Entries Sheet
    const ledgerEntries: any[] = [];
    data.accounts.forEach(a => {
      if (a.ledger) {
        a.ledger.forEach(l => {
          ledgerEntries.push({
            AccountID: a.id,
            AccountName: a.name,
            Date: l.date,
            VoucherID: l.voucherId,
            VoucherNum: l.voucherNum,
            Description: l.description,
            Debit: l.debit,
            Credit: l.credit,
            BalanceAfter: l.balanceAfter,
            CreatedAt: l.createdAt
          });
        });
      }
    });
    const ledgerSheet = XLSX.utils.json_to_sheet(ledgerEntries);
    XLSX.utils.book_append_sheet(workbook, ledgerSheet, "LedgerEntries");

    // Config Sheet
    const configSheet = XLSX.utils.json_to_sheet([data.config]);
    XLSX.utils.book_append_sheet(workbook, configSheet, "Config");

    XLSX.writeFile(workbook, `TLP_Backup_${formatDate(new Date())}.xlsx`);
    triggerNotification(`Database exported as Excel.`);
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    setSaveStatus('Reading backup file...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        let data: any;

        if (fileExt === 'json') {
          const content = event.target?.result as string;
          data = JSON.parse(content);
        } else if (fileExt === 'xlsx') {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          
          // Parse Sheets
          const accountsSheet = workbook.Sheets["Accounts"];
          const vouchersSheet = workbook.Sheets["Vouchers"];
          const ledgerSheet = workbook.Sheets["LedgerEntries"];
          const configSheet = workbook.Sheets["Config"];

          if (!accountsSheet || !vouchersSheet || !configSheet) {
            throw new Error("Invalid Excel backup: Missing required sheets (Accounts, Vouchers, Config).");
          }

          const rawAccounts = XLSX.utils.sheet_to_json(accountsSheet);
          const rawVouchers = XLSX.utils.sheet_to_json(vouchersSheet);
          const rawLedger = ledgerSheet ? XLSX.utils.sheet_to_json(ledgerSheet) : [];
          const rawConfig = XLSX.utils.sheet_to_json(configSheet)[0] as any;

          // Reconstruct data structure
          data = {
            config: rawConfig,
            vouchers: rawVouchers.map((v: any) => ({
              ...v,
              details: v.Details ? JSON.parse(v.Details) : {}
            })),
            accounts: rawAccounts.map((a: any) => {
              const accountLedger = rawLedger
                .filter((l: any) => l.AccountID === a.ID)
                .map((l: any) => ({
                  date: l.Date,
                  voucherId: l.VoucherID,
                  voucherNum: l.VoucherNum,
                  description: l.Description,
                  debit: Number(l.Debit),
                  credit: Number(l.Credit),
                  balanceAfter: Number(l.BalanceAfter),
                  createdAt: l.CreatedAt
                }));
              return {
                ...a,
                id: a.ID,
                code: a.Code,
                name: a.Name,
                type: a.Type,
                cell: a.Cell,
                location: a.Location,
                currency: a.Currency,
                balance: Number(a.Balance),
                ledger: accountLedger
              };
            })
          };
        } else {
          throw new Error("Unsupported file format. Please use .json or .xlsx");
        }
        
        if (!data.accounts || !data.vouchers || !data.config) {
          throw new Error("Invalid backup file: Missing required data structures.");
        }

        setSaveStatus('Restoring database (this may take a moment)...');
        await importFullDatabase(data);
        
        setSaveStatus('Restoration complete! Reloading...');
        setTimeout(() => {
          alert("Database restored successfully. The application will now reload.");
          window.location.reload();
        }, 500);
      } catch (err: any) { 
        console.error("Restore Error:", err);
        const errorMsg = err.message || "Unknown error occurred during restoration.";
        setSaveStatus(`Restore Failed: ${errorMsg}`);
        
        if (errorMsg.includes('column') || errorMsg.includes('schema cache')) {
          alert(`Restore Failed: ${errorMsg}\n\nThis usually means your database schema is outdated. Please go to the 'Diagnostics' tab, copy the SQL code, and run it in your Supabase SQL Editor to fix this.`);
        } else {
          alert(`Restore Failed: ${errorMsg}`); 
        }
      } finally {
        if (restoreInputRef.current) {
          restoreInputRef.current.value = '';
        }
      }
    };

    if (fileExt === 'json') {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  if (loading || !config) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex space-x-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm w-fit overflow-x-auto no-print">
        {['branding', 'financial', 'security', 'disaster', 'diagnostics'].map(t => (
          <button 
            key={t} 
            type="button"
            onClick={() => setActiveTab(t as any)} 
            className={`px-6 py-3 rounded-xl font-bold text-xs transition-all uppercase whitespace-nowrap ${activeTab === t ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-blue-500'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <form onSubmit={handleUpdate} className="space-y-8">
        {syncError && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-500/50 p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center space-x-4">
              <span className="text-3xl">⚠️</span>
              <div className="flex flex-col">
                <span className="text-amber-800 dark:text-amber-400 font-black uppercase text-xs tracking-widest">Database Sync Required</span>
                <p className="text-[10px] text-amber-700 dark:text-amber-500 font-medium max-w-md">Your database is missing new configuration columns (Hotel List, Auto Refresh, etc.). Changes to these features will be lost until you run the SQL update in Diagnostics.</p>
              </div>
            </div>
            <button 
              type="button" 
              onClick={() => setActiveTab('diagnostics')}
              className="bg-amber-500 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg"
            >
              Fix Database Now
            </button>
          </div>
        )}

        {activeTab === 'branding' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border shadow-xl text-center border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-6 tracking-widest">Master Brand Asset</p>
                <div 
                  onClick={() => fileInputRef.current?.click()} 
                  className="w-full aspect-video rounded-3xl border-2 border-dashed flex items-center justify-center cursor-pointer hover:border-blue-500 bg-slate-50 dark:bg-slate-800 overflow-hidden group transition-all"
                >
                  {config.companyLogo ? (
                    <img src={config.companyLogo} style={{ height: `${config.logoSize}px` }} alt="Logo" className="object-contain" />
                  ) : (
                    <span className="text-slate-400 font-bold text-xs uppercase group-hover:text-blue-500 transition-colors">Upload Logo</span>
                  )}
                </div>
                <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={handleLogoUpload} />
                <div className="mt-8 space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase flex justify-between">
                     <span>Logo Height</span>
                     <span className="text-blue-600 font-black">{config.logoSize}px</span>
                   </label>
                   <input type="range" min="20" max="200" className="w-full accent-blue-600" value={config.logoSize} onChange={e => setConfig({...config, logoSize: Number(e.target.value)})} />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border shadow-xl border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-4 tracking-widest text-center">Interface Scaling</p>
                <div className="space-y-4">
                   <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500">
                      <span>Font Size</span>
                      <span className="bg-blue-600 text-white px-3 py-1 rounded-full">{config.fontSize}px</span>
                   </div>
                   <input 
                      type="range" 
                      min="12" 
                      max="24" 
                      className="w-full accent-blue-600" 
                      value={config.fontSize} 
                      onChange={e => setConfig({...config, fontSize: Number(e.target.value)})} 
                   />
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 shadow-xl space-y-8 border border-slate-100 dark:border-slate-800">
                <h3 className="text-2xl font-orbitron font-bold uppercase tracking-tighter">Identity & Formatting</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-bold text-blue-600 uppercase mb-2 block tracking-widest">Company Name</label>
                    <input className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 font-black uppercase text-sm shadow-inner outline-none" value={config.companyName} onChange={e => setConfig({...config, companyName: e.target.value.toUpperCase()})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-blue-600 uppercase mb-2 block tracking-widest">Subtitle</label>
                    <input className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 text-sm shadow-inner outline-none" value={config.appSubtitle} onChange={e => setConfig({...config, appSubtitle: e.target.value})} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-indigo-600 uppercase mb-2 block tracking-widest">Letter Case Selection (Account Heads)</label>
                    <select 
                      className="w-full bg-indigo-50/50 dark:bg-indigo-900/10 border-none rounded-xl p-4 font-bold text-sm shadow-inner appearance-none cursor-pointer outline-none"
                      value={config.accountNameCase}
                      onChange={e => setConfig({...config, accountNameCase: e.target.value as any})}
                    >
                      <option value="Sentence Case">Sentence Case (e.g. Cash at bank)</option>
                      <option value="camelCase">Camel Case (e.g. cashAtBank)</option>
                      <option value="UPPERCASE">UPPERCASE (e.g. CASH AT BANK)</option>
                      <option value="lowercase">lowercase (e.g. cash at bank)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block tracking-widest">Cell Number</label>
                    <input className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 text-sm shadow-inner outline-none" value={config.companyCell} onChange={e => setConfig({...config, companyCell: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block tracking-widest">Phone Number</label>
                    <input className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 text-sm shadow-inner outline-none" value={config.companyPhone} onChange={e => setConfig({...config, companyPhone: e.target.value})} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block tracking-widest">Email Address</label>
                    <input className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 text-sm shadow-inner outline-none" value={config.companyEmail} onChange={e => setConfig({...config, companyEmail: e.target.value})} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block tracking-widest">Corporate Address</label>
                    <textarea className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 h-24 font-medium text-sm shadow-inner resize-none outline-none" value={config.companyAddress} onChange={e => setConfig({...config, companyAddress: e.target.value})} />
                  </div>
                  <div className="md:col-span-2 bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl flex items-center justify-between border border-blue-100 dark:border-blue-900/30">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Smart Hotel Lists</span>
                      <span className="text-[8px] text-slate-500 uppercase font-bold">Show Makkah/Madinah dropdown list in vouchers</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={config.showHotelsList !== false} 
                        onChange={e => setConfig({...config, showHotelsList: e.target.checked})} 
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'financial' && (
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 shadow-xl space-y-8 border border-slate-100 dark:border-slate-800">
                <h3 className="text-2xl font-orbitron font-bold uppercase tracking-tighter">Exchange Rate Controls</h3>
                <div className="w-full">
                  <label className="text-[10px] font-bold text-blue-600 uppercase mb-2 block tracking-widest">Default SAR Rate (PKR/1 SAR)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="w-full bg-blue-50/50 dark:bg-blue-900/10 border-2 border-blue-100 dark:border-blue-900/30 rounded-2xl p-6 font-orbitron font-black text-3xl text-center text-blue-600 shadow-sm outline-none focus:border-blue-500 transition-all" 
                    value={config.defaultROE} 
                    onChange={e => setConfig({...config, defaultROE: Number(e.target.value)})} 
                  />
                </div>
             </div>

             <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 shadow-xl space-y-8 border border-slate-100 dark:border-slate-800">
                <h3 className="text-2xl font-orbitron font-bold uppercase tracking-tighter">Live Data Engine</h3>
                <div className="space-y-6">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl flex items-center justify-between border border-slate-100 dark:border-slate-700">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">Auto Refresh Database</span>
                      <span className="text-[8px] text-slate-500 uppercase font-bold">Periodically pull fresh cloud data</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={config.autoRefreshEnabled} 
                        onChange={e => setConfig({...config, autoRefreshEnabled: e.target.checked})} 
                      />
                      <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {config.autoRefreshEnabled && (
                    <div className="animate-in slide-in-from-top-2 duration-300 p-6 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-3xl border border-emerald-100 dark:border-emerald-900/10">
                      <label className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-4 block">Refresh Cycle (Minutes)</label>
                      <div className="flex items-center space-x-6">
                        <input 
                          type="number" 
                          min="1" 
                          max="1440"
                          className="w-32 bg-white dark:bg-slate-900 border-2 border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-4 font-orbitron font-black text-2xl text-center text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500"
                          value={config.autoRefreshIntervalMinutes}
                          onChange={e => setConfig({...config, autoRefreshIntervalMinutes: Math.max(1, Number(e.target.value))})}
                        />
                        <div className="flex flex-col">
                          <span className="text-[12px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Minutes</span>
                          <span className="text-[8px] font-bold text-slate-500 uppercase">Suggested: 5-15 mins</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
             </div>
           </div>
        )}

        {activeTab === 'security' && (
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 shadow-xl space-y-8 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">🔑</div>
                  <div>
                    <h3 className="text-2xl font-orbitron font-bold uppercase tracking-tighter">User Management</h3>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Identity Provisioning</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block tracking-widest ml-4">Authorized Email (User ID)</label>
                    <input 
                      type="email" 
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 font-bold text-sm shadow-inner outline-none"
                      placeholder="user@company.com"
                      value={newUserEmail}
                      onChange={e => setNewUserEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block tracking-widest ml-4">Secure Key (Password)</label>
                    <input 
                      type="password" 
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 font-bold text-sm shadow-inner outline-none"
                      placeholder="••••••••"
                      value={newUserPassword}
                      onChange={e => setNewUserPassword(e.target.value)}
                    />
                  </div>
                  
                  {securityStatus && (
                    <div className={`p-4 rounded-xl text-[10px] font-bold uppercase tracking-tight text-center ${securityStatus.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {securityStatus.msg}
                    </div>
                  )}

                  <button 
                    type="button"
                    onClick={handleCreateUser}
                    className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl shadow-xl uppercase text-[10px] tracking-widest transition-all active:scale-95"
                  >
                    Register New Identity
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 text-white rounded-[2.5rem] p-10 flex flex-col justify-center text-center space-y-4 border border-white/5 shadow-2xl">
                 <div className="text-5xl mb-2">🏛️</div>
                 <h4 className="text-xl font-orbitron font-black uppercase tracking-widest">Enterprise Guard</h4>
                 <p className="text-xs text-slate-400 leading-relaxed font-medium">
                   New users registered here will gain access to the system. 
                   Ensure you are complying with corporate security policies regarding 
                   shared credentials and password complexity.
                 </p>
              </div>
           </div>
        )}

        {activeTab === 'disaster' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-900 text-white rounded-[2.5rem] p-12 shadow-2xl flex flex-col justify-between min-h-[400px] border border-white/5">
              <div>
                <h3 className="text-3xl font-orbitron font-bold mb-2 tracking-tighter uppercase">Export Vault</h3>
                <p className="text-slate-400 text-xs mb-8">Download a secure local backup of all accounts and vouchers.</p>
              </div>
              <div className="space-y-6">
                <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Automatic Daily Backup</span>
                    <span className="text-[8px] text-slate-400 uppercase font-bold">Triggers at 12:00 AM (if app is open)</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={config.autoBackupEnabled} 
                      onChange={e => setConfig({...config, autoBackupEnabled: e.target.checked})} 
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white">Interval Backup</span>
                      <span className="text-[8px] text-slate-400 uppercase font-bold">Triggers every X hours</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={config.autoBackupIntervalEnabled} 
                        onChange={e => setConfig({...config, autoBackupIntervalEnabled: e.target.checked})} 
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  
                  {config.autoBackupIntervalEnabled && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Backup Interval (Hours)</label>
                      <div className="flex items-center space-x-4">
                        <input 
                          type="number" 
                          min="1" 
                          max="168"
                          className="w-24 bg-slate-800 border-none rounded-xl p-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500"
                          value={config.autoBackupIntervalHours}
                          onChange={e => setConfig({...config, autoBackupIntervalHours: Math.max(1, Number(e.target.value))})}
                        />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hours</span>
                      </div>
                      <p className="text-[8px] text-slate-500 mt-2 italic font-medium uppercase">Timer resets after each successful backup.</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <button 
                    type="button" 
                    onClick={async () => {
                      await handleBackupJSON();
                      await handleBackupExcel();
                      triggerNotification("Auto-Backup Protocol triggered manually.");
                    }} 
                    className="w-full py-5 bg-blue-600/20 text-blue-400 border border-blue-600/30 font-black rounded-2xl uppercase text-[10px] tracking-[0.2em] shadow-xl hover:bg-blue-600/30 transition-all flex flex-col items-center justify-center space-y-1"
                  >
                    <span className="text-lg">⚡</span>
                    <span>Trigger Auto-Backup Protocol</span>
                    <span className="text-[7px] opacity-60">Downloads Both JSON & Excel</span>
                  </button>
                  <button 
                    type="button" 
                    onClick={handleBackupJSON} 
                    className="w-full py-5 bg-white text-slate-900 font-black rounded-2xl uppercase text-xs tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center space-x-3"
                  >
                    <span>📄</span> <span>Download JSON Backup</span>
                  </button>
                  <button 
                    type="button" 
                    onClick={handleBackupExcel} 
                    className="w-full py-5 bg-emerald-600 text-white font-black rounded-2xl uppercase text-xs tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center space-x-3"
                  >
                    <span>📊</span> <span>Download Excel Backup</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-12 shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between min-h-[400px]">
              <div>
                <h3 className="text-3xl font-orbitron font-bold mb-2 tracking-tighter uppercase dark:text-white">Restoration</h3>
                <p className="text-slate-400 text-xs mb-8">Upload a JSON or Excel backup file to overwrite current cloud state.</p>
              </div>
              <div className="space-y-4">
                <button 
                  type="button" 
                  onClick={() => restoreInputRef.current?.click()} 
                  className="w-full py-5 bg-rose-600 text-white font-black rounded-2xl shadow-xl shadow-rose-600/20 uppercase text-xs tracking-[0.2em] transition-all flex items-center justify-center space-x-3"
                >
                  <span>📤</span> <span>Upload & Restore Backup</span>
                </button>
                <p className="text-[10px] text-slate-400 font-bold uppercase text-center">Supports .json and .xlsx formats</p>
                <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30 text-[10px] font-bold text-amber-700 dark:text-amber-400 text-center uppercase tracking-tight">
                  ⚠️ Note: After changing "Auto Backup" toggles, you MUST click "Commit Global Changes" at the bottom to save your settings.
                </div>
              </div>
              <input type="file" hidden ref={restoreInputRef} accept=".json,.xlsx" onChange={handleRestore} />
            </div>
          </div>
        )}

        {activeTab === 'diagnostics' && (
          <div className="space-y-8">
             <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 shadow-xl space-y-6 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-4 mb-4">
                   <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center text-white shadow-lg">⚖️</div>
                   <div>
                      <h3 className="text-2xl font-orbitron font-bold uppercase tracking-tighter">Integrity Scanner</h3>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">IFRS Double-Entry Audit</p>
                   </div>
                </div>
                
                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Aggregate Debits</p>
                    <p className="text-xl font-orbitron font-bold text-emerald-500">{integrityStats.totalDr.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Aggregate Credits</p>
                    <p className="text-xl font-orbitron font-bold text-rose-500">{integrityStats.totalCr.toLocaleString()}</p>
                  </div>
                  <div className={`p-6 rounded-3xl border ${Math.abs(integrityStats.diff) < 0.01 ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100' : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100'}`}>
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2">System Discrepancy</p>
                    <p className={`text-xl font-orbitron font-bold ${Math.abs(integrityStats.diff) < 0.01 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatCurrency(integrityStats.diff)}
                    </p>
                  </div>
                </div>

                {Math.abs(integrityStats.diff) > 0.01 && (
                  <div className="bg-rose-100/50 dark:bg-rose-900/20 p-6 rounded-3xl border border-rose-200 text-sm font-bold text-rose-700 dark:text-rose-400">
                     ALERT: Your Trial Balance is broken by PKR {formatCurrency(integrityStats.diff)}. 
                     Please check Account 3001 (Reserve) to see if an Opening Balance entry is missing its counterpart.
                  </div>
                )}
             </div>

             <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 shadow-xl space-y-6 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-4 mb-4">
                   <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg">🛠️</div>
                   <div>
                      <h3 className="text-2xl font-orbitron font-bold uppercase tracking-tighter">System Maintenance</h3>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Manual Schema Reload</p>
                   </div>
                </div>
                
                <div className="relative group">
                   <pre className="bg-slate-900 text-slate-300 p-8 rounded-3xl text-[11px] font-mono overflow-x-auto border border-white/5">
{`-- FIX: Update Enum Types & Sync Schema
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voucher_type_enum') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'voucher_type_enum' AND e.enumlabel = 'AV') THEN
            ALTER TYPE public.voucher_type_enum ADD VALUE 'AV';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'voucher_type_enum' AND e.enumlabel = 'RV') THEN
            ALTER TYPE public.voucher_type_enum ADD VALUE 'RV';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'voucher_type_enum' AND e.enumlabel = 'PV') THEN
            ALTER TYPE public.voucher_type_enum ADD VALUE 'PV';
        END IF;
    END IF;
END $$;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS show_hotels_list BOOLEAN DEFAULT TRUE;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS auto_refresh_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS auto_refresh_interval_minutes INTEGER DEFAULT 5;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS font_size INTEGER DEFAULT 16;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS account_name_case TEXT DEFAULT 'Sentence Case';
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS banks JSONB DEFAULT '[]';
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS auto_backup_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS auto_backup_interval_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS auto_backup_interval_hours INTEGER DEFAULT 6;
-- Update branding to Hashmi Travel Solutions
UPDATE app_config SET company_name = 'Hashmi Travel Solutions', app_subtitle = 'Travel Solutions by Shuja Anwar', company_phone = '0313-2710182', company_cell = '0313-2710182', company_email = 'Shujaanwaar@gmail.com' WHERE id = '00000000-0000-0000-0000-000000000001';
NOTIFY pgrst, 'reload schema';`}
                   </pre>
                   <button 
                      type="button"
                      onClick={() => {
                         const sql = `-- FIX: Update Enum Types & Sync Schema
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voucher_type_enum') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'voucher_type_enum' AND e.enumlabel = 'AV') THEN
            ALTER TYPE public.voucher_type_enum ADD VALUE 'AV';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'voucher_type_enum' AND e.enumlabel = 'RV') THEN
            ALTER TYPE public.voucher_type_enum ADD VALUE 'RV';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'voucher_type_enum' AND e.enumlabel = 'PV') THEN
            ALTER TYPE public.voucher_type_enum ADD VALUE 'PV';
        END IF;
    END IF;
END $$;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS show_hotels_list BOOLEAN DEFAULT TRUE;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS auto_refresh_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS auto_refresh_interval_minutes INTEGER DEFAULT 5;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS font_size INTEGER DEFAULT 16;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS account_name_case TEXT DEFAULT 'Sentence Case';
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS banks JSONB DEFAULT '[]';
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS auto_backup_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS auto_backup_interval_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS auto_backup_interval_hours INTEGER DEFAULT 6;
UPDATE app_config SET company_name = 'Hashmi Travel Solutions', app_subtitle = 'Travel Solutions by Shuja Anwar', company_phone = '0313-2710182', company_cell = '0313-2710182', company_email = 'Shujaanwaar@gmail.com' WHERE id = '00000000-0000-0000-0000-000000000001';
NOTIFY pgrst, 'reload schema';`;
                         navigator.clipboard.writeText(sql);
                         triggerNotification("SQL Copied to Clipboard");
                      }}
                      className="absolute top-4 right-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[9px] font-bold uppercase tracking-widest backdrop-blur-md transition-all"
                   >
                      Copy SQL
                   </button>
                </div>
             </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-8 border-t dark:border-slate-800 no-print">
          <p className={`font-black text-[10px] uppercase tracking-widest transition-opacity duration-300 ${saveStatus ? 'opacity-100' : 'opacity-0'} ${saveStatus.includes('Error') ? 'text-rose-500' : 'text-emerald-500'}`}>
            {saveStatus}
          </p>
          <button 
            type="submit" 
            className="px-12 py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-[0.3em] text-[10px] font-orbitron"
          >
            Commit Global Changes
          </button>
        </div>
      </form>
    </div>
  );
};

export default ControlPanel;