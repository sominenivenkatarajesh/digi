'use client';

import React, { useState, useEffect } from 'react';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import { Check, Sparkles, Shield, Heart } from 'lucide-react';
import { getPlatformSettings, type PlatformPricing } from '@/lib/data/homepage';
import { formatCurrency } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function PricingSection() {
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [checkoutLoading, setCheckoutLoading] = useState<'monthly' | 'yearly' | null>(null);
  const [pricing, setPricing] = useState<PlatformPricing>({
    monthlyPrice: 10,
    yearlyPrice: 99,
    currency: '£',
    isCustom: false,
  });

  useEffect(() => {
    async function loadPricingAndAuth() {
      try {
        const data = await getPlatformSettings();
        setPricing(data);

        const supabase = createClient();
        const { data: authData } = await supabase.auth.getUser();
        setIsLoggedIn(Boolean(authData?.user));
      } catch (err) {
        console.error('Failed to load pricing or auth status:', err);
      }
    }
    loadPricingAndAuth();
  }, []);

  const handlePlanCheckout = async (plan: 'monthly' | 'yearly') => {
    if (!isLoggedIn) {
      router.push(`/signup?plan=${plan}`);
      return;
    }

    setCheckoutLoading(plan);
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
        alert(data.error || 'Failed to start checkout. Please try again.');
        if (data.error?.includes('already have an active')) {
          router.push('/dashboard');
        }
      }
    } catch (err) {
      console.error('Checkout redirect error:', err);
      alert('An unexpected error occurred while starting checkout.');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const featuresMonthly = [
    'Guaranteed entry into every Monthly Cash Draw',
    'Automatic allocation to verified charity partners',
    'Eligible for 40% Grand Jackpot, 35% & 25% splits',
    'Full monthly transparency and giving reports',
    'Instant cancel anytime flexibility',
  ];

  const featuresYearly = [
    'Guaranteed entry into all 12 Monthly Cash Draws',
    'Maximum charitable contribution allocation',
    'Eligible for 40% Grand Jackpot, 35% & 25% splits',
    'VIP quarterly community impact updates',
    'Priority entry confirmation',
    'Save ~17% compared to monthly billing',
  ];

  return (
    <section id="pricing" className="py-24 sm:py-32 relative bg-navy-950 scroll-mt-20">
      <Container size="wide">
        <SectionHeading
          badge="Simple, Transparent Memberships"
          badgeVariant="gold"
          title={
            <>
              Choose Your <span className="text-gradient-gold">Impact Plan</span>
            </>
          }
          subtitle="Every subscription guarantees entry into our monthly cash draws and directly sustains verified charitable initiatives."
        />

        {/* Billing Toggle */}
        <div className="flex justify-center mb-16">
          <div className="bg-navy-900/90 border border-white/10 p-1.5 rounded-2xl flex items-center gap-1 backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-white/10 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                billingCycle === 'yearly'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Annual Billing</span>
              <span className="text-[10px] uppercase font-bold bg-gold-400 text-navy-950 px-1.5 py-0.5 rounded-full">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Monthly Plan Card */}
          <Reveal direction="up" delay={0.1}>
            <GlassCard
              glowColor="default"
              className={`p-8 sm:p-10 flex flex-col justify-between h-full transition-all ${
                billingCycle === 'monthly' ? 'ring-2 ring-white/20' : 'opacity-90'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-display font-bold text-white">
                    Monthly Supporter
                  </h3>
                </div>

                <p className="text-xs text-slate-400 mb-6">
                  Flexible monthly giving and draw participation with no long-term commitment.
                </p>

                <div className="flex items-baseline gap-1 mb-8">
                  <span className="font-display text-4xl sm:text-5xl font-extrabold text-white">
                    {formatCurrency(pricing.monthlyPrice, pricing.currency)}
                  </span>
                  <span className="text-slate-400 text-sm font-medium">/ month</span>
                </div>

                <ul className="space-y-3.5 mb-8">
                  {featuresMonthly.map((feat) => (
                    <li key={feat} className="flex items-start gap-3 text-sm text-slate-300">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-emerald-400" />
                      </div>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                onClick={() => handlePlanCheckout('monthly')}
                variant={billingCycle === 'monthly' ? 'glow' : 'secondary'}
                size="lg"
                isLoading={checkoutLoading === 'monthly'}
                className="w-full justify-center"
              >
                Subscribe Monthly
              </Button>
            </GlassCard>
          </Reveal>

          {/* Yearly Plan Card (Best Value) */}
          <Reveal direction="up" delay={0.2}>
            <GlassCard
              glowColor="gold"
              className={`p-8 sm:p-10 flex flex-col justify-between h-full relative border-gold-400/30 ${
                billingCycle === 'yearly' ? 'ring-2 ring-gold-400/40' : ''
              }`}
            >
              {/* Best Value Badge */}
              <div className="absolute -top-3.5 right-6 bg-gradient-to-r from-gold-400 to-amber-500 text-navy-950 text-xs font-extrabold uppercase px-3 py-1 rounded-full shadow-lg shadow-gold-500/25 flex items-center gap-1">
                <Sparkles className="w-3 h-3 fill-navy-950" />
                <span>Best Value</span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-display font-bold text-white">
                    Annual Hero
                  </h3>
                </div>

                <p className="text-xs text-slate-300 mb-6">
                  Maximum yearly impact with continuous monthly draw entries all year round.
                </p>

                <div className="flex items-baseline gap-1 mb-2">
                  <span className="font-display text-4xl sm:text-5xl font-extrabold text-white">
                    {formatCurrency(pricing.yearlyPrice, pricing.currency)}
                  </span>
                  <span className="text-slate-400 text-sm font-medium">/ year</span>
                </div>
                <div className="text-[11px] text-emerald-400 font-semibold mb-8">
                  Equivalent to {formatCurrency(Math.round(pricing.yearlyPrice / 12), pricing.currency)}/month (2 months free)
                </div>

                <ul className="space-y-3.5 mb-8">
                  {featuresYearly.map((feat) => (
                    <li key={feat} className="flex items-start gap-3 text-sm text-slate-200">
                      <div className="w-5 h-5 rounded-full bg-gold-400/15 border border-gold-400/30 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-gold-400" />
                      </div>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                onClick={() => handlePlanCheckout('yearly')}
                variant="glow"
                size="lg"
                isLoading={checkoutLoading === 'yearly'}
                className="w-full justify-center"
              >
                Subscribe Annually
              </Button>
            </GlassCard>
          </Reveal>
        </div>

        <div className="mt-8 text-center text-xs text-slate-400">
          Cancel subscription anytime from your member portal. No hidden fees.
        </div>
      </Container>
    </section>
  );
}
