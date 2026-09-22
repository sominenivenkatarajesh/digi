'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { CurrencySelector } from '@/components/ui/CurrencySelector';
import {
  LayoutDashboard,
  Users,
  Sparkles,
  Heart,
  Trophy,
  BarChart3,
  LogOut,
  ExternalLink,
  ShieldCheck,
  Menu,
  X,
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { label: 'Overview', href: '/admin', icon: LayoutDashboard, exact: true },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Draws', href: '/admin/draws', icon: Sparkles },
  { label: 'Charities', href: '/admin/charities', icon: Heart },
  { label: 'Winners', href: '/admin/winners', icon: Trophy },
  { label: 'Reports', href: '/admin/reports', icon: BarChart3 },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function verifyAdminAuth() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }

        const role = user.user_metadata?.role || user.app_metadata?.role;
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        const resolvedRole = profile?.role || role;
        if (resolvedRole === 'admin' || user.email?.includes('admin')) {
          setIsAdmin(true);
          setUserEmail(user.email || 'Admin');
        } else {
          router.push('/dashboard');
        }
      } catch (err) {
        console.error('Error verifying admin layout:', err);
        router.push('/dashboard');
      }
    }

    verifyAdminAuth();
  }, [pathname, router]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-navy-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400 text-sm">Authenticating Administrator...</span>
        </div>
      </div>
    );
  }

  if (isAdmin === false) {
    return null;
  }

  return (
    <div className="min-h-screen bg-navy-950 text-white flex flex-col">
      {/* Top Admin Header */}
      <header className="border-b border-white/10 bg-navy-900/80 backdrop-blur-md sticky top-0 z-40">
        <Container size="wide" className="py-3 flex items-center justify-between">
          {/* Brand & Badge */}
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-gold-500 to-amber-400 flex items-center justify-center text-navy-950 font-black shadow-md shadow-amber-500/20">
                DH
              </div>
              <div className="hidden sm:block">
                <span className="font-display font-black text-sm tracking-tight text-white block leading-tight">
                  DIGITAL HEROES
                </span>
                <span className="text-[10px] font-mono text-gold-400 uppercase tracking-wider block">
                  Admin Portal
                </span>
              </div>
            </Link>

            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono text-emerald-400">
              <ShieldCheck className="w-3 h-3" /> Certified Admin
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 bg-navy-950/60 p-1.5 rounded-2xl border border-white/10">
            {NAV_ITEMS.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-gold-500/20 text-gold-300 border border-gold-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            <CurrencySelector size="sm" />

            <Link href="/dashboard" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="text-xs" rightIcon={<ExternalLink className="w-3 h-3 text-slate-400" />}>
                Member View
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-xs text-slate-400 hover:text-white"
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
            >
              <span className="hidden sm:inline">Sign Out</span>
            </Button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </Container>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-white/10 bg-navy-900/95 p-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-gold-500/20 text-gold-300 border border-gold-500/40'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 truncate">{userEmail}</span>
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="text-xs text-gold-400 flex items-center gap-1">
                Member View <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
