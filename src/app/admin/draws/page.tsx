'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { createClient } from '@/lib/supabase/client';
import {
  ShieldAlert,
  Play,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Sparkles,
  Award,
  Users,
  Coins,
  ArrowLeft,
  RotateCcw,
  Clock,
  Lock,
} from 'lucide-react';

interface SimulationResult {
  simulationId: string;
  month: string;
  mode: string;
  winningNumbers: number[];
  pool: {
    totalPounds: number;
    tier5Pounds: number;
    tier4Pounds: number;
    tier3Pounds: number;
    jackpotCarriedInPounds: number;
    jackpotRolledOverPounds: number;
    remainderPounds: number;
  };
  metrics: {
    eligibleCount: number;
    totalEvaluated: number;
    totalWinners: number;
  };
  winners: {
    tier5: { count: number; prizePerWinnerPounds: number; userIds: string[]; rolledOver: boolean };
    tier4: { count: number; prizePerWinnerPounds: number; userIds: string[] };
    tier3: { count: number; prizePerWinnerPounds: number; userIds: string[] };
  };
}

interface PublishedDraw {
  id: string;
  draw_month: string;
  mode: string;
  status: string;
  winning_numbers: number[];
  pool_total: number;
  tier5_pool: number;
  tier4_pool: number;
  tier3_pool: number;
  jackpot_carried_in: number;
  jackpot_rolled_over: number;
  published_at: string;
}

