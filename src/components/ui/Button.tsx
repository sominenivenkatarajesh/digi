'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline-gold' | 'ghost' | 'glow';
  size?: 'sm' | 'md' | 'lg';
  href?: string;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  ButtonProps
>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      href,
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'group relative inline-flex items-center justify-center font-medium transition-all duration-300 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950 disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer overflow-hidden';

    const sizeStyles = {
      sm: 'text-xs px-3.5 py-2 gap-1.5',
      md: 'text-sm px-5 py-2.5 gap-2',
      lg: 'text-base px-7 py-3.5 gap-2.5 font-semibold',
    };

    const variantStyles = {
      primary:
        'bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/25 hover:shadow-emerald-500/40 hover:brightness-110 active:scale-[0.98]',
      glow:
        'bg-gradient-to-r from-gold-400 via-amber-500 to-yellow-500 text-navy-950 font-bold shadow-[0_0_25px_rgba(245,158,11,0.35)] hover:shadow-[0_0_35px_rgba(245,158,11,0.6)] hover:brightness-105 active:scale-[0.98]',
      secondary:
        'bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/10 hover:border-white/20 backdrop-blur-md shadow-sm active:scale-[0.98]',
      'outline-gold':
        'border border-gold-400/40 hover:border-gold-400/80 text-gold-300 hover:text-gold-200 bg-gold-500/5 hover:bg-gold-500/15 backdrop-blur-sm shadow-sm active:scale-[0.98]',
      ghost:
        'text-slate-300 hover:text-white hover:bg-white/[0.06] active:scale-[0.98]',
    };

    const content = (
      <>
        {/* Subtle sheen highlight animation on hover */}
        <span
          className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 ease-in-out group-hover:translate-x-full pointer-events-none"
          aria-hidden="true"
        />
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && (
          <span className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5">
            {rightIcon}
          </span>
        )}
      </>
    );

    const combinedClassName = cn(
      baseStyles,
      sizeStyles[size],
      variantStyles[variant],
      className
    );

    if (href) {
      return (
        <Link
          href={href}
          className={combinedClassName}
          ref={ref as React.ForwardedRef<HTMLAnchorElement>}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        className={combinedClassName}
        disabled={disabled || isLoading}
        ref={ref as React.ForwardedRef<HTMLButtonElement>}
        {...props}
      >
        {content}
      </button>
    );
  }
);

Button.displayName = 'Button';
