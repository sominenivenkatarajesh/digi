'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Score } from '@/lib/scores/types';
import { formatScoreDate, validateScore } from '@/lib/scores/logic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ticket,
  Plus,
  Calendar,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
  Info,
  X,
  RotateCcw,
} from 'lucide-react';

interface ScoresCardProps {
  isActiveSubscription: boolean;
  isAdmin: boolean;
}

export function ScoresCard({ isActiveSubscription, isAdmin }: ScoresCardProps) {
  const isEditable = isActiveSubscription || isAdmin;

  const [scores, setScores] = useState<Score[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State for Adding
  // Get user's local today date in YYYY-MM-DD
  const getTodayLocal = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [formScore, setFormScore] = useState<number>(36);
  const [formDate, setFormDate] = useState<string>(getTodayLocal());
  const [formInlineError, setFormInlineError] = useState<string | null>(null);

  // Modal State for Editing
  const [editingScore, setEditingScore] = useState<Score | null>(null);
  const [editScoreValue, setEditScoreValue] = useState<number>(36);
  const [editDateValue, setEditDateValue] = useState<string>('');
  const [editInlineError, setEditInlineError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Modal State for Deleting
  const [deletingScore, setDeletingScore] = useState<Score | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reload scores strictly from the server after every change
  const fetchScores = useCallback(async () => {
    try {
      const res = await fetch('/api/scores');
      if (res.ok) {
        const data = await res.json();
        setScores(data.scores || []);
      } else {
        console.error('Failed to fetch scores from API');
      }
    } catch (err) {
      console.error('Error fetching scores:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  // Flash message helper
  const showToast = (msg: string, type: 'success' | 'error') => {
    if (type === 'success') {
      setSuccessMessage(msg);
      setErrorMessage(null);
      setTimeout(() => setSuccessMessage(null), 4000);
    } else {
      setErrorMessage(msg);
      setSuccessMessage(null);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  // Add Score handler
  const handleAddScore = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormInlineError(null);

    const validation = validateScore(formScore, formDate);
    if (!validation.isValid) {
      setFormInlineError(validation.error || 'Invalid score or date.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: formScore,
          played_on: formDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormInlineError(data.error || 'Failed to record score.');
        showToast(data.error || 'Failed to record score.', 'error');
      } else {
        showToast('Score recorded successfully!', 'success');
        // Reset form date to local today
        setFormDate(getTodayLocal());
        // Server reload rule: ALWAYS reload list from the server
        await fetchScores();
      }
    } catch (err: any) {
      setFormInlineError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (score: Score) => {
    setEditingScore(score);
    setEditScoreValue(score.score);
    setEditDateValue(score.played_on);
    setEditInlineError(null);
  };

  // Submit Edit
  const handleUpdateScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingScore) return;

    const validation = validateScore(editScoreValue, editDateValue);
    if (!validation.isValid) {
      setEditInlineError(validation.error || 'Invalid score values.');
      return;
    }

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/scores/${editingScore.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: editScoreValue,
          played_on: editDateValue,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEditInlineError(data.error || 'Failed to update score.');
      } else {
        showToast('Score updated successfully!', 'success');
        setEditingScore(null);
        await fetchScores();
      }
    } catch (err: any) {
      setEditInlineError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Submit Delete
  const handleDeleteScore = async () => {
    if (!deletingScore) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/scores/${deletingScore.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to delete score.', 'error');
      } else {
        showToast('Score removed successfully.', 'success');
        setDeletingScore(null);
        await fetchScores();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete score.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const count = scores.length;
  const isFull = count >= 5;

  return (
    <GlassCard glowColor="emerald" className="p-6 sm:p-8 mb-10 border-emerald-500/20 relative">
      {/* Toast Notifications */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-3 text-emerald-300 text-xs font-medium"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </motion.div>
        )}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center gap-3 text-red-300 text-xs font-medium"
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header: Title + Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/[0.08]">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Ticket className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-display font-bold text-white">
                Your Stableford Scores
              </h2>
              <span className="text-[10px] uppercase font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                Monthly Draw Entries
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Enter your last 5 Stableford scores (1–45). These numbers are matched directly against the monthly draw.
            </p>
          </div>
        </div>

        {/* Progress Tracker (X of 5 scores entered) */}
        <div className="flex items-center gap-3 bg-navy-950/70 border border-white/10 px-4 py-2.5 rounded-2xl shrink-0">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((slot) => (
              <div
                key={slot}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  slot <= count
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)] scale-110'
                    : 'bg-white/10 border border-white/10'
                }`}
              />
            ))}
          </div>
          <div className="text-xs font-semibold text-slate-300">
            <span className="text-emerald-400 font-bold">{count}</span> of 5 scores entered
          </div>
        </div>
      </div>

      {/* Non-Subscriber Read-Only Banner */}
      {!isEditable && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-amber-300 text-xs">
            <Lock className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              Active subscription required to record, edit, or remove scores. Existing scores are in read-only mode.
            </span>
          </div>
          <Button
            href="/dashboard?subscribe=true"
            variant="glow"
            size="sm"
            className="shrink-0"
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Subscribe to Unlock
          </Button>
        </div>
      )}

      {/* Add Score Form */}
      {isEditable && (
        <form
          onSubmit={handleAddScore}
          className="mb-8 p-5 rounded-2xl bg-navy-950/60 border border-white/10 backdrop-blur-sm"
        >
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            {/* Score input with quick stepper */}
            <div className="w-full md:w-56">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Stableford Score (1–45)
              </label>
              <div className="flex items-center rounded-xl bg-navy-900/80 border border-white/10 p-1">
                <button
                  type="button"
                  onClick={() => setFormScore((prev) => Math.max(1, prev - 1))}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center font-bold text-base transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  max={45}
                  value={formScore}
                  onChange={(e) => setFormScore(parseInt(e.target.value, 10) || 0)}
                  className="w-full text-center bg-transparent text-white font-mono font-bold text-lg focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setFormScore((prev) => Math.min(45, prev + 1))}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center font-bold text-base transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Date picker */}
            <div className="w-full md:w-56">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Date Played
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  max={getTodayLocal()}
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 rounded-xl bg-navy-900/80 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              leftIcon={<Plus className="w-4 h-4" />}
              className="w-full md:w-auto h-[42px] shrink-0"
            >
              Add Score
            </Button>
          </div>

          {/* Replacement tip if 5 scores already exist */}
          {isFull && (
            <div className="mt-3 flex items-start gap-2 text-xs text-slate-400">
              <Info className="w-3.5 h-3.5 text-gold-400 shrink-0 mt-0.5" />
              <span>
                You currently have 5 active scores. Adding a score with a newer date will automatically replace your oldest score.
              </span>
            </div>
          )}

          {/* Inline Form Error */}
          {formInlineError && (
            <div className="mt-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{formInlineError}</span>
            </div>
          )}
        </form>
      )}

      {/* Scores List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
            Active Draw Scores ({count}/5)
          </h3>
          <span className="text-[11px] text-slate-400">Sorted newest first</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl bg-white/5 border border-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : count === 0 ? (
          <div className="p-10 rounded-2xl bg-navy-950/40 border border-white/5 text-center">
            <Ticket className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-white mb-1">No golf scores recorded yet</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Add your first Stableford score above. You need 5 recorded scores to participate in the monthly cash prize draws.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <AnimatePresence>
              {scores.map((score, index) => {
                const isOldest = isFull && index === scores.length - 1;

                return (
                  <motion.div
                    key={score.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className={`p-4 rounded-2xl border flex flex-col justify-between transition-all duration-200 relative overflow-hidden ${
                      isOldest
                        ? 'bg-amber-500/5 border-amber-500/30'
                        : 'bg-navy-900/60 border-white/10 hover:border-emerald-500/30'
                    }`}
                  >
                    {/* Oldest Tag */}
                    {isOldest && (
                      <div className="absolute top-0 right-0 px-2 py-0.5 rounded-bl-xl bg-amber-500/20 text-amber-300 border-l border-b border-amber-500/30 text-[9px] font-bold uppercase tracking-wider">
                        Next to be replaced
                      </div>
                    )}

                    <div>
                      {/* Score Badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-navy-950 font-display font-extrabold text-lg flex items-center justify-center shadow-md shadow-emerald-500/20">
                          {score.score}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase font-mono">
                          pts
                        </span>
                      </div>

                      {/* Date formatted without timezone shifts */}
                      <div className="text-xs font-semibold text-white mb-1">
                        {formatScoreDate(score.played_on)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {score.played_on}
                      </div>
                    </div>

                    {/* Edit & Delete Action Buttons */}
                    {isEditable && (
                      <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(score)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                          title="Edit score"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingScore(score)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete score"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Edit Score Modal */}
      {editingScore && (
        <div className="fixed inset-0 bg-navy-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md p-6 rounded-3xl bg-navy-900 border border-white/10 shadow-2xl relative"
          >
            <button
              type="button"
              onClick={() => setEditingScore(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-display font-bold text-white mb-1">
              Edit Stableford Score
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Update the score value (1–45) or the date played. Duplicate dates are not permitted.
            </p>

            <form onSubmit={handleUpdateScore} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Score (1–45)
                </label>
                <div className="flex items-center rounded-xl bg-navy-950 border border-white/10 p-1">
                  <button
                    type="button"
                    onClick={() => setEditScoreValue((prev) => Math.max(1, prev - 1))}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center font-bold text-base"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={45}
                    value={editScoreValue}
                    onChange={(e) => setEditScoreValue(parseInt(e.target.value, 10) || 0)}
                    className="w-full text-center bg-transparent text-white font-mono font-bold text-lg focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setEditScoreValue((prev) => Math.min(45, prev + 1))}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center font-bold text-base"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Date Played
                </label>
                <input
                  type="date"
                  max={getTodayLocal()}
                  value={editDateValue}
                  onChange={(e) => setEditDateValue(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-navy-950 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              {editInlineError && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs">
                  {editInlineError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setEditingScore(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="glow"
                  size="md"
                  isLoading={isUpdating}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingScore && (
        <div className="fixed inset-0 bg-navy-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm p-6 rounded-3xl bg-navy-900 border border-white/10 shadow-2xl"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-display font-bold text-white mb-2">
              Remove this score?
            </h3>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              Are you sure you want to remove the score of{' '}
              <strong className="text-white">{deletingScore.score} pts</strong> played on{' '}
              <strong className="text-white">{formatScoreDate(deletingScore.played_on)}</strong>? You will have {count - 1} of 5 scores recorded.
            </p>

            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setDeletingScore(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                className="bg-red-600 hover:bg-red-500 text-white"
                isLoading={isDeleting}
                onClick={handleDeleteScore}
              >
                Delete Score
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </GlassCard>
  );
}
