'use client';

import React from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { XCircle, ArrowLeft, Sparkles } from 'lucide-react';

export default function SubscribeCancelledPage() {
  return (
    <main className="min-h-screen bg-navy-950 text-white flex flex-col justify-center items-center py-20 px-4 relative overflow-hidden">
      {/* Background Glow */}
      <div
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] bg-slate-500/10 blur-[130px] rounded-full"
        aria-hidden="true"
      />

      <Container size="narrow" className="relative z-10">
        <GlassCard glowColor="default" className="p-8 sm:p-12 text-center border-white/10">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
            <XCircle className="w-8 h-8" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white mb-3">
            Checkout Incomplete
          </h1>

          <p className="text-sm text-slate-300 max-w-md mx-auto mb-8 leading-relaxed">
            Your card was not charged. Whenever you are ready to join our monthly draws and empower charitable causes, you can pick up where you left off.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              href="/#pricing"
              variant="glow"
              size="md"
              leftIcon={<Sparkles className="w-4 h-4" />}
            >
              View Membership Plans
            </Button>
            <Button
              href="/dashboard"
              variant="secondary"
              size="md"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Return to Dashboard
            </Button>
          </div>
        </GlassCard>
      </Container>
    </main>
  );
}
