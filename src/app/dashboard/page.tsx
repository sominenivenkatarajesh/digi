'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScoresCard } from '@/components/dashboard/ScoresCard';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
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

  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
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

  useEffect(() => {
    async function loadUserData() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login?next=/dashboard');
          return;
        }

        // 1. Fetch user profile with selected charity and contribution percent
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, role, charity_id, charity_percent, charities(id, name, tagline, is_active, slug)')
          .eq('id', user.id)
          .maybeSingle();

        const role = profileData?.role || user.user_metadata?.role || 'subscriber';
        const isAdmin = role === 'admin';

        setProfile({
          id: user.id,
          email: user.email || '',
          full_name:
            profileData?.full_name ||
            user.user_metadata?.full_name ||
            user.email?.split('@')[0] ||
            'Hero Member',
          role,
        });

        // Parse charity info
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ch = (profileData as any)?.charities;
        const currentPercent = Number(profileData?.charity_percent || 10);
        const charityId = profileData?.charity_id || ch?.id || '';
        const charityName = ch?.name || "Hope Horizons Children's Foundation";
        const charityTagline =
          ch?.tagline || 'Transforming pediatric healthcare & critical care access';
        const isCharityActive = ch ? Boolean(ch.is_active) : true;

        setCharity({
          id: charityId,
          name: charityName,
          tagline: charityTagline,
          percent: currentPercent,
          isActive: isCharityActive,
        });

        setSelectedCharityId(charityId);
        setSelectedPercent(currentPercent);

        // 2. Fetch subscription row
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('plan, status, current_period_end, cancel_at_period_end, stripe_customer_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (subData) {
          const rawStatus = (subData.status as 'active' | 'inactive' | 'lapsed' | 'cancelled') || 'inactive';
          const periodEnd = subData.current_period_end ? new Date(subData.current_period_end) : null;
          const isPeriodValid = periodEnd ? periodEnd.getTime() > Date.now() : true;
          const isActive = isAdmin || (rawStatus === 'active' && isPeriodValid);

          setSubscription({
            plan: (subData.plan as 'monthly' | 'yearly') || 'monthly',
            status: rawStatus,
            isActive,
            isAdmin,
            renewalDate: subData.current_period_end || null,
            cancelAtPeriodEnd: Boolean(subData.cancel_at_period_end),
            stripeCustomerId: subData.stripe_customer_id || null,
          });
        } else {
          setSubscription({
            plan: 'monthly',
            status: 'inactive',
            isActive: isAdmin,
            isAdmin,
            renewalDate: null,
            cancelAtPeriodEnd: false,
            stripeCustomerId: null,
          });
        }

        // 3. Fetch user's total contributions to date from payments table
        const { data: paymentsData } = await supabase
          .from('payments')
          .select('charity_amount')
          .eq('user_id', user.id);

        if (paymentsData && paymentsData.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const totalPaid = paymentsData.reduce((sum: number, p: any) => sum + Number(p.charity_amount || 0), 0);
          setTotalContributedSoFar(totalPaid);
        }

        // 4. Fetch active charities list for change dropdown
        const { data: charitiesList } = await supabase
          .from('charities')
          .select('id, name, slug')
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (charitiesList) {
          setActiveCharities(charitiesList);
        }

        // 5. Fetch platform settings for min charity percent
        const { data: settingsData } = await supabase
          .from('platform_settings')
          .select('min_charity_percent')
          .limit(1)
          .maybeSingle();

        if (settingsData?.min_charity_percent) {
          setMinPercent(Number(settingsData.min_charity_percent));
        }

        // Auto-open modal if changeCharity URL param was passed
        if (changeCharityParam) {
          setSelectedCharityId(changeCharityParam);
          setIsModalOpen(true);
        }
      } catch (err) {
        console.error('Error loading dashboard:', err);
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
      <main className="min-h-screen bg-navy-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading your hero dashboard...</p>
        </div>
      </main>
    );
  }

  const getStatusBadge = () => {
    if (!subscription) return null;
    if (subscription.isAdmin) {
      return (
        <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">
          Admin Bypass
        </span>
      );
    }

    switch (subscription.status) {
      case 'active':
        return (
          <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            Active
          </span>
        );
      case 'lapsed':
        return (
          <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
            Payment Lapsed
          </span>
        );
      case 'cancelled':
        return (
          <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/30">
            Inactive
          </span>
        );
    }
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

  // Plan price calculation for charity split
  const isYearly = subscription?.plan === 'yearly';
  const planCost = isYearly ? 99 : 10;
  const planPeriodText = isYearly ? '/yr' : '/mo';
  const charityAmountPerCycle = (planCost * (charity.percent / 100)).toFixed(2);

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

        {/* Subscribe Banner if prompted */}
        {promptSubscribe && !subscription?.isActive && (
          <div className="mb-8 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-white">Unlock Golf Score Tracking & Monthly Draws</h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Your registration is complete! Choose a plan below to activate your account and start entering golf scores.
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
                Monthly (£10/mo)
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isCheckoutLoading === 'yearly'}
                onClick={() => handleStartCheckout('yearly')}
              >
                Yearly (£99/yr)
              </Button>
            </div>
          </div>
        )}

        {/* Membership Status Overview */}
        <div className="mb-6">
          <h2 className="text-lg font-display font-bold text-white">Membership Overview</h2>
          <p className="text-slate-400 text-sm mt-1">
            {subscription?.isActive
              ? 'Your active subscription fuels direct charity aid and guarantees entry into every monthly draw.'
              : 'Activate your membership to unlock full draw participation and direct charity giving.'}
          </p>
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
                  Subscribe Now (£10/mo)
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
                    £{charityAmountPerCycle} {planPeriodText}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <span className="text-slate-400">Your total impact so far:</span>
                  <span className="font-bold text-emerald-300">
                    {totalContributedSoFar > 0 ? formatCurrency(totalContributedSoFar, '£') : '£0.00'}
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

          {/* Card 3: Upcoming Draw */}
          <GlassCard glowColor="default" className="p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                  Upcoming Draw
                </span>
                <Calendar className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-display font-bold text-white mb-1">
                1st of Next Month
              </div>
              <p className="text-xs text-slate-400">
                Official 5-number draw at 00:00:00 UTC.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.08] text-xs text-slate-300">
              {subscription?.isActive ? (
                <span className="text-emerald-400 font-medium">✓ Qualified for next draw</span>
              ) : (
                <span className="text-amber-400 font-medium">Subscribe to qualify</span>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Stableford Scores Card */}
        <ScoresCard
          isActiveSubscription={subscription?.isActive || false}
          isAdmin={subscription?.isAdmin || false}
        />
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
                        £{((planCost * selectedPercent) / 100).toFixed(2)} {planPeriodText}
                      </strong>{' '}
                      of your {subscription?.plan || 'monthly'} fee will go directly to charity.
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
