'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScoresCard } from '@/components/dashboard/ScoresCard';
import { WinningsCard, UserWinning } from '@/components/dashboard/WinningsCard';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { calculateContribution, poundsToPence, penceToPounds } from '@/lib/charity/calculate';
import { useCurrency } from '@/components/providers/CurrencyProvider';
import { CurrencySelector } from '@/components/ui/CurrencySelector';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Sparkles,
  Heart,
  Ticket,
  LogOut,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  ArrowRight,
  ShieldCheck,
  Lock,
  ExternalLink,
  Sliders,
  X,
  Info,
  Trophy,
  Users,
  Award,
  Gift,
  Compass,
  Share2,
  Copy,
  Check,
  TrendingUp,
} from 'lucide-react';

interface MemberProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

interface SubscriptionDetails {
  plan: 'monthly' | 'yearly';
  status: 'active' | 'inactive' | 'lapsed' | 'cancelled';
  isActive: boolean;
  isAdmin: boolean;
  renewalDate: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
}

interface CharityDetails {
  id: string;
  name: string;
  tagline: string;
  percent: number;
  isActive: boolean;
}

interface ActiveCharityOption {
  id: string;
  name: string;
  slug: string;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const promptSubscribe = searchParams.get('subscribe') === 'true';
  const changeCharityParam = searchParams.get('changeCharity');

  const { format: formatPrice, currency, symbol } = useCurrency();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [userScores, setUserScores] = useState<{ id: string; score: number; played_on: string }[]>([]);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [charity, setCharity] = useState<CharityDetails>({
    id: '',
    name: "Hope Horizons Children's Foundation",
    tagline: 'Transforming pediatric healthcare & critical care access',
    percent: 10,
    isActive: true,
  });
  const [totalContributedSoFar, setTotalContributedSoFar] = useState<number>(0);
  const [activeCharities, setActiveCharities] = useState<ActiveCharityOption[]>([]);
  const [minPercent, setMinPercent] = useState<number>(10);
  const [monthlyPrice, setMonthlyPrice] = useState<number>(10);
  const [yearlyPrice, setYearlyPrice] = useState<number>(99);

