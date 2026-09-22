'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { createClient } from '@/lib/supabase/client';
import { signupSchema, SignupInput } from '@/lib/validations/auth';
import { CurrencySelector } from '@/components/ui/CurrencySelector';
import { useCurrency } from '@/components/providers/CurrencyProvider';
import {
  Sparkles,
  Heart,
  Mail,
  Lock,
  User,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

interface CharityOption {
  id: string;
  name: string;
  tagline: string;
}

const fallbackCharities: CharityOption[] = [
  {
    id: 'f87a8b42-1e9a-4c28-98e3-0c4a6db2b901',
    name: "Hope Horizons Children's Foundation",
    tagline: 'Transforming pediatric healthcare & critical care access',
  },
  {
    id: 'a12b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
    name: 'Clean Oceans Global',
    tagline: 'Restoring marine ecosystems through plastic recovery',
  },
  {
    id: 'c98d7e6f-5a4b-3c2d-1e0f-9a8b7c6d5e4f',
    name: 'Emergency Shelter Coalition',
    tagline: 'Rapid crisis relief and sustainable housing',
  },
];

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { format: formatPrice } = useCurrency();
  const planParam = searchParams.get('plan') === 'yearly' ? 'yearly' : 'monthly';
  const charityParam = searchParams.get('charity');

  const [charities, setCharities] = useState<CharityOption[]>(fallbackCharities);
  const [formData, setFormData] = useState<SignupInput>({
    fullName: '',
    email: '',
    password: '',
    charityId: fallbackCharities[0].id,
    charityPercent: 10,
    planType: planParam,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    async function loadCharities() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('charities')
          .select('id, name, tagline, slug')
          .eq('is_active', true);

        if (!error && data && data.length > 0) {
          setCharities(data);
          // Check if charityParam matches slug or id
          const matched = charityParam
            ? data.find((c: any) => c.id === charityParam || c.slug === charityParam)
            : null;
          setFormData((prev) => ({
            ...prev,
            charityId: matched ? matched.id : data[0].id,
          }));
        }
      } catch {
        // Fallbacks remain in place
      }
    }
    loadCharities();
  }, [charityParam]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field error on change
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    // 1. Validate with Zod
    const result = signupSchema.safeParse(formData);
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
      // Only pass charity_id if it corresponds to an actual loaded database charity
      const isValidDbCharity = charities.some(
        (c) => c.id === formData.charityId && !c.id.startsWith('f87a8b') && !c.id.startsWith('a12b3c') && !c.id.startsWith('c98d7e')
      );

      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            ...(isValidDbCharity && formData.charityId ? { charity_id: formData.charityId } : {}),
            charity_percent: formData.charityPercent || 10,
            plan_type: formData.planType,
            role: 'subscriber',
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });

      if (error) {
        setAuthError(error.message);
        setIsLoading(false);
        return;
      }

      if (data.user && !data.session) {
        // Confirmation email required
        setIsSuccess(true);
      } else if (data.session) {
        // Automatically signed in: continue straight to checkout
        try {
          const res = await fetch('/api/stripe/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: formData.planType }),
          });
          const checkoutData = await res.json();
          if (checkoutData.url) {
            window.location.href = checkoutData.url;
            return;
          }
        } catch (checkoutErr) {
          console.error('Post-signup checkout redirect failed:', checkoutErr);
        }
        router.push('/dashboard');
      }
    } catch {
      setAuthError('An unexpected error occurred during signup. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-navy-950 text-white flex flex-col justify-center items-center py-20 px-4 relative overflow-hidden">
      {/* Top right currency option */}
      <div className="absolute top-6 right-6 z-20">
        <CurrencySelector size="sm" />
      </div>

      {/* Background Glows */}
      <div
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-br from-emerald-500/15 via-gold-500/10 to-transparent blur-[140px] rounded-full"
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

          <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-white tracking-tight mb-3">
            Join the Monthly Giving Circle
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Fund verified humanitarian causes, receive guaranteed monthly draw entries, and win life-changing cash prizes.
          </p>
        </div>

        <GlassCard glowColor="emerald" className="p-8 sm:p-10 max-w-lg mx-auto shadow-2xl">
          {isSuccess ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-display font-bold text-white mb-2">
                Check Your Email
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed mb-6">
                We sent a confirmation link to{' '}
                <span className="text-white font-medium">{formData.email}</span>. Click the link in your email to activate your Digital Heroes membership.
              </p>
              <Button href="/login" variant="secondary" className="w-full">
                Go to Sign In
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {authError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-3 text-red-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <span>{authError}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="Jane Doe"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-navy-900/80 border text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-colors ${
                      errors.fullName ? 'border-red-500/50' : 'border-white/10'
                    }`}
                  />
                </div>
                {errors.fullName && (
                  <p className="text-red-400 text-xs mt-1.5">{errors.fullName}</p>
                )}
              </div>

              {/* Email Address */}
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
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Password
                </label>
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
                {errors.password ? (
                  <p className="text-red-400 text-xs mt-1.5">{errors.password}</p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Min 8 chars, with at least 1 uppercase, 1 lowercase & 1 number
                  </p>
                )}
              </div>

              {/* Charity Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Choose Charity to Support
                </label>
                <div className="relative">
                  <Heart className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400" />
                  <select
                    name="charityId"
                    value={formData.charityId}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-navy-900/90 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
                  >
                    {charities.map((ch) => (
                      <option key={ch.id} value={ch.id} className="bg-navy-900 text-white">
                        {ch.name}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.charityId && (
                  <p className="text-red-400 text-xs mt-1.5">{errors.charityId}</p>
                )}

                {/* Contribution Percentage Slider */}
                <div className="mt-4 p-3.5 rounded-xl bg-navy-950/60 border border-white/10">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-300">
                      Charity Contribution:
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {formData.charityPercent || 10}% of fee
                    </span>
                  </div>
                  <input
                    type="range"
                    name="charityPercent"
                    min="10"
                    max="100"
                    step="5"
                    value={formData.charityPercent || 10}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        charityPercent: parseInt(e.target.value, 10),
                      }))
                    }
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                    <span>Min 10%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    {formData.planType === 'yearly'
                      ? `£${(((formData.charityPercent || 10) / 100) * 99).toFixed(2)} / year directly allocated to your charity.`
                      : `£${(((formData.charityPercent || 10) / 100) * 10).toFixed(2)} / month directly allocated to your charity.`}
                  </p>
                </div>
              </div>

              {/* Membership Plan Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Membership Plan
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, planType: 'monthly' }))}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      formData.planType === 'monthly'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-white shadow-sm'
                        : 'bg-navy-900/40 border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-bold">Monthly</div>
                    <div className="text-sm font-extrabold text-white mt-0.5">{formatPrice(10)} / mo</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, planType: 'yearly' }))}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      formData.planType === 'yearly'
                        ? 'bg-gold-500/10 border-gold-400/40 text-white shadow-sm'
                        : 'bg-navy-900/40 border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Annual</span>
                      <span className="text-[9px] uppercase font-extrabold bg-gold-400 text-navy-950 px-1.5 py-0.2 rounded-full">
                        Best Value
                      </span>
                    </div>
                    <div className="text-sm font-extrabold text-white mt-0.5">{formatPrice(99)} / yr</div>
                  </button>
                </div>
              </div>

              {/* Submit CTA Button */}
              <Button
                type="submit"
                variant="glow"
                size="lg"
                isLoading={isLoading}
                className="w-full justify-center mt-2 shadow-xl"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Create Account & Subscribe
              </Button>

              <div className="flex items-center justify-center gap-2 pt-2 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Cancel anytime. Fully verified and transparent.</span>
              </div>
            </form>
          )}

          {/* Login Redirection Link */}
          <div className="mt-8 pt-6 border-t border-white/[0.08] text-center text-xs text-slate-400">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-4"
            >
              Sign in here
            </Link>
          </div>
        </GlassCard>
      </Container>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-navy-950 text-white flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </main>
      }
    >
      <SignupForm />
    </Suspense>
  );
}

