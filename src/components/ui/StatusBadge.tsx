import React from 'react';

export type BadgeType =
  | 'active'
  | 'inactive'
  | 'lapsed'
  | 'cancelled'
  | 'pending'
  | 'verified'
  | 'approved'
  | 'rejected'
  | 'paid'
  | 'unpaid'
  | 'admin_bypass'
  | 'override';

interface StatusBadgeProps {
  status: BadgeType | string;
  label?: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export function StatusBadge({ status, label, size = 'sm', className = '' }: StatusBadgeProps) {
  const norm = status.toLowerCase();

  let styles = 'bg-slate-500/20 text-slate-200 border-slate-500/40';
  let defaultLabel = status;

  switch (norm) {
    // Green variants (active, verified, approved, paid)
    case 'active':
      styles = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10';
      defaultLabel = 'Active';
      break;
    case 'verified':
    case 'approved':
      styles = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10';
      defaultLabel = 'Verified';
      break;
    case 'paid':
      styles = 'bg-teal-500/20 text-teal-200 border-teal-500/40 shadow-sm shadow-teal-500/10';
      defaultLabel = 'Paid';
      break;

    // Amber variants (pending, lapsed, unpaid) - strictly high contrast text
    case 'pending':
      styles = 'bg-amber-500/20 text-amber-200 border-amber-500/40 shadow-sm shadow-amber-500/10';
      defaultLabel = 'Pending Review';
      break;
    case 'lapsed':
      styles = 'bg-amber-500/25 text-amber-100 border-amber-500/50 shadow-sm shadow-amber-500/10';
      defaultLabel = 'Payment Lapsed';
      break;
    case 'unpaid':
      styles = 'bg-amber-500/20 text-amber-200 border-amber-500/40';
      defaultLabel = 'Unpaid';
      break;

    // Red / Rose variants (cancelled, rejected)
    case 'cancelled':
      styles = 'bg-rose-500/20 text-rose-200 border-rose-500/40';
      defaultLabel = 'Cancelled';
      break;
    case 'rejected':
      styles = 'bg-rose-500/20 text-rose-200 border-rose-500/40';
      defaultLabel = 'Rejected';
      break;

    // Purple / Indigo variants (admin bypass, override)
    case 'admin_bypass':
      styles = 'bg-purple-500/25 text-purple-200 border-purple-500/50 shadow-sm shadow-purple-500/10';
      defaultLabel = 'Admin Bypass';
      break;
    case 'override':
      styles = 'bg-indigo-500/25 text-indigo-200 border-indigo-500/50 shadow-sm shadow-indigo-500/10';
      defaultLabel = 'Manual Override';
      break;

    case 'inactive':
    default:
      styles = 'bg-slate-500/20 text-slate-200 border-slate-500/30';
      defaultLabel = label || status;
      break;
  }

  const sizeClasses = {
    xs: 'text-[9px] px-2 py-0.5 font-bold tracking-wider',
    sm: 'text-[10px] sm:text-xs px-2.5 py-0.5 font-bold tracking-wide',
    md: 'text-xs sm:text-sm px-3 py-1 font-bold',
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 uppercase font-mono rounded-full border transition-colors ${sizeClasses} ${styles} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 shrink-0" />
      <span>{label || defaultLabel}</span>
    </span>
  );
}
