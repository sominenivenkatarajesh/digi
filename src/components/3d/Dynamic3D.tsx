'use client';

import dynamic from 'next/dynamic';
import { ScenePlaceholder } from './ScenePlaceholder';

export const DynamicHeroScene = dynamic(
  () => import('./HeroScene').then((mod) => mod.HeroScene),
  {
    ssr: false,
    loading: () => <ScenePlaceholder variant="hero" height="h-[420px] lg:h-[560px]" />,
  }
);

export const DynamicDrawBalls = dynamic(
  () => import('./DrawBalls').then((mod) => mod.DrawBalls),
  {
    ssr: false,
    loading: () => <ScenePlaceholder variant="balls" height="h-[180px] sm:h-[210px]" />,
  }
);

export const DynamicImpactGlobe = dynamic(
  () => import('./ImpactGlobe').then((mod) => mod.ImpactGlobe),
  {
    ssr: false,
    loading: () => <ScenePlaceholder variant="globe" height="h-[220px] sm:h-[260px]" />,
  }
);