  // Charity edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCharityId, setSelectedCharityId] = useState('');
  const [selectedPercent, setSelectedPercent] = useState(10);
  const [isSavingCharity, setIsSavingCharity] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isBillingLoading, setIsBillingLoading] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState<'monthly' | 'yearly' | null>(null);

  // Latest Published Draw State
  const [latestDrawInfo, setLatestDrawInfo] = useState<{
    draw: {
      id: string;
      draw_month: string;
      mode: string;
      winning_numbers: number[];
      pool_total: number;
      tier5_pool: number;
      tier4_pool: number;
      tier3_pool: number;
      jackpot_carried_in: number;
      jackpot_rolled_over: number;
      published_at: string;
    } | null;
    userEntry: {
      id: string;
      scores_snapshot: number[];
      match_count: number;
    } | null;
    userWin: {
      id: string;
      tier: string;
      prize_amount: number;
      verification_status: string;
      payment_status: string;
    } | null;
  } | null>(null);

  // Winnings & Participation Summary State
  const [userWinnings, setUserWinnings] = useState<UserWinning[]>([]);
  const [winningsSummary, setWinningsSummary] = useState<{
    totalWon: number;
    totalPaid: number;
    totalPending: number;
    count: number;
  } | null>(null);
  const [winningsNotifications, setWinningsNotifications] = useState<{
    actionRequiredCount: number;
    approvedPendingPayoutCount: number;
    paidCount: number;
  } | null>(null);
  const [participation, setParticipation] = useState<{
    drawsEnteredCount: number;
    nextDrawMonth: string;
    isEligibleForNextDraw: boolean;
    eligibilityReason: string;
  } | null>(null);

  const loadUserWinnings = async () => {
    try {
      const res = await fetch('/api/dashboard/summary');
      if (res.ok) {
        const data = await res.json();
        setUserWinnings(data.winnings || []);
        setWinningsSummary(data.winningsSummary || null);
        setWinningsNotifications(data.notifications || null);
      }
    } catch (e) {
      console.error('Failed to reload winnings:', e);
    }
  };

  useEffect(() => {
    async function loadUserData() {
      try {
        const res = await fetch('/api/dashboard/summary');
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login?next=/dashboard');
            return;
          }
          throw new Error('Failed to load dashboard summary');
        }

        const data = await res.json();
        setProfile(data.profile);
        setSubscription(data.subscription);
        setCharity(data.charity);
        setSelectedCharityId(data.charity?.id || '');
        setSelectedPercent(data.charity?.percent || 10);
        setActiveCharities(data.activeCharities || []);
        setMinPercent(data.pricing?.minPercent || 10);
        setMonthlyPrice(data.pricing?.monthlyPrice || 10);
        setYearlyPrice(data.pricing?.yearlyPrice || 99);
        setUserScores(data.scores || []);
        setParticipation(data.participation || null);
        setUserWinnings(data.winnings || []);
        setWinningsSummary(data.winningsSummary || null);
        setWinningsNotifications(data.notifications || null);
        setLatestDrawInfo(data.latestDrawInfo || null);

        // Auto-open modal if changeCharity URL param was passed
        if (changeCharityParam) {
          setSelectedCharityId(changeCharityParam);
          setIsModalOpen(true);
        }
      } catch (err) {
        console.error('Error loading dashboard summary:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadUserData();
  }, [router, changeCharityParam]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleOpenBillingPortal = async () => {
    setIsBillingLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Unable to open billing portal.');
      }
    } catch (err) {
      console.error('Portal error:', err);
      alert('An unexpected error occurred opening billing management.');
    } finally {
      setIsBillingLoading(false);
    }
  };

  const handleStartCheckout = async (plan: 'monthly' | 'yearly') => {
    setIsCheckoutLoading(plan);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to start checkout.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('An unexpected error occurred initiating checkout.');
    } finally {
      setIsCheckoutLoading(null);
    }
  };

  const handleSaveCharitySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveErrorMsg(null);
    setSaveSuccessMsg(null);

    if (selectedPercent < minPercent) {
      setSaveErrorMsg(`Minimum contribution percentage is ${minPercent}%.`);
      return;
    }
    if (selectedPercent > 100) {
      setSaveErrorMsg('Maximum contribution percentage is 100%.');
      return;
    }

    setIsSavingCharity(true);
    try {
      const res = await fetch('/api/user/charity', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charityId: selectedCharityId,
          charityPercent: selectedPercent,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update charity settings.');
      }

      const updatedCharityRecord = activeCharities.find((c) => c.id === selectedCharityId);
      setCharity((prev) => ({
        ...prev,
        id: selectedCharityId,
        name: updatedCharityRecord ? updatedCharityRecord.name : prev.name,
        percent: selectedPercent,
        isActive: true,
      }));

      setSaveSuccessMsg(
        data.message || 'Preferences saved! Changes will take effect on your next subscription payment.'
      );

      setTimeout(() => {
        setIsModalOpen(false);
        setSaveSuccessMsg(null);
      }, 1800);
    } catch (err: any) {
      setSaveErrorMsg(err.message || 'Failed to save settings.');
    } finally {
      setIsSavingCharity(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-navy-950 text-white pt-24 pb-20">
        <Container>
          {/* Header skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 mb-8 border-b border-white/[0.08] animate-pulse">
            <div className="space-y-2">
              <div className="h-8 w-48 bg-white/10 rounded-xl" />
              <div className="h-4 w-32 bg-white/5 rounded-lg" />
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-24 bg-white/10 rounded-xl" />
              <div className="h-9 w-24 bg-white/10 rounded-xl" />
            </div>
          </div>

          {/* 3 cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-white/[0.03] border border-white/5 p-6 animate-pulse space-y-4">
                <div className="h-4 w-28 bg-white/10 rounded" />
                <div className="h-8 w-40 bg-white/15 rounded-lg" />
                <div className="h-12 w-full bg-white/5 rounded-xl" />
                <div className="h-9 w-full bg-white/10 rounded-xl mt-auto" />
              </div>
            ))}
          </div>

          {/* Large section skeleton */}
          <div className="h-72 rounded-2xl bg-white/[0.03] border border-white/5 p-6 animate-pulse mb-8 space-y-4">
            <div className="h-5 w-44 bg-white/10 rounded" />
            <div className="h-24 w-full bg-white/5 rounded-xl" />
          </div>
        </Container>
      </main>
    );
  }

  const getStatusBadge = () => {
    if (!subscription) return null;
    if (subscription.isAdmin) {
      return <StatusBadge status="admin_bypass" size="sm" />;
    }
    return <StatusBadge status={subscription.status} size="sm" />;
  };

  const formatRenewalDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Plan price calculation for charity split (dynamically computed using canonical calculateContribution)
  const isYearly = subscription?.plan === 'yearly';
  const planCost = isYearly ? yearlyPrice : monthlyPrice;
  const planPeriodText = isYearly ? '/yr' : '/mo';
  const charityPence = calculateContribution(poundsToPence(planCost), charity.percent, minPercent);
  const charityAmountPerCycle = (charityPence / 100).toFixed(2);

  return (
    <main className="min-h-screen bg-navy-950 text-white pt-24 pb-20 selection:bg-emerald-500/30 selection:text-emerald-200">
      <Container>
        {/* User Welcome Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 mb-8 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                Welcome, {profile?.full_name}
              </h1>
              {subscription?.isAdmin && (
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  Staff Admin
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Signed in as {profile?.email}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <CurrencySelector size="sm" />

            {subscription?.isActive && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-semibold">
                <Ticket className="w-3.5 h-3.5 text-emerald-400" />
                <span>Draw Eligible</span>
              </div>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
            >
              Sign Out
            </Button>
          </div>
        </div>

        {/* Subscribe Banner if prompted or inactive */}
        {(!subscription?.isActive || promptSubscribe) && (
          <div className="mb-8 p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Welcome to Digital Heroes!</h2>
                <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                  Start your charity golf journey: activate a monthly or yearly membership to support vetted charities, record your 5 latest Stableford scores, and automatically enter official cash draws every month.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <Button
                variant="glow"
                size="sm"
                isLoading={isCheckoutLoading === 'monthly'}
                onClick={() => handleStartCheckout('monthly')}
              >
                Monthly ({formatPrice(monthlyPrice)}/mo)
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isCheckoutLoading === 'yearly'}
                onClick={() => handleStartCheckout('yearly')}
              >
                Yearly ({formatPrice(yearlyPrice)}/yr)
              </Button>
            </div>
          </div>
        )}

        {/* Fresh user empty state: 0 scores reminder */}
        {subscription?.isActive && userScores.length === 0 && (
          <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-gold-500/15 via-amber-500/10 to-transparent border border-gold-500/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Compass className="w-6 h-6 text-gold-400 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-white">No Golf Scores Added Yet</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  You need 5 valid Stableford scores (1–45) to enter the upcoming monthly draw. Add your first score below!
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const el = document.getElementById('scores-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-xs shrink-0"
            >
              Add Scores
            </Button>
          </div>
        )}

        {/* Winnings Action / Status Notification Banners */}
        {winningsNotifications && winningsNotifications.actionRequiredCount > 0 && (
          <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-rose-500/15 to-transparent border border-amber-500/40 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Action Required: Submit Score Proof
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300">
                    {winningsNotifications.actionRequiredCount} Action{winningsNotifications.actionRequiredCount > 1 ? 's' : ''} Needed
                  </span>
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Congratulations on your draw win! Please upload screenshot proof of your golf scores below to verify your round and unlock your payout.
                </p>
              </div>
            </div>
          </div>
        )}

        {winningsNotifications && winningsNotifications.actionRequiredCount === 0 && winningsNotifications.approvedPendingPayoutCount > 0 && (
          <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-teal-500/10 to-transparent border border-emerald-500/35 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Score Proof Verified & Approved!
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300">
                    {winningsNotifications.approvedPendingPayoutCount} Prize{winningsNotifications.approvedPendingPayoutCount > 1 ? 's' : ''} Approved
                  </span>
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Your submitted golf score proofs have been verified by the administrator. Your cash prize payout is pending manual transfer.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Membership Status Overview */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-display font-bold text-white">Membership Overview</h2>
            <p className="text-slate-400 text-sm mt-1">
              {subscription?.isActive
                ? 'Your active subscription fuels direct charity aid and guarantees entry into every monthly draw.'
                : 'Activate your membership to unlock full draw participation and direct charity giving.'}
            </p>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>Display Currency:</span>
            <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {currency} ({symbol})
            </span>
          </div>
        </div>

        {/* 3 Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Card 1: Subscription Management Card */}
          <GlassCard
            glowColor={subscription?.isActive ? 'emerald' : 'default'}
            className="p-6 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                  Membership Plan
                </span>
                {getStatusBadge()}
              </div>

              <div className="text-2xl font-display font-bold text-white capitalize mb-1">
                {subscription?.plan} Member
              </div>

              {/* Renewal / Expiry Details */}
              {subscription?.renewalDate && (
                <div className="text-xs text-slate-300 mt-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {subscription.cancelAtPeriodEnd ? 'Access ends: ' : 'Renews on: '}
                    <strong className="text-white">
                      {formatRenewalDate(subscription.renewalDate)}
                    </strong>
                  </span>
                </div>
              )}

              {/* Cancellation Warning Notice */}
              {subscription?.cancelAtPeriodEnd && (
                <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs">
                  ⚠️ Membership cancelled. You retain full member access until{' '}
                  {formatRenewalDate(subscription.renewalDate)}.
                </div>
              )}

              {subscription?.status === 'lapsed' && (
                <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs">
                  ⚠️ Payment failed. Please update your card in billing management to keep your draw eligibility.
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-6 pt-4 border-t border-white/[0.08]">
              {subscription?.stripeCustomerId ? (
                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={isBillingLoading}
                  onClick={handleOpenBillingPortal}
                  className="w-full justify-center"
                  leftIcon={<CreditCard className="w-3.5 h-3.5" />}
                  rightIcon={<ExternalLink className="w-3 h-3 text-slate-400" />}
                >
                  Manage Billing
                </Button>
              ) : (
                <Button
                  variant="glow"
                  size="sm"
                  isLoading={isCheckoutLoading === 'monthly'}
                  onClick={() => handleStartCheckout('monthly')}
                  className="w-full justify-center"
                  leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                >
                  Subscribe Now ({formatPrice(monthlyPrice)}/mo)
                </Button>
              )}
            </div>
          </GlassCard>

          {/* Card 2: Chosen Charity Cause */}
          <GlassCard glowColor="gold" className="p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                  Supported Charity
                </span>
                <Heart className="w-4 h-4 text-gold-400 fill-gold-400/20" />
              </div>

              {/* Deactivated Notice */}
              {!charity.isActive && (
                <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Your chosen charity is currently inactive. Please choose an active charity to resume contributions.
                  </span>
                </div>
              )}

              <div className="text-lg font-display font-bold text-white mb-1 line-clamp-1">
                {charity.name}
              </div>
              <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                {charity.tagline}
              </p>

              {/* Current Split Stats */}
              <div className="p-3 rounded-xl bg-navy-950/60 border border-white/5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Contribution Split:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {charity.percent}% of fee
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Dedicated per cycle:</span>
                  <span className="font-bold text-white">
                    {formatPrice(charityPence / 100)} {planPeriodText}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <span className="text-slate-400">Your total impact so far:</span>
                  <span className="font-bold text-emerald-300">
                    {totalContributedSoFar > 0 ? formatPrice(totalContributedSoFar) : formatPrice(0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.08] flex items-center justify-between gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSelectedCharityId(charity.id);
                  setSelectedPercent(charity.percent);
                  setIsModalOpen(true);
                }}
                className="w-full justify-center text-xs"
                leftIcon={<Sliders className="w-3.5 h-3.5 text-gold-400" />}
              >
                Change Charity or %
              </Button>
            </div>
          </GlassCard>

          {/* Card 3: Participation Summary */}
          <GlassCard glowColor="default" className="p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                  Participation Summary
                </span>
                <Calendar className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-display font-bold text-white mb-1">
                {participation?.drawsEnteredCount ?? 0} {participation?.drawsEnteredCount === 1 ? 'Draw' : 'Draws'} Entered
              </div>
              <p className="text-xs text-slate-400">
                Next draw scheduled for{' '}
                <strong className="text-white">
                  {participation?.nextDrawMonth
                    ? new Date(participation.nextDrawMonth).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                    : '1st of Next Month'}
                </strong>.
              </p>
              <div className="mt-3 p-2.5 rounded-xl bg-gold-500/10 border border-gold-500/20 text-xs">
                <span className="text-slate-400">Eligibility Status: </span>
                <span className={participation?.isEligibleForNextDraw ? 'text-emerald-300 font-semibold' : 'text-amber-300 font-semibold'}>
                  {participation?.eligibilityReason || (subscription?.isActive ? 'Eligible' : 'Subscription required')}
                </span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.08] text-xs text-slate-300 flex items-center justify-between">
              {participation?.isEligibleForNextDraw ? (
                <span className="text-emerald-400 font-medium">✓ Qualified for next draw</span>
              ) : (
                <span className="text-amber-400 font-medium">Needs 5 scores & active sub</span>
              )}
              <span className="text-[11px] text-slate-400">45% Pool Split</span>
            </div>
          </GlassCard>
        </div>

        {/* Stableford Scores Card */}
        <div id="scores-section">
          <ScoresCard
            isActiveSubscription={subscription?.isActive || false}
            isAdmin={subscription?.isAdmin || false}
          />
        </div>

        {/* Your Winnings & Verification */}
        {profile?.id && (
          <WinningsCard
            winnings={userWinnings}
            userId={profile.id}
            onRefresh={loadUserWinnings}
          />
        )}

        {/* Latest Official Draw */}
        {latestDrawInfo?.draw && (
          <div className="mt-12 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="w-5 h-5 text-gold-400" />
                  <h2 className="text-xl font-display font-bold text-white">
                    Latest Official Draw — {new Date(latestDrawInfo.draw.draw_month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </h2>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Official Results
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Published {latestDrawInfo.draw.published_at ? new Date(latestDrawInfo.draw.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''} • Mode: <span className="capitalize text-slate-300 font-medium">{latestDrawInfo.draw.mode}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Total Prize Pool:</span>
                <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/25 text-sm">
                  {formatPrice(Number(latestDrawInfo.draw.pool_total || 0))}
                </span>
              </div>
            </div>

            <GlassCard glowColor="gold" className="p-6 sm:p-8 relative overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* Winning Numbers */}
                <div className="lg:col-span-6 space-y-3">
                  <div className="text-xs uppercase font-semibold text-gold-400 tracking-wider flex items-center justify-between">
                    <span>Official Winning Numbers (1-45)</span>
                    <span className="text-[11px] text-slate-400 font-mono">5 Numbers Drawn</span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {latestDrawInfo.draw.winning_numbers?.map((num, i) => (
                      <div
                        key={i}
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black text-xl sm:text-2xl flex items-center justify-center shadow-lg shadow-amber-500/25 border-2 border-amber-200"
                      >
                        {num}
                      </div>
                    ))}
                  </div>
                  {Number(latestDrawInfo.draw.jackpot_rolled_over || 0) > 0 && (
                    <p className="text-xs text-amber-300 flex items-center gap-1.5 pt-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      Jackpot rolled over! {formatPrice(Number(latestDrawInfo.draw.jackpot_rolled_over))} carries into next month&apos;s draw.
                    </p>
                  )}
                </div>

                {/* User Entry Result (Snapshot from draw_entries, never live scores) */}
                <div className="lg:col-span-6 p-5 rounded-2xl bg-navy-950/80 border border-white/10">
                  {latestDrawInfo.userEntry ? (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs uppercase font-semibold text-slate-300 tracking-wider">
                          Your Draw Entry (Scores Locked at Draw)
                        </span>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {latestDrawInfo.userEntry.match_count} {latestDrawInfo.userEntry.match_count === 1 ? 'Match' : 'Matches'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap mb-4">
                        {latestDrawInfo.userEntry.scores_snapshot?.map((score, idx) => {
                          const isMatch = latestDrawInfo.draw?.winning_numbers?.includes(score);
                          return (
                            <div key={idx} className="flex flex-col items-center">
                              <div
                                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-black text-base sm:text-lg transition ${
                                  isMatch
                                    ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300 shadow-md shadow-amber-500/40'
                                    : 'bg-slate-900 border border-slate-700 text-slate-300'
                                }`}
                              >
                                {score}
                              </div>
                              {isMatch && (
                                <span className="text-[10px] font-bold text-amber-400 mt-1">MATCH</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {latestDrawInfo.userWin ? (
                        <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs">
                          <div className="font-bold flex items-center gap-1.5 text-sm text-emerald-300">
                            <Trophy className="w-4 h-4 text-emerald-400" />
                            Congratulations! You won {formatPrice(Number(latestDrawInfo.userWin.prize_amount))}!
                          </div>
                          <p className="mt-1 text-[11px] text-emerald-300/80">
                            Tier {latestDrawInfo.userWin.tier} Winner • Status: {latestDrawInfo.userWin.verification_status.toUpperCase()}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">
                          {latestDrawInfo.userEntry.match_count >= 3
                            ? 'Matches recorded for this draw.'
                            : 'No cash prize won this month. (Minimum 3 matches required to win a cash prize).'}
                        </p>
                      )}

                      <p className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-white/5">
                        🔒 Stored snapshot used: live score edits do not change this published result.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2 opacity-80" />
                      <p className="text-sm font-semibold text-white mb-1">
                        You were not entered in this draw
                      </p>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        {!subscription?.isActive
                          ? 'An active subscription is required to participate in official monthly draws.'
                          : userScores.length < 5
                          ? `You have ${userScores.length}/5 scores submitted. Exactly 5 Stableford scores are required to qualify.`
                          : 'Your account was not eligible at the time this draw was published.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          </div>
        )}

        {/* SECTION 3B: Upcoming Monthly Draw Entry (No tickets — 5 Stableford scores) */}
        <div className="mt-12 mb-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Ticket className="w-5 h-5 text-gold-400" />
                <h2 className="text-xl font-display font-bold text-white">Upcoming Draw Entry</h2>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-gold-500/15 text-gold-400 border border-gold-500/30">
                  Next Monthly Draw
                </span>
              </div>
              <p className="text-xs text-slate-400">
                No tickets or lottery numbers assigned. Your 5 stored Stableford scores are matched against the 5 winning numbers in each draw.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Guaranteed Prize Pool:</span>
              <span className="font-mono font-bold text-gold-300 bg-gold-500/10 px-2.5 py-1 rounded-xl border border-gold-500/25 text-sm">
                {formatPrice(45000)}
              </span>
            </div>
          </div>

          <GlassCard glowColor="gold" className="p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
              {/* Scores Grid */}
              <div className="w-full lg:w-auto">
                <div className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-3 flex items-center justify-between">
                  <span>Your Current 5 Scores (1-45):</span>
                  <span className={userScores.length === 5 ? 'text-emerald-400 font-mono font-semibold' : 'text-amber-400 font-mono font-semibold'}>
                    {userScores.length === 5 ? '✓ 5/5 Scores Complete (Eligible)' : `${userScores.length}/5 Scores (Need Exactly 5)`}
                  </span>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  {[0, 1, 2, 3, 4].map((index) => {
                    const scoreItem = userScores[index];
                    return (
                      <div key={index} className="flex flex-col items-center gap-1.5">
                        <div
                          className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center font-display font-black text-xl sm:text-2xl transition-all shadow-lg ${
                            scoreItem
                              ? 'bg-gradient-to-tr from-gold-500 via-amber-400 to-yellow-300 text-navy-950 shadow-gold-500/25 scale-100 ring-2 ring-gold-400/50'
                              : 'bg-navy-900/90 border-2 border-dashed border-white/20 text-slate-500'
                          }`}
                        >
                          {scoreItem ? scoreItem.score : `?`}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {scoreItem ? scoreItem.played_on : `Slot ${index + 1}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Draw Status & Countdown Info */}
              <div className="w-full lg:max-w-xs p-5 rounded-2xl bg-navy-950/70 border border-white/10 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Draw Schedule:</span>
                  <span className="font-semibold text-white">1st of Next Month</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Draw Engine:</span>
                  <span className="font-mono text-slate-300">5 Numbers (1-45)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Matching Rule:</span>
                  <span className="text-slate-300 font-medium">3, 4, or 5 matches</span>
                </div>
                <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                  <span className="text-slate-400">Draw Qualification:</span>
                  <span className={subscription?.isActive && userScores.length === 5 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                    {subscription?.isActive && userScores.length === 5
                      ? 'Fully Qualified'
                      : !subscription?.isActive
                      ? 'Subscribe to Qualify'
                      : 'Add 5 Scores'}
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* SECTION 4: Charity Spotlight & One-off Boost */}
        <div className="mt-12 mb-12">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Heart className="w-5 h-5 text-rose-400" />
                <h2 className="text-xl font-display font-bold text-white">Charity Impact & Spotlight</h2>
              </div>
              <p className="text-xs text-slate-400">
                100% of your charity contributions are transferred directly to verified humanitarian and environmental causes.
              </p>
            </div>
            <Button
              href="/charities"
              variant="secondary"
              size="sm"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              All Charities
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Active Charity Spotlight Card */}
            <GlassCard glowColor="emerald" className="p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Your Chosen Cause
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    Split: {charity.percent}%
                  </span>
                </div>

                <h3 className="text-lg font-display font-bold text-white mb-1">
                  {charity.name}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  {charity.tagline}
                </p>

                <div className="p-3.5 rounded-xl bg-navy-950/60 border border-white/5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Estimated Monthly Impact:</span>
                    <span className="font-bold text-emerald-300">
                      {formatPrice(charityPence / 100)} / month
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Lifetime Contribution:</span>
                    <span className="font-mono font-bold text-white">
                      {totalContributedSoFar > 0 ? formatPrice(totalContributedSoFar) : formatPrice(0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/[0.08] flex items-center gap-3">
                <Button
                  href={`/charities/${charity.id || 'hope-horizons'}?donate=true`}
                  variant="glow"
                  size="sm"
                  className="flex-1 justify-center text-xs"
                  leftIcon={<Gift className="w-3.5 h-3.5" />}
                >
                  Make One-Off Boost
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsModalOpen(true)}
                  className="text-xs"
                >
                  Edit Split %
                </Button>
              </div>
            </GlassCard>

            {/* Upcoming Charity Golf Days */}
            <GlassCard glowColor="default" className="p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-gold-400 bg-gold-500/10 px-2 py-0.5 rounded border border-gold-500/20">
                    Upcoming Charity Tournaments
                  </span>
                  <Trophy className="w-4 h-4 text-gold-400" />
                </div>

                <h3 className="text-lg font-display font-bold text-white mb-2">
                  Heroes Charity Golf Classic
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Wentworth Golf Club, Surrey • 18-hole Stableford invitational with 100% of tournament entry fees dedicated to pediatric critical care.
                </p>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Next Tournament: In 14 Days</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Users className="w-3.5 h-3.5 text-gold-400" />
                    <span>Over 120 Golfers & Verified Heroes Participating</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/[0.08]">
                <Button
                  href="/charities"
                  variant="secondary"
                  size="sm"
                  className="w-full justify-center text-xs"
                  rightIcon={<ExternalLink className="w-3.5 h-3.5 text-slate-400" />}
                >
                  View All Charity Events
                </Button>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* SECTION 5: Recent Draw Ledger & Community Winners */}
        <div className="mt-12 mb-12">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-5 h-5 text-gold-400" />
                <h2 className="text-xl font-display font-bold text-white">Transparent Draw Ledger</h2>
              </div>
              <p className="text-xs text-slate-400">
                Audited monthly prize allocations and direct charity distributions for full transparency.
              </p>
            </div>
            <span className="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Public Blockchain Audited</span>
            </span>
          </div>

          <GlassCard glowColor="default" className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase">Draw #28 Winning Numbers</span>
                <div className="flex items-center gap-1.5 mt-2">
                  {[14, 22, 31, 38, 42].map((num) => (
                    <span
                      key={num}
                      className="w-8 h-8 rounded-lg bg-navy-900 border border-gold-400/30 text-gold-400 font-mono font-bold text-xs flex items-center justify-center shadow-sm"
                    >
                      {num}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase">Jackpot Winner</span>
                <div className="text-base font-display font-bold text-white mt-1">
                  1 Lucky Hero
                </div>
                <div className="text-xs text-emerald-400 font-mono font-semibold">
                  Won {formatPrice(45000)}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase">Charity Payout (Cycle #28)</span>
                <div className="text-base font-display font-bold text-white mt-1">
                  {formatPrice(10000)}
                </div>
                <div className="text-xs text-slate-400">
                  Disbursed across 6 causes
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase">Prize Pool Percentage</span>
                <div className="text-base font-display font-bold text-white mt-1">
                  45% Guaranteed
                </div>
                <div className="text-xs text-slate-400">
                  Strictly non-profit retention
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* SECTION 6: Member Perks & Quick Actions */}
        <div className="mt-12 mb-16">
          <div className="mb-6">
            <h2 className="text-xl font-display font-bold text-white mb-1">Member Tools & Community</h2>
            <p className="text-xs text-slate-400">
              Share the mission, verify your contribution records, and invite fellow golfers to play and give.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Referral / Invite */}
            <GlassCard glowColor="default" className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2 text-emerald-400">
                  <Share2 className="w-4 h-4" />
                  <span className="font-semibold text-xs text-white">Invite a Fellow Golfer</span>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Bring another golfer into the circle to expand charity funding and enter joint draw bonuses.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    navigator.clipboard.writeText(`${window.location.origin}/signup?ref=${profile?.id || 'hero'}`);
                    setCopiedInvite(true);
                    setTimeout(() => setCopiedInvite(false), 2500);
                  }
                }}
                className="w-full justify-center text-xs"
                leftIcon={copiedInvite ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              >
                {copiedInvite ? 'Copied Invite Link!' : 'Copy Referral Link'}
              </Button>
            </GlassCard>

            {/* Stableford Rules */}
            <GlassCard glowColor="default" className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2 text-gold-400">
                  <TrendingUp className="w-4 h-4" />
                  <span className="font-semibold text-xs text-white">Stableford Rules Guide</span>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Scores 1-45 are entered per round. The 5 latest valid rounds form your verified numbers.
                </p>
              </div>
              <Button
                href="/#how-it-works"
                variant="secondary"
                size="sm"
                className="w-full justify-center text-xs"
                rightIcon={<ExternalLink className="w-3.5 h-3.5 text-slate-400" />}
              >
                Read Draw Mechanics
              </Button>
            </GlassCard>

            {/* Tax Receipt */}
            <GlassCard glowColor="default" className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2 text-teal-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="font-semibold text-xs text-white">Tax-Deductible Certificate</span>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Your designated charity contributions are eligible for Gift Aid and direct tax relief.
                </p>
              </div>
              <Button
                href="/dashboard"
                variant="secondary"
                size="sm"
                onClick={() => alert(`Your annual Giving Statement for ${currency} ${formatPrice(totalContributedSoFar)} will be sent to ${profile?.email} at the end of the tax year.`)}
                className="w-full justify-center text-xs"
              >
                Request Tax Statement
              </Button>
            </GlassCard>
          </div>
        </div>
      </Container>

      {/* Charity Settings Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg">
            <GlassCard glowColor="gold" className="p-6 sm:p-8 relative border-white/20">
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2.5 mb-2">
                <Heart className="w-5 h-5 text-gold-400" />
                <h3 className="text-xl font-display font-bold text-white">
                  Update Charity Settings
                </h3>
              </div>
              <p className="text-xs text-slate-300 mb-6">
                Direct a higher percentage of your membership fee to any vetted UK charity.
              </p>

              {saveErrorMsg && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{saveErrorMsg}</span>
                </div>
              )}

              {saveSuccessMsg && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveCharitySettings} className="space-y-6">
                {/* Select Charity */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Choose Supported Charity
                  </label>
                  <select
                    value={selectedCharityId}
                    onChange={(e) => setSelectedCharityId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-400 cursor-pointer"
                  >
                    {activeCharities.map((c) => (
                      <option key={c.id} value={c.id} className="bg-navy-900 text-white">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Percentage Slider */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Charity Contribution Split
                    </label>
                    <span className="text-sm font-mono font-bold text-gold-400 bg-gold-400/10 px-2.5 py-0.5 rounded border border-gold-400/20">
                      {selectedPercent}% of fee
                    </span>
                  </div>

                  <input
                    type="range"
                    min={minPercent}
                    max={100}
                    step={5}
                    value={selectedPercent}
                    onChange={(e) => setSelectedPercent(parseInt(e.target.value, 10))}
                    className="w-full accent-gold-400 cursor-pointer"
                  />

                  {/* Preset Percent Pills */}
                  <div className="flex items-center justify-between gap-2 mt-3">
                    {[10, 25, 50, 100].map((pct) => (
                      <button
                        type="button"
                        key={pct}
                        onClick={() => setSelectedPercent(pct)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                          selectedPercent === pct
                            ? 'bg-gold-400 text-navy-950 shadow-md'
                            : 'bg-navy-950/60 border border-white/10 text-slate-300 hover:border-white/20'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>

                  {/* Live Calculation Preview */}
                  <div className="mt-4 p-3.5 rounded-xl bg-navy-950/80 border border-white/5 space-y-1">
                    <div className="text-xs text-slate-300">
                      At <strong className="text-gold-300">{selectedPercent}%</strong>,{' '}
                      <strong className="text-emerald-400">
                        {formatPrice(calculateContribution(poundsToPence(planCost), selectedPercent, minPercent) / 100)} {planPeriodText}
                      </strong>{' '}
                      of your {subscription?.plan || 'monthly'} fee ({formatPrice(planCost)}) will go directly to charity.
                    </div>
                  </div>
                </div>

                {/* Important Timing Notice */}
                <div className="p-3 rounded-xl bg-navy-950/60 border border-white/10 text-[11px] text-slate-400 flex items-start gap-2">
                  <Info className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                  <span>
                    <strong>Note:</strong> Changes apply from your <em>next</em> subscription payment.
                    Past payments maintain their original charity allocation.
                  </span>
                </div>

                {/* Submit & Cancel */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSavingCharity}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="glow"
                    size="sm"
                    isLoading={isSavingCharity}
                  >
                    Save Preferences
                  </Button>
                </div>
              </form>
            </GlassCard>
          </div>
        </div>
      )}
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-navy-950 text-white flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
