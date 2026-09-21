'use client';

import React from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Sparkles, Heart } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  const links = [
    { label: 'How it works', href: '#how-it-works' },
    { label: 'The Draw', href: '#the-draw' },
    { label: 'Charities', href: '/charities' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Subscribe', href: '/signup' },
    { label: 'Login', href: '/login' },
  ];

  return (
    <footer className="bg-navy-950 border-t border-white/[0.08] py-14 text-slate-400 text-sm">
      <Container size="wide">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 pb-10 border-b border-white/[0.06]">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="font-display font-bold text-lg text-white">
              Digital<span className="text-gold-400">Heroes</span>
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="flex flex-wrap items-center justify-center gap-6 sm:gap-8" aria-label="Footer Links">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Responsible Play & Copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 text-center sm:text-left">
          <div className="max-w-md">
            <span className="font-semibold text-slate-400">Play responsibly.</span>{' '}
            Monthly draws are intended to support charitable causes. Participation is strictly for individuals aged 18 and over.
          </div>

          <div>
            © {currentYear} Digital Heroes. All rights reserved.
          </div>
        </div>
      </Container>
    </footer>
  );
}
