'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useCurrency } from '@/components/providers/CurrencyProvider';
import { CurrencyCode, CurrencyConfig } from '@/lib/currency';
import { ChevronDown, Globe, Search, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CurrencySelectorProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function CurrencySelector({ className, size = 'md' }: CurrencySelectorProps) {
  const { currency, setCurrency, currencies, config } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Autofocus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedLetter(null);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Extract unique sorted starting letters of available countries
  const availableLetters = useMemo(() => {
    const letters = new Set<string>();
    currencies.forEach((c) => {
      const countryFirstLetter = (c.country || c.name || c.code)[0].toUpperCase();
      letters.add(countryFirstLetter);
    });
    return Array.from(letters).sort();
  }, [currencies]);

  // Filter currencies by search query or starting letter
  const filteredCurrencies = useMemo(() => {
    let list = currencies;

    // 1. If a specific starting letter is selected via letter pills
    if (selectedLetter) {
      list = list.filter((c) => {
        const countryFirst = (c.country || '').trim().toUpperCase()[0];
        const codeFirst = c.code.toUpperCase()[0];
        return countryFirst === selectedLetter || codeFirst === selectedLetter;
      });
    }

    // 2. If a search query is entered in the search box
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter((c) => {
        const country = (c.country || '').toLowerCase();
        const code = c.code.toLowerCase();
        const name = c.name.toLowerCase();
        const countryCode = (c.countryCode || '').toLowerCase();

        // Exact starting letter match (e.g. user entered single letter "i")
        if (query.length === 1) {
          return (
            country.startsWith(query) ||
            code.startsWith(query) ||
            countryCode.startsWith(query)
          );
        }

        // Substring / prefix search for longer queries
        return (
          country.includes(query) ||
          code.includes(query) ||
          name.includes(query) ||
          countryCode.includes(query)
        );
      });
    }

    return list;
  }, [currencies, searchQuery, selectedLetter]);

  // Handle keyboard shortcuts (e.g. typing a letter directly, ArrowDown, Enter, Esc)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (e.key === 'Enter' && filteredCurrencies.length > 0) {
      setCurrency(filteredCurrencies[0].code as CurrencyCode);
      setIsOpen(false);
    }
  };

  return (
    <div className={cn('relative inline-block text-left', className)} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl border border-white/10 bg-navy-900/80 text-white font-medium shadow-sm backdrop-blur-md hover:bg-navy-800 hover:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all cursor-pointer',
          size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-xs sm:text-sm'
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={`Country: ${config.country || config.name} (${config.code})`}
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

      {/* Dropdown Menu with Country Search */}
      {isOpen && (
        <div
          onKeyDown={handleKeyDown}
          className="absolute right-0 z-50 mt-2 w-72 sm:w-80 rounded-2xl bg-navy-900/98 border border-white/15 p-2.5 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="px-2 pb-2 text-[11px] uppercase font-bold tracking-wider text-slate-400 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Globe className="w-3.5 h-3.5" />
              <span>Select Country & Currency</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {filteredCurrencies.length} {filteredCurrencies.length === 1 ? 'option' : 'options'}
            </span>
          </div>

          {/* Search Input Box */}
          <div className="relative my-2">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedLetter(null); // Clear pill when typing
              }}
              placeholder="Search by country or starting letter (e.g. 'I')..."
              className="w-full bg-navy-950/80 border border-white/15 focus:border-emerald-500 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Starting Letter Filter Bar */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1.5 mb-1 text-[11px] font-mono scrollbar-none">
            <button
              type="button"
              onClick={() => {
                setSelectedLetter(null);
                setSearchQuery('');
              }}
              className={cn(
                'px-1.5 py-0.5 rounded-md text-[10px] uppercase font-bold transition-all shrink-0 cursor-pointer',
                !selectedLetter && !searchQuery
                  ? 'bg-emerald-500 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              )}
            >
              All
            </button>
            {availableLetters.map((letter) => {
              const isActive =
                selectedLetter === letter ||
                (searchQuery.trim().toUpperCase() === letter && !selectedLetter);
              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => {
                    setSelectedLetter(letter);
                    setSearchQuery('');
                  }}
                  className={cn(
                    'w-5 h-5 rounded-md text-[11px] font-bold flex items-center justify-center transition-all shrink-0 cursor-pointer',
                    isActive
                      ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  )}
                  title={`Countries starting with ${letter}`}
                >
                  {letter}
                </button>
              );
            })}
          </div>

          {/* Currency / Country List */}
          <div className="max-h-64 overflow-y-auto space-y-1 pr-0.5">
            {filteredCurrencies.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                <p>No country starting with &ldquo;{searchQuery || selectedLetter}&rdquo;</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedLetter(null);
                  }}
                  className="mt-2 text-[11px] font-semibold text-emerald-400 hover:underline"
                >
                  Clear search & show all
                </button>
              </div>
            ) : (
              filteredCurrencies.map((c: CurrencyConfig) => {
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
                        ? 'bg-emerald-500/20 text-white border border-emerald-500/40'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl shrink-0">{c.flag}</span>
                      <div>
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <span>{c.country || c.name}</span>
                          <span className="font-mono text-emerald-400 font-bold text-[11px]">
                            {c.code} ({c.symbol})
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">{c.name}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-emerald-400" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CurrencySelector;
