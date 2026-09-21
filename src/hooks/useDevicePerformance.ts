'use client';

import { useState, useEffect } from 'react';

export interface DevicePerformance {
  isMobile: boolean;
  isLowPower: boolean;
  reducedMotion: boolean;
  tier: 'low' | 'medium' | 'high';
  dpr: number;
  particleCount: number;
  enablePostProcessing: boolean;
}

export function useDevicePerformance(): DevicePerformance {
  const [perf, setPerf] = useState<DevicePerformance>({
    isMobile: false,
    isLowPower: false,
    reducedMotion: false,
    tier: 'high',
    dpr: 1.5,
    particleCount: 80,
    enablePostProcessing: true,
  });

  useEffect(() => {
    // 1. Check reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reducedMotion = motionQuery.matches;

    // 2. Check mobile viewport / touch
    const isMobile =
      window.innerWidth < 768 ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

    // 3. Hardware concurrency & device memory
    const concurrency = navigator.hardwareConcurrency || 4;
    const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 8;
    const isLowPower = concurrency <= 4 || memory <= 4;

    let tier: 'low' | 'medium' | 'high' = 'high';
    let dpr = 2;
    let particleCount = 80;
    let enablePostProcessing = true;

    if (reducedMotion || isLowPower || isMobile) {
      if (isLowPower && isMobile) {
        tier = 'low';
        dpr = 1;
        particleCount = 25;
        enablePostProcessing = false;
      } else {
        tier = 'medium';
        dpr = 1.25;
        particleCount = 45;
        enablePostProcessing = false;
      }
    } else {
      tier = 'high';
      dpr = Math.min(window.devicePixelRatio || 1.5, 2);
      particleCount = 90;
      enablePostProcessing = true;
    }

    setPerf({
      isMobile,
      isLowPower,
      reducedMotion,
      tier,
      dpr,
      particleCount,
      enablePostProcessing,
    });

    const handleMotionChange = (e: MediaQueryListEvent) => {
      setPerf((prev) => ({
        ...prev,
        reducedMotion: e.matches,
        enablePostProcessing: !e.matches && prev.tier === 'high',
      }));
    };

    motionQuery.addEventListener('change', handleMotionChange);
    return () => motionQuery.removeEventListener('change', handleMotionChange);
  }, []);

  return perf;
}
