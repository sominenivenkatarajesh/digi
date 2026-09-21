'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { createClient } from '@/lib/supabase/client';
import {
  ShieldAlert,
  Sparkles,
  Settings,
  Heart,
  Save,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Users,
} from 'lucide-react';

interface CharityItem {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
  is_featured: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [charities, setCharities] = useState<CharityItem[]>([]);
  const [monthlyPrice, setMonthlyPrice] = useState(10);
  const [yearlyPrice, setYearlyPrice] = useState(99);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    async function verifyAdmin() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login?next=/admin');
          return;
        }

        const role = user.user_metadata?.role || user.app_metadata?.role;
        // In local development/initial setup, allow admin if role is admin or user email contains admin
        if (role === 'admin' || user.email?.includes('admin')) {
          setIsAdmin(true);
        } else {
          router.push('/dashboard');
          return;
        }

        // Load platform settings
        const { data: settingsData } = await supabase
          .from('platform_settings')
          .select('*')
          .maybeSingle();

        if (settingsData) {
          setMonthlyPrice(Number(settingsData.monthly_price || 10));
          setYearlyPrice(Number(settingsData.yearly_price || 99));
        }

        // Load charities
        const { data: charityList } = await supabase
          .from('charities')
          .select('id, name, category, is_active, is_featured');

        if (charityList) {
          setCharities(charityList);
        }
      } catch (err) {
        console.error('Admin loading error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    verifyAdmin();
  }, [router]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('platform_settings')
        .upsert(
          {
            monthly_price: Number(monthlyPrice),
            yearly_price: Number(yearlyPrice),
            currency: '£',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (error) {
        setSaveError(error.message);
      } else {
        setSaveSuccess(true);
      }
    } catch {
      setSaveError('Failed to save settings. Please try again.');
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-navy-950 text-white flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <main className="min-h-screen bg-navy-950 text-white pb-24 relative overflow-hidden">
      {/* Header */}
      <header className="border-b border-white/[0.08] bg-navy-900/50 backdrop-blur-xl sticky top-0 z-40">
        <Container size="wide" className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold-500/10 border border-gold-500/25 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-gold-400" />
            </div>
            <span className="font-display font-bold text-lg text-white">
              DigitalHeroes <span className="text-gold-400">Admin Control</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/admin/draws">
              <Button variant="primary" size="sm" leftIcon={<Sparkles className="w-3.5 h-3.5" />}>
                Draw Engine
              </Button>
            </Link>
            <Button href="/dashboard" variant="secondary" size="sm">
              Member Dashboard
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
            >
              Sign Out
            </Button>
          </div>
        </Container>
      </header>

      <Container size="wide" className="pt-10 relative z-10">
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-extrabold text-white">
              Platform Administration
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Configure monthly draw parameters, subscription pricing, and verified charities.
            </p>
          </div>
          <Link href="/admin/draws">
            <Button variant="primary" leftIcon={<Sparkles className="w-4 h-4 text-gold-400" />}>
              Open Draw Engine & Simulations →
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Platform Pricing Settings */}
          <div className="lg:col-span-6">
            <GlassCard glowColor="gold" className="p-8">
              <div className="flex items-center gap-2 mb-6">
                <Settings className="w-5 h-5 text-gold-400" />
                <h2 className="text-xl font-display font-bold text-white">
                  Subscription Pricing
                </h2>
              </div>

              {saveSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Platform settings saved successfully!</span>
                </div>
              )}

              {saveError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4" />
                  <span>{saveError}</span>
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Monthly Subscription Price (£)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={monthlyPrice}
                    onChange={(e) => setMonthlyPrice(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-navy-900/90 border border-white/10 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Annual Subscription Price (£)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={yearlyPrice}
                    onChange={(e) => setYearlyPrice(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-navy-900/90 border border-white/10 text-white font-mono"
                  />
                </div>

                <Button
                  type="submit"
                  variant="glow"
                  size="md"
                  className="w-full justify-center mt-2"
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  Update Platform Pricing
                </Button>
              </form>
            </GlassCard>
          </div>

          {/* Charity Management */}
          <div className="lg:col-span-6">
            <GlassCard glowColor="emerald" className="p-8">
              <div className="flex items-center gap-2 mb-6">
                <Heart className="w-5 h-5 text-emerald-400" />
                <h2 className="text-xl font-display font-bold text-white">
                  Verified Charities ({charities.length})
                </h2>
              </div>

              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {charities.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No custom charities loaded yet. Seed data active in database.
                  </p>
                ) : (
                  charities.map((ch) => (
                    <div
                      key={ch.id}
                      className="p-3.5 rounded-xl bg-navy-900/70 border border-white/5 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {ch.name}
                        </div>
                        <div className="text-xs text-slate-400">
                          {ch.category} {ch.is_featured && '• Featured Spotlight'}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          ch.is_active
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {ch.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </div>
        </div>
      </Container>
    </main>
  );
}
