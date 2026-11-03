import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Account, AppConfig, Currency, LedgerEntry, Voucher, VoucherType } from '../types';

/**
 * Format currency with commas and 2 decimals or 0 decimals
 */
export const formatNumber = (num: number, decimals: number = 2): string => {
  if (isNaN(num)) return '0.00';
  return Number(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

/**
 * Format date nicely for PDF (DD-MM-YYYY)
 */
export const formatPdfDate = (dateStr?: string): string => {
  if (!dateStr || dateStr === '-') return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

export interface LedgerPdfExportOptions {
  account: Account;
  entries: LedgerEntry[];
  vouchers: Voucher[];
  config: AppConfig;
  currency: Currency;
  currentROE: number;
  fromDate?: string;
  toDate?: string;
  getNarrative: (entry: any, voucher?: Voucher) => string;
}

/**
 * Generates a 100% TEXT-BASED, VECTOR SEARCHABLE PDF for the General / Customer / Vendor Ledger.
 * Every single character, voucher number, narration, amount, and date is embedded as real text.
 * Ctrl+F works instantly, text can be highlighted and copied, and the file size is minimal.
 */
export const generateSearchableLedgerPdf = ({
  account,
  entries,
  vouchers,
  config,
  currency,
  currentROE,
  fromDate,
  toDate,
  getNarrative
}: LedgerPdfExportOptions): { doc: jsPDF; fileName: string; blob: Blob } => {
  // A4 Landscape: 297mm x 210mm
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const marginX = 10;
  let currentY = 12;

  // 1. Company Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // slate-900 (#0f172a)
  doc.text((config.companyName || 'TRAVEL ENTERPRISE').toUpperCase(), pageWidth / 2, currentY, { align: 'center' });

  currentY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  const contacts = [
    config.companyCell ? `CELL: ${config.companyCell}` : '',
    config.companyPhone ? `TEL: ${config.companyPhone}` : '',
    config.companyEmail ? `EMAIL: ${config.companyEmail}` : ''
  ].filter(Boolean).join('   |   ');
  if (contacts) {
    doc.text(contacts, pageWidth / 2, currentY, { align: 'center' });
    currentY += 4;
  }

  // Horizontal divider
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.4);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 5;

  // 2. Statement Title & Account Details Block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  const accountTypeLabel = account.type === 'VENDOR' ? 'VENDOR' : (account.type === 'CUSTOMER' ? 'CUSTOMER' : 'GENERAL');
  doc.text(`${accountTypeLabel} STATEMENT OF ACCOUNT`, pageWidth / 2, currentY, { align: 'center' });
  currentY += 5;

  // Account details box
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(marginX, currentY, pageWidth - (marginX * 2), 16, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, currentY, pageWidth - (marginX * 2), 16, 2, 2, 'S');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`ACCOUNT: ${account.name.toUpperCase()} (${account.code || 'N/A'})`, marginX + 4, currentY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const contactText = account.cell ? `PHONE: ${account.cell}` : '';
  const locationText = account.location ? `LOCATION: ${account.location}` : '';
  const subDetails = [contactText, locationText].filter(Boolean).join('   |   ');
  if (subDetails) {
    doc.text(subDetails, marginX + 4, currentY + 11.5);
  }

  // Right side of details box: Period & Print Date
  const periodText = `PERIOD: ${fromDate ? formatPdfDate(fromDate) : 'START'}  TO  ${toDate ? formatPdfDate(toDate) : 'CURRENT'}`;
  doc.text(periodText, pageWidth - marginX - 4, currentY + 5.5, { align: 'right' });

  const printDateStr = `PRINTED: ${formatPdfDate(new Date().toISOString())} ${new Date().toLocaleTimeString()}`;
  const currencyInfo = `CURRENCY: ${currency} ${currency === Currency.SAR ? `(ROE: ${currentROE})` : ''}`;
  doc.text(`${currencyInfo}   |   ${printDateStr}`, pageWidth - marginX - 4, currentY + 11.5, { align: 'right' });

  currentY += 20;

  // 3. Build Table Data
  let totalDebit = 0;
  let totalCredit = 0;
  let runningBalance = 0;

  const tableBody = entries.map((entry, index) => {
    const voucher = vouchers.find(v => v.id === entry.voucherId);
    const displayVNum = voucher?.voucherNum || entry.voucherNum || '-';
    const displayDescription = getNarrative(entry, voucher);
    const displayType = voucher?.type || ((entry.description?.includes('Opening') || (entry as any).isOpening) ? 'OP' : '-');
    const isOpening = (entry as any).isOpening;

    // Rate / Rooms / Nights logic
    let rateSar = '-';
    let rooms = '-';
    let nights = '-';
    let roeStr = '-';

    const isSar = voucher?.currency === Currency.SAR;
    const itemRoe = voucher?.roe || currentROE || 1;

    const vType = voucher?.type as string | undefined;
    if (vType === VoucherType.HOTEL || vType === 'HV' || vType === 'HOTEL') {
      const details = voucher?.details;
      const item = details?.items?.[0] || details;
      const rateVal = item?.unitRate !== undefined ? Number(item.unitRate) : (details?.unitRate !== undefined ? Number(details.unitRate) : undefined);
      if (rateVal && rateVal > 0) {
        rateSar = isSar ? formatNumber(rateVal, 0) : formatNumber(rateVal / itemRoe, 0);
      }
      rooms = String(item?.numRooms || details?.numRooms || '-');
      nights = String(item?.numNights || details?.numNights || '-');
      roeStr = String(voucher?.roe || itemRoe);
    } else if (vType === VoucherType.TRANSPORT || vType === 'TV' || vType === 'TRANSPORT') {
      const item = voucher?.details?.items?.[0] || voucher?.details;
      const rateVal = item?.rate !== undefined ? Number(item.rate) : undefined;
      if (rateVal && rateVal > 0) {
        rateSar = formatNumber(rateVal, 0);
      }
      rooms = String(item?.numVehicles || '1');
      roeStr = String(voucher?.roe || itemRoe);
    } else if (vType === VoucherType.VISA || vType === 'VV' || vType === 'VISA') {
      const item = voucher?.details?.items?.[0] || voucher?.details;
      const rateVal = item?.rate !== undefined ? Number(item.rate) : undefined;
      if (rateVal && rateVal > 0) {
        rateSar = isSar ? formatNumber(rateVal, 0) : formatNumber(rateVal / itemRoe, 0);
      }
      rooms = String(item?.quantity || '-');
      roeStr = String(voucher?.roe || itemRoe);
    } else if (voucher?.roe) {
      roeStr = String(voucher.roe);
    }

    // Debit and Credit amounts (apply currency conversion if SAR view)
    let debitAmount = entry.debit || 0;
    let creditAmount = entry.credit || 0;

    if (currency === Currency.SAR) {
      if ((entry as any).displayDebit !== undefined) {
        debitAmount = (entry as any).displayDebit;
      } else if (voucher?.roe) {
        debitAmount = debitAmount / voucher.roe;
      } else {
        debitAmount = debitAmount / currentROE;
      }

      if ((entry as any).displayCredit !== undefined) {
        creditAmount = (entry as any).displayCredit;
      } else if (voucher?.roe) {
        creditAmount = creditAmount / voucher.roe;
      } else {
        creditAmount = creditAmount / currentROE;
      }
    }

    totalDebit += debitAmount;
    totalCredit += creditAmount;

    let balanceAfter = (entry as any).balanceAfter;
    if (balanceAfter === undefined) {
      runningBalance += (debitAmount - creditAmount);
      balanceAfter = runningBalance;
    } else {
      runningBalance = balanceAfter;
    }

    const balanceText = `${formatNumber(Math.abs(balanceAfter), 2)} ${balanceAfter >= 0 ? 'DR' : 'CR'}`;

    return [
      String(index + 1),
      isOpening ? '-' : formatPdfDate(entry.date),
      displayVNum,
      displayType,
      displayDescription,
      rateSar,
      rooms,
      nights,
      roeStr,
      debitAmount > 0 ? formatNumber(debitAmount, 2) : '-',
      creditAmount > 0 ? formatNumber(creditAmount, 2) : '-',
      balanceText
    ];
  });

  // Table Columns Definition
  const head = [[
    '#',
    'DATE',
    'REF #',
    'TYPE',
    'TRANSACTION NARRATION',
    'RATE (SAR)',
    'RMS/QTY',
    'NGTS',
    'ROE',
    `DEBIT (${currency})`,
    `CREDIT (${currency})`,
    `BALANCE (${currency})`
  ]];

  // 4. Render Table with autoTable
  autoTable(doc, {
    startY: currentY,
    head: head,
    body: tableBody,
    theme: 'grid',
    margin: { left: marginX, right: marginX, bottom: 18 },
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      textColor: [30, 41, 59], // slate-800
      lineColor: [226, 232, 240], // slate-200
      lineWidth: 0.15,
      cellPadding: { top: 2, right: 1.5, bottom: 2, left: 1.5 },
      overflow: 'linebreak',
      valign: 'middle'
    },
    headStyles: {
      fillColor: [15, 23, 42], // slate-900 (#0f172a)
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      valign: 'middle'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // slate-50
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' }, // #
      1: { cellWidth: 18, halign: 'center' }, // DATE
      2: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }, // REF #
      3: { cellWidth: 12, halign: 'center', fontStyle: 'bold' }, // TYPE
      4: { cellWidth: 'auto', halign: 'left', fontStyle: 'bold' }, // NARRATION (takes remaining width)
      5: { cellWidth: 18, halign: 'center' }, // RATE (SAR)
      6: { cellWidth: 14, halign: 'center' }, // ROOMS/QTY
      7: { cellWidth: 12, halign: 'center' }, // NIGHTS
      8: { cellWidth: 12, halign: 'center' }, // ROE
      9: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }, // DEBIT
      10: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }, // CREDIT
      11: { cellWidth: 28, halign: 'right', fontStyle: 'bold' } // BALANCE
    },
    didDrawPage: (data) => {
      // Footer on every page
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184); // slate-400
      const footerY = pageHeight - 6;

      doc.text(
        `Generated by ${config.companyName || 'TravelLedger Pro'}  •  Searchable Vector PDF (Ctrl+F supported)`,
        marginX,
        footerY
      );

      const pageStr = `Page ${data.pageNumber} of ${pageCount}`;
      doc.text(pageStr, pageWidth - marginX, footerY, { align: 'right' });
    }
  });

  // 5. Total and Summary Footer Row
  const finalY = (doc as any).lastAutoTable.finalY + 4;
  if (finalY < pageHeight - 35) {
    // Summary Box
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(marginX, finalY, pageWidth - (marginX * 2), 16, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.roundedRect(marginX, finalY, pageWidth - (marginX * 2), 16, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('STATEMENT FINANCIAL TOTALS:', marginX + 4, finalY + 6);

    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Total Transactions: ${entries.length}`, marginX + 4, finalY + 11.5);

    // Totals aligned right
    const summaryRightX = pageWidth - marginX - 6;
    const finalBalance = runningBalance;
    const finalBalText = `${formatNumber(Math.abs(finalBalance), 2)} ${finalBalance >= 0 ? 'DR' : 'CR'}`;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text(`TOTAL DEBIT: ${currency} ${formatNumber(totalDebit, 2)}`, summaryRightX - 110, finalY + 9, { align: 'right' });

    doc.setTextColor(225, 29, 72); // rose-600
    doc.text(`TOTAL CREDIT: ${currency} ${formatNumber(totalCredit, 2)}`, summaryRightX - 55, finalY + 9, { align: 'right' });

    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(`NET BALANCE: ${currency} ${finalBalText}`, summaryRightX, finalY + 9, { align: 'right' });
  }

  const safeAccountName = account.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeDate = new Date().toISOString().split('T')[0];
  const fileName = `Ledger_${safeAccountName}_${safeDate}.pdf`;
  const blob = doc.output('blob');

  return { doc, fileName, blob };
};

export interface BookingSchedulePdfOptions {
  bookings: Array<{
    checkIn: string;
    checkOut?: string;
    paxGroup: string;
    service: string;
    vendorPartner: string;
    clientName: string;
    allocation: string;
    nights: number | string;
    credit: number;
    status?: string;
  }>;
  config: AppConfig;
  fromDate?: string;
  toDate?: string;
  filterLabel?: string;
}

/**
 * Generates a 100% TEXT-BASED, VECTOR SEARCHABLE PDF for the Dashboard Booking Schedule.
 * Allows searching by Pax Name, Voucher Number, Hotel, Sector, Vendor, Customer via Ctrl+F.
 */
export const generateSearchableBookingSchedulePdf = ({
  bookings,
  config,
  fromDate,
  toDate,
  filterLabel
}: BookingSchedulePdfOptions): { doc: jsPDF; fileName: string; blob: Blob } => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const marginX = 10;
  let currentY = 12;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text((config.companyName || 'TRAVEL ENTERPRISE').toUpperCase(), pageWidth / 2, currentY, { align: 'center' });

  currentY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(config.appSubtitle || 'Operational Management Suite', pageWidth / 2, currentY, { align: 'center' });
  currentY += 4;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 5;

  // Subheader
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('OPERATIONAL BOOKING SCHEDULE REPORT', pageWidth / 2, currentY, { align: 'center' });
  currentY += 5;

  // Metadata block
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginX, currentY, pageWidth - (marginX * 2), 10, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, currentY, pageWidth - (marginX * 2), 10, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  const filterDesc = filterLabel ? `FILTER: ${filterLabel.toUpperCase()}` : 'LIVE OPERATIONAL FEED';
  doc.text(filterDesc, marginX + 4, currentY + 6.5);

  const periodStr = `PERIOD: ${fromDate ? formatPdfDate(fromDate) : 'ANY'} TO ${toDate ? formatPdfDate(toDate) : 'ANY'}`;
  const printStr = `TOTAL BOOKINGS: ${bookings.length}   |   PRINTED: ${formatPdfDate(new Date().toISOString())} ${new Date().toLocaleTimeString()}`;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(periodStr, pageWidth / 2, currentY + 6.5, { align: 'center' });
  doc.text(printStr, pageWidth - marginX - 4, currentY + 6.5, { align: 'right' });

  currentY += 14;

  let totalCreditAmount = 0;

  const tableBody = bookings.map((b, idx) => {
    totalCreditAmount += Number(b.credit || 0);
    return [
      String(idx + 1),
      formatPdfDate(b.checkIn),
      b.checkOut ? formatPdfDate(b.checkOut) : '-',
      b.paxGroup || '-',
      (b.service || '-').toUpperCase(),
      b.vendorPartner || '-',
      b.clientName || '-',
      b.allocation || '-',
      String(b.nights ?? '-'),
      formatNumber(Number(b.credit || 0), 2)
    ];
  });

  const head = [[
    '#',
    'CHECK IN',
    'CHECK OUT',
    'PAX GROUP / GUEST',
    'SERVICE',
    'VENDOR / SUPPLIER',
    'CLIENT / CUSTOMER',
    'ALLOCATION / DETAILS',
    'NGTS',
    'AMOUNT (PKR)'
  ]];

  autoTable(doc, {
    startY: currentY,
    head: head,
    body: tableBody,
    theme: 'grid',
    margin: { left: marginX, right: marginX, bottom: 18 },
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      cellPadding: { top: 2, right: 1.5, bottom: 2, left: 1.5 },
      overflow: 'linebreak',
      valign: 'middle'
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 42, halign: 'left', fontStyle: 'bold' },
      4: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 38, halign: 'left' },
      6: { cellWidth: 40, halign: 'left', fontStyle: 'bold' },
      7: { cellWidth: 'auto', halign: 'left' },
      8: { cellWidth: 12, halign: 'center' },
      9: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
    },
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      const footerY = pageHeight - 6;

      doc.text(
        `Generated by ${config.companyName || 'TravelLedger Pro'}  •  Searchable Vector PDF (Ctrl+F supported)`,
        marginX,
        footerY
      );

      const pageStr = `Page ${data.pageNumber} of ${pageCount}`;
      doc.text(pageStr, pageWidth - marginX, footerY, { align: 'right' });
    }
  });

  // Footer summary
  const finalY = (doc as any).lastAutoTable.finalY + 4;
  if (finalY < pageHeight - 25) {
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(marginX, finalY, pageWidth - (marginX * 2), 12, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(marginX, finalY, pageWidth - (marginX * 2), 12, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`TOTAL BOOKINGS: ${bookings.length}`, marginX + 4, finalY + 7.5);

    const rightX = pageWidth - marginX - 6;
    doc.text(`TOTAL VALUE: PKR ${formatNumber(totalCreditAmount, 2)}`, rightX, finalY + 7.5, { align: 'right' });
  }

  const safeDate = new Date().toISOString().split('T')[0];
  const fileName = `Booking_Schedule_${safeDate}.pdf`;
  const blob = doc.output('blob');

  return { doc, fileName, blob };
};

export interface DashboardMetricsPdfOptions {
  config: AppConfig;
  stats: {
    totalIncome: number;
    totalReceivables: number;
    totalPayables: number;
    totalCash: number;
  };
  bankAccounts?: Array<{ name: string; balance: number; currency: string }>;
  topCustomers?: Array<{ name: string; balance: number }>;
  topVendors?: Array<{ name: string; balance: number }>;
}

/**
 * Generates a Searchable Vector PDF of Dashboard Key Metrics.
 */
export const generateSearchableDashboardMetricsPdf = ({
  config,
  stats,
  bankAccounts = [],
  topCustomers = [],
  topVendors = []
}: DashboardMetricsPdfOptions): { doc: jsPDF; fileName: string; blob: Blob } => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  let currentY = 16;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text((config.companyName || 'TRAVEL ENTERPRISE').toUpperCase(), pageWidth / 2, currentY, { align: 'center' });

  currentY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(config.appSubtitle || 'Enterprise Accounting Suite', pageWidth / 2, currentY, { align: 'center' });
  currentY += 4;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 8;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('EXECUTIVE FINANCIAL DASHBOARD SUMMARY', pageWidth / 2, currentY, { align: 'center' });
  currentY += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`As of ${formatPdfDate(new Date().toISOString())} ${new Date().toLocaleTimeString()}  •  Ctrl+F Searchable Report`, pageWidth / 2, currentY, { align: 'center' });
  currentY += 8;

  // Key Metrics 4-Box Grid
  const boxWidth = (pageWidth - (marginX * 2) - 9) / 2;
  const boxHeight = 20;

  const boxes = [
    { label: 'TOTAL SALES / REVENUE', val: `PKR ${formatNumber(stats.totalIncome, 0)}`, color: [16, 185, 129] },
    { label: 'CUSTOMER RECEIVABLES (DR)', val: `PKR ${formatNumber(stats.totalReceivables, 0)}`, color: [59, 130, 246] },
    { label: 'VENDOR PAYABLES (CR)', val: `PKR ${formatNumber(stats.totalPayables, 0)}`, color: [244, 63, 94] },
    { label: 'LIQUID CASH & BANK', val: `PKR ${formatNumber(stats.totalCash, 0)}`, color: [245, 158, 11] }
  ];

  boxes.forEach((b, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = marginX + (col * (boxWidth + 9));
    const y = currentY + (row * (boxHeight + 5));

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(b.label, x + 4, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(b.color[0], b.color[1], b.color[2]);
    doc.text(b.val, x + 4, y + 15);
  });

  currentY += (boxHeight * 2) + 14;

  // Cash & Bank Balances Table
  if (bankAccounts.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('CASH & BANK BALANCES', marginX, currentY);
    currentY += 4;

    const bankBody = bankAccounts.map((b, idx) => [
      String(idx + 1),
      b.name,
      b.currency,
      formatNumber(b.balance, 2)
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'ACCOUNT NAME', 'CURRENCY', 'BALANCE']],
      body: bankBody,
      theme: 'grid',
      margin: { left: marginX, right: marginX },
      styles: { font: 'helvetica', fontSize: 8 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 'auto', halign: 'left', fontStyle: 'bold' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Top Customer Receivables
  if (topCustomers.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('TOP CUSTOMER RECEIVABLES', marginX, currentY);
    currentY += 4;

    const custBody = topCustomers.map((c, idx) => [
      String(idx + 1),
      c.name,
      `PKR ${formatNumber(c.balance, 2)}`
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'CUSTOMER NAME', 'OUTSTANDING BALANCE']],
      body: custBody,
      theme: 'grid',
      margin: { left: marginX, right: marginX },
      styles: { font: 'helvetica', fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 'auto', halign: 'left', fontStyle: 'bold' },
        2: { cellWidth: 50, halign: 'right', fontStyle: 'bold' }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Top Vendor Payables
  if (topVendors.length > 0 && currentY < pageHeight - 40) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('TOP VENDOR PAYABLES', marginX, currentY);
    currentY += 4;

    const vendBody = topVendors.map((v, idx) => [
      String(idx + 1),
      v.name,
      `PKR ${formatNumber(v.balance, 2)}`
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'VENDOR NAME', 'OUTSTANDING LIABILITY']],
      body: vendBody,
      theme: 'grid',
      margin: { left: marginX, right: marginX },
      styles: { font: 'helvetica', fontSize: 8 },
      headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 'auto', halign: 'left', fontStyle: 'bold' },
        2: { cellWidth: 50, halign: 'right', fontStyle: 'bold' }
      }
    });
  }

  // Footer
  const footerY = pageHeight - 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated by ${config.companyName || 'TravelLedger Pro'}  •  Searchable Vector PDF (Ctrl+F supported)`, marginX, footerY);

  const safeDate = new Date().toISOString().split('T')[0];
  const fileName = `Dashboard_Metrics_${safeDate}.pdf`;
  const blob = doc.output('blob');

  return { doc, fileName, blob };
};

/**
 * Clean Print/Save-as-PDF helper using an isolated hidden iframe.
 * Triggers native browser print where "Save as PDF" produces a 100% Vector,
 * Ctrl+F searchable PDF with exact visual styles, borders, and colors!
 */
export const printElementAsVectorPdf = (element: HTMLElement, title: string = 'Document') => {
  const printIframe = document.createElement('iframe');
  printIframe.style.position = 'fixed';
  printIframe.style.right = '0';
  printIframe.style.bottom = '0';
  printIframe.style.width = '0';
  printIframe.style.height = '0';
  printIframe.style.border = '0';
  printIframe.style.opacity = '0';
  printIframe.style.zIndex = '-9999';

  document.body.appendChild(printIframe);

  const iframeDoc = printIframe.contentDocument || printIframe.contentWindow?.document;
  if (!iframeDoc) {
    window.print();
    return;
  }

  // Collect active style links & stylesheets
  const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map(el => el.outerHTML)
    .join('\n');

  iframeDoc.open();
  iframeDoc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        ${styleTags}
        <style>
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          body {
            background: white !important;
            color: #0f172a !important;
            font-family: 'Inter', sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          table {
            width: 100% !important;
            page-break-inside: auto !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
        </style>
      </head>
      <body>
        <div style="width: 100%; max-width: 100%; margin: 0 auto;">
          ${element.innerHTML}
        </div>
      </body>
    </html>
  `);
  iframeDoc.close();

  setTimeout(() => {
    try {
      printIframe.contentWindow?.focus();
      printIframe.contentWindow?.print();
    } catch (e) {
      console.warn("Iframe print fallback:", e);
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(printIframe)) {
          document.body.removeChild(printIframe);
        }
      }, 3000);
    }
  }, 500);
};
