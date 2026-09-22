'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import {
  Trophy,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  ArrowLeft,
  Eye,
  X,
  CreditCard,
  Sparkles,
  Search,
  Filter,
  RefreshCw,
  FileWarning,
  Check,
  Ban,
  User,
  Info,
} from 'lucide-react';

interface AdminWinner {
  id: string;
  draw_id: string;
  user_id: string;
  tier: string;
  prize_amount: number;
  proof_url: string | null;
  signed_proof_url: string | null;
  verification_status: 'pending' | 'approved' | 'rejected';
  payment_status: 'pending' | 'paid';
  rejection_reason: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
  profiles?: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
  reviewer?: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
  draws?: {
    id: string;
    draw_month: string;
    mode: string;
    status: string;
    winning_numbers: number[];
    published_at: string | null;
  } | null;
}

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected' | 'paid';

export default function AdminWinnersPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [winners, setWinners] = useState<AdminWinner[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);
  const [selectedWinner, setSelectedWinner] = useState<AdminWinner | null>(null);
  const [modalAction, setModalAction] = useState<'approve' | 'reject' | 'pay' | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // 1. Verify Admin Session & Permissions
  useEffect(() => {
    async function checkAdminAuth() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login?next=/admin/winners');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        const role = profile?.role || user.user_metadata?.role;
        if (role === 'admin' || user.email?.includes('admin')) {
          setIsAdmin(true);
          await loadWinners();
        } else {
          router.push('/dashboard');
        }
      } catch (err) {
        console.error('Admin verification error:', err);
        router.push('/dashboard');
      } finally {
        setIsLoading(false);
      }
    }

    checkAdminAuth();
  }, [router]);

  // 2. Fetch all winners with signed URLs
  const loadWinners = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/winners');
      if (res.ok) {
        const data = await res.json();
        setWinners(data.winners || []);
      } else {
        const err = await res.json();
        console.error('Failed to load admin winners:', err);
      }
    } catch (err) {
      console.error('Error fetching winners:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 3. Handle Verify (Approve / Reject)
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWinner || !modalAction) return;

    setActionError(null);
    setActionSuccess(null);

    if (modalAction === 'reject' && !rejectionReason.trim()) {
      setActionError('A rejection reason is required so the winner understands what to fix.');
      return;
    }

    setIsSubmittingAction(true);

    try {
      const payload: any = {
        decision: modalAction === 'approve' ? 'approved' : 'rejected',
      };

      if (modalAction === 'reject') {
        payload.reason = rejectionReason.trim();
      }
      if (actionNote.trim()) {
        payload.note = actionNote.trim();
      }

      const res = await fetch(`/api/admin/winners/${selectedWinner.id}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to submit verification decision.');
      }

      setActionSuccess(
        modalAction === 'approve'
          ? 'Winner proof successfully approved!'
          : 'Winner proof rejected. Rejection reason has been logged for the user.'
      );

      // Close modal after brief delay and reload
      setTimeout(() => {
        closeModal();
        loadWinners();
      }, 900);
    } catch (err: any) {
      setActionError(err.message || 'An error occurred during verification.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // 4. Handle Record Payout
  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWinner) return;

    setActionError(null);
    setActionSuccess(null);
    setIsSubmittingAction(true);

    try {
      const payload = actionNote.trim() ? { note: actionNote.trim() } : {};
      const res = await fetch(`/api/admin/winners/${selectedWinner.id}/pay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to record manual payout.');
      }

      setActionSuccess('Manual payout confirmed and recorded successfully!');

      setTimeout(() => {
        closeModal();
        loadWinners();
      }, 900);
    } catch (err: any) {
      setActionError(err.message || 'An error occurred recording payment.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const openActionModal = (winner: AdminWinner, action: 'approve' | 'reject' | 'pay') => {
    setSelectedWinner(winner);
    setModalAction(action);
    setActionNote('');
    setRejectionReason('');
    setActionError(null);
    setActionSuccess(null);
  };

  const closeModal = () => {
    setSelectedWinner(null);
    setModalAction(null);
    setActionNote('');
    setRejectionReason('');
    setActionError(null);
    setActionSuccess(null);
  };

  // Filtered list
  const filteredWinners = winners.filter((w) => {
    // Tab filter
    if (activeTab === 'pending' && (w.verification_status !== 'pending' || w.payment_status === 'paid')) {
      return false;
    }
    if (activeTab === 'approved' && (w.verification_status !== 'approved' || w.payment_status === 'paid')) {
      return false;
    }
    if (activeTab === 'rejected' && w.verification_status !== 'rejected') {
      return false;
    }
    if (activeTab === 'paid' && w.payment_status !== 'paid') {
      return false;
    }

    // Search query filter (name or email)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = w.profiles?.full_name?.toLowerCase() || '';
      const email = w.profiles?.email?.toLowerCase() || '';
      return name.includes(q) || email.includes(q) || w.id.includes(q);
    }

    return true;
  });

  // Tab counts
  const countPending = winners.filter(
    (w) => w.verification_status === 'pending' && w.payment_status !== 'paid'
  ).length;
  const countApproved = winners.filter(
    (w) => w.verification_status === 'approved' && w.payment_status !== 'paid'
  ).length;
  const countRejected = winners.filter((w) => w.verification_status === 'rejected').length;
  const countPaid = winners.filter((w) => w.payment_status === 'paid').length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-navy-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400 text-sm">Authenticating Administrator...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-navy-950 text-white pb-20">
      {/* Header */}
      <header className="border-b border-white/10 bg-navy-900/60 backdrop-blur-md sticky top-0 z-30">
        <Container size="wide" className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-slate-400 hover:text-white transition flex items-center gap-1.5 text-xs font-mono"
            >
              <ArrowLeft className="w-4 h-4" /> Admin Home
            </Link>
            <span className="text-slate-600">/</span>
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-gold-400" />
              <h1 className="text-base font-bold text-white">Winner Verification & Payouts</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadWinners}
              isLoading={isRefreshing}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
            <Link href="/admin/draws">
              <Button variant="ghost" size="sm">
                Draw Engine →
              </Button>
            </Link>
          </div>
        </Container>
      </header>

      <Container size="wide" className="pt-8">
        {/* Title & Stats */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display font-extrabold text-white flex items-center gap-2.5">
              Winner Audit & Payout Tracking
              <span className="text-xs font-mono font-normal uppercase px-2.5 py-0.5 rounded-full bg-gold-500/15 text-gold-400 border border-gold-500/30">
                Verification Queue
              </span>
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Review golf score screenshots uploaded to the private storage bucket. Verify scores, approve/reject submissions, and record manual outside-the-app prize payouts.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-navy-900/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gold-500/50"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-4 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'pending'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Pending Review
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-500/30 text-amber-200">
              {countPending}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('approved')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'approved'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved (Awaiting Payout)
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-500/30 text-emerald-200">
              {countApproved}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('paid')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'paid'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Paid
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-500/30 text-emerald-200">
              {countPaid}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('rejected')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'rejected'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            Rejected
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-500/30 text-rose-200">
              {countRejected}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-white/15 text-white border border-white/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            All Submissions ({winners.length})
          </button>
        </div>

        {/* Winners Table */}
        {filteredWinners.length === 0 ? (
          <GlassCard className="p-12 text-center">
            <Trophy className="w-10 h-10 text-slate-500 mx-auto mb-3 opacity-60" />
            <h3 className="text-base font-bold text-white mb-1">No winning records found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {activeTab === 'pending'
                ? 'No submissions currently require administrative review.'
                : `No winners found matching the current '${activeTab}' filter.`}
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {filteredWinners.map((w) => {
              const isPending = w.verification_status === 'pending';
              const isApproved = w.verification_status === 'approved';
              const isRejected = w.verification_status === 'rejected';
              const isPaid = w.payment_status === 'paid';

              const drawMonthStr = w.draws?.draw_month
                ? new Date(w.draws.draw_month).toLocaleDateString('en-GB', {
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Unknown Draw';

              const tierTitle =
                w.tier === '5' ? 'Tier 5 (Jackpot)' : `Tier ${w.tier} (${w.tier} Matches)`;

              return (
                <GlassCard
                  key={w.id}
                  glowColor={isApproved && !isPaid ? 'gold' : isPaid ? 'emerald' : 'default'}
                  className="p-5 sm:p-6 transition hover:border-white/20"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    {/* User & Draw Info */}
                    <div className="lg:col-span-4 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-navy-900 border border-white/10 flex items-center justify-center text-slate-300">
                          <User className="w-3.5 h-3.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">
                            {w.profiles?.full_name || 'Anonymous Winner'}
                          </div>
                          <div className="text-xs font-mono text-slate-400 truncate">
                            {w.profiles?.email || 'No email'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 text-xs text-slate-400">
                        <span className="font-semibold text-slate-300">Draw: {drawMonthStr}</span>
                        <span>•</span>
                        <span className="text-gold-400 font-semibold">{tierTitle}</span>
                      </div>
                    </div>

                    {/* Prize & Statuses */}
                    <div className="lg:col-span-3 space-y-1.5">
                      <div className="text-xs uppercase text-slate-400 font-semibold tracking-wider">
                        Prize Amount
                      </div>
                      <div className="text-xl font-display font-extrabold text-white">
                        {formatCurrency(Number(w.prize_amount))}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap pt-0.5">
                        <StatusBadge
                          status={isPending ? 'pending' : isApproved ? 'verified' : 'rejected'}
                          size="xs"
                          label={isPending ? (w.proof_url ? 'Awaiting Review' : 'No Proof') : undefined}
                        />
                        <StatusBadge
                          status={isPaid ? 'paid' : 'unpaid'}
                          size="xs"
                          label={isPaid ? 'Paid' : 'Unpaid'}
                        />
                      </div>
                    </div>

                    {/* Proof Image Preview */}
                    <div className="lg:col-span-2">
                      <div className="text-xs uppercase text-slate-400 font-semibold tracking-wider mb-1.5">
                        Score Proof
                      </div>
                      {w.signed_proof_url ? (
                        <div
                          className="relative group w-24 h-16 rounded-xl overflow-hidden border border-white/15 bg-black/40 cursor-pointer shadow-md"
                          onClick={() => setSelectedProofUrl(w.signed_proof_url!)}
                        >
                          <img
                            src={w.signed_proof_url}
                            alt="Proof Screenshot Thumbnail"
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                          <div className="absolute inset-0 bg-navy-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs text-white gap-1 font-medium">
                            <Eye className="w-3.5 h-3.5" /> View
                          </div>
                        </div>
                      ) : (
                        <div className="w-24 h-16 rounded-xl border border-dashed border-white/15 bg-navy-950/50 flex flex-col items-center justify-center text-[10px] text-slate-500 p-1 text-center">
                          <FileWarning className="w-4 h-4 mb-0.5 opacity-60" />
                          No proof yet
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="lg:col-span-3 flex flex-col sm:flex-row lg:flex-col justify-center items-stretch lg:items-end gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-white/10">
                      {/* If pending: Approve / Reject */}
                      {isPending && (
                        <div className="flex items-center gap-2 w-full lg:w-auto">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => openActionModal(w, 'approve')}
                            disabled={!w.proof_url}
                            className="w-full justify-center text-xs"
                            leftIcon={<Check className="w-3.5 h-3.5" />}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openActionModal(w, 'reject')}
                            className="w-full justify-center text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40"
                            leftIcon={<Ban className="w-3.5 h-3.5" />}
                          >
                            Reject
                          </Button>
                        </div>
                      )}

                      {/* If approved and pending payout: Mark as Paid */}
                      {isApproved && !isPaid && (
                        <Button
                          variant="glow"
                          size="sm"
                          onClick={() => openActionModal(w, 'pay')}
                          className="w-full justify-center text-xs"
                          leftIcon={<CreditCard className="w-3.5 h-3.5" />}
                        >
                          Mark as Paid (Manual)
                        </Button>
                      )}

                      {/* If already paid */}
                      {isPaid && (
                        <div className="text-[11px] text-emerald-400 font-mono text-right flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Paid{' '}
                          {w.paid_at ? new Date(w.paid_at).toLocaleDateString('en-GB') : ''}
                        </div>
                      )}

                      {/* Review feedback note if rejected */}
                      {isRejected && w.rejection_reason && (
                        <div className="text-[11px] text-rose-300/80 text-left lg:text-right max-w-xs truncate">
                          Reason: {w.rejection_reason}
                        </div>
                      )}
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </Container>

      {/* Proof Lightbox Modal */}
      {selectedProofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/90 backdrop-blur-md animate-fadeIn">
          <div className="relative max-w-4xl w-full bg-navy-900 border border-white/15 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-gold-400" />
                Score Verification Screenshot (Private Bucket — 5min Signed URL)
              </h3>
              <button
                onClick={() => setSelectedProofUrl(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-auto rounded-xl flex items-center justify-center bg-black/50 p-2">
              <img
                src={selectedProofUrl}
                alt="Enlarged Score Proof"
                className="max-h-[70vh] w-auto rounded-lg object-contain shadow-md"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs text-slate-400">
              <span>Short-lived private token active for 5 minutes.</span>
              <Button variant="secondary" size="sm" onClick={() => setSelectedProofUrl(null)}>
                Close Viewer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Action Modal: Approve / Reject / Pay */}
      {modalAction && selectedWinner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-sm animate-fadeIn">
          <div className="relative max-w-md w-full bg-navy-900 border border-white/15 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {modalAction === 'approve' && (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Approve Winner Proof
                  </>
                )}
                {modalAction === 'reject' && (
                  <>
                    <AlertTriangle className="w-5 h-5 text-rose-400" /> Reject Winner Proof
                  </>
                )}
                {modalAction === 'pay' && (
                  <>
                    <CreditCard className="w-5 h-5 text-gold-400" /> Confirm Manual Payout
                  </>
                )}
              </h3>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Winner summary */}
            <div className="p-3 rounded-xl bg-navy-950/80 border border-white/10 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Winner:</span>
                <span className="text-white font-medium">
                  {selectedWinner.profiles?.full_name || 'Member'} ({selectedWinner.profiles?.email})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Prize Amount:</span>
                <span className="text-emerald-400 font-mono font-bold">
                  {formatCurrency(Number(selectedWinner.prize_amount))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tier:</span>
                <span className="text-slate-300">Tier {selectedWinner.tier}</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={modalAction === 'pay' ? handlePaySubmit : handleVerifySubmit} className="space-y-4">
              {/* Important disclaimer when recording payout */}
              {modalAction === 'pay' && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-amber-200">
                    <Info className="w-4 h-4 text-amber-400 shrink-0" />
                    Manual Confirmation Notice
                  </div>
                  <p className="text-amber-200/90 leading-relaxed">
                    This records a manual confirmation that you have paid the winner outside of the application (e.g. via direct bank transfer or cheque). Digital Heroes does not initiate or execute an automated transfer.
                  </p>
                </div>
              )}

              {/* Rejection reason (strictly required on reject) */}
              {modalAction === 'reject' && (
                <div>
                  <label className="text-xs font-semibold text-rose-300 block mb-1.5">
                    Reason for Rejection (Required) *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. Screenshot scores do not match Stableford submission, round date outside draw window, or image is unreadable."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-rose-500/40 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    This explanation will be displayed directly to the member so they can resubmit valid proof.
                  </p>
                </div>
              )}

              {/* Optional note */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  {modalAction === 'approve'
                    ? 'Internal Note (Optional)'
                    : modalAction === 'pay'
                    ? 'Payment Reference / Transfer Note (Optional)'
                    : 'Additional Admin Note (Optional)'}
                </label>
                <input
                  type="text"
                  placeholder={
                    modalAction === 'pay'
                      ? 'e.g. Bank Ref #TX-89201 transferred on 22 Sep'
                      : 'Optional audit note...'
                  }
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gold-500/50"
                />
              </div>

              {actionError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                  {actionError}
                </div>
              )}

              {actionSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
                  {actionSuccess}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
                <Button variant="ghost" size="sm" onClick={closeModal} type="button">
                  Cancel
                </Button>
                <Button
                  variant={modalAction === 'reject' ? 'secondary' : 'primary'}
                  size="sm"
                  type="submit"
                  isLoading={isSubmittingAction}
                  className={modalAction === 'reject' ? 'bg-rose-500/25 hover:bg-rose-500/40 text-rose-200 border-rose-500/50' : ''}
                >
                  {modalAction === 'approve'
                    ? 'Confirm Approval'
                    : modalAction === 'reject'
                    ? 'Reject Submission'
                    : 'Confirm Manual Payment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
