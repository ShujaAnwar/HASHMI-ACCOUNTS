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
