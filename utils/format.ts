/**
 * Formats a number as currency, wrapping negative values in parentheses.
 * Example: 1000 -> 1,000
 * Example: -1000 -> (1,000)
 */
export const formatCurrency = (amount: number): string => {
  const absoluteValue = Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  
  if (amount < 0) {
    return `(${absoluteValue})`;
  }
  
  return absoluteValue;
};

/**
 * Formats a date as Day Month Year (e.g., 12 April 2026).
 */
export const formatDate = (date: string | Date | undefined | null): string => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

/**
 * Parses a date string or Date object into UTC midnight timestamp (ms)
 * to prevent local timezone / DST off-by-one errors when counting nights.
 */
export const parseDateToUTC = (dateInput: string | Date | undefined | null): number | null => {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null;
    return Date.UTC(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
  }
  const str = String(dateInput).trim();
  if (!str || str === '-') return null;

  // Match YYYY-MM-DD (optionally followed by T...)
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    return Date.UTC(y, m, d);
  }

  // Match DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    const y = parseInt(dmyMatch[3], 10);
    return Date.UTC(y, m, d);
  }

  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return null;
  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
};

/**
 * Computes exact number of nights between check-in and check-out dates.
 */
export const calculateNights = (
  fromDate: string | Date | undefined | null,
  toDate: string | Date | undefined | null
): number => {
  const startUTC = parseDateToUTC(fromDate);
  const endUTC = parseDateToUTC(toDate);
  if (startUTC === null || endUTC === null) return 0;
  const diffDays = Math.round((endUTC - startUTC) / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

/**
 * Resolves the accurate number of nights from check-in/check-out dates first,
 * falling back to stored numNights/nights if valid dates are absent.
 */
export const resolveNights = (item?: any, fallbackDetails?: any): number => {
  const fromDate = item?.fromDate || item?.checkIn || item?.checkInDate || fallbackDetails?.fromDate || fallbackDetails?.checkIn || fallbackDetails?.checkInDate;
  const toDate = item?.toDate || item?.checkOut || item?.checkOutDate || fallbackDetails?.toDate || fallbackDetails?.checkOut || fallbackDetails?.checkOutDate;
  const computed = calculateNights(fromDate, toDate);
  if (computed > 0) return computed;

  const stored = item?.numNights ?? item?.nights ?? fallbackDetails?.numNights ?? fallbackDetails?.nights;
  const num = Number(stored);
  return !isNaN(num) && num > 0 ? num : 0;
};

