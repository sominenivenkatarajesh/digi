import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Trophy, ArrowLeft, Home, HelpCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-navy-950 text-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />

      <Container className="relative z-10 max-w-xl">
        <GlassCard glowColor="emerald" className="p-8 sm:p-12 text-center border-white/15">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
            <Trophy className="w-8 h-8 opacity-80" />
          </div>

          <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            404 Error • Out of Bounds
          </span>

          <h1 className="text-3xl sm:text-4xl font-display font-black text-white mt-4 mb-3 tracking-tight">
            Page Not Found
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed mb-8 max-w-md mx-auto">
            The fairway you&apos;re looking for has moved or doesn&apos;t exist. Let&apos;s get you back on course to play, win, and give.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              href="/"
              variant="glow"
              size="md"
              leftIcon={<Home className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Return Home
            </Button>
            <Button
              href="/dashboard"
              variant="secondary"
              size="md"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Go to Dashboard
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-center gap-2 text-xs text-slate-400">
            <HelpCircle className="w-4 h-4 text-slate-400" />
            <span>Need assistance? <Link href="/#faq" className="text-emerald-400 hover:underline">Read the FAQ</Link></span>
          </div>
        </GlassCard>
      </Container>
    </main>
  );
}
