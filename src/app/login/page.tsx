'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { createClient } from '@/lib/supabase/client';
import { loginSchema, LoginInput } from '@/lib/validations/auth';
import { CurrencySelector } from '@/components/ui/CurrencySelector';
import { Sparkles, Mail, Lock, AlertCircle, ArrowRight, LogIn } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';
  const callbackError = searchParams.get('error');

  const [formData, setFormData] = useState<LoginInput>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(
    callbackError ? 'Authentication session failed. Please sign in again.' : null
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const result = loginSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[String(err.path[0])] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        setAuthError(error.message);
        setIsLoading(false);
        return;
      }

      if (data.session) {
        const planParam = searchParams.get('plan');
        if (planParam === 'monthly' || planParam === 'yearly') {
          try {
            const res = await fetch('/api/stripe/checkout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ plan: planParam }),
            });
            const checkoutData = await res.json();
            if (checkoutData.url) {
              window.location.href = checkoutData.url;
              return;
            }
          } catch (checkoutErr) {
            console.error('Post-login checkout error:', checkoutErr);
          }
        }
        router.push(next);
        router.refresh();
      }
    } catch {
      setAuthError('An unexpected login error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GlassCard glowColor="emerald" className="p-8 sm:p-10 max-w-md mx-auto shadow-2xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        {authError && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-3 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span>{authError}</span>
          </div>
        )}

        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="jane@example.com"
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-navy-900/80 border text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-colors ${
                errors.email ? 'border-red-500/50' : 'border-white/10'
              }`}
            />
          </div>
          {errors.email && (
            <p className="text-red-400 text-xs mt-1.5">{errors.email}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-slate-400 hover:text-emerald-400 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-navy-900/80 border text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-colors ${
                errors.password ? 'border-red-500/50' : 'border-white/10'
              }`}
            />
          </div>
          {errors.password && (
            <p className="text-red-400 text-xs mt-1.5">{errors.password}</p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          variant="glow"
          size="lg"
          isLoading={isLoading}
          className="w-full justify-center mt-2 shadow-xl"
          rightIcon={<LogIn className="w-4 h-4" />}
        >
          Sign In
        </Button>
      </form>

      {/* Redirection Link */}
      <div className="mt-8 pt-6 border-t border-white/[0.08] text-center text-xs text-slate-400">
        Don&apos;t have an account yet?{' '}
        <Link
          href="/signup"
          className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-4"
        >
          Subscribe now
        </Link>
      </div>
    </GlassCard>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-navy-950 text-white flex flex-col justify-center items-center py-20 px-4 relative overflow-hidden">
      {/* Top right currency option */}
      <div className="absolute top-6 right-6 z-20">
        <CurrencySelector size="sm" />
      </div>

      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[450px] bg-gradient-to-br from-emerald-500/10 via-gold-500/5 to-transparent blur-[120px] rounded-full"
        aria-hidden="true"
      />

      <Container size="narrow" className="relative z-10">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 mb-6 group focus:outline-none"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-md shadow-emerald-500/20">
              <div className="w-full h-full bg-navy-950 rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <span className="font-display font-bold text-xl text-white">
              Digital<span className="text-gold-400">Heroes</span>
            </span>
          </Link>

          <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-white tracking-tight mb-2">
            Welcome Back
          </h1>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            Sign in to check your active monthly draw numbers and impact contributions.
          </p>
        </div>

        <Suspense fallback={<div className="text-center text-slate-400">Loading sign in...</div>}>
          <LoginForm />
        </Suspense>
      </Container>
    </main>
  );
}
