export type CurrencyCode =
  | 'INR'
  | 'USD'
  | 'GBP'
  | 'EUR'
  | 'AUD'
  | 'CAD'
  | 'AED'
  | 'SGD'
  | 'JPY'
  | 'NZD'
  | 'CHF'
  | 'ZAR';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  country: string;
  countryCode: string;
  rateFromGbp: number; // 1 GBP = X in target currency
  flag: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    country: 'India',
    countryCode: 'IN',
    rateFromGbp: 110.0,
    flag: '🇮🇳',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    country: 'United States',
    countryCode: 'US',
    rateFromGbp: 1.28,
    flag: '🇺🇸',
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    country: 'United Kingdom',
    countryCode: 'GB',
    rateFromGbp: 1.0,
    flag: '🇬🇧',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    country: 'European Union',
    countryCode: 'EU',
    rateFromGbp: 1.17,
    flag: '🇪🇺',
  },
  AUD: {
    code: 'AUD',
    symbol: 'A$',
    name: 'Australian Dollar',
    country: 'Australia',
    countryCode: 'AU',
    rateFromGbp: 1.95,
    flag: '🇦🇺',
  },
  CAD: {
    code: 'CAD',
    symbol: 'C$',
    name: 'Canadian Dollar',
    country: 'Canada',
    countryCode: 'CA',
    rateFromGbp: 1.76,
    flag: '🇨🇦',
  },
  AED: {
    code: 'AED',
    symbol: 'AED ',
    name: 'UAE Dirham',
    country: 'United Arab Emirates',
    countryCode: 'AE',
    rateFromGbp: 4.7,
    flag: '🇦🇪',
  },
  SGD: {
    code: 'SGD',
    symbol: 'S$',
    name: 'Singapore Dollar',
    country: 'Singapore',
    countryCode: 'SG',
    rateFromGbp: 1.72,
    flag: '🇸🇬',
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    name: 'Japanese Yen',
    country: 'Japan',
    countryCode: 'JP',
    rateFromGbp: 195.0,
    flag: '🇯🇵',
  },
  NZD: {
    code: 'NZD',
    symbol: 'NZ$',
    name: 'New Zealand Dollar',
    country: 'New Zealand',
    countryCode: 'NZ',
    rateFromGbp: 2.12,
    flag: '🇳🇿',
  },
  CHF: {
    code: 'CHF',
    symbol: 'CHF ',
    name: 'Swiss Franc',
    country: 'Switzerland',
    countryCode: 'CH',
    rateFromGbp: 1.11,
    flag: '🇨🇭',
  },
  ZAR: {
    code: 'ZAR',
    symbol: 'R',
    name: 'South African Rand',
    country: 'South Africa',
    countryCode: 'ZA',
    rateFromGbp: 23.5,
    flag: '🇿🇦',
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
