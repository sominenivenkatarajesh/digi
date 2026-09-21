'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useCurrency } from '@/components/providers/CurrencyProvider';
import { CurrencyCode } from '@/lib/currency';
import { ChevronDown, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CurrencySelectorProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function CurrencySelector({ className, size = 'md' }: CurrencySelectorProps) {
  const { currency, setCurrency, currencies, config } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn('relative inline-block text-left', className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl border border-white/10 bg-navy-900/80 text-white font-medium shadow-sm backdrop-blur-md hover:bg-navy-800 hover:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all cursor-pointer',
          size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-xs sm:text-sm'
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="text-sm">{config.flag}</span>
        <span className="font-mono font-bold text-emerald-400">{config.symbol}</span>
        <span className="text-slate-300 font-semibold">{config.code}</span>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-slate-400 transition-transform duration-200',
            isOpen ? 'rotate-180 text-emerald-400' : ''
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-52 rounded-2xl bg-navy-900/95 border border-white/15 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-2 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-white/10 flex items-center gap-1.5">
            <Globe className="w-3 h-3 text-emerald-400" />
            <span>Select Currency</span>
          </div>
          <div className="max-h-60 overflow-y-auto py-1 space-y-0.5">
            {currencies.map((c) => {
              const isSelected = c.code === currency;
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    setCurrency(c.code as CurrencyCode);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer text-left',
                    isSelected
                      ? 'bg-emerald-500/15 text-white border border-emerald-500/30'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{c.flag}</span>
                    <div>
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <span>{c.code}</span>
                        <span className="font-mono text-emerald-400 font-bold">({c.symbol})</span>
                      </div>
                      <div className="text-[10px] text-slate-400">{c.name}</div>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