export default function AdminDrawsPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Form State
  const defaultMonth = new Date().toISOString().slice(0, 7); // e.g. "2026-09"
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [mode, setMode] = useState<'random' | 'algorithm'>('random');

  // Action States
  const [isSimulating, setIsSimulating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [publishedDraws, setPublishedDraws] = useState<PublishedDraw[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuthAndLoad() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login?next=/admin/draws');
          return;
        }

        // Check profile role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (!profile || profile.role !== 'admin') {
          setIsAdmin(false);
          setIsLoadingAuth(false);
          return;
        }

        setIsAdmin(true);
        await loadDrawsHistory();
      } catch (err) {
        console.error('Auth verification error:', err);
      } finally {
        setIsLoadingAuth(false);
      }
    }

    checkAuthAndLoad();
  }, [router]);

  const loadDrawsHistory = async () => {
    try {
      const res = await fetch('/api/admin/draws');
      if (res.ok) {
        const data = await res.json();
        setPublishedDraws(data.draws || []);
      }
    } catch (e) {
      console.error('Failed to load past draws:', e);
    }
  };

  const handleSimulate = async () => {
    setIsSimulating(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/draws/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: `${selectedMonth}-01`,
          mode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Simulation failed');
      }

      setSimulation(data.simulation);
    } catch (err: any) {
      setErrorMsg(err.message || 'Simulation error');
    } finally {
      setIsSimulating(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/draws/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: `${selectedMonth}-01`,
          mode,
          simulationId: simulation?.simulationId,
        }),
      });

      const data = await res.json();
      if (res.status === 409) {
        throw new Error(`409 Conflict: ${data.error || 'This month is already published.'}`);
      }
      if (!res.ok) {
        throw new Error(data.error || 'Failed to publish draw');
      }

      setSuccessMsg(`Draw for ${selectedMonth} published successfully! Numbers: ${data.winningNumbers.join(', ')}`);
      setShowConfirmModal(false);
      setSimulation(null);
      await loadDrawsHistory();
    } catch (err: any) {
      setErrorMsg(err.message || 'Publishing failed');
      setShowConfirmModal(false);
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <GlassCard className="max-w-md w-full p-8 text-center border-red-500/30">
          <ShieldAlert className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-slate-400 mb-6">
            Administrator privileges are required to view the draw engine and simulation tools.
          </p>
          <Link href="/dashboard">
            <Button variant="primary" className="w-full">
              Return to Member Dashboard
            </Button>
          </Link>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10">
      <Container size="wide">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/admin" className="text-slate-400 hover:text-white transition flex items-center gap-1 text-sm">
                <ArrowLeft className="w-4 h-4" /> Back to Admin
              </Link>
              <span className="text-slate-600">/</span>
              <span className="text-emerald-400 font-semibold text-sm">Draw Engine</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Monthly Draw & Prize Engine</h1>
            <p className="text-slate-400 text-sm mt-1">
              Simulate draws, inspect winners, and atomically publish official monthly results.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="secondary" size="sm">
                User Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Draw Error</p>
              <p className="text-xs text-red-300 mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Success</p>
              <p className="text-xs text-emerald-300 mt-0.5">{successMsg}</p>
            </div>
          </div>
        )}

        {/* Controls Card */}
        <GlassCard className="p-6 mb-8">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Draw Controls & Parameters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Month Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Draw Month
              </label>
              <div className="relative">
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Draws are normalized to the 1st of the selected month.
              </p>
            </div>

            {/* Mode Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Algorithm Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('random')}
                  className={`px-3 py-2.5 rounded-lg text-xs font-semibold transition border ${
                    mode === 'random'
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  🎲 True Random (1-45)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('algorithm')}
                  className={`px-3 py-2.5 rounded-lg text-xs font-semibold transition border ${
                    mode === 'algorithm'
                      ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  ⚖️ Stableford Weighted
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Weighted mode uses member score distributions (1-45, min weight 1).
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col justify-end gap-2">
              <Button
                variant="primary"
                onClick={handleSimulate}
                disabled={isSimulating || isPublishing}
                className="w-full"
              >
                {isSimulating ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                    Running Engine...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Play className="w-4 h-4 fill-current" />
                    Run Simulation Preview
                  </span>
                )}
              </Button>
            </div>
          </div>
        </GlassCard>

        {/* Simulation Preview Section */}
        {simulation && (
          <div className="mb-10 space-y-6">
            {/* Warning Banner */}
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-700/60 text-amber-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500 text-black">
                      SIMULATION - NOT OFFICIAL
                    </span>
                    <span className="text-xs text-amber-300">
                      Simulation ID: <code className="font-mono">{simulation.simulationId.slice(0, 8)}...</code>
                    </span>
                  </div>
                  <p className="text-xs text-amber-300/80 mt-1">
                    These numbers have been saved to draft simulations. Publishing will reuse these exact winning numbers.
                  </p>
                </div>
              </div>

              <Button
                variant="primary"
                onClick={() => setShowConfirmModal(true)}
                disabled={isPublishing}
                className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
              >
                <Lock className="w-4 h-4 mr-2" />
                Publish Official Draw
              </Button>
            </div>

            {/* Winning Numbers Presentation */}
            <GlassCard className="p-8 text-center bg-gradient-to-b from-slate-900 to-slate-950 border-emerald-500/30">
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-3">
                Simulated Winning Numbers ({simulation.mode.toUpperCase()} MODE)
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 my-4">
                {simulation.winningNumbers.map((num, i) => (
                  <div
                    key={i}
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 border-2 border-amber-200 transform hover:scale-105 transition"
                  >
                    {num}
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                5 distinct numbers matched against all eligible members&apos; 5 Stableford scores (1-45).
              </p>
            </GlassCard>

            {/* Prize Pool Breakdown Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <GlassCard className="p-5">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>Total Prize Pool</span>
                  <Coins className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  £{simulation.pool.totalPounds.toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  45% of active member subscriptions
                </div>
              </GlassCard>

              <GlassCard className="p-5 border-amber-500/20">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>Tier 5 (Match 5)</span>
                  <Award className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-amber-400">
                  £{simulation.pool.tier5Pounds.toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  40% + £{simulation.pool.jackpotCarriedInPounds.toFixed(2)} carried in
                </div>
              </GlassCard>

              <GlassCard className="p-5">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>Tier 4 (Match 4)</span>
                  <Award className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-blue-400">
                  £{simulation.pool.tier4Pounds.toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  35% allocation (no rollover)
                </div>
              </GlassCard>

              <GlassCard className="p-5">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                  <span>Tier 3 (Match 3)</span>
                  <Award className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-emerald-400">
                  £{simulation.pool.tier3Pounds.toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  25% + penny roundings
                </div>
              </GlassCard>
            </div>

            {/* Winners Summary Card */}
            <GlassCard className="p-6">
              <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                Winner Distribution & Payout Calculation
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Tier 5 */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-amber-400 uppercase">Match 5 / Jackpot</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                      {simulation.winners.tier5.count} Winner{simulation.winners.tier5.count === 1 ? '' : 's'}
                    </span>
                  </div>
                  {simulation.winners.tier5.count > 0 ? (
                    <div>
                      <p className="text-xl font-bold text-white">
                        £{simulation.winners.tier5.prizePerWinnerPounds.toFixed(2)}{' '}
                        <span className="text-xs text-slate-400 font-normal">/ winner</span>
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-amber-300/90 flex items-center gap-1.5 mt-1">
                        <RotateCcw className="w-4 h-4 text-amber-400" />
                        Rollover to Next Month!
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        £{simulation.pool.jackpotRolledOverPounds.toFixed(2)} rolls into next month&apos;s jackpot.
                      </p>
                    </div>
                  )}
                </div>

                {/* Tier 4 */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-blue-400 uppercase">Match 4</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold">
                      {simulation.winners.tier4.count} Winner{simulation.winners.tier4.count === 1 ? '' : 's'}
                    </span>
                  </div>
                  {simulation.winners.tier4.count > 0 ? (
                    <div>
                      <p className="text-xl font-bold text-white">
                        £{simulation.winners.tier4.prizePerWinnerPounds.toFixed(2)}{' '}
                        <span className="text-xs text-slate-400 font-normal">/ winner</span>
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic mt-2">No Match 4 winners this draw.</p>
                  )}
                </div>

                {/* Tier 3 */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-emerald-400 uppercase">Match 3</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                      {simulation.winners.tier3.count} Winner{simulation.winners.tier3.count === 1 ? '' : 's'}
                    </span>
                  </div>
                  {simulation.winners.tier3.count > 0 ? (
                    <div>
                      <p className="text-xl font-bold text-white">
                        £{simulation.winners.tier3.prizePerWinnerPounds.toFixed(2)}{' '}
                        <span className="text-xs text-slate-400 font-normal">/ winner</span>
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic mt-2">No Match 3 winners this draw.</p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
                <span>
                  Eligible Users Evaluated: <strong className="text-white">{simulation.metrics.eligibleCount}</strong> of {simulation.metrics.totalEvaluated}
                </span>
                <span>
                  Unallocated Penny Remainder: <strong className="text-white">£{simulation.pool.remainderPounds.toFixed(2)}</strong> (retained per pool rules)
                </span>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Past Official Draws */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400" />
              Published Draws History
            </h2>
            <Button variant="secondary" size="sm" onClick={loadDrawsHistory}>
              Refresh History
            </Button>
          </div>

          {publishedDraws.length === 0 ? (
            <GlassCard className="p-8 text-center text-slate-400">
              <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold">No official draws published yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Run a simulation and click &quot;Publish Official Draw&quot; to create the first entry.
              </p>
            </GlassCard>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Month</th>
                    <th className="py-3 px-4">Winning Numbers</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4">Total Pool</th>
                    <th className="py-3 px-4">Rolled Over</th>
                    <th className="py-3 px-4">Published At</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {publishedDraws.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-900/40 transition">
                      <td className="py-3 px-4 font-bold text-white">{d.draw_month}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {d.winning_numbers?.map((n, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[11px] border border-amber-500/40"
                            >
                              {n}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 capitalize font-sans">{d.mode}</td>
                      <td className="py-3 px-4 text-emerald-400">£{Number(d.pool_total || 0).toFixed(2)}</td>
                      <td className="py-3 px-4 text-amber-400">
                        {Number(d.jackpot_rolled_over || 0) > 0
                          ? `£${Number(d.jackpot_rolled_over).toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-sans">
                        {d.published_at ? new Date(d.published_at).toLocaleString() : '—'}
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center gap-3 text-amber-400 mb-4">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="text-lg font-bold text-white">Confirm Official Draw Publish</h3>
              </div>

              <p className="text-sm text-slate-300 mb-4">
                You are about to officially publish the draw for{' '}
                <strong className="text-white">{selectedMonth}</strong> using the simulated winning numbers:
              </p>

              <div className="flex items-center justify-center gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800 mb-4">
                {simulation?.winningNumbers.map((n, i) => (
                  <span
                    key={i}
                    className="w-8 h-8 rounded-full bg-amber-500 text-black font-black text-sm flex items-center justify-center"
                  >
                    {n}
                  </span>
                ))}
              </div>

              <div className="bg-red-950/40 border border-red-900/60 rounded-lg p-3 text-xs text-red-300 mb-6">
                <strong>Permanent action:</strong> This will insert official draw entries and winners into the public ledger. You cannot unpublish or modify this draw once confirmed.
              </div>

              <div className="flex items-center justify-end gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isPublishing}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {isPublishing ? 'Publishing...' : 'Yes, Publish Official Draw'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}
