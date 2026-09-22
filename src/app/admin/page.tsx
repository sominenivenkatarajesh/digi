'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import {
  Users,
  Sparkles,
  Heart,
  Trophy,
  BarChart3,
  Settings,
  Save,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Clock,
  Coins,
  ShieldCheck,
} from 'lucide-react';

interface OverviewMetrics {
  users: {
    total_users: number;
    active_subscribers: number;
    monthly_subscribers: number;
    yearly_subscribers: number;
  };
  prize_pool: {
    total_prize_pool: number;
    jackpot_pending_carry_in: number;
    effective_total_pool: number;
  };
  draws: {
    published_draws_count: number;
    tier5_winners: number;
    tier4_winners: number;
    tier3_winners: number;
    total_winners: number;
    total_prize_awarded: number;
    total_paid_out: number;
    total_pending_payout: number;
  };
  charities: {
    total_charity_impact: number;
    breakdown: Array<any>;
  };
}

interface RecentDraw {
  id: string;
  draw_month: string;
  mode: string;
  winning_numbers: number[];
  pool_total: number;
  status: string;
  published_at: string;
}

export default function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [recentDraws, setRecentDraws] = useState<RecentDraw[]>([]);
  const [monthlyPrice, setMonthlyPrice] = useState(10);
  const [yearlyPrice, setYearlyPrice] = useState(99);
  const [minCharityPercent, setMinCharityPercent] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadOverviewData() {
      try {
        const supabase = createClient();

        // 1. Fetch unified reports metrics (identical source to /admin/reports)
        const reportsRes = await fetch('/api/admin/reports');
        if (reportsRes.ok) {
          const reportsData = await reportsRes.json();
          setMetrics(reportsData.reports || null);
        }

        // 2. Fetch recent draws
        const { data: drawsData } = await supabase
          .from('draws')
          .select('id, draw_month, mode, winning_numbers, pool_total, status, published_at')
          .eq('status', 'published')
          .order('draw_month', { ascending: false })
          .limit(5);

        if (drawsData) {
          setRecentDraws(drawsData);
        }

        // 3. Fetch platform settings
        const { data: settingsData } = await supabase
          .from('platform_settings')
          .select('*')
          .maybeSingle();

        if (settingsData) {
          setMonthlyPrice(Number(settingsData.monthly_price || 10));
          setYearlyPrice(Number(settingsData.yearly_price || 99));
          setMinCharityPercent(Number(settingsData.min_charity_percent || 10));
        }
      } catch (err) {
        console.error('Error loading admin overview:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadOverviewData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    setSaveError(null);
    setIsSaving(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('platform_settings')
        .upsert(
          {
            monthly_price: Number(monthlyPrice),
            yearly_price: Number(yearlyPrice),
            min_charity_percent: Number(minCharityPercent),
            currency: '£',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (error) {
        setSaveError(error.message);
      } else {
        setSaveSuccess(true);
      }
    } catch {
      setSaveError('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Container size="wide" className="pt-8 pb-16">
      {/* Title & Introduction */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-black text-white flex items-center gap-2.5">
            Platform Command Center
            <span className="text-xs font-mono font-normal uppercase px-2.5 py-0.5 rounded-full bg-gold-500/15 text-gold-400 border border-gold-500/30">
              Overview
            </span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Real-time platform metrics, recent monthly draws, user accounts, and pricing parameters.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/admin/draws">
            <Button variant="primary" size="sm" leftIcon={<Sparkles className="w-3.5 h-3.5" />}>
              Open Draw Engine
            </Button>
          </Link>
          <Link href="/admin/reports">
            <Button variant="secondary" size="sm" leftIcon={<BarChart3 className="w-3.5 h-3.5" />}>
              View Full Analytics
            </Button>
          </Link>
        </div>
      </div>

      {/* 4 Overview Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {/* Card 1: Users */}
        <GlassCard glowColor="default" className="p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
              Total Members
            </span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-display font-black text-white">
            {isLoading ? '...' : metrics?.users.total_users ?? 0}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-white/5">
            <span>Active Subscribers:</span>
            <span className="font-mono font-bold text-emerald-400">
              {metrics?.users.active_subscribers ?? 0}
            </span>
          </div>
        </GlassCard>

        {/* Card 2: Active Subscriptions */}
        <GlassCard glowColor="default" className="p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
              Subscriptions
            </span>
            <TrendingUp className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-3xl font-display font-black text-teal-300">
            {isLoading ? '...' : metrics?.users.active_subscribers ?? 0}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-white/5">
            <span>Monthly / Annual:</span>
            <span className="font-mono font-bold text-white">
              {metrics?.users.monthly_subscribers ?? 0} / {metrics?.users.yearly_subscribers ?? 0}
            </span>
          </div>
        </GlassCard>

        {/* Card 3: Prize Pool */}
        <GlassCard glowColor="gold" className="p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase font-semibold text-gold-400 tracking-wider">
              Total Prize Pool
            </span>
            <Trophy className="w-4 h-4 text-gold-400" />
          </div>
          <div className="text-3xl font-display font-black text-gold-300">
            {isLoading ? '...' : formatCurrency(Number(metrics?.prize_pool.total_prize_pool ?? 0))}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-white/5">
            <span>Pending Jackpot Carry-in:</span>
            <span className="font-mono font-bold text-amber-300">
              {formatCurrency(Number(metrics?.prize_pool.jackpot_pending_carry_in ?? 0))}
            </span>
          </div>
        </GlassCard>

        {/* Card 4: Charity Impact */}
        <GlassCard glowColor="default" className="p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase font-semibold text-rose-400 tracking-wider">
              Charity Impact
            </span>
            <Heart className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-3xl font-display font-black text-rose-300">
            {isLoading ? '...' : formatCurrency(Number(metrics?.charities.total_charity_impact ?? 0))}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-white/5">
            <span>Verified Causes:</span>
            <span className="font-mono font-bold text-white">
              {metrics?.charities.breakdown.length ?? 0} Active
            </span>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Recent Official Draws Table */}
        <div className="lg:col-span-7 space-y-6">
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-gold-400" />
                <h2 className="text-lg font-bold text-white">Recent Official Draws</h2>
              </div>
              <Link href="/admin/draws">
                <Button variant="ghost" size="sm" className="text-xs">
                  Draw Engine →
                </Button>
              </Link>
            </div>

            {recentDraws.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl">
                <Clock className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-60" />
                <p className="text-sm font-semibold text-white mb-1">No published draws yet</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                  Run simulation preview and publish your first official monthly draw.
                </p>
                <Link href="/admin/draws">
                  <Button variant="primary" size="sm">
                    Simulate & Publish Draw
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentDraws.map((d) => (
                  <div
                    key={d.id}
                    className="p-4 rounded-xl bg-navy-950/70 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-white">
                          {new Date(d.draw_month).toLocaleDateString('en-GB', {
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                        <StatusBadge status="verified" size="xs" label={d.status} />
                        <span className="text-[10px] font-mono text-slate-400 uppercase">
                          {d.mode}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {d.winning_numbers?.map((num, i) => (
                          <span
                            key={i}
                            className="w-7 h-7 rounded-lg bg-gold-500/20 text-gold-300 font-mono font-bold text-xs flex items-center justify-center border border-gold-500/30"
                          >
                            {num}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <div className="text-xs text-slate-400">Prize Pool</div>
                      <div className="text-sm font-mono font-bold text-emerald-400">
                        {formatCurrency(Number(d.pool_total))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Quick Navigation Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/admin/users">
              <GlassCard className="p-5 hover:border-gold-500/40 transition group cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-gold-400 transition" />
                </div>
                <h3 className="text-sm font-bold text-white mb-0.5">User Management</h3>
                <p className="text-xs text-slate-400">Search members, edit scores, support overrides.</p>
              </GlassCard>
            </Link>

            <Link href="/admin/charities">
              <GlassCard className="p-5 hover:border-gold-500/40 transition group cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <Heart className="w-5 h-5 text-rose-400" />
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-gold-400 transition" />
                </div>
                <h3 className="text-sm font-bold text-white mb-0.5">Charity Directory</h3>
                <p className="text-xs text-slate-400">Create causes, manage golf events, soft deactivation.</p>
              </GlassCard>
            </Link>

            <Link href="/admin/winners">
              <GlassCard className="p-5 hover:border-gold-500/40 transition group cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <Trophy className="w-5 h-5 text-gold-400" />
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-gold-400 transition" />
                </div>
                <h3 className="text-sm font-bold text-white mb-0.5">Winner Verification</h3>
                <p className="text-xs text-slate-400">Audit score proofs, approve/reject, manual payouts.</p>
              </GlassCard>
            </Link>

            <Link href="/admin/reports">
              <GlassCard className="p-5 hover:border-gold-500/40 transition group cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <BarChart3 className="w-5 h-5 text-teal-400" />
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-gold-400 transition" />
                </div>
                <h3 className="text-sm font-bold text-white mb-0.5">Reports & Analytics</h3>
                <p className="text-xs text-slate-400">Detailed prize distribution, rollover, and charity totals.</p>
              </GlassCard>
            </Link>
          </div>
        </div>

        {/* Platform Settings Card */}
        <div className="lg:col-span-5">
          <GlassCard glowColor="gold" className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-gold-400" />
              <h2 className="text-lg font-bold text-white">Platform Settings</h2>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Monthly Membership Price (£)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={monthlyPrice}
                  onChange={(e) => setMonthlyPrice(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-white/10 text-xs text-white focus:outline-none focus:border-gold-500/50"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Annual Membership Price (£)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={yearlyPrice}
                  onChange={(e) => setYearlyPrice(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-white/10 text-xs text-white focus:outline-none focus:border-gold-500/50"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Minimum Charity Contribution (%)
                </label>
                <input
                  type="number"
                  min="10"
                  max="100"
                  step="1"
                  value={minCharityPercent}
                  onChange={(e) => setMinCharityPercent(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-white/10 text-xs text-white focus:outline-none focus:border-gold-500/50"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Enforces platform rule: Minimum 10%, Maximum 100%.
                </span>
              </div>

              {saveError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              {saveSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Platform settings updated successfully!</span>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSaving}
                className="w-full justify-center mt-2"
                leftIcon={<Save className="w-4 h-4" />}
              >
                Save Settings
              </Button>
            </form>
          </GlassCard>
        </div>
      </div>
    </Container>
  );
}
