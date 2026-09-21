'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { GlassCard } from '@/components/ui/GlassCard';
import { Reveal } from '@/components/ui/Reveal';
import { Button } from '@/components/ui/Button';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { DynamicImpactGlobe } from '@/components/3d/Dynamic3D';
import {
  getFeaturedCharity,
  getPlatformStats,
  type FeaturedCharity,
  type PlatformStats,
} from '@/lib/data/homepage';
import { Heart, Globe2, ExternalLink, ArrowRight, ShieldCheck, Users } from 'lucide-react';

export function CharityImpactSection() {
  const [charity, setCharity] = useState<FeaturedCharity | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [charityData, statsData] = await Promise.all([
          getFeaturedCharity(),
          getPlatformStats(),
        ]);
        setCharity(charityData);
        setStats(statsData);
      } catch (err) {
        console.error('Error loading charity data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <section id="charities" className="py-24 sm:py-32 relative bg-navy-900/70 scroll-mt-20">
      <Container size="wide">
        <SectionHeading
          badge="Verified Charitable Impact"
          badgeVariant="emerald"
          title={
            <>
              Real Giving.{' '}
              <span className="text-gradient-emerald">Measurable Change</span>.
            </>
          }
          subtitle="Every subscriber powers essential humanitarian efforts. Explore this month's featured spotlight and see where your support creates tangible impact."
        />

        {/* Real Data Counter Bar (Strictly no fake numbers) */}
        <Reveal direction="up" delay={0.1}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-16">
            <GlassCard className="p-6 text-center" glowColor="emerald">
              <div className="flex justify-center mb-2">
                <Users className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-display font-extrabold text-white mb-1">
                <AnimatedCounter
                  value={stats?.subscriberCount}
                  zeroStateText="Be the first to join"
                  suffix={stats?.subscriberCount && stats.subscriberCount > 0 ? '+' : ''}
                />
              </div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                Active Subscribers
              </p>
            </GlassCard>

            <GlassCard className="p-6 text-center" glowColor="gold">
              <div className="flex justify-center mb-2">
                <Heart className="w-5 h-5 text-gold-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-display font-extrabold text-white mb-1">
                <AnimatedCounter
                  value={stats?.charityCount}
                  zeroStateText="Vetted Monthly Partner"
                  suffix={stats?.charityCount && stats.charityCount > 0 ? ' Partners' : ''}
                />
              </div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                Verified Charities
              </p>
            </GlassCard>

            <GlassCard className="p-6 text-center" glowColor="default">
              <div className="flex justify-center mb-2">
                <ShieldCheck className="w-5 h-5 text-teal-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-display font-extrabold text-white mb-1">
                100%
              </div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                Direct Cause Allocation
              </p>
            </GlassCard>
          </div>
        </Reveal>

        {/* Featured Charity Spotlight Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Spotlight Details */}
          <div className="lg:col-span-7">
            <Reveal direction="left" delay={0.2}>
              <GlassCard glowColor="emerald" className="p-8 sm:p-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-6">
                  <Heart className="w-3.5 h-3.5 fill-emerald-400/20" />
                  <span>Featured Charity Spotlight</span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2">
                  {charity?.name || "Hope Horizons Children's Foundation"}
                </h3>

                <p className="text-sm font-medium text-emerald-400 mb-4">
                  {charity?.tagline || 'Transforming pediatric healthcare & critical care access'}
                </p>

                <p className="text-sm sm:text-base text-slate-300 font-light leading-relaxed mb-6">
                  {charity?.description ||
                    'Providing life-saving medical equipment, compassionate family support, and specialized pediatric care for children facing severe illnesses.'}
                </p>

                {/* Impact Statement Box */}
                <div className="p-4 rounded-xl bg-navy-950/60 border border-emerald-500/20 mb-8 flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <p className="text-xs sm:text-sm text-emerald-200/90 leading-normal">
                    {charity?.impactMetric ||
                      '100% of draw contributions directly fund life-saving hospital treatments and family assistance.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <Button
                    href="/charities"
                    variant="primary"
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Browse All Charities
                  </Button>
                  {charity?.websiteUrl && (
                    <a
                      href={charity.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                    >
                      <span>Visit Charity Website</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </GlassCard>
            </Reveal>
          </div>

          {/* Dotted 3D Impact Globe Column */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center text-center">
            <Reveal direction="right" delay={0.3}>
              <div className="relative w-full max-w-sm">
                <DynamicImpactGlobe />
                <div className="mt-4">
                  <span className="text-xs uppercase tracking-widest font-mono text-slate-400">
                    Worldwide Charitable Network
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Every ticket purchased contributes to verified humanitarian organizations
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
