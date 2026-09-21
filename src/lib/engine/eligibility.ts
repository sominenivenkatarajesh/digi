import { UserSubscriptionCandidate } from './types';

/**
 * Validates whether a user is eligible to participate in the official monthly draw.
 *
 * PRD & Phase 5 Security Rules:
 * 1. Must have a real subscription row with status = 'active' AND current_period_end in the future
 *    (or cancelled with current_period_end in the future, retaining paid access until period end).
 * 2. Status 'lapsed' or expired periods are strictly ineligible.
 * 3. Admins do NOT receive an automatic bypass into the draw prize pool; an admin is ONLY
 *    eligible if they have a real, paying, active subscription row.
 * 4. Must have recorded EXACTLY 5 scores. Fewer or more than 5 scores disqualifies the user.
 *
 * @param candidate - User subscription and score candidate data
 * @param nowTime - Optional timestamp for deterministic testing (defaults to Date.now())
 */
export function isEligible(
  candidate: UserSubscriptionCandidate,
  nowTime: number = Date.now()
): boolean {
  // 1. Must have exactly 5 scores
  if (candidate.scoresCount !== 5) {
    return false;
  }

  // 2. Must have a real subscription row
  if (!candidate.hasActiveSubscriptionRow) {
    return false;
  }

  // 3. Status checks:
  // - 'active': eligible if period is valid or no expiry is specified
  // - 'cancelled': eligible ONLY IF current_period_end is still in the future (paid period remaining)
  // - 'lapsed' / 'inactive': never eligible
  if (candidate.status === 'active') {
    if (!candidate.currentPeriodEnd) {
      return true;
    }
    const periodEndTime = new Date(candidate.currentPeriodEnd).getTime();
    return !isNaN(periodEndTime) && periodEndTime >= nowTime;
  }

  if (candidate.status === 'cancelled') {
    if (!candidate.currentPeriodEnd) {
      return false;
    }
    const periodEndTime = new Date(candidate.currentPeriodEnd).getTime();
    return !isNaN(periodEndTime) && periodEndTime >= nowTime;
  }

  return false;
}
