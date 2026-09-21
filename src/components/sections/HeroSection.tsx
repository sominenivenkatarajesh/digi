'use client';

import React from 'react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { DynamicHeroScene } from '@/components/3d/Dynamic3D';
import { Reveal } from '@/components/ui/Reveal';
import { Heart, ArrowRight, ShieldCheck, Trophy, Sparkles } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative min-h-[90vh] lg:min-h-screen flex items-center justify-center pt-28 pb-16 lg:pt-36 lg:pb-24 overflow-hidden">
      {/* Background Subtle Gradient Blobs */}
      <div
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[900px] h-[500px] bg-gradient-to-br from-emerald-500/10 via-gold-500/5 to-transparent blur-[120px] rounded-full"
        aria-hidden="true"
      />

      <Container size="wide" className="relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Hero Narrative Column */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
            {/* Pill Tag */}
            <Reveal direction="down" delay={0.1}>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-6 shadow-sm backdrop-blur-md">
                <Heart className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/20" />
                <span>Emotion-Driven Giving • Monthly Draws</span>
              </div>
            </Reveal>

            {/* Headline */}
            <Reveal direction="up" delay={0.2}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-display font-extrabold tracking-tight text-white leading-[1.08] mb-6">
                Win for You.{' '}
                <span className="text-gradient-emerald">Empower Lives</span> for Good.
              </h1>
            </Reveal>

            {/* Subtext */}
            <Reveal direction="up" delay={0.3}>
              <p className="text-base sm:text-lg lg:text-xl text-slate-300 max-w-2xl font-light leading-relaxed mb-8 sm:mb-10">
                Join our community where your monthly subscription directly powers verified humanitarian causes. Every ticket entered gives you the chance to win verified cash jackpots while changing lives forever.
              </p>
            </Reveal>

            {/* CTAs */}
            <Reveal direction="up" delay={0.4}>
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                <Button
                  href="/signup"
                  variant="glow"
                  size="lg"
                  className="w-full sm:w-auto text-base shadow-xl"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Subscribe to the Draw
                </Button>
                <Button
                  href="#how-it-works"
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto text-base"
                >
                  See How It Works
                </Button>
              </div>
            </Reveal>

            {/* Trust Micro-Badges */}
            <Reveal direction="up" delay={0.5}>
              <div className="mt-10 sm:mt-12 pt-8 border-t border-white/[0.08] grid grid-cols-2 sm:grid-cols-3 gap-6 w-full text-left">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">100% Vetted</div>
                    <div className="text-[11px] text-slate-400">Verified charities</div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gold-500/10 border border-gold-500/20 flex items-center justify-center shrink-0">
                    <Trophy className="w-4 h-4 text-gold-400" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Monthly Cash Draws</div>
                    <div className="text-[11px] text-slate-400">Guaranteed prize pools</div>
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-teal-300" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Full Transparency</div>
                    <div className="text-[11px] text-slate-400">Clear 40/35/25 split</div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Right 3D Visual Column */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div className="relative w-full max-w-[480px] lg:max-w-none aspect-square flex items-center justify-center">
              <DynamicHeroScene />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
