'use client';

import React, { useState, useRef } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { useCurrency } from '@/components/providers/CurrencyProvider';
import {
  Trophy,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  RotateCcw,
  Eye,
  X,
  FileWarning,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

export interface UserWinning {
  id: string;
  draw_id: string;
  user_id: string;
  tier: string;
  prize_amount: number | string;
  proof_url: string | null;
  signed_proof_url?: string | null;
  verification_status: 'pending' | 'approved' | 'rejected';
  payment_status: 'pending' | 'paid';
  rejection_reason: string | null;
  admin_note: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
  draws?: {
    id: string;
    draw_month: string;
    mode: string;
    winning_numbers: number[];
    published_at: string;
  } | null;
}

interface WinningsCardProps {
  winnings: UserWinning[];
  userId: string;
  onRefresh: () => Promise<void>;
}

export function WinningsCard({ winnings, userId, onRefresh }: WinningsCardProps) {
  const { format: formatPrice } = useCurrency();
  const [uploadingWinnerId, setUploadingWinnerId] = useState<string | null>(null);
  const [replacingWinnerId, setReplacingWinnerId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<{ id: string; message: string } | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  const handleFileChange = async (winner: UserWinning, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // 1. Client-side format validation: reject before storage
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setUploadError({
        id: winner.id,
        message: 'Invalid file format. Please select a JPEG, PNG, or WebP image.',
      });
      e.target.value = '';
      return;
    }

    // 2. Client-side size validation: max 5MB
    if (file.size > MAX_FILE_SIZE) {
      setUploadError({
        id: winner.id,
        message: `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the 5MB limit. Please upload a smaller image.`,
      });
      e.target.value = '';
      return;
    }

    setUploadingWinnerId(winner.id);

    try {
      const supabase = createClient();

      // Direct client upload into private "winner-proofs" bucket:
      // Path: {user_id}/{winner_id}-{timestamp}.{ext}
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const timestamp = Date.now();
      const storagePath = `${userId}/${winner.id}-${timestamp}.${extension}`;

      const { data: uploadData, error: storageError } = await supabase.storage
        .from('winner-proofs')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (storageError || !uploadData) {
        throw new Error(storageError?.message || 'Storage upload failed.');
      }

      // PATCH /api/winners/[id]/proof to save the storage path
      const res = await fetch(`/api/winners/${winner.id}/proof`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof_url: storagePath }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to save proof submission.');
      }

      // Clear replace state and trigger refresh
      setReplacingWinnerId(null);
      await onRefresh();
    } catch (err: any) {
      console.error('Proof upload error:', err);
      setUploadError({
        id: winner.id,
        message: err.message || 'An error occurred uploading your proof. Please try again.',
      });
    } finally {
      setUploadingWinnerId(null);
      if (fileInputRefs.current[winner.id]) {
        fileInputRefs.current[winner.id]!.value = '';
      }
    }
  };

  if (!winnings || winnings.length === 0) {
    return null;
  }

  return (
    <div className="mt-12 mb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-5 h-5 text-gold-400" />
            <h2 className="text-xl font-display font-bold text-white">Your Winnings & Verification</h2>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-gold-500/15 text-gold-400 border border-gold-500/30">
              {winnings.length} {winnings.length === 1 ? 'Prize' : 'Prizes'}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Upload score screenshots from your golf platform to verify your winning rounds and claim manual payouts.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {winnings.map((w) => {
          const isPending = w.verification_status === 'pending';
          const isApproved = w.verification_status === 'approved';
          const isRejected = w.verification_status === 'rejected';
          const isPaid = w.payment_status === 'paid';

          const drawMonthFormatted = w.draws?.draw_month
            ? new Date(w.draws.draw_month).toLocaleDateString('en-GB', {
                month: 'long',
                year: 'numeric',
              })
            : 'Official Draw';

          const tierLabel =
            w.tier === '5' ? 'Tier 5 (Jackpot - 5 Matches)' : `Tier ${w.tier} (${w.tier} Matches)`;

          const canReplaceProof =
            isPending && !isPaid && (w.proof_url !== null || replacingWinnerId === w.id);

          const showUploadForm =
            (!w.proof_url && isPending) || isRejected || replacingWinnerId === w.id;

          return (
            <GlassCard
              key={w.id}
              glowColor={isApproved ? 'gold' : isRejected ? 'default' : 'default'}
              className="p-6 sm:p-7 relative overflow-hidden"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                {/* Left details */}
                <div className="space-y-3 max-w-xl">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-mono uppercase px-2.5 py-1 rounded-lg bg-navy-950/80 border border-white/10 text-slate-300 font-semibold">
                      {drawMonthFormatted}
                    </span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gold-500/15 text-gold-300 border border-gold-500/30">
                      {tierLabel}
                    </span>

                    {/* Verification Status Badge */}
                    {isPending && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {w.proof_url ? 'Submitted, awaiting review' : 'Proof Required'}
                      </span>
                    )}
                    {isApproved && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Verified & Approved
                      </span>
                    )}
                    {isRejected && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Proof Rejected
                      </span>
                    )}

                    {/* Payment Status Badge */}
                    {isPaid ? (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Paid
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-400 border border-white/5">
                        Payment: Pending
                      </span>
                    )}
                  </div>

                  {/* Prize Amount */}
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-display font-black text-white">
                      {formatPrice(Number(w.prize_amount))}
                    </span>
                    <span className="text-xs text-slate-400">Awarded Prize</span>
                  </div>

                  {/* Rejection Reason Notice */}
                  {isRejected && w.rejection_reason && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-rose-300">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        Administrator Feedback
                      </div>
                      <p className="text-rose-200/90 leading-relaxed">{w.rejection_reason}</p>
                      <p className="text-[11px] text-rose-300/70 pt-1">
                        Please review the feedback above and upload an updated screenshot from your golf platform.
                      </p>
                    </div>
                  )}

                  {/* Approved Confirmation */}
                  {isApproved && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs">
                      <div className="font-semibold flex items-center gap-1.5 text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        Score verification verified by administration.
                      </div>
                      <p className="text-[11px] text-emerald-200/80 mt-0.5">
                        {isPaid
                          ? `Payment completed on ${w.paid_at ? new Date(w.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'recently'}.`
                          : 'Manual payout is currently pending transfer by the platform administrator.'}
                      </p>
                    </div>
                  )}

                  {/* Inline Upload Error */}
                  {uploadError?.id === w.id && (
                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                      <FileWarning className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{uploadError.message}</span>
                    </div>
                  )}
                </div>

                {/* Right action / upload area */}
                <div className="lg:w-80 flex flex-col justify-center items-stretch lg:items-end gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 border-white/10">
                  {showUploadForm ? (
                    <div className="w-full space-y-2">
                      <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block text-left">
                        {isRejected ? 'Upload Revised Proof' : 'Upload Score Screenshot'}
                      </label>
                      <p className="text-[11px] text-slate-400 text-left">
                        Accepted: JPG, PNG, WebP (max 5MB).
                      </p>

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        ref={(el) => {
                          fileInputRefs.current[w.id] = el;
                        }}
                        onChange={(e) => handleFileChange(w, e)}
                        className="hidden"
                        id={`proof-upload-${w.id}`}
                        disabled={uploadingWinnerId === w.id}
                      />

                      <Button
                        variant="primary"
                        size="sm"
                        disabled={uploadingWinnerId === w.id}
                        onClick={() => fileInputRefs.current[w.id]?.click()}
                        className="w-full justify-center"
                        leftIcon={<UploadCloud className="w-4 h-4" />}
                      >
                        {uploadingWinnerId === w.id
                          ? 'Uploading & Verifying...'
                          : isRejected
                          ? 'Select New Image'
                          : 'Choose Screenshot'}
                      </Button>

                      {replacingWinnerId === w.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setReplacingWinnerId(null)}
                          className="w-full justify-center text-xs text-slate-400 hover:text-white"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  ) : (
                    /* Proof is uploaded */
                    <div className="w-full space-y-3">
                      {w.signed_proof_url && (
                        <div className="relative group rounded-xl overflow-hidden border border-white/10 bg-navy-950/80 p-2 flex items-center justify-between gap-3">
                          <div
                            className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                            onClick={() => setPreviewImageUrl(w.signed_proof_url!)}
                          >
                            {/* Thumbnail */}
                            <img
                              src={w.signed_proof_url}
                              alt="Score Proof Thumbnail"
                              className="w-12 h-12 rounded-lg object-cover border border-white/10 shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-medium text-white block truncate">
                                Score Proof Uploaded
                              </span>
                              <span className="text-[10px] text-gold-400 flex items-center gap-1 mt-0.5">
                                <Eye className="w-3 h-3" /> Click to view
                              </span>
                            </div>
                          </div>

                          {/* Replace button (allowed only while verification and payment are still pending) */}
                          {canReplaceProof && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setReplacingWinnerId(w.id)}
                              className="text-xs shrink-0"
                              leftIcon={<RotateCcw className="w-3 h-3" />}
                            >
                              Replace
                            </Button>
                          )}
                        </div>
                      )}

                      {!w.signed_proof_url && w.proof_url && (
                        <div className="p-3 rounded-xl bg-navy-950/70 border border-white/10 flex items-center justify-between gap-2 text-xs">
                          <span className="text-slate-300">Proof submitted</span>
                          {canReplaceProof && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setReplacingWinnerId(w.id)}
                              className="text-xs"
                              leftIcon={<RotateCcw className="w-3 h-3" />}
                            >
                              Replace
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Image Lightbox Modal */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/90 backdrop-blur-md animate-fadeIn">
          <div className="relative max-w-3xl w-full bg-navy-900 border border-white/15 rounded-2xl p-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-gold-400" />
                Submitted Golf Score Proof
              </h3>
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-auto rounded-xl flex items-center justify-center bg-black/40 p-2">
              <img
                src={previewImageUrl}
                alt="Golf Score Proof Full View"
                className="max-h-[70vh] w-auto rounded-lg object-contain"
              />
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <Button variant="secondary" size="sm" onClick={() => setPreviewImageUrl(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
