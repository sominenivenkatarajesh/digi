'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useDevicePerformance } from '@/hooks/useDevicePerformance';

interface AnimatedCounterProps {
  value: number | null | undefined;
  prefix?: string;
  suffix?: string;
  duration?: number; // ms
  zeroStateText?: string;
  className?: string;
}

export function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  duration = 1500,
  zeroStateText = 'Be the first to join',
  className = '',
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const elementRef = useRef<HTMLSpanElement>(null);
  const { reducedMotion } = useDevicePerformance();

  const isZero = value === 0 || value === null || value === undefined;

  useEffect(() => {
    if (isZero || hasAnimated) return;

    const target = value;

    if (reducedMotion) {
      setDisplayValue(target);
      setHasAnimated(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let startTimestamp: number | null = null;

          const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            // Ease-out cubic
            const easeOutProgress = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(easeOutProgress * target);
            setDisplayValue(current);

            if (progress < 1) {
              window.requestAnimationFrame(step);
            } else {
              setDisplayValue(target);
              setHasAnimated(true);
            }
          };

          window.requestAnimationFrame(step);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, [value, duration, reducedMotion, hasAnimated, isZero]);

  if (isZero) {
    return (
      <span ref={elementRef} className={className}>
        {zeroStateText}
      </span>
    );
  }

  return (
    <span ref={elementRef} className={className}>
      {prefix}
      {displayValue.toLocaleString()}
      {suffix}
    </span>
  );
}
