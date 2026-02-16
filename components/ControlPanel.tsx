import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getConfig, saveConfig, exportFullDatabase, importFullDatabase, getAccounts, getVouchers } from '../services/db';
import { AppConfig, Account, Voucher } from '../types';

interface ControlPanelProps {
  onConfigUpdate?: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ onConfigUpdate }) => {
  const [config, setConfig] = useState<(AppConfig & { fontSize?: number }) | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [saveStatus, setSaveStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'branding' | 'financial' | 'disaster' | 'diagnostics'>('branding');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const [conf, accs, vchs] = await Promise.all([
        getConfig(),
        getAccounts(),
        getVouchers()
      ]);
      setConfig(conf);
      setAccounts(accs);
      setVouchers(vchs);
      setLoading(false);
    };
    load();
  }, []);

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
      await saveConfig(config);
      triggerNotification('System configuration updated successfully.');
      if (onConfigUpdate) onConfigUpdate();
    } catch (err) {
      console.error("Save failed:", err);
      triggerNotification('Error: Could not save configuration.');
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

  const handleBackup = async () => {
    const data = await exportFullDatabase();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TLP_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    triggerNotification(`Database exported.`);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.config) {
          await importFullDatabase(data);
          alert("Database restored. Reloading...");
          window.location.reload();
        }
      } catch (err) { 
        alert("Restore Failed: Invalid backup file format."); 
      }
    };
    reader.readAsText(file);
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
        {['branding', 'financial', 'disaster', 'diagnostics'].map(t => (
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
                <h3 className="text-2xl font-orbitron font-bold uppercase tracking-tighter">Identity Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-bold text-blue-600 uppercase mb-2 block tracking-widest">Company Name</label>
                    <input className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 font-black uppercase text-sm shadow-inner outline-none" value={config.companyName} onChange={e => setConfig({...config, companyName: e.target.value.toUpperCase()})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-blue-600 uppercase mb-2 block tracking-widest">Subtitle</label>
                    <input className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 text-sm shadow-inner outline-none" value={config.appSubtitle} onChange={e => setConfig({...config, appSubtitle: e.target.value})} />
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
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'financial' && (
           <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 shadow-xl space-y-8 border border-slate-100 dark:border-slate-800">
              <h3 className="text-2xl font-orbitron font-bold uppercase tracking-tighter">Exchange Rate Controls</h3>
              <div className="w-64">
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
        )}

        {activeTab === 'disaster' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-900 text-white rounded-[2.5rem] p-12 shadow-2xl flex flex-col justify-between min-h-[300px] border border-white/5">
              <div>
                <h3 className="text-3xl font-orbitron font-bold mb-2 tracking-tighter uppercase">Export Vault</h3>
                <p className="text-slate-400 text-xs mb-8">Download a secure local backup of all accounts and vouchers.</p>
              </div>
              <button 
                type="button" 
                onClick={handleBackup} 
                className="w-full py-5 bg-white text-slate-900 font-black rounded-2xl uppercase text-xs tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-all"
              >
                Download Full Backup
              </button>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-12 shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between min-h-[300px]">
              <div>
                <h3 className="text-3xl font-orbitron font-bold mb-2 tracking-tighter uppercase dark:text-white">Restoration</h3>
                <p className="text-slate-400 text-xs mb-8">Upload a JSON backup file to overwrite current cloud state.</p>
              </div>
              <button 
                type="button" 
                onClick={() => restoreInputRef.current?.click()} 
                className="w-full py-5 bg-rose-600 text-white font-black rounded-2xl shadow-xl shadow-rose-600/20 uppercase text-xs tracking-[0.2em] transition-all"
              >
                Upload JSON Backup
              </button>
              <input type="file" hidden ref={restoreInputRef} accept=".json" onChange={handleRestore} />
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
                      {integrityStats.diff.toLocaleString()}
                    </p>
                  </div>
                </div>

                {Math.abs(integrityStats.diff) > 0.01 && (
                  <div className="bg-rose-100/50 dark:bg-rose-900/20 p-6 rounded-3xl border border-rose-200 text-sm font-bold text-rose-700 dark:text-rose-400">
                     ALERT: Your Trial Balance is broken by PKR {Math.abs(integrityStats.diff).toLocaleString()}. 
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
{`-- FIX: Add missing column and reload cache
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS currency public.currency_enum NOT NULL DEFAULT 'PKR';
NOTIFY pgrst, 'reload schema';`}
                   </pre>
                   <button 
                      type="button"
                      onClick={() => {
                         navigator.clipboard.writeText("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS currency public.currency_enum NOT NULL DEFAULT 'PKR';\nNOTIFY pgrst, 'reload schema';");
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
            Commit Identity Changes
          </button>
        </div>
      </form>
    </div>
  );
};

export default ControlPanel;