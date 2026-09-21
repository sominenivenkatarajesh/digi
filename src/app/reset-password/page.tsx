'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { createClient } from '@/lib/supabase/client';
import { resetPasswordSchema } from '@/lib/validations/auth';
import { Sparkles, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      setError(result.error.issues[0]?.message || 'Invalid password');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
      } else {
        setIsSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 2500);
      }
    } catch {
      setError('Failed to update password. Please ensure your recovery link is valid.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-navy-950 text-white flex flex-col justify-center items-center py-20 px-4 relative overflow-hidden">
      <div
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] bg-gold-500/10 blur-[120px] rounded-full"
        aria-hidden="true"
      />

      <Container size="narrow" className="relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 group focus:outline-none">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5">
              <div className="w-full h-full bg-navy-950 rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <span className="font-display font-bold text-xl text-white">
              Digital<span className="text-gold-400">Heroes</span>
            </span>
          </Link>

          <h1 className="text-3xl font-display font-extrabold text-white tracking-tight mb-2">
            Create New Password
          </h1>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            Please establish a secure replacement password for your member profile.
          </p>
        </div>

        <GlassCard glowColor="gold" className="p-8 sm:p-10 max-w-md mx-auto shadow-2xl">
          {isSuccess ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-xl font-display font-bold text-white mb-2">
                Password Successfully Updated
              </h2>
              <p className="text-xs text-slate-300 mb-6">
                Your credentials have been securely refreshed. Redirecting you to sign in...
              </p>
              <Button href="/login" variant="glow" className="w-full">
                Sign In Now
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-3 text-red-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-navy-900/80 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gold-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-navy-900/80 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gold-400"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="glow"
                size="lg"
                isLoading={isLoading}
                className="w-full justify-center"
              >
                Save New Password
              </Button>
            </form>
          )}
        </GlassCard>
      </Container>
    </main>
  );
}
