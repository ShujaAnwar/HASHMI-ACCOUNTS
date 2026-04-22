import React, { useEffect } from 'react';
import { AppConfig } from '../types';
import { formatDate } from '../utils/format';
import { exportFullDatabase } from '../services/db';
import * as XLSX from 'xlsx';

interface AutoBackupManagerProps {
  config: AppConfig;
}

const AutoBackupManager: React.FC<AutoBackupManagerProps> = ({ config }) => {
  useEffect(() => {
    if (!config.autoBackupEnabled && !config.autoBackupIntervalEnabled) return;

    const performBackup = async (type: 'DAILY' | 'INTERVAL') => {
      try {
        console.log(`Triggering ${type} automatic backup...`);
        const data = await exportFullDatabase();
        const now = new Date();
        const timestamp = formatDate(now).replace(/[:.]/g, '-');
        const prefix = type === 'DAILY' ? 'Daily_Backup' : 'Interval_Backup';

        // 1. JSON Backup
        const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const jsonUrl = URL.createObjectURL(jsonBlob);
        const jsonLink = document.createElement('a');
        jsonLink.href = jsonUrl;
        jsonLink.download = `${prefix}_${timestamp}.json`;
        document.body.appendChild(jsonLink);
        jsonLink.click();
        document.body.removeChild(jsonLink);

        // 2. Excel Backup
        const workbook = XLSX.utils.book_new();
        
        // Accounts
        const accountsData = data.accounts.map(a => ({
          ID: a.id, Code: a.code, Name: a.name, Type: a.type,
          Cell: a.cell, Location: a.location, Currency: a.currency, Balance: a.balance
        }));
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(accountsData), "Accounts");

        // Vouchers
        const vouchersData = data.vouchers.map(v => ({
          ID: v.id, Type: v.type, VoucherNum: v.voucherNum, Date: v.date,
          Currency: v.currency, ROE: v.roe, TotalAmountPKR: v.totalAmountPKR,
          Description: v.description, Status: v.status, Reference: v.reference,
          CustomerID: v.customerId, VendorID: v.vendorId, Details: JSON.stringify(v.details),
          CreatedAt: v.createdAt
        }));
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(vouchersData), "Vouchers");

        // Ledger
        const ledgerEntries: any[] = [];
        data.accounts.forEach(a => {
          if (a.ledger) {
            a.ledger.forEach(l => {
              ledgerEntries.push({
                AccountID: a.id, AccountName: a.name, Date: l.date,
                VoucherID: l.voucherId, VoucherNum: l.voucherNum, Description: l.description,
                Debit: l.debit, Credit: l.credit, BalanceAfter: l.balanceAfter, CreatedAt: l.createdAt
              });
            });
          }
        });
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(ledgerEntries), "LedgerEntries");

        // Config
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([data.config]), "Config");

        XLSX.writeFile(workbook, `${prefix}_${timestamp}.xlsx`);

        if (type === 'DAILY') {
          localStorage.setItem('last_auto_backup_date', now.toISOString().split('T')[0]);
        } else {
          localStorage.setItem('last_interval_backup_time', now.getTime().toString());
        }
        
        console.log(`${type} automatic backup completed successfully.`);
      } catch (err) {
        console.error(`${type} automatic backup failed:`, err);
      }
    };

    const checkAndBackup = async () => {
      const now = new Date();
      
      // 1. Check Daily Backup
      if (config.autoBackupEnabled) {
        const today = now.toISOString().split('T')[0];
        const lastDailyBackupDate = localStorage.getItem('last_auto_backup_date');
        if (lastDailyBackupDate !== today) {
          await performBackup('DAILY');
        }
      }

      // 2. Check Interval Backup
      if (config.autoBackupIntervalEnabled && config.autoBackupIntervalHours) {
        const lastIntervalBackupTime = localStorage.getItem('last_interval_backup_time');
        const intervalMs = config.autoBackupIntervalHours * 60 * 60 * 1000;
        
        if (!lastIntervalBackupTime) {
          // First time initialization
          localStorage.setItem('last_interval_backup_time', now.getTime().toString());
        } else {
          const timeSinceLastBackup = now.getTime() - parseInt(lastIntervalBackupTime);
          if (timeSinceLastBackup >= intervalMs) {
            await performBackup('INTERVAL');
          }
        }
      }
    };

    // Check every minute if we need to backup
    const interval = setInterval(checkAndBackup, 60000);
    checkAndBackup(); // Initial check

    return () => clearInterval(interval);
  }, [config.autoBackupEnabled, config.autoBackupIntervalEnabled, config.autoBackupIntervalHours]);

  return null;
};

export default AutoBackupManager;
