'use client';

import React, { useState, useEffect } from 'react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { formatCurrency } from '@/lib/utils';
import {
  BarChart3,
  Trophy,
  Heart,
  Users,
  Sparkles,
  TrendingUp,
  RefreshCw,
  CreditCard,
  ShieldCheck,
  Clock,
  ArrowUpRight,
} from 'lucide-react';

interface ReportData {
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
    breakdown: Array<{
      id: string;
      name: string;
      slug: string;
      category: string;
      is_active: boolean;
      total_donations: number;
      total_subscription_contributions: number;
      total_raised: number;
    }>;
  };
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadReports = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/reports');
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || null);
      }
    } catch (err) {
      console.error('Error fetching admin reports:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  if (isLoading || !reports) {
    return (
      <div className="min-h-screen bg-navy-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400 text-sm">Computing Platform Aggregates...</span>
        </div>
      </div>
    );
  }

  const { users, prize_pool, draws, charities } = reports;

  return (
    <Container size="wide" className="pt-8 pb-16">
      {/* Title & Refresh */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-white flex items-center gap-2.5">
            Platform Analytics & Financial Reports
            <span className="text-xs font-mono font-normal uppercase px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-400 border border-teal-500/30">
              Audited Aggregates
            </span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Aggregated figures calculated directly via database analytics functions for absolute accuracy.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={loadReports}
          isLoading={isRefreshing}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Recalculate Stats
        </Button>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-semibold text-slate-400">Total Registered</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-display font-black text-white">{users.total_users}</div>
          <div className="mt-2 text-xs text-emerald-400 font-medium">
            {users.active_subscribers} active paying subscribers
          </div>
        </GlassCard>

        <GlassCard glowColor="gold" className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-semibold text-gold-400">Prize Pool Generated</span>
            <Trophy className="w-4 h-4 text-gold-400" />
          </div>
          <div className="text-3xl font-display font-black text-gold-300">
            {formatCurrency(Number(prize_pool.total_prize_pool))}
          </div>
          <div className="mt-2 text-xs text-amber-300 font-medium">
            +{formatCurrency(Number(prize_pool.jackpot_pending_carry_in))} jackpot rollover
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-semibold text-rose-400">Total Charity Impact</span>
            <Heart className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-3xl font-display font-black text-rose-300">
            {formatCurrency(Number(charities.total_charity_impact))}
          </div>
          <div className="mt-2 text-xs text-slate-400 font-medium">
            Across {charities.breakdown.length} verified causes
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-semibold text-teal-400">Total Paid Out</span>
            <CreditCard className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-3xl font-display font-black text-teal-300">
            {formatCurrency(Number(draws.total_paid_out))}
          </div>
          <div className="mt-2 text-xs text-slate-400 font-medium">
            {formatCurrency(Number(draws.total_pending_payout))} pending payout
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
        {/* Draw Performance & Winners Breakdown */}
        <div className="lg:col-span-6 space-y-6">
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-gold-400" />
                Monthly Draw & Winner Statistics
              </h2>
              <span className="text-xs font-mono text-slate-400">
                {draws.published_draws_count} Published Draws
              </span>
            </div>

            <div className="space-y-4">
              {/* Tier 5 */}
              <div className="p-4 rounded-xl bg-navy-950/70 border border-white/5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-gold-400" />
                    Tier 5 (5 Matches / Jackpot)
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Top prize pool tier (40% split + rollover)</div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-base font-black text-gold-300">
                    {draws.tier5_winners}
                  </span>
                  <span className="text-xs text-slate-400 block">winners</span>
                </div>
              </div>

              {/* Tier 4 */}
              <div className="p-4 rounded-xl bg-navy-950/70 border border-white/5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-400" />
                    Tier 4 (4 Matches)
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Secondary tier (35% split)</div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-base font-black text-teal-300">
                    {draws.tier4_winners}
                  </span>
                  <span className="text-xs text-slate-400 block">winners</span>
                </div>
              </div>

              {/* Tier 3 */}
              <div className="p-4 rounded-xl bg-navy-950/70 border border-white/5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    Tier 3 (3 Matches)
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Consolation tier (25% split)</div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-base font-black text-emerald-300">
                    {draws.tier3_winners}
                  </span>
                  <span className="text-xs text-slate-400 block">winners</span>
                </div>
              </div>
            </div>

            {/* Payout status bar */}
            <div className="mt-6 pt-5 border-t border-white/10 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Total Awarded Cash Prizes:</span>
                <span className="font-mono font-bold text-white">
                  {formatCurrency(Number(draws.total_prize_awarded))}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Confirmed Paid to Winners:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatCurrency(Number(draws.total_paid_out))}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Pending Winner Verification / Payout:</span>
                <span className="font-mono font-bold text-amber-300">
                  {formatCurrency(Number(draws.total_pending_payout))}
                </span>
              </div>
            </div>
          </GlassCard>

          {/* Subscribers Distribution */}
          <GlassCard className="p-6">
            <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              Subscriber Plan Breakdown
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-navy-950/70 border border-white/5 text-center">
                <span className="text-xs text-slate-400 block mb-1">Monthly Subscribers</span>
                <span className="text-2xl font-display font-black text-white">
                  {users.monthly_subscribers}
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">£10 / month</span>
              </div>

              <div className="p-4 rounded-xl bg-navy-950/70 border border-white/5 text-center">
                <span className="text-xs text-slate-400 block mb-1">Annual Subscribers</span>
                <span className="text-2xl font-display font-black text-gold-300">
                  {users.yearly_subscribers}
                </span>
                <span className="text-[11px] text-slate-500 block mt-1">£99 / year</span>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Charity Impact Breakdown Table */}
        <div className="lg:col-span-6">
          <GlassCard className="p-6 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-400" />
                  Charity Impact by Cause
                </h2>
                <span className="text-xs font-mono font-bold text-rose-300">
                  {formatCurrency(Number(charities.total_charity_impact))} Total
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Combines direct donations and monthly member fee splits allocated to each verified partner.
              </p>

              <div className="space-y-3">
                {charities.breakdown.map((c) => {
                  const maxRaised = Math.max(...charities.breakdown.map((b) => b.total_raised), 1);
                  const pct = Math.min(100, Math.round((c.total_raised / maxRaised) * 100));

                  return (
                    <div key={c.id} className="p-3.5 rounded-xl bg-navy-950/70 border border-white/5 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="font-bold text-white truncate max-w-[240px]">
                          {c.name}
                        </div>
                        <div className="font-mono font-black text-emerald-400">
                          {formatCurrency(Number(c.total_raised))}
                        </div>
                      </div>

                      {/* Visual contribution bar */}
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-rose-500 to-amber-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pct, 5)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Subscriptions: {formatCurrency(Number(c.total_subscription_contributions))}</span>
                        <span>Direct Donations: {formatCurrency(Number(c.total_donations))}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 mt-6 border-t border-white/10 text-[11px] text-slate-500">
              🔒 Direct donations are strictly separate from prize pools and go 100% directly to the chosen charity.
            </div>
          </GlassCard>
        </div>
      </div>
    </Container>
  );
}
