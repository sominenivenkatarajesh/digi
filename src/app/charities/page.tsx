import React from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Heart, ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Charities | Digital Heroes',
  description: 'Browse all verified charitable causes funded by Digital Heroes subscribers.',
};

export default function CharitiesPage() {
  return (
    <main className="min-h-screen bg-navy-950 text-white flex flex-col justify-center items-center py-24 px-4 relative overflow-hidden">
      <div className="absolute w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="absolute w-80 h-80 rounded-full bg-gold-400/10 blur-3xl pointer-events-none" />

      <Container size="narrow" className="relative z-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/10">
          <Heart className="w-8 h-8 text-emerald-400" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-white mb-4">
          Verified Charity Directory
        </h1>
        <p className="text-slate-400 max-w-lg mx-auto mb-8 leading-relaxed">
          Every month, 100% of the platform charitable fund is distributed to vetted humanitarian, healthcare, and community organisations.
        </p>

        <GlassCard className="p-8 max-w-md mx-auto mb-8 text-center" glowColor="emerald">
          <div className="text-sm font-semibold uppercase tracking-wider text-emerald-400 mb-2">
            Full Directory Coming Soon
          </div>
          <p className="text-xs text-slate-400">
            Our comprehensive searchable charity catalog with transparent impact statements is being prepared for the upcoming monthly draw.
          </p>
        </GlassCard>

        <Button href="/" variant="secondary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Back to Homepage
        </Button>
      </Container>
    </main>
  );
}
