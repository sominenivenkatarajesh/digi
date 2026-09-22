'use client';

import React, { useEffect } from 'react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Router Uncaught Error:', error);
  }, [error]);

  return (
    <main className="min-h-screen bg-navy-950 text-white flex items-center justify-center p-4">
      <Container className="max-w-md">
        <GlassCard glowColor="default" className="p-8 text-center border-rose-500/20 bg-rose-950/20">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center mb-5">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <h2 className="text-2xl font-display font-bold text-white mb-2">
            Something went wrong
          </h2>

          <p className="text-xs text-slate-300 leading-relaxed mb-6">
            We encountered an unexpected error loading this page. You can try refreshing or returning to safety.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="glow"
              size="sm"
              onClick={() => reset()}
              leftIcon={<RotateCcw className="w-4 h-4" />}
              className="w-full sm:w-auto justify-center"
            >
              Try Again
            </Button>
            <Button
              href="/"
              variant="secondary"
              size="sm"
              leftIcon={<Home className="w-4 h-4" />}
              className="w-full sm:w-auto justify-center"
            >
              Return Home
            </Button>
          </div>
        </GlassCard>
      </Container>
    </main>
  );
}
