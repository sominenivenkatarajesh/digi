'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import {
  Heart,
  Calendar,
  MapPin,
  ExternalLink,
  ArrowLeft,
  Sparkles,
  CreditCard,
  AlertTriangle,
  Info,
  Lock,
} from 'lucide-react';

export interface CharityEvent {
  id: string;
  charity_id: string;
  title: string;
  event_date: string;
  location: string | null;
  description: string | null;
}

export interface CharityData {
  id: string;
  name: string;
  slug: string;
  tagline?: string;
  description: string;
  short_description?: string;
  category?: string;
  impact_metric?: string;
  website_url?: string;
  logo_url?: string;
  image_url?: string;
  is_featured: boolean;
  is_active: boolean;
}

interface CharityProfileClientProps {
  charity: CharityData;
  totalRaised: number;
  events: CharityEvent[];
  isLoggedIn: boolean;
  initialDonate?: boolean;
}

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

export function CharityProfileClient({
  charity,
  totalRaised,
  events,
  isLoggedIn,
  initialDonate = false,
}: CharityProfileClientProps) {
  const router = useRouter();
  const [donationAmount, setDonationAmount] = useState<number | ''>(25);
  const [customInput, setCustomInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSelectPreset = (amount: number) => {
    setDonationAmount(amount);
    setCustomInput('');
    setErrorMessage(null);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      setDonationAmount(parsed);
    } else {
      setDonationAmount('');
    }
    setErrorMessage(null);
  };

  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const amount = typeof donationAmount === 'number' ? donationAmount : parseFloat(customInput);
    if (isNaN(amount) || amount < 1) {
      setErrorMessage('Please enter an amount of at least £1.00');
      return;
    }

    if (amount > 10000) {
      setErrorMessage('Maximum single donation is £10,000');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/stripe/donate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charityId: charity.id,
          amount,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start donation checkout.');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment initiation failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 pb-24 selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-[40%] left-[-15%] w-[600px] h-[600px] bg-gold-400/5 rounded-full blur-[140px]" />
      </div>

      <Container className="relative z-10 pt-28 sm:pt-32">
        {/* Back Link */}
        <div className="mb-6">
          <Link
            href="/charities"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-400 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Back to All Charities</span>
          </Link>
        </div>

        {/* Hero Section */}
        <GlassCard
          glowColor={charity.is_featured ? 'gold' : 'emerald'}
          className="p-6 sm:p-10 mb-10 relative overflow-hidden"
        >
          {charity.is_featured && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-400/15 border border-gold-400/30 text-gold-300 text-xs font-bold uppercase tracking-wider mb-4">
              <Sparkles className="w-3.5 h-3.5 text-gold-400" />
              <span>Featured Cause</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="text-xs uppercase font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {charity.category || 'Humanitarian Cause'}
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white mb-4 tracking-tight">
                {charity.name}
              </h1>

              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-3xl mb-6">
                {charity.tagline || charity.short_description || charity.description}
              </p>

              {charity.website_url && (
                <a
                  href={charity.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium mb-6"
                >
                  <span>Visit website</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-white/10">
                <Button
                  href={isLoggedIn ? `/dashboard?changeCharity=${charity.id}` : `/signup?charity=${charity.slug || charity.id}`}
                  variant="primary"
                  size="lg"
                  leftIcon={<Heart className="w-4 h-4 fill-white" />}
                >
                  {isLoggedIn ? 'Support with Membership' : 'Support with Membership'}
                </Button>

                <Button
                  href="#donate-section"
                  variant="glow"
                  size="lg"
                  leftIcon={<CreditCard className="w-4 h-4" />}
                >
                  Make Direct Donation
                </Button>
              </div>
            </div>

            {/* Total Raised Card */}
            <div className="lg:col-span-4 w-full">
              <div className="p-6 rounded-2xl bg-navy-950/70 border border-white/10 backdrop-blur-md">
                <div className="text-xs text-slate-400 font-mono uppercase tracking-wider mb-1">
                  Total Raised
                </div>
                <div className="text-3xl sm:text-4xl font-display font-bold text-emerald-400 mb-2">
                  {totalRaised > 0 ? formatCurrency(totalRaised, '£') : '£0.00'}
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  {totalRaised > 0
                    ? 'Raised directly through member contributions and independent donations.'
                    : 'Be the first supporter to contribute!'}
                </p>

                {charity.impact_metric && (
                  <div className="pt-4 border-t border-white/10">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {charity.impact_metric}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Content Layout: 2 Columns (About + Events / Donation) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column: Description & Events */}
          <div className="lg:col-span-7 space-y-10">
            {/* About Section */}
            <GlassCard className="p-6 sm:p-8">
              <h2 className="text-xl font-display font-bold text-white mb-4 flex items-center gap-2">
                <Heart className="w-5 h-5 text-emerald-400" />
                About {charity.name}
              </h2>
              <div className="text-slate-300 leading-relaxed text-sm sm:text-base whitespace-pre-line space-y-4">
                {charity.description}
              </div>
            </GlassCard>

            {/* Upcoming Events Section */}
            <GlassCard className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-gold-400" />
                    Upcoming Events
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Charity golf days, tournaments, and fundraisers.
                  </p>
                </div>
              </div>

              {events.length === 0 ? (
                <div className="p-8 rounded-xl bg-navy-950/40 border border-white/5 text-center">
                  <Calendar className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-300 font-medium">No upcoming events scheduled</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Check back soon for upcoming charity golf tournaments and community days.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {events.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-5 rounded-xl bg-navy-950/60 border border-white/10 hover:border-emerald-500/30 transition-colors"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <h3 className="text-base font-bold text-white">{evt.title}</h3>
                        <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-gold-400/10 text-gold-300 border border-gold-400/20">
                          {formatDate(evt.event_date)}
                        </span>
                      </div>

                      {evt.location && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{evt.location}</span>
                        </div>
                      )}

                      {evt.description && (
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {evt.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>

          {/* Right Column: Independent Donation Form */}
          <div className="lg:col-span-5" id="donate-section">
            <GlassCard
              glowColor="gold"
              className="p-6 sm:p-8 sticky top-28 border-white/15"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/25 flex items-center justify-center text-gold-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-display font-bold text-white">
                    Direct Donation
                  </h2>
                  <p className="text-xs text-slate-400">
                    Independent charitable contribution
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-300 mb-6 leading-relaxed">
                Make an independent donation directly to <strong className="text-white">{charity.name}</strong>.
                Membership is not required, and donations are processed securely via Stripe.
              </p>

              {errorMessage && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleDonate} className="space-y-5">
                <div>
                  <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-2">
                    Select Donation Amount
                  </label>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {PRESET_AMOUNTS.map((amt) => (
                      <button
                        type="button"
                        key={amt}
                        onClick={() => handleSelectPreset(amt)}
                        disabled={isSubmitting}
                        className={`py-2 px-3 rounded-xl text-sm font-bold transition-all ${
                          donationAmount === amt && customInput === ''
                            ? 'bg-gradient-to-r from-gold-400 to-amber-500 text-navy-950 shadow-md shadow-amber-500/20'
                            : 'bg-navy-950/60 border border-white/10 text-slate-200 hover:border-white/25 hover:text-white'
                        }`}
                      >
                        £{amt}
                      </button>
                    ))}
                  </div>

                  {/* Custom Amount Input */}
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      £
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      step="any"
                      placeholder="Other amount (min £1)"
                      value={customInput}
                      onChange={handleCustomChange}
                      disabled={isSubmitting}
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-navy-950/80 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400"
                    />
                  </div>
                </div>

                {/* Transparency Notice */}
                <div className="p-3.5 rounded-xl bg-navy-950/60 border border-white/5 space-y-1.5 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                    <Info className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Important Information</span>
                  </div>
                  <p>
                    • Direct donations are separate from the monthly prize draw and do not affect scoring or draw entries.
                  </p>
                  <p>
                    • Securely processed via Stripe Checkout with instant receipt.
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="glow"
                  size="lg"
                  className="w-full justify-center"
                  isLoading={isSubmitting}
                  disabled={isSubmitting || (!donationAmount && !customInput)}
                  leftIcon={<Lock className="w-4 h-4" />}
                >
                  {isSubmitting
                    ? 'Redirecting to Stripe...'
                    : `Donate ${donationAmount ? formatCurrency(Number(donationAmount), '£') : 'Now'}`}
                </Button>
              </form>
            </GlassCard>
          </div>
        </div>
      </Container>
    </div>
  );
}
