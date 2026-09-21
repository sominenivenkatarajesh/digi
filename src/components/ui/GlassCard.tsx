'use client';

import React, { useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useDevicePerformance } from '@/hooks/useDevicePerformance';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glowColor?: 'emerald' | 'gold' | 'default';
  enableTilt?: boolean;
  enableSpotlight?: boolean;
}

export function GlassCard({
  children,
  className,
  glowColor = 'default',
  enableTilt = true,
  enableSpotlight = true,
  ...props
}: GlassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, opacity: 0 });
  const [tiltStyle, setTiltStyle] = useState<React.CSSProperties>({});
  const { reducedMotion, isMobile } = useDevicePerformance();

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current || reducedMotion || isMobile) return;

      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (enableSpotlight) {
        setMousePos({ x, y, opacity: 1 });
      }

      if (enableTilt) {
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -6; // max 6 deg
        const rotateY = ((x - centerX) / centerX) * 6; // max 6 deg

        setTiltStyle({
          transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`,
          transition: 'transform 0.1s ease-out',
        });
      }
    },
    [reducedMotion, isMobile, enableSpotlight, enableTilt]
  );

  const handleMouseLeave = useCallback(() => {
    setMousePos((prev) => ({ ...prev, opacity: 0 }));
    if (enableTilt) {
      setTiltStyle({
        transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)',
        transition: 'transform 0.5s ease-out',
      });
    }
  }, [enableTilt]);

  const spotlightGradients = {
    default: 'radial-gradient(400px circle at var(--mouse-x) var(--mouse-y), rgba(255,255,255,0.06), transparent 80%)',
    emerald: 'radial-gradient(450px circle at var(--mouse-x) var(--mouse-y), rgba(16,185,129,0.12), transparent 80%)',
    gold: 'radial-gradient(450px circle at var(--mouse-x) var(--mouse-y), rgba(245,158,11,0.12), transparent 80%)',
  };

  const borderAccents = {
    default: 'border-white/10 hover:border-white/20',
    emerald: 'border-emerald-500/20 hover:border-emerald-500/40',
    gold: 'border-gold-400/20 hover:border-gold-400/50',
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        ...tiltStyle,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--mouse-x' as any]: `${mousePos.x}px`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--mouse-y' as any]: `${mousePos.y}px`,
      }}
      className={cn(
        'group relative overflow-hidden rounded-2xl bg-navy-900/50 backdrop-blur-xl border transition-colors duration-300 shadow-xl shadow-black/40',
        borderAccents[glowColor],
        className
      )}
      {...props}
    >
      {/* Radial Spotlight on Mouse Hover */}
      {enableSpotlight && !reducedMotion && !isMobile && (
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300"
          style={{
            opacity: mousePos.opacity,
            background: spotlightGradients[glowColor],
          }}
          aria-hidden="true"
        />
      )}

      {/* Glass interior highlight */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent"
        aria-hidden="true"
      />

      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
