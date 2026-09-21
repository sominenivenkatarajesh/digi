import { Score, ScoreValidationResult, ScoreInsertPlan } from './types';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Returns the maximum allowed date string in YYYY-MM-DD format.
 * Includes a tolerance of UTC today + 1 day to ensure users in eastern time zones
 * (such as IST UTC+5:30) can submit today's local score without false future-date rejections.
 */
export function getMaxAllowedDateString(referenceDate: Date = new Date()): string {
  const maxUtc = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate() + 1
    )
  );
  const y = maxUtc.getUTCFullYear();
  const m = String(maxUtc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(maxUtc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Validates a Stableford score (1-45 integer) and a played_on date string.
 * Rejects numbers <= 0, >= 46, non-integers, invalid dates, and future dates.
 */
export function validateScore(
  score: unknown,
  playedOn: unknown,
  referenceDate?: Date
): ScoreValidationResult {
  // Score validation
  if (typeof score !== 'number' || isNaN(score) || !Number.isInteger(score)) {
    return {
      isValid: false,
      error: 'Score must be a whole number between 1 and 45.',
    };
  }

  if (score < 1 || score > 45) {
    return {
      isValid: false,
      error: 'Score must be between 1 and 45 in Stableford format.',
    };
  }

  // Date format validation (YYYY-MM-DD)
  if (typeof playedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(playedOn)) {
    return {
      isValid: false,
      error: 'Date must be in YYYY-MM-DD format.',
    };
  }

  const [year, month, day] = playedOn.split('-').map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day));

  if (
    dateObj.getUTCFullYear() !== year ||
    dateObj.getUTCMonth() !== month - 1 ||
    dateObj.getUTCDate() !== day
  ) {
    return {
      isValid: false,
      error: 'Invalid calendar date.',
    };
  }

  // Future date check (with UTC + 1 day tolerance)
  const maxAllowed = getMaxAllowedDateString(referenceDate);
  if (playedOn > maxAllowed) {
    return {
      isValid: false,
      error: 'Score date cannot be in the future.',
    };
  }

  return { isValid: true };
}

/**
 * Sorts scores newest first by played_on (tie-break by created_at DESC).
 */
export function sortScores<T extends { played_on: string; created_at?: string }>(
  scores: T[]
): T[] {
  return [...scores].sort((a, b) => {
    if (a.played_on !== b.played_on) {
      return b.played_on.localeCompare(a.played_on);
    }
    if (a.created_at && b.created_at) {
      return b.created_at.localeCompare(a.created_at);
    }
    return 0;
  });
}

/**
 * Pure planning function determining what will happen when inserting a new score:
 * - Duplicate date -> not allowed ("You already have a score for this date. Edit it instead.")
 * - 5 scores exist and the new date is older than all 5 -> not allowed (would be dropped immediately by trigger)
 * - 5 scores exist and the new date is newer than the oldest -> allowed and willReplace = the oldest score
 * - < 5 scores exist -> allowed
 */
export function planScoreInsert(
  existingScores: Score[],
  newScore: { score: number; played_on: string }
): ScoreInsertPlan {
  // 1. Check duplicate date
  const isDuplicate = existingScores.some((s) => s.played_on === newScore.played_on);
  if (isDuplicate) {
    return {
      allowed: false,
      reason: 'You already have a score for this date. Edit it instead.',
    };
  }

  // 2. If 5 or more scores exist, analyze replacement
  if (existingScores.length >= 5) {
    const sorted = sortScores(existingScores);
    const oldestScore = sorted[sorted.length - 1];

    // If new score is strictly older than the oldest existing score
    if (newScore.played_on < oldestScore.played_on) {
      return {
        allowed: false,
        reason:
          'This score date is older than all 5 of your stored scores and would be immediately replaced.',
      };
    }

    return {
      allowed: true,
      willReplace: oldestScore,
    };
  }

  return { allowed: true };
}

/**
 * Formats a YYYY-MM-DD date string cleanly without timezone conversion bugs.
 * Example: "2026-09-21" -> "21 Sep 2026"
 */
export function formatScoreDate(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(monthIdx) || isNaN(day) || monthIdx < 0 || monthIdx > 11) {
    return dateStr;
  }
  return `${day} ${MONTH_NAMES[monthIdx]} ${year}`;
}
