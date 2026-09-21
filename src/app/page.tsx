import React from 'react';
import { Navbar } from '@/components/sections/Navbar';
import { HeroSection } from '@/components/sections/HeroSection';
import { HowItWorksSection } from '@/components/sections/HowItWorksSection';
import { TheDrawSection } from '@/components/sections/TheDrawSection';
import { CharityImpactSection } from '@/components/sections/CharityImpactSection';
import { PricingSection } from '@/components/sections/PricingSection';
import { FinalCTASection } from '@/components/sections/FinalCTASection';
import { Footer } from '@/components/sections/Footer';

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-navy-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white overflow-hidden">
      {/* 1. Header & Navigation */}
      <Navbar />

      {/* Main Content Sections */}
      <main className="flex-1">
        {/* 2. Hero Section with 3D HeroScene */}
        <HeroSection />

        {/* 3. How It Works (3 Steps) */}
        <HowItWorksSection />

        {/* 4. The Draw (3D DrawBalls, 40/35/25 Split, Next Month Countdown) */}
        <TheDrawSection />

        {/* 5. Charity Impact (Featured Charity, Real Stats/Zero-State, 3D Globe) */}
        <CharityImpactSection />

        {/* 6. Pricing (Monthly vs Yearly from platform_settings, Best Value) */}
        <PricingSection />

        {/* 7. Final CTA Banner */}
        <FinalCTASection />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
