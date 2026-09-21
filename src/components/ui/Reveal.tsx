'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useDevicePerformance } from '@/hooks/useDevicePerformance';

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number;
  duration?: number;
  className?: string;
  triggerOnce?: boolean;
}

export function Reveal({
  children,
  delay = 0,
  direction = 'up',
  distance = 24,
  duration = 0.6,
  className = '',
  triggerOnce = true,
}: RevealProps) {
  const { reducedMotion } = useDevicePerformance();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const directions = {
    up: { y: distance, x: 0 },
    down: { y: -distance, x: 0 },
    left: { x: distance, y: 0 },
    right: { x: -distance, y: 0 },
    none: { x: 0, y: 0 },
  };

  const initial = {
    opacity: 0,
    ...directions[direction],
  };

  return (
    <motion.div
      initial={initial}
      whileInView={{
        opacity: 1,
        x: 0,
        y: 0,
      }}
      viewport={{ once: triggerOnce, margin: '-40px' }}
      transition={{
        duration,
        delay,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
