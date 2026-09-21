'use client';

import React, { useState, useEffect } from 'react';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { GlassCard } from '@/components/ui/GlassCard';
import { Reveal } from '@/components/ui/Reveal';
import { DynamicDrawBalls } from '@/components/3d/Dynamic3D';
import { useInView } from '@/hooks/useInView';
import { Trophy, Clock, CheckCircle2, Award } from 'lucide-react';

interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function TheDrawSection() {
  const [sectionRef, isInView] = useInView({ threshold: 0.25 });
  const [timeLeft, setTimeLeft] = useState<CountdownTime>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    function calculateTimeLeft() {
      const now = new Date();
      // Target: 1st day of the next month at 00:00:00 UTC
      const nextMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0)
      );

      const diff = nextMonth.getTime() - now.getTime();
      if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      };
    }

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const tiers = [
    {
      matches: 'Match 5 Numbers',
      percentage: '40%',
      title: 'Grand Jackpot',
      description: 'Awarded to participants matching all 5 drawn numbers in the monthly cycle.',
      color: 'gold' as const,
      badge: 'Tier 1',
    },
    {
      matches: 'Match 4 Numbers',
      percentage: '35%',
      title: 'Major Tier',
      description: 'Shared among subscribers matching 4 out of 5 drawn numbers.',
      color: 'emerald' as const,
      badge: 'Tier 2',
    },
    {
      matches: 'Match 3 Numbers',
      percentage: '25%',
      title: 'Community Tier',
      description: 'Shared among subscribers matching 3 out of 5 drawn numbers.',
      color: 'default' as const,
      badge: 'Tier 3',
    },
  ];

  return (
    <section
      id="the-draw"
      ref={sectionRef}
      className="py-24 sm:py-32 relative bg-navy-950 overflow-hidden scroll-mt-20"
    >
      {/* Background Radial Ambiance */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-radial-gradient from-gold-500/10 via-emerald-500/5 to-transparent blur-[140px]"
        aria-hidden="true"
      />

      <Container size="wide" className="relative z-10">
        <SectionHeading
          badge="The Monthly Draw"
          badgeVariant="gold"
          title={
            <>
              Transparent Numbers.{' '}
              <span className="text-gradient-gold">Guaranteed Splits</span>.
            </>
          }
          subtitle="Every month, 5 official numbers are drawn. Our 40 / 35 / 25 prize pool formula ensures transparent, multi-tier payouts directly to winning heroes."
        />

        {/* 3D Floating Draw Balls Canvas */}
        <div className="relative mb-14">
          <div className="flex flex-col items-center justify-center text-center mb-3 gap-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold uppercase tracking-wider bg-gold-400/10 border border-gold-400/25 text-gold-400">
              <span>Example draw</span>
            </div>
            <span className="text-xs uppercase tracking-widest font-mono font-medium text-slate-400 mt-1">
              {isInView ? 'Example sequence settled in alignment' : 'Example draw sequence in motion'}
            </span>
          </div>
          <DynamicDrawBalls isSettled={isInView} />
          <p className="text-center text-[11px] text-slate-400 mt-2 italic">
            * Numbers shown above are an example illustration of the 5-ball draw format. Official monthly results are published following each verified draw.
          </p>
        </div>

        {/* Next Monthly Draw Countdown Bar */}
        <Reveal direction="up" delay={0.2}>
          <GlassCard
            glowColor="gold"
            className="p-6 sm:p-8 max-w-2xl mx-auto mb-16 text-center border-gold-400/20 shadow-2xl"
          >
            <div className="flex items-center justify-center gap-2 mb-4 text-gold-400 text-xs font-semibold uppercase tracking-wider">
              <Clock className="w-4 h-4 animate-pulse" />
              <span>Next Official Monthly Draw</span>
            </div>

            <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-md mx-auto">
              {[
                { label: 'Days', val: timeLeft.days },
                { label: 'Hours', val: timeLeft.hours },
                { label: 'Mins', val: timeLeft.minutes },
                { label: 'Secs', val: timeLeft.seconds },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-navy-950/70 border border-white/10 rounded-xl p-2.5 sm:p-4 flex flex-col items-center"
                >
                  <span className="font-mono text-2xl sm:text-4xl font-bold text-white tracking-tight">
                    {String(item.val).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider mt-1">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-4">
              Draws take place on the 1st day of each month at 00:00:00 UTC.
            </p>
          </GlassCard>
        </Reveal>

        {/* Prize Split Breakdown Tiers (40 / 35 / 25) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier, idx) => (
            <Reveal key={tier.badge} delay={idx * 0.15} direction="up">
              <GlassCard
                glowColor={tier.color}
                className="p-8 h-full flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-slate-300">
                      {tier.badge}
                    </span>
                    <span className="font-display font-extrabold text-2xl text-gold-400">
                      {tier.percentage}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2 mb-2">
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

                <div className="pt-6 mt-6 border-t border-white/5 flex items-center gap-2 text-xs text-slate-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Pool calculated from monthly entries</span>
                </div>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
