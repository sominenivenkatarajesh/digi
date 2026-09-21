import React from 'react';
import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  badge?: string;
  badgeVariant?: 'emerald' | 'gold' | 'default';
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: 'center' | 'left';
  className?: string;
}

export function SectionHeading({
  badge,
  badgeVariant = 'emerald',
  title,
  subtitle,
  align = 'center',
  className,
}: SectionHeadingProps) {
  const badgeStyles = {
    emerald:
      'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 shadow-emerald-500/10',
    gold: 'bg-gold-500/10 text-gold-400 border-gold-500/25 shadow-gold-500/10',
    default: 'bg-white/5 text-slate-300 border-white/10 shadow-white/5',
  };

  const badgeDot = {
    emerald: 'bg-emerald-400',
    gold: 'bg-gold-400',
    default: 'bg-slate-400',
  };

  return (
    <div
      className={cn(
        'max-w-3xl mb-12 sm:mb-16',
        align === 'center' ? 'mx-auto text-center' : 'text-left',
        className
      )}
    >
      {badge && (
        <div
          className={cn(
            'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase border mb-4 shadow-sm backdrop-blur-md',
            badgeStyles[badgeVariant]
          )}
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full animate-pulse',
              badgeDot[badgeVariant]
            )}
            aria-hidden="true"
          />
          {badge}
        </div>
      )}

      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold tracking-tight text-white leading-[1.15]">
        {title}
      </h2>

      {subtitle && (
        <p className="mt-4 sm:mt-5 text-base sm:text-lg text-slate-400 font-light leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
