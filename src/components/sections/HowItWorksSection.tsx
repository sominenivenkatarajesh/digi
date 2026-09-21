'use client';

import React from 'react';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { GlassCard } from '@/components/ui/GlassCard';
import { Reveal } from '@/components/ui/Reveal';
import { HeartHandshake, Award, Gift, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function HowItWorksSection() {
  const steps = [
    {
      number: '01',
      title: 'Subscribe & Select Cause',
      description:
        'Choose a monthly or annual membership. A guaranteed portion of every subscription directly finances vetted humanitarian and healthcare charities.',
      icon: <HeartHandshake className="w-6 h-6 text-emerald-400" />,
      accent: 'emerald' as const,
    },
    {
      number: '02',
      title: 'Enter Your Scores',
      description:
        'Log your monthly activity scores or challenge numbers with ease. Your verified submission converts into official entries for the upcoming monthly draw.',
      icon: <Award className="w-6 h-6 text-gold-400" />,
      accent: 'gold' as const,
    },
    {
      number: '03',
      title: 'Win & Give Back',
      description:
        'On the first of every month, 5 winning numbers are drawn. Win your share of the cash jackpot while your membership fuels real-world relief projects.',
      icon: <Gift className="w-6 h-6 text-emerald-300" />,
      accent: 'emerald' as const,
    },
  ];

  return (
    <section id="how-it-works" className="py-24 sm:py-32 relative bg-navy-900/60 scroll-mt-20">
      <Container size="wide">
        <SectionHeading
          badge="Effortless & Transparent"
          badgeVariant="emerald"
          title={
            <>
              How <span className="text-gradient-emerald">Digital Heroes</span> Works
            </>
          }
          subtitle="Three simple steps to transform regular participation into life-changing charitable support and cash prize opportunities."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, idx) => (
            <Reveal key={step.number} delay={idx * 0.15} direction="up">
              <GlassCard
                glowColor={step.accent}
                className="p-8 h-full flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center shadow-inner">
                      {step.icon}
                    </div>
                    <span className="font-mono text-3xl font-extrabold text-white/20 select-none">
                      {step.number}
                    </span>
                  </div>

                  <h3 className="text-xl font-display font-bold text-white mb-3">
                    {step.title}
                  </h3>

                  <p className="text-sm text-slate-300 font-light leading-relaxed">
                    {step.description}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-white/[0.06] flex items-center text-xs font-semibold text-emerald-400">
                  <span>Step {idx + 1} of 3</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5 opacity-70" />
                </div>
              </GlassCard>
            </Reveal>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button href="/signup" variant="secondary" size="md">
            Get Started in 60 Seconds
          </Button>
        </div>
      </Container>
    </section>
  );
}
