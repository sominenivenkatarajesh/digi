'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  CurrencyCode,
  CurrencyConfig,
  CURRENCIES,
  formatPrice,
  convertFromGbp,
} from '@/lib/currency';

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  symbol: string;
  config: CurrencyConfig;
  format: (amountGbp: number, options?: { showDecimals?: boolean }) => string;
  convert: (amountGbp: number) => number;
  currencies: CurrencyConfig[];
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  // Default to INR as requested by the user
  const [currency, setCurrencyState] = useState<CurrencyCode>('INR');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('dh_currency') as CurrencyCode;
      if (saved && CURRENCIES[saved]) {
        setCurrencyState(saved);
      }
    } catch {
      // Ignore localStorage read errors in SSR or restricted environments
    }
  }, []);

  const setCurrency = (code: CurrencyCode) => {
    if (CURRENCIES[code]) {
      setCurrencyState(code);
      try {
        localStorage.setItem('dh_currency', code);
      } catch {
        // Ignore localStorage write error
      }
    }
  };

  const config = CURRENCIES[currency] || CURRENCIES.INR;

  const format = (amountGbp: number, options?: { showDecimals?: boolean }) => {
    return formatPrice(amountGbp, currency, options);
  };

  const convert = (amountGbp: number) => {
    return convertFromGbp(amountGbp, currency);
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        symbol: config.symbol,
        config,
        format,
        convert,
        currencies: Object.values(CURRENCIES),
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    // Return a safe fallback if used outside provider
    const fallbackConfig = CURRENCIES.INR;
    return {
      currency: 'INR' as CurrencyCode,
      setCurrency: () => {},
      symbol: fallbackConfig.symbol,
      config: fallbackConfig,
      format: (amountGbp: number, options?: { showDecimals?: boolean }) =>
        formatPrice(amountGbp, 'INR', options),
      convert: (amountGbp: number) => convertFromGbp(amountGbp, 'INR'),
      currencies: Object.values(CURRENCIES),
    };
  }
  return context;
}
