import React, { useState, useRef } from 'react';
import { getConfig, saveConfig, exportFullDatabase, importFullDatabase, getAccounts } from '../services/db';
import { AppConfig, AccountType } from '../types';
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
      const base64 = event.target?.result as string;
      const newConfig = { ...config, companyLogo: base64 };
      setConfig(newConfig);
      saveConfig(newConfig);
      triggerNotification('Brand logo uploaded.');
      if (onConfigUpdate) onConfigUpdate();
    };
    reader.readAsDataURL(file);
  };

  const handleBackup = () => {
    const data = exportFullDatabase();
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
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.config) {
          importFullDatabase(data);
          alert("Database restored. Reloading...");
          window.location.reload();
        }
      } catch (err) { alert("Restore Failed"); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-6xl space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex space-x-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm w-fit overflow-x-auto no-print">
        {['branding', 'financial', 'disaster'].map(t => (
          <button key={t} onClick={() => setActiveTab(t as any)} className={`px-6 py-3 rounded-xl font-bold text-xs transition-all uppercase ${activeTab === t ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>{t}</button>
        ))}
      </div>

      <form onSubmit={handleUpdate} className="space-y-8">
        {activeTab === 'branding' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border shadow-xl text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-6 tracking-widest">Master Brand Asset</p>
                <div onClick={() => fileInputRef.current?.click()} className="w-full aspect-video rounded-3xl border-2 border-dashed flex items-center justify-center cursor-pointer hover:border-blue-500 bg-slate-50 dark:bg-slate-800 overflow-hidden">
                  {config.companyLogo ? <img src={config.companyLogo} style={{ height: `${config.logoSize}px` }} alt="Logo" /> : <span>Upload Logo</span>}
                </div>
                <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={handleLogoUpload} />
                <div className="mt-8 space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase">Logo Height: {config.logoSize}px</label>
                   <input type="range" min="20" max="200" className="w-full" value={config.logoSize} onChange={e => setConfig({...config, logoSize: Number(e.target.value)})} />
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 shadow-xl space-y-8">
                <h3 className="text-2xl font-orbitron font-bold uppercase">Identity Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div><label className="text-[10px] font-bold text-blue-600 uppercase mb-2 block">Company Name</label><input className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-4 font-bold uppercase" value={config.companyName} onChange={e => setConfig({...config, companyName: e.target.value.toUpperCase()})} /></div>
                  <div><label className="text-[10px] font-bold text-blue-600 uppercase mb-2 block">Subtitle</label><input className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-4" value={config.appSubtitle} onChange={e => setConfig({...config, appSubtitle: e.target.value})} /></div>
                  <div><label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Cell Number</label><input className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-4" value={config.companyCell} onChange={e => setConfig({...config, companyCell: e.target.value})} /></div>
                  <div><label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Phone Number</label><input className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-4" value={config.companyPhone} onChange={e => setConfig({...config, companyPhone: e.target.value})} /></div>
                  <div><label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Email Address</label><input className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-4" value={config.companyEmail} onChange={e => setConfig({...config, companyEmail: e.target.value})} /></div>
                  <div className="md:col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Corporate Address</label><textarea className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-4 h-24 font-medium" value={config.companyAddress} onChange={e => setConfig({...config, companyAddress: e.target.value})} /></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'financial' && (
           <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 shadow-xl space-y-8">
              <h3 className="text-2xl font-orbitron font-bold uppercase">Exchange Rate Controls</h3>
              <div className="w-64"><label className="text-[10px] font-bold text-blue-600 uppercase mb-2 block">Default SAR Rate</label><input type="number" step="0.01" className="w-full bg-blue-50 dark:bg-blue-900/20 border-2 rounded-2xl p-4 font-orbitron font-bold text-2xl text-center" value={config.defaultROE} onChange={e => setConfig({...config, defaultROE: Number(e.target.value)})} /></div>
           </div>
        )}

        {activeTab === 'disaster' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-900 text-white rounded-[2.5rem] p-12 shadow-2xl"><h3 className="text-3xl font-orbitron font-bold mb-4">Export Vault</h3><button type="button" onClick={handleBackup} className="w-full py-4 bg-white text-slate-900 font-bold rounded-2xl uppercase text-xs tracking-widest">Download Full Backup</button></div>
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-12 shadow-xl border"><h3 className="text-3xl font-orbitron font-bold mb-4">Restoration</h3><button type="button" onClick={() => restoreInputRef.current?.click()} className="w-full py-4 bg-rose-600 text-white font-bold rounded-2xl shadow-xl uppercase text-xs tracking-widest">Upload JSON Backup</button><input type="file" hidden ref={restoreInputRef} accept=".json" onChange={handleRestore} /></div>
          </div>
        )}

        <div className="flex items-center justify-between pt-8 border-t dark:border-slate-800 no-print">
          <p className="text-emerald-500 font-bold text-[10px] uppercase tracking-widest">{saveStatus}</p>
          <button type="submit" className="px-12 py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-3xl shadow-2xl hover:scale-[1.02] transition-all uppercase tracking-[0.2em] text-[10px]">Commit Identity Changes</button>
        </div>
      </form>
    </div>
  );
};

export default ControlPanel;