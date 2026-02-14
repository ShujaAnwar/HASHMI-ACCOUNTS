import React, { useState, useMemo, useEffect } from 'react';
import { VoucherType, Currency, AccountType, Voucher, VoucherStatus, Account, AppConfig } from '../types';
import { getAccounts, getVouchers, getConfig } from '../services/db';
import { AccountingService } from '../services/AccountingService';
import PaymentVoucherForm from './PaymentVoucherForm';
import ReceiptVoucherForm from './ReceiptVoucherForm';
import TransportVoucherForm from './TransportVoucherForm';
import VisaVoucherForm from './VisaVoucherForm';
import HotelVoucherForm from './HotelVoucherForm';
import TicketVoucherForm from './TicketVoucherForm';

const amountToWords = (num: number): string => {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const numStr = Math.floor(num).toString();
  if (numStr.length > 9) return 'Amount too large';
  let n = ('000000000' + numStr).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  let str = '';
  str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (Number(n[5]) != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + ' ' : '';
  return str.trim() + ' PKR Only';
};

interface VouchersProps {
  externalIntent?: { type: 'EDIT' | 'VIEW', voucher: Voucher } | null;
  clearIntent?: () => void;
}

const Vouchers: React.FC<VouchersProps> = ({ externalIntent, clearIntent }) => {
  const [activeType, setActiveType] = useState<VoucherType>(VoucherType.HOTEL);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'CREATE' | 'EDIT' | 'CLONE'>('CREATE');
  const [viewingVoucher, setViewingVoucher] = useState<Voucher | null>(null);
  const [inspectorView, setInspectorView] = useState<'OFFICIAL' | 'PKR' | 'SAR' | 'SERVICE'>('OFFICIAL');
  const [voucherToEdit, setVoucherToEdit] = useState<Voucher | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [allVouchers, setAllVouchers] = useState<Voucher[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [accs, conf, vchs] = await Promise.all([
        getAccounts(),
        getConfig(),
        getVouchers()
      ]);
      setAccounts(accs);
      setConfig(conf);
      setAllVouchers(vchs);
    };
    fetchData();
  }, [refreshKey, showForm]);

  useEffect(() => {
    if (externalIntent) {
      if (externalIntent.type === 'EDIT') handleEdit(externalIntent.voucher);
      else if (externalIntent.type === 'VIEW') {
        setViewingVoucher(externalIntent.voucher);
        setInspectorView('SERVICE'); 
      }
      if (clearIntent) clearIntent();
    }
  }, [externalIntent]);

  const handleEdit = (v: Voucher) => { setFormMode('EDIT'); setVoucherToEdit(v); setShowForm(true); };
  const handleClone = (v: Voucher) => { setFormMode('CLONE'); setVoucherToEdit(v); setShowForm(true); };
  
  const handleDelete = async (id: string) => { 
    if (window.confirm('Delete voucher?')) { 
      await AccountingService.deleteVoucher(id); 
      setRefreshKey(prev => prev + 1); 
      setViewingVoucher(null); 
    } 
  };

  const handleSave = async (data: any) => {
    if (formMode === 'EDIT' && voucherToEdit) await AccountingService.updateVoucher(voucherToEdit.id, data);
    else await AccountingService.postVoucher(data);
    setShowForm(false); setVoucherToEdit(null); setRefreshKey(prev => prev + 1);
  };

  const filteredVouchers = useMemo(() => {
    return allVouchers.filter(v => v.type === activeType);
  }, [allVouchers, activeType]);

  const formatMeals = (meals: any) => {
    if (Array.isArray(meals)) return meals.join(', ');
    if (typeof meals === 'string') return meals;
    return 'Room Only';
  };

  const getDetailedNarrative = (v: Voucher) => {
    if (!v.details) return v.description;
    
    switch (v.type) {
      case VoucherType.HOTEL:
        const from = v.details.fromDate ? new Date(v.details.fromDate).toLocaleDateString() : '';
        const to = v.details.toDate ? new Date(v.details.toDate).toLocaleDateString() : '';
        return `Hotel: ${v.details.hotelName} | ${v.details.roomType} | ${from} to ${to} | Meal: ${formatMeals(v.details.meals)}`;
      case VoucherType.TRANSPORT:
        return `Sector: ${v.details.items?.[0]?.sector || 'N/A'} | Vehicle: ${v.details.items?.[0]?.vehicle || 'N/A'}`;
      case VoucherType.VISA:
        return `Visa for: ${v.details.headName}`;
      case VoucherType.TICKET:
        return `${v.details.paxName} | ${v.details.airline} | ${v.details.sector} | PNR: ${v.reference || 'N/