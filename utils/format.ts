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
