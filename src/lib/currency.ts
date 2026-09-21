export type CurrencyCode = 'INR' | 'USD' | 'GBP' | 'EUR' | 'AUD' | 'CAD' | 'AED';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  rateFromGbp: number; // 1 GBP = X in target currency
  flag: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    rateFromGbp: 110.0,
    flag: '🇮🇳',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    rateFromGbp: 1.28,
    flag: '🇺🇸',
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    rateFromGbp: 1.0,
    flag: '🇬🇧',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    rateFromGbp: 1.17,
    flag: '🇪🇺',
  },
  AUD: {
    code: 'AUD',
    symbol: 'A$',
    name: 'Australian Dollar',
    rateFromGbp: 1.95,
    flag: '🇦🇺',
  },
  CAD: {
    code: 'CAD',
    symbol: 'C$',
    name: 'Canadian Dollar',
    rateFromGbp: 1.76,
    flag: '🇨🇦',
  },
  AED: {
    code: 'AED',
    symbol: 'AED ',
    name: 'UAE Dirham',
    rateFromGbp: 4.7,
    flag: '🇦🇪',
  },
};

export function convertFromGbp(amountGbp: number, target: CurrencyCode): number {
  const rate = CURRENCIES[target]?.rateFromGbp || 1;
  return amountGbp * rate;
}

export function formatPrice(
  amountGbp: number,
  currencyCode: CurrencyCode = 'INR',
  options?: { showDecimals?: boolean }
): string {
  const cfg = CURRENCIES[currencyCode] || CURRENCIES.INR;
  const converted = convertFromGbp(amountGbp, currencyCode);

  const isWhole = Number.isInteger(converted);
  const decimals =
    options?.showDecimals !== undefined
      ? options.showDecimals
        ? 2
        : 0
      : isWhole
      ? 0
      : 2;

  const formattedNum = converted.toLocaleString(
    currencyCode === 'INR' ? 'en-IN' : 'en-US',
    {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }
  );

  return `${cfg.symbol}${formattedNum}`;
}
