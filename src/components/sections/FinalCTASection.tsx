'use client';

import React from 'react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Reveal } from '@/components/ui/Reveal';
import { Sparkles, ArrowRight, HeartHandshake, ShieldCheck } from 'lucide-react';

export function FinalCTASection() {
  return (
    <section className="py-20 sm:py-28 relative overflow-hidden bg-navy-900/50">
      <Container size="default">
        <Reveal direction="up">
          <div className="relative rounded-3xl p-8 sm:p-14 lg:p-16 overflow-hidden border border-emerald-500/30 bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 shadow-2xl text-center">
            {/* Ambient background glows */}
            <div
              className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 rounded-full bg-emerald-500/20 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-gold-400/20 blur-3xl"
              aria-hidden="true"
            />

            <div className="relative z-10 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-gold-500/10 border border-gold-500/20 text-gold-400 mb-6">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Next Draw Cycle Active</span>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold text-white tracking-tight leading-tight mb-6">
                Your Next Win{' '}
                <span className="text-gradient-emerald">Changes a Life</span>.
              </h2>

              <p className="text-base sm:text-lg text-slate-300 font-light leading-relaxed mb-10">
                Step up as a Digital Hero today. Support verified charitable missions, receive guaranteed entry into every monthly cash draw, and be part of meaningful change.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  href="/signup"
                  variant="glow"
                  size="lg"
                  className="w-full sm:w-auto shadow-2xl text-base px-8"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Join & Subscribe Now
                </Button>
                <Button
                  href="/charities"
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto text-base"
                >
                  Browse Charities
                </Button>
              </div>

              <div className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Cancel anytime
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <HeartHandshake className="w-4 h-4 text-gold-400" />
                  Verified charity partners
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
