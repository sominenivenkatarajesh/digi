'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class WebGLErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('WebGL Rendering fallback triggered:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="relative w-full h-full min-h-[300px] flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900/60 via-navy-950/80 to-navy-900/40 border border-white/5 p-6 backdrop-blur-md">
          {/* Ambient Glow */}
          <div className="absolute inset-0 bg-radial-gradient from-emerald-500/10 via-transparent to-transparent opacity-60" />
          <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-500/20 to-gold-400/20 border border-emerald-500/30 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/10">
              <div className="w-8 h-8 rounded-full bg-emerald-400/30 animate-pulse" />
            </div>
            <p className="text-sm font-medium text-slate-300">
              {this.props.fallbackTitle || 'Interactive 3D Visual'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Optimized for high-performance visual display
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
