'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Heart, Sparkles, ArrowRight, ShieldCheck, Home } from 'lucide-react';

function DonateSuccessContent() {
  const searchParams = useSearchParams();
  const charitySlug = searchParams.get('charity');

  return (
    <main className="min-h-screen bg-navy-950 text-white flex flex-col justify-center items-center py-20 px-4 relative overflow-hidden">
      {/* Glow backgrounds */}
      <div
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] bg-gold-500/15 blur-[140px] rounded-full"
        aria-hidden="true"
      />

      <Container size="narrow" className="relative z-10">
        <GlassCard glowColor="gold" className="p-8 sm:p-12 text-center border-white/10">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gold-400/20 border border-gold-400/40 flex items-center justify-center text-gold-400 shadow-xl shadow-gold-500/10">
            <Heart className="w-8 h-8 fill-gold-400/30" />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-gold-400/10 border border-gold-400/30 text-gold-300 mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Direct Charitable Gift</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-white mb-3">
            Thank You for Your Donation!
          </h1>

          <p className="text-sm text-slate-300 max-w-md mx-auto mb-6 leading-relaxed">
            Your generous one-off contribution has been received and allocated directly to your chosen cause. 100% of this donation fuels real-world relief and community programs.
          </p>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10 max-w-sm mx-auto mb-8 flex items-center justify-center gap-2 text-xs text-emerald-400 font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>Recorded in verified charity impact reports</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {charitySlug && (
              <Button
                href={`/charities/${charitySlug}`}
                variant="glow"
                size="md"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Back to Charity Profile
              </Button>
            )}
            <Button
              href="/charities"
              variant="secondary"
              size="md"
            >
              Browse All Causes
            </Button>
            <Button
              href="/dashboard"
              variant="ghost"
              size="md"
              leftIcon={<Home className="w-4 h-4" />}
            >
              Dashboard
            </Button>
          </div>
        </GlassCard>
      </Container>
    </main>
  );
}

export default function DonateSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-navy-950 flex items-center justify-center text-slate-400">
          Loading donation confirmation...
        </main>
      }
    >
      <DonateSuccessContent />
    </Suspense>
  );
}
