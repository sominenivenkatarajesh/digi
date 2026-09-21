'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScoresCard } from '@/components/dashboard/ScoresCard';
import { createClient } from '@/lib/supabase/client';
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
  charityName: string;
  charityTagline: string;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const promptSubscribe = searchParams.get('subscribe') === 'true';

  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
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

        // Fetch user profile with selected charity
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, role, charity_id, charities(name, tagline)')
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

        // Fetch subscription row
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('plan, status, current_period_end, cancel_at_period_end, stripe_customer_id')
          .eq('user_id', user.id)
          .maybeSingle();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ch = (profileData as any)?.charities;
        const charityName = ch?.name || "Hope Horizons Children's Foundation";
        const charityTagline =
          ch?.tagline || 'Transforming pediatric healthcare & critical care access';

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
            charityName,
            charityTagline,
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
            charityName,
            charityTagline,
          });
        }
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadUserData();
  }, [router]);

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
      return null;
    }
  };

  return (
    <main className="min-h-screen bg-navy-950 text-white pb-24 relative overflow-hidden">
      {/* Ambient background glows */}
      <div
        className="pointer-events-none absolute top-0 right-1/4 w-[600px] h-[500px] bg-emerald-500/10 blur-[130px] rounded-full"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/3 left-0 w-[500px] h-[400px] bg-gold-400/10 blur-[130px] rounded-full"
        aria-hidden="true"
      />

      {/* Top Header */}
      <header className="border-b border-white/[0.08] bg-navy-900/50 backdrop-blur-xl sticky top-0 z-40">
        <Container size="wide" className="py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="font-display font-bold text-lg text-white">
              Digital<span className="text-gold-400">Heroes</span>
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-block text-xs text-slate-300 font-medium">
              {profile?.full_name}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
            >
              Sign Out
            </Button>
          </div>
        </Container>
      </header>

      <Container size="wide" className="pt-10 relative z-10">
        {/* Unlock Banner for Non-Subscribers / Prompted */}
        {(!subscription?.isActive || promptSubscribe) && !subscription?.isAdmin && (
          <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-gold-500/15 via-amber-500/10 to-transparent border border-gold-400/30 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl shadow-gold-500/5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gold-400/20 border border-gold-400/40 flex items-center justify-center shrink-0 mt-0.5">
                <Lock className="w-6 h-6 text-gold-400" />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-white mb-1">
                  Subscribe to Unlock Stableford Scores & Monthly Cash Draws
                </h2>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  You are signed in, but your account does not have an active subscription. Subscribe to a Monthly (£10) or Annual (£99) membership to record your 5 golf scores and qualify for the monthly cash prize pool.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button
                variant="glow"
                size="md"
                isLoading={isCheckoutLoading === 'monthly'}
                onClick={() => handleStartCheckout('monthly')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Subscribe Monthly (£10)
              </Button>
              <Button
                variant="secondary"
                size="md"
                isLoading={isCheckoutLoading === 'yearly'}
                onClick={() => handleStartCheckout('yearly')}
              >
                Annual (£99)
              </Button>
            </div>
          </div>
        )}

        {/* Welcome Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-white/5 border border-white/10 text-slate-300 mb-3">
            {subscription?.isActive ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>
              {subscription?.isActive ? 'Active Subscriber Account' : 'Inactive Subscription'}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-white">
            Hello, {profile?.full_name}
          </h1>
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
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                  Supported Charity
                </span>
                <Heart className="w-4 h-4 text-gold-400 fill-gold-400/20" />
              </div>
              <div className="text-lg font-display font-bold text-white mb-1 line-clamp-1">
                {subscription?.charityName}
              </div>
              <p className="text-xs text-slate-400 line-clamp-2">
                {subscription?.charityTagline}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.08] text-xs text-emerald-400 font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Direct allocations per paid invoice</span>
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

