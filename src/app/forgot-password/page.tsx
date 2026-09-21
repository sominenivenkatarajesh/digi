'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { createClient } from '@/lib/supabase/client';
import { forgotPasswordSchema } from '@/lib/validations/auth';
import { Sparkles, Mail, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0]?.message || 'Invalid email');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        }
      );

      if (resetError) {
        setError(resetError.message);
      } else {
        setIsSuccess(true);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-navy-950 text-white flex flex-col justify-center items-center py-20 px-4 relative overflow-hidden">
      <div
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] bg-emerald-500/10 blur-[120px] rounded-full"
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
            Reset Your Password
          </h1>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            Enter your account email to receive a secure password recovery link.
          </p>
        </div>

        <GlassCard glowColor="emerald" className="p-8 sm:p-10 max-w-md mx-auto shadow-2xl">
          {isSuccess ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-xl font-display font-bold text-white mb-2">
                Recovery Link Dispatched
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed mb-6">
                If an account exists for <span className="text-white font-medium">{email}</span>, you will receive password reset instructions shortly.
              </p>
              <Button href="/login" variant="secondary" className="w-full">
                Back to Sign In
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
                  Account Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@example.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-navy-900/80 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
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
                Send Reset Link
              </Button>

              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </GlassCard>
      </Container>
    </main>
  );
}
