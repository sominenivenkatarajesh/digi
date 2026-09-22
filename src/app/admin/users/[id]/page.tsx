'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/utils';
import {
  ArrowLeft,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  CreditCard,
  Edit2,
  Trash2,
  Plus,
  Heart,
  Trophy,
  Info,
  X,
  Save,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

interface UserScore {
  id: string;
  score: number;
  played_on: string;
  created_at: string;
}

interface UserWinner {
  id: string;
  tier: string;
  prize_amount: number;
  verification_status: string;
  payment_status: string;
  paid_at: string | null;
  created_at: string;
  draws?: {
    draw_month: string;
    mode: string;
    published_at: string;
  } | null;
}

interface UserDetail {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  charity_percent: number;
  charity: {
    id: string;
    name: string;
    is_active: boolean;
  } | null;
  subscription: {
    id?: string;
    plan: 'monthly' | 'yearly';
    status: 'active' | 'inactive' | 'lapsed' | 'cancelled';
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    admin_override_note: string | null;
    admin_overridden_by: string | null;
    admin_overridden_at: string | null;
    override_admin?: {
      full_name: string | null;
      email: string | null;
    } | null;
  } | null;
  scores: UserScore[];
  winners: UserWinner[];
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.id as string;

  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Score Modal State
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [scoreToEdit, setScoreToEdit] = useState<UserScore | null>(null);
  const [scoreValue, setScoreValue] = useState<number>(36);
  const [playedOnDate, setPlayedOnDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [isSavingScore, setIsSavingScore] = useState(false);

  // Subscription Override Modal State
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState<'active' | 'inactive' | 'lapsed' | 'cancelled'>('active');
  const [overridePlan, setOverridePlan] = useState<'monthly' | 'yearly'>('monthly');
  const [overrideNote, setOverrideNote] = useState('');
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [isSavingOverride, setIsSavingOverride] = useState(false);

  const loadUserData = async () => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setUserDetail(data.user);
        if (data.user?.subscription) {
          setOverrideStatus(data.user.subscription.status);
          setOverridePlan(data.user.subscription.plan);
        }
      } else {
        router.push('/admin/users');
      }
    } catch (err) {
      console.error('Error loading user detail:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadUserData();
    }
  }, [userId]);

  // Handle Score Submit (Add or Edit)
  const handleScoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setScoreError(null);
    setIsSavingScore(true);

    try {
      const method = scoreToEdit ? 'PATCH' : 'POST';
      const payload: any = {
        score: Number(scoreValue),
        played_on: playedOnDate,
      };
      if (scoreToEdit) {
        payload.scoreId = scoreToEdit.id;
      }

      const res = await fetch(`/api/admin/users/${userId}/scores`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to save score');
      }

      setIsScoreModalOpen(false);
      setScoreToEdit(null);
      await loadUserData();
    } catch (err: any) {
      setScoreError(err.message || 'Error saving score');
    } finally {
      setIsSavingScore(false);
    }
  };

  // Handle Score Delete
  const handleScoreDelete = async (scoreId: string) => {
    if (!confirm('Are you sure you want to delete this score?')) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}/scores?scoreId=${scoreId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await loadUserData();
      } else {
        const json = await res.json();
        alert(json.error || 'Failed to delete score');
      }
    } catch (err) {
      console.error('Error deleting score:', err);
    }
  };

  // Handle Subscription Override Submit
  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOverrideError(null);

    if (!overrideNote.trim()) {
      setOverrideError('An audit explanation note is strictly required for manual overrides.');
      return;
    }

    setIsSavingOverride(true);

    try {
      const res = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: overrideStatus,
          plan: overridePlan,
          note: overrideNote.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to override subscription status');
      }

      setIsOverrideModalOpen(false);
      setOverrideNote('');
      await loadUserData();
    } catch (err: any) {
      setOverrideError(err.message || 'Error executing override');
    } finally {
      setIsSavingOverride(false);
    }
  };

  if (isLoading || !userDetail) {
    return (
      <div className="min-h-screen bg-navy-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400 text-sm">Loading member profile...</span>
        </div>
      </div>
    );
  }

  const isSubActive = userDetail.subscription?.status === 'active';

  return (
    <Container size="wide" className="pt-8 pb-16">
      {/* Back button & User Heading */}
      <div className="mb-8">
        <Link
          href="/admin/users"
          className="text-slate-400 hover:text-white transition flex items-center gap-1.5 text-xs font-mono mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Members List
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-gold-500 to-amber-400 text-navy-950 font-black text-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              {userDetail.full_name ? userDetail.full_name[0]?.toUpperCase() : 'U'}
            </div>
            <div>
              <h1 className="text-2xl font-display font-black text-white flex items-center gap-2">
                {userDetail.full_name}
                {userDetail.role === 'admin' && (
                  <span className="text-xs font-mono uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Administrator
                  </span>
                )}
              </h1>
              <p className="text-xs font-mono text-slate-400">{userDetail.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsOverrideModalOpen(true)}
              leftIcon={<CreditCard className="w-3.5 h-3.5 text-gold-400" />}
            >
              Subscription Override
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Profile & Subscription Card */}
        <div className="lg:col-span-4 space-y-6">
          {/* Subscription Status Card */}
          <GlassCard glowColor={isSubActive ? 'emerald' : 'default'} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                Membership Status
              </span>
              <StatusBadge status={userDetail.subscription?.status || 'inactive'} size="sm" />
            </div>

            <div className="text-xl font-display font-bold text-white capitalize mb-1">
              {userDetail.subscription?.plan || 'No'} Plan
            </div>

            {userDetail.subscription?.current_period_end && (
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-2">
                <Calendar className="w-3.5 h-3.5" />
                Current Period Ends:{' '}
                <strong className="text-white">
                  {new Date(userDetail.subscription.current_period_end).toLocaleDateString('en-GB')}
                </strong>
              </p>
            )}

            {/* Support Override Audit Details Callout */}
            {userDetail.subscription?.admin_override_note && (
              <div className="mt-4 p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 text-indigo-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold flex items-center gap-1.5 text-indigo-200">
                    <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                    Manual Support Override Recorded
                  </div>
                  <StatusBadge status="override" size="xs" label="Override" />
                </div>
                <p className="text-indigo-100/90 leading-relaxed italic bg-navy-950/60 p-2.5 rounded-xl border border-indigo-500/20">
                  &ldquo;{userDetail.subscription.admin_override_note}&rdquo;
                </p>
                <div className="text-[11px] text-indigo-300/80 pt-1 border-t border-indigo-500/20">
                  Overridden by{' '}
                  <strong className="text-white">
                    {userDetail.subscription.override_admin?.full_name || 'Administrator'}
                  </strong>{' '}
                  on{' '}
                  {userDetail.subscription.admin_overridden_at
                    ? new Date(userDetail.subscription.admin_overridden_at).toLocaleDateString('en-GB')
                    : 'record'}
                  .
                </div>
                <div className="text-[10px] text-amber-300/90 flex items-center gap-1 pt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Temporary: next Stripe webhook event will overwrite this status.</span>
                </div>
              </div>
            )}
          </GlassCard>

          {/* Charity Card */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                Supported Charity
              </span>
              <Heart className="w-4 h-4 text-rose-400" />
            </div>

            {userDetail.charity ? (
              <div>
                <h3 className="text-base font-bold text-white mb-1">{userDetail.charity.name}</h3>
                <div className="p-2.5 rounded-xl bg-navy-950/70 border border-white/5 text-xs flex justify-between items-center mt-3">
                  <span className="text-slate-400">Contribution Split:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {userDetail.charity_percent}% of membership fee
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No charity assigned yet.</p>
            )}
          </GlassCard>

          {/* User Metadata */}
          <GlassCard className="p-6 text-xs space-y-2.5">
            <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider block mb-2">
              Account Metadata
            </span>
            <div className="flex justify-between">
              <span className="text-slate-400">User ID:</span>
              <span className="font-mono text-slate-300 truncate max-w-[180px]">{userDetail.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Registered:</span>
              <span className="text-white">
                {new Date(userDetail.created_at).toLocaleDateString('en-GB')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Role:</span>
              <span className="font-mono text-gold-400 uppercase">{userDetail.role}</span>
            </div>
            <p className="text-[10px] text-slate-500 pt-2 border-t border-white/5">
              Role changes are strictly restricted to database administrators per security guidelines.
            </p>
          </GlassCard>
        </div>

        {/* Right Column: Stored Scores & Winning History */}
        <div className="lg:col-span-8 space-y-8">
          {/* Stored Stableford Scores Card */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-gold-400" />
                  Stored Stableford Scores ({userDetail.scores.length}/5)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Admin score edits strictly enforce the same 1–45 range, maximum 5 scores, and unique date rules as member submissions.
                </p>
              </div>

              {userDetail.scores.length < 5 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setScoreToEdit(null);
                    setScoreValue(36);
                    setPlayedOnDate(new Date().toISOString().slice(0, 10));
                    setIsScoreModalOpen(true);
                  }}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Add Score
                </Button>
              )}
            </div>

            {userDetail.scores.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl">
                <Trophy className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold text-white mb-1">No scores submitted yet</p>
                <p className="text-xs text-slate-400 mb-3">
                  This user has not submitted any rounds of golf yet.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setScoreToEdit(null);
                    setScoreValue(36);
                    setPlayedOnDate(new Date().toISOString().slice(0, 10));
                    setIsScoreModalOpen(true);
                  }}
                >
                  Add First Score
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {userDetail.scores.map((s, idx) => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-2xl bg-navy-950/80 border border-white/10 flex flex-col items-center justify-between gap-2 text-center group hover:border-gold-500/40 transition"
                  >
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      Round #{idx + 1}
                    </span>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-gold-500 to-amber-400 text-navy-950 font-black text-xl flex items-center justify-center shadow-md">
                      {s.score}
                    </div>
                    <span className="text-[11px] font-mono text-slate-300">{s.played_on}</span>

                    <div className="flex items-center gap-1 pt-1 opacity-80 group-hover:opacity-100 transition">
                      <button
                        onClick={() => {
                          setScoreToEdit(s);
                          setScoreValue(s.score);
                          setPlayedOnDate(s.played_on);
                          setIsScoreModalOpen(true);
                        }}
                        className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
                        title="Edit score"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleScoreDelete(s.id)}
                        className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                        title="Delete score"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Winner History Card */}
          <GlassCard className="p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-gold-400" />
              Draw Winning History ({userDetail.winners.length})
            </h2>

            {userDetail.winners.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl">
                <p className="text-xs text-slate-400">No draw wins recorded for this user yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {userDetail.winners.map((w) => (
                  <div
                    key={w.id}
                    className="p-4 rounded-xl bg-navy-950/70 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white">
                          {w.draws?.draw_month
                            ? new Date(w.draws.draw_month).toLocaleDateString('en-GB', {
                                month: 'long',
                                year: 'numeric',
                              })
                            : 'Official Draw'}
                        </span>
                        <span className="font-bold text-gold-400">Tier {w.tier}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <span>Verification: <strong className="text-white capitalize">{w.verification_status}</strong></span>
                        <span>•</span>
                        <span>Payment: <strong className="text-white capitalize">{w.payment_status}</strong></span>
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <div className="text-base font-mono font-black text-emerald-400">
                        {formatCurrency(Number(w.prize_amount))}
                      </div>
                      {w.paid_at && (
                        <div className="text-[10px] text-slate-400">
                          Paid on {new Date(w.paid_at).toLocaleDateString('en-GB')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Edit/Add Score Modal */}
      {isScoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-sm animate-fadeIn">
          <div className="relative max-w-sm w-full bg-navy-900 border border-white/15 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-gold-400" />
                {scoreToEdit ? 'Edit User Score' : 'Add User Score'}
              </h3>
              <button
                onClick={() => setIsScoreModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScoreSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Stableford Score (1 - 45) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="45"
                  step="1"
                  required
                  value={scoreValue}
                  onChange={(e) => setScoreValue(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-white/10 text-xs text-white focus:outline-none focus:border-gold-500/50"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Must be between 1 and 45 points.
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Date Played (YYYY-MM-DD) *
                </label>
                <input
                  type="date"
                  required
                  value={playedOnDate}
                  onChange={(e) => setPlayedOnDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-white/10 text-xs text-white focus:outline-none focus:border-gold-500/50"
                />
              </div>

              {scoreError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                  {scoreError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
                <Button variant="ghost" size="sm" type="button" onClick={() => setIsScoreModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isSavingScore}>
                  {scoreToEdit ? 'Save Changes' : 'Add Score'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subscription Override Modal */}
      {isOverrideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-sm animate-fadeIn">
          <div className="relative max-w-md w-full bg-navy-900 border border-white/15 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gold-400" />
                Manual Subscription Override
              </h3>
              <button
                onClick={() => setIsOverrideModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Clear Warning Callout */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                Temporary Manual Override Warning
              </div>
              <p className="text-amber-200/90 leading-relaxed">
                This is a temporary customer support override. It does NOT modify or charge Stripe. Any future Stripe webhook event (renewal, cancellation, payment failure) will overwrite this status.
              </p>
            </div>

            <form onSubmit={handleOverrideSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Override Status *
                </label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-white/10 text-xs text-white focus:outline-none focus:border-gold-500/50"
                >
                  <option value="active">Active (Full Draw Eligibility)</option>
                  <option value="inactive">Inactive</option>
                  <option value="lapsed">Lapsed (Payment Issue)</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Plan Type
                </label>
                <select
                  value={overridePlan}
                  onChange={(e) => setOverridePlan(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-white/10 text-xs text-white focus:outline-none focus:border-gold-500/50"
                >
                  <option value="monthly">Monthly Plan (£10/mo)</option>
                  <option value="yearly">Annual Plan (£99/yr)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Support Audit Note (Strictly Required) *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Granted 30-day manual active access for user facing bank dispute ticket #4921."
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gold-500/50"
                />
              </div>

              {overrideError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                  {overrideError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
                <Button variant="ghost" size="sm" type="button" onClick={() => setIsOverrideModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isSavingOverride}>
                  Confirm Override
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Container>
  );
}
