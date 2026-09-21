'use client';

import React from 'react';

interface ScenePlaceholderProps {
  height?: string;
  variant?: 'hero' | 'balls' | 'globe';
}

export function ScenePlaceholder({
  height = 'h-full',
  variant = 'hero',
}: ScenePlaceholderProps) {
  return (
    <div
      className={`relative w-full ${height} flex items-center justify-center overflow-hidden pointer-events-none select-none`}
      aria-hidden="true"
    >
      {/* Dynamic ambient radial gradients */}
      <div className="absolute w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute w-60 h-60 rounded-full bg-gold-400/10 blur-2xl animate-pulse delay-700 pointer-events-none" />

      {variant === 'hero' && (
        <div className="relative flex items-center justify-center">
          <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-full border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-gold-400/5 to-transparent backdrop-blur-sm shadow-[0_0_50px_rgba(16,185,129,0.15)] flex items-center justify-center animate-spin-slow">
            <div className="w-32 h-32 rounded-full border border-gold-400/20 bg-radial-gradient from-gold-400/10 to-transparent" />
          </div>
        </div>
      )}

      {variant === 'balls' && (
        <div className="flex gap-4 sm:gap-6 items-center justify-center">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border border-gold-400/20 bg-gradient-to-br from-navy-800 to-navy-950 flex items-center justify-center shadow-lg shadow-gold-500/5 animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <span className="text-xs font-mono font-bold text-gold-400/50">
                0{i}
              </span>
            </div>
          ))}
        </div>
      )}

      {variant === 'globe' && (
        <div className="relative w-44 h-44 rounded-full border border-emerald-500/20 flex items-center justify-center animate-pulse">
          <div className="w-36 h-36 rounded-full border border-dashed border-emerald-500/30" />
        </div>
      )}
    </div>
  );
}
