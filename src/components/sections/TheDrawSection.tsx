'use client';

import React, { useState, useEffect } from 'react';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { GlassCard } from '@/components/ui/GlassCard';
import { Reveal } from '@/components/ui/Reveal';
import { DynamicDrawBalls } from '@/components/3d/Dynamic3D';
import { useInView } from '@/hooks/useInView';
import { Trophy, Clock, CheckCircle2, Award, Calendar, Radio } from 'lucide-react';

interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function TheDrawSection() {
  const [sectionRef, isInView] = useInView({ threshold: 0.15 });

  // Live Date & Time States (initialized safely for SSR hydration)
  const [currentTimeFormatted, setCurrentTimeFormatted] = useState<string>('');
  const [currentDateFormatted, setCurrentDateFormatted] = useState<string>('');
  const [currentCycle, setCurrentCycle] = useState<string>('Current Cycle');
  const [nextDrawFormatted, setNextDrawFormatted] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<CountdownTime>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    function updateClockAndCountdown() {
      const now = new Date();

      // 1. Current live date & time
      const dateStr = now.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const timeStr = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')} UTC`;
      setCurrentDateFormatted(dateStr);
      setCurrentTimeFormatted(timeStr);

      // 2. Active monthly cycle (e.g. "September 2026")
      const cycleStr = now.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
      setCurrentCycle(cycleStr);

      // 3. Target next draw: 1st of next month at 00:00:00 UTC
      let nextMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0)
      );

      // If already passed, roll forward to subsequent month (continuing indefinitely from today)
      let diff = nextMonth.getTime() - now.getTime();
      if (diff <= 0) {
        nextMonth = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1, 0, 0, 0)
        );
        diff = nextMonth.getTime() - now.getTime();
      }

      const nextMonthName = nextMonth.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
      setNextDrawFormatted(`1 ${nextMonthName} at 00:00:00 UTC`);

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    }

    updateClockAndCountdown();
    const timer = setInterval(updateClockAndCountdown, 1000);
    return () => clearInterval(timer);
  }, []);

  const tiers = [
    {
      matches: 'Match 5 Numbers',
      percentage: '40%',
      title: 'Grand Jackpot',
      description: 'Awarded to subscribers matching all 5 drawn numbers in the active monthly cycle.',
      color: 'gold' as const,
      badge: 'Tier 1',
      icon: Trophy,
    },
    {
      matches: 'Match 4 Numbers',
      percentage: '35%',
      title: 'Major Tier',
      description: 'Shared equally among all subscribers matching 4 out of 5 drawn numbers.',
      color: 'emerald' as const,
      badge: 'Tier 2',
      icon: Award,
    },
    {
      matches: 'Match 3 Numbers',
      percentage: '25%',
      title: 'Community Tier',
      description: 'Shared equally among all subscribers matching 3 out of 5 drawn numbers.',
      color: 'default' as const,
      badge: 'Tier 3',
      icon: CheckCircle2,
    },
  ];

  return (
    <section
      id="the-draw"
      ref={sectionRef}
      className="py-16 sm:py-24 relative bg-navy-950 overflow-hidden scroll-mt-20"
    >
      {/* Background Radial Ambiance */}
      <div
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-radial-gradient from-gold-500/10 via-emerald-500/5 to-transparent blur-[130px]"
        aria-hidden="true"
      />

      <Container size="wide" className="relative z-10">
        <SectionHeading
          badge="Monthly Guaranteed Draw"
          badgeVariant="gold"
          title={
            <>
              Transparent Numbers.{' '}
              <span className="text-gradient-gold">Guaranteed Splits</span>.
            </>
          }
          subtitle="Every month, 5 official numbers are drawn. Our 40 / 35 / 25 prize pool formula ensures transparent, multi-tier payouts directly to winning heroes."
        />

        {/* Centerpiece Showcase Stage */}
        <Reveal direction="up" delay={0.15}>
          <GlassCard
            glowColor="gold"
            className="p-6 sm:p-8 max-w-4xl mx-auto mb-14 border-gold-400/25 bg-navy-900/60 shadow-2xl relative overflow-hidden"
          >
            {/* Top Live Status Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-6 border-b border-white/10">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span>Active Cycle: {currentCycle}</span>
                </div>

                {currentDateFormatted && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono text-slate-300 bg-navy-950/70 border border-white/10">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Today: {currentDateFormatted}</span>
                    <span className="text-emerald-400 font-semibold">• {currentTimeFormatted}</span>
                  </div>
                )}
              </div>

              {nextDrawFormatted && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium text-gold-400 bg-gold-400/10 border border-gold-400/25">
                  <Clock className="w-3.5 h-3.5 text-gold-400 animate-pulse" />
                  <span>Next Draw: {nextDrawFormatted}</span>
                </div>
              )}
            </div>

            {/* Countdown Grid */}
            <div className="py-6 text-center">
              <div className="text-xs uppercase tracking-widest font-mono font-semibold text-gold-400/90 mb-4">
                Official Monthly Draw Countdown
              </div>

              <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-lg mx-auto">
                {[
                  { label: 'Days', val: timeLeft.days },
                  { label: 'Hours', val: timeLeft.hours },
                  { label: 'Mins', val: timeLeft.minutes },
                  { label: 'Secs', val: timeLeft.seconds },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="bg-navy-950/80 border border-gold-400/20 rounded-xl p-3 sm:p-4 flex flex-col items-center shadow-lg"
                  >
                    <span className="font-mono text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
                      {String(item.val).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider mt-1 font-medium">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3D Ball Rack Showcase */}
            <div className="relative pt-2 pb-4">
              <div className="flex flex-col items-center justify-center text-center mb-2 gap-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold uppercase tracking-wider bg-gold-400/10 border border-gold-400/25 text-gold-400">
                  <span>Official 5-Ball Sequence</span>
                </div>
                <span className="text-[11px] uppercase tracking-widest font-mono text-slate-400">
                  {isInView ? 'Sequence settled in alignment' : 'Draw sequence in rotation'}
                </span>
              </div>

              {/* 3D Sphere Canvas */}
              <div className="relative w-full flex items-center justify-center">
                <DynamicDrawBalls isSettled={isInView} />
              </div>

              <p className="text-center text-[11px] text-slate-400 mt-2 italic max-w-lg mx-auto">
                * Illustrative 5-ball format (07 - 14 - 21 - 28 - 35). Certified monthly winning numbers are drawn and cryptographically verified on the 1st of every month.
              </p>
            </div>
          </GlassCard>
        </Reveal>

        {/* Prize Split Breakdown Tiers (40 / 35 / 25) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier, idx) => {
            const Icon = tier.icon;
            return (
              <Reveal key={tier.badge} delay={idx * 0.12} direction="up">
                <GlassCard
                  glowColor={tier.color}
                  className="p-7 h-full flex flex-col justify-between border-white/10 hover:border-gold-400/30 transition-all duration-300 shadow-xl"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-slate-300">
                        {tier.badge}
                      </span>
                      <span className="font-display font-black text-3xl text-gold-400">
                        {tier.percentage}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-5 h-5 text-gold-400" />
                      <h3 className="text-lg font-bold text-white">
                        {tier.title}
                      </h3>
                    </div>

                    <div className="text-xs font-mono text-emerald-400 font-semibold mb-3">
                      {tier.matches}
                    </div>

                    <p className="text-sm text-slate-300 leading-relaxed font-light">
                      {tier.description}
                    </p>
                  </div>

                  <div className="pt-5 mt-6 border-t border-white/5 flex items-center gap-2 text-xs text-slate-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Pool calculated from monthly entries</span>
                  </div>
                </GlassCard>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

export default TheDrawSection;
