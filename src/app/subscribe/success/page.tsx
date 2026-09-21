'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { CheckCircle2, Sparkles, Loader2, ArrowRight } from 'lucide-react';

export default function SubscribeSuccessPage() {
  const router = useRouter();
  const [isActive, setIsActive] = useState(false);
  const [plan, setPlan] = useState<string>('monthly');
  const [attempts, setAttempts] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let currentAttempts = 0;
    const maxAttempts = 15; // Poll up to ~37 seconds

    async function checkStatus() {
      try {
        currentAttempts++;
        setAttempts(currentAttempts);

        const res = await fetch('/api/stripe/status');
        if (res.ok) {
          const data = await res.json();
          if (data.isActive) {
            setIsActive(true);
            setPlan(data.plan || 'monthly');
            return;
          }
        }

        if (currentAttempts >= maxAttempts) {
          setTimedOut(true);
          return;
        }

        // Schedule next check in 2.5s
        timerRef.current = setTimeout(checkStatus, 2500);
      } catch (err) {
        console.error('Error polling subscription status:', err);
        if (currentAttempts >= maxAttempts) {
          setTimedOut(true);
        } else {
          timerRef.current = setTimeout(checkStatus, 2500);
        }
      }
    }

    checkStatus();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <main className="min-h-screen bg-navy-950 text-white flex flex-col justify-center items-center py-20 px-4 relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] bg-emerald-500/15 blur-[140px] rounded-full"
        aria-hidden="true"
      />

      <Container size="narrow" className="relative z-10">
        <GlassCard
          glowColor={isActive ? 'emerald' : 'gold'}
          className="p-8 sm:p-12 text-center border-white/10"
        >
          {isActive ? (
            <div>
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Subscription Confirmed</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-white mb-3">
                Membership Activated!
              </h1>

              <p className="text-sm text-slate-300 max-w-md mx-auto mb-8 leading-relaxed">
                Welcome to Digital Heroes! Your <span className="text-emerald-400 font-semibold capitalize">{plan}</span> subscription is live. Your contribution directly empowers verified charity causes and guarantees your entry into every monthly draw.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  href="/dashboard"
                  variant="glow"
                  size="lg"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Go to Dashboard
                </Button>
              </div>
            </div>
          ) : timedOut ? (
            <div>
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gold-500/15 border border-gold-500/30 flex items-center justify-center text-gold-400">
                <Sparkles className="w-8 h-8" />
              </div>

              <h1 className="text-2xl sm:text-3xl font-display font-bold text-white mb-3">
                Payment Received
              </h1>

              <p className="text-sm text-slate-300 max-w-md mx-auto mb-8 leading-relaxed">
                Your payment was received and our secure webhook is synchronizing your account with Stripe. You can proceed directly to your dashboard.
              </p>

              <Button
                href="/dashboard"
                variant="primary"
                size="lg"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Continue to Dashboard
              </Button>
            </div>
          ) : (
            <div>
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-white/5 border border-white/10 text-slate-300 mb-4">
                <span>Attempt {attempts} of 15</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-display font-bold text-white mb-3">
                Activating your membership...
              </h1>

              <p className="text-sm text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
                Awaiting secure webhook confirmation from Stripe. This normally takes just a few seconds.
              </p>

              <div className="w-48 h-1.5 bg-white/10 rounded-full mx-auto overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 animate-pulse w-3/4 rounded-full" />
              </div>
            </div>
          )}
        </GlassCard>
      </Container>
    </main>
  );
}
