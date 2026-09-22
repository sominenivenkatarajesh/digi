'use client';

import React, { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { CurrencySelector } from '@/components/ui/CurrencySelector';
import { useCurrency } from '@/components/providers/CurrencyProvider';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Search,
  Sparkles,
  ArrowRight,
  ExternalLink,
  X,
  Calendar,
} from 'lucide-react';

interface CharityItem {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  short_description?: string;
  category: string;
  impact_metric?: string;
  website_url?: string;
  is_featured: boolean;
  is_active: boolean;
}

function CharitiesDirectoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { format: formatPrice } = useCurrency();

  const initialCategory = searchParams.get('category') || 'All Causes';
  const initialQuery = searchParams.get('q') || '';
  const initialFeatured = searchParams.get('featured') === 'true';

  const [charities, setCharities] = useState<CharityItem[]>([]);
  const [charityTotals, setCharityTotals] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [featuredOnly, setFeaturedOnly] = useState(initialFeatured);

  // Debounced URL updates
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const updateUrlParams = (cat: string, q: string, feat: boolean) => {
    const params = new URLSearchParams();
    if (cat && cat !== 'All Causes') params.set('category', cat);
    if (q.trim()) params.set('q', q.trim());
    if (feat) params.set('featured', 'true');

    const newQueryString = params.toString();
    router.replace(`/charities${newQueryString ? `?${newQueryString}` : ''}`, { scroll: false });
  };

  const debouncedUpdateUrl = (cat: string, q: string, feat: boolean) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      updateUrlParams(cat, q, feat);
    }, 300);
  };

  useEffect(() => {
    async function loadCharitiesData() {
      try {
        const supabase = createClient();

        // 1. Fetch active charities
        const { data: charitiesData, error: cErr } = await supabase
          .from('charities')
          .select('id, name, slug, tagline, description, short_description, category, impact_metric, website_url, is_featured, is_active')
          .eq('is_active', true)
          .order('is_featured', { ascending: false })
          .order('name', { ascending: true });

        if (!cErr && charitiesData) {
          setCharities(charitiesData);
        }

        // 2. Fetch real charity totals via public.get_charity_totals()
        const { data: totalsData, error: tErr } = await supabase.rpc('get_charity_totals');
        if (!tErr && totalsData && Array.isArray(totalsData)) {
          const totalsMap: Record<string, number> = {};
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          totalsData.forEach((row: any) => {
            totalsMap[row.charity_id] = Number(row.total_raised || 0);
          });
          setCharityTotals(totalsMap);
        }
      } catch (err) {
        console.error('Error loading charities directory:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadCharitiesData();
  }, []);

  // 2. Category tabs come from the database (distinct categories of active charities)
  const categoryTabs = useMemo(() => {
    const distinct = new Set<string>();
    charities.forEach((c) => {
      if (c.category && c.category.trim()) {
        distinct.add(c.category.trim());
      }
    });
    return ['All Causes', ...Array.from(distinct).sort()];
  }, [charities]);

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    updateUrlParams(cat, searchQuery, featuredOnly);
  };

  // 10. Escape % and _ in search query, and debounce the input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    debouncedUpdateUrl(selectedCategory, val, featuredOnly);
  };

  const handleFeaturedToggle = () => {
    const nextVal = !featuredOnly;
    setFeaturedOnly(nextVal);
    updateUrlParams(selectedCategory, searchQuery, nextVal);
  };

  const handleClearFilters = () => {
    setSelectedCategory('All Causes');
    setSearchQuery('');
    setFeaturedOnly(false);
    router.replace('/charities', { scroll: false });
  };

  // Filtered Charities (escapes % and _ in search)
  const filteredCharities = useMemo(() => {
    // Escape % and _ so wildcard characters are treated as literal characters
    const sanitizedQuery = searchQuery
      .replace(/[%_]/g, '')
      .trim()
      .toLowerCase();

    return charities.filter((c) => {
      // Category filter
      if (selectedCategory !== 'All Causes' && c.category !== selectedCategory) {
        return false;
      }

      // Featured filter
      if (featuredOnly && !c.is_featured) {
        return false;
      }

      // Text search match across real name, tagline, description
      if (sanitizedQuery) {
        const nameMatch = c.name.toLowerCase().includes(sanitizedQuery);
        const tagMatch = (c.tagline || '').toLowerCase().includes(sanitizedQuery);
        const descMatch = (c.short_description || c.description || '').toLowerCase().includes(sanitizedQuery);
        const catMatch = (c.category || '').toLowerCase().includes(sanitizedQuery);

        if (!nameMatch && !tagMatch && !descMatch && !catMatch) {
          return false;
        }
      }

      return true;
    });
  }, [charities, selectedCategory, featuredOnly, searchQuery]);

  return (
    <main className="min-h-screen bg-navy-950 text-white pt-24 pb-20 selection:bg-emerald-500/30 selection:text-emerald-200">
      <Container>
        {/* Navigation & Header */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <Link
            href="/"
            className="text-xs font-semibold text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1.5"
          >
            ← Back to Homepage
          </Link>
          <div className="flex items-center gap-3">
            <CurrencySelector size="sm" />
            <span className="text-xs text-slate-400 font-mono">
              {charities.length} Active Partner{charities.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* Section Heading (No invented claims) */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-gold-400/10 border border-gold-400/25 text-gold-300 mb-4">
            <Heart className="w-3.5 h-3.5" />
            <span>Community Impact</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-white tracking-tight mb-4">
            Charity <span className="text-gradient-gold">Directory</span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Every Digital Heroes subscription allocates at least 10% (up to 100%) to charitable causes.
            Explore active causes, view upcoming events, or make an independent donation.
          </p>
        </div>

        {/* Search & Category Filter Toolbar */}
        <div className="bg-navy-900/80 border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-xl mb-10 shadow-2xl">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search causes by name or category..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-navy-950/80 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    updateUrlParams(selectedCategory, '', featuredOnly);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Featured Filter Toggle */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleFeaturedToggle}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 border cursor-pointer ${
                  featuredOnly
                    ? 'bg-gold-400/15 border-gold-400/40 text-gold-300 shadow-md shadow-gold-500/10'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Featured Causes</span>
              </button>
            </div>
          </div>

          {/* Category Tabs (Dynamic from Database) */}
          <div className="mt-4 pt-4 border-t border-white/[0.08] flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categoryTabs.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryChange(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Directory Results Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-80 rounded-3xl bg-white/5 border border-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : filteredCharities.length === 0 ? (
          <div className="p-16 rounded-3xl bg-navy-900/50 border border-white/10 text-center max-w-md mx-auto">
            <Heart className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-display font-bold text-white mb-2">
              No charities match your search
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Try adjusting your search query or selecting another category to view available causes.
            </p>
            <Button variant="secondary" size="sm" onClick={handleClearFilters}>
              Clear All Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredCharities.map((charity) => {
                const totalRaised = charityTotals[charity.id] || 0;
                const slugOrId = charity.slug || charity.id;

                return (
                  <motion.div
                    key={charity.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <GlassCard
                      glowColor={charity.is_featured ? 'gold' : 'emerald'}
                      className="p-6 sm:p-7 flex flex-col justify-between h-full relative group border-white/10 hover:border-white/20 transition-all duration-300"
                    >
                      {/* Featured Badge */}
                      {charity.is_featured && (
                        <div className="absolute -top-3 right-6 bg-gradient-to-r from-gold-400 to-amber-500 text-navy-950 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1">
                          <Sparkles className="w-3 h-3 fill-navy-950" />
                          <span>Featured Spotlight</span>
                        </div>
                      )}

                      <div>
                        {/* Category & Cause */}
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-[10px] uppercase font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                            {charity.category || 'Humanitarian'}
                          </span>
                          <Heart className="w-4 h-4 text-emerald-400" />
                        </div>

                        {/* Title */}
                        <h2 className="text-xl font-display font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">
                          <Link href={`/charities/${slugOrId}`}>
                            {charity.name}
                          </Link>
                        </h2>

                        {/* Tagline / Short Description */}
                        <p className="text-xs text-slate-300 mb-4 line-clamp-2 leading-relaxed">
                          {charity.short_description || charity.tagline || charity.description}
                        </p>

                        {/* Total Raised Stat */}
                        <div className="mb-6 p-3.5 rounded-xl bg-navy-950/60 border border-white/5 flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">Total Raised:</span>
                          <span className="font-display font-bold text-emerald-400 text-sm">
                            {totalRaised > 0
                              ? formatPrice(totalRaised)
                              : 'Be the first to join'}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between gap-3">
                        <Button
                          href={`/charities/${slugOrId}`}
                          variant="secondary"
                          size="sm"
                          className="flex-1 justify-center"
                          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                        >
                          View Profile
                        </Button>
                        <Button
                          href={`/charities/${slugOrId}?donate=true`}
                          variant="glow"
                          size="sm"
                          className="shrink-0"
                        >
                          Donate
                        </Button>
                      </div>
                    </GlassCard>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </Container>
    </main>
  );
}

export default function CharitiesPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-navy-950 flex items-center justify-center text-slate-400">
          Loading charity directory...
        </main>
      }
    >
      <CharitiesDirectoryContent />
    </Suspense>
  );
}
