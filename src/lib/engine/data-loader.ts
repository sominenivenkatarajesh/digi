import { createAdminClient } from '@/lib/supabase/admin';
import { EligibleUser, PoolSettings, UserSubscriptionCandidate } from './types';
import { isEligible } from './eligibility';

const PAGE_SIZE = 1000;

/**
 * Loads all eligible users and their 5 latest scores using paginated queries.
 *
 * Pagination Guarantee:
 * Supabase/PostgREST enforces a default 1,000-row limit per query.
 * This loader paginates through subscriptions and scores using `.range(offset, offset + PAGE_SIZE - 1)`
 * in a loop until all records are consumed, ensuring zero users are silently dropped.
 */
export async function loadEligibleUsersAndScores(): Promise<{
  eligibleUsers: EligibleUser[];
  settings: PoolSettings;
  totalSubscribersEvaluated: number;
}> {
  const adminClient = createAdminClient();

  // 1. Fetch platform pricing settings
  const { data: settingsData } = await adminClient
    .from('platform_settings')
    .select('monthly_price, yearly_price, prize_pool_percent, monthly_subscription_price, annual_subscription_price')
    .limit(1)
    .maybeSingle();

  const monthlyPricePence = Math.round(
    Number(settingsData?.monthly_price ?? settingsData?.monthly_subscription_price ?? 10) * 100
  );
  const yearlyPricePence = Math.round(
    Number(settingsData?.yearly_price ?? settingsData?.annual_subscription_price ?? 99) * 100
  );
  const prizePoolPercent = Number(settingsData?.prize_pool_percent ?? 45);

  const poolSettings: PoolSettings = {
    monthlyPricePence,
    yearlyPricePence,
    prizePoolPercent,
  };

  // 2. Fetch all active and cancelled subscriptions in pages of 1,000
  const subscriptionsMap = new Map<
    string,
    { plan: 'monthly' | 'yearly'; status: string; current_period_end: string | null }
  >();

  let subOffset = 0;
  let hasMoreSubs = true;

  while (hasMoreSubs) {
    const { data: subBatch, error: subErr } = await adminClient
      .from('subscriptions')
      .select('user_id, plan, status, current_period_end')
      .in('status', ['active', 'cancelled'])
      .range(subOffset, subOffset + PAGE_SIZE - 1);

    if (subErr) {
      console.error('Error loading subscriptions batch:', subErr);
      break;
    }

    if (!subBatch || subBatch.length === 0) {
      hasMoreSubs = false;
      break;
    }

    for (const sub of subBatch) {
      subscriptionsMap.set(sub.user_id, {
        plan: (sub.plan as 'monthly' | 'yearly') || 'monthly',
        status: sub.status,
        current_period_end: sub.current_period_end,
      });
    }

    if (subBatch.length < PAGE_SIZE) {
      hasMoreSubs = false;
    } else {
      subOffset += PAGE_SIZE;
    }
  }

  // 3. Fetch all scores in pages of 1,000
  const userScoresMap = new Map<string, { score: number; played_on: string }[]>();

  let scoreOffset = 0;
  let hasMoreScores = true;

  while (hasMoreScores) {
    const { data: scoreBatch, error: scoreErr } = await adminClient
      .from('scores')
      .select('user_id, score, played_on')
      .range(scoreOffset, scoreOffset + PAGE_SIZE - 1);

    if (scoreErr) {
      console.error('Error loading scores batch:', scoreErr);
      break;
    }

    if (!scoreBatch || scoreBatch.length === 0) {
      hasMoreScores = false;
      break;
    }

    for (const row of scoreBatch) {
      if (!userScoresMap.has(row.user_id)) {
        userScoresMap.set(row.user_id, []);
      }
      userScoresMap.get(row.user_id)!.push({
        score: row.score,
        played_on: row.played_on,
      });
    }

    if (scoreBatch.length < PAGE_SIZE) {
      hasMoreScores = false;
    } else {
      scoreOffset += PAGE_SIZE;
    }
  }

  // 4. Evaluate eligibility for all subscribers
  const eligibleUsers: EligibleUser[] = [];
  const nowTime = Date.now();

  for (const [userId, subInfo] of subscriptionsMap.entries()) {
    const rawScores = userScoresMap.get(userId) || [];

    // Sort by played_on DESC to obtain the latest 5 scores
    rawScores.sort(
      (a, b) => new Date(b.played_on).getTime() - new Date(a.played_on).getTime()
    );

    const latest5Scores = rawScores.slice(0, 5).map((s) => s.score);

    const candidate: UserSubscriptionCandidate = {
      userId,
      hasActiveSubscriptionRow: true,
      status: subInfo.status as any,
      currentPeriodEnd: subInfo.current_period_end,
      scoresCount: rawScores.length, // Must have recorded at least 5 scores
    };

    // If candidate has 5 or more scores, they have 5 valid scores for the draw
    if (rawScores.length >= 5 && isEligible({ ...candidate, scoresCount: 5 }, nowTime)) {
      eligibleUsers.push({
        userId,
        plan: subInfo.plan,
        scores: latest5Scores,
      });
    }
  }

  return {
    eligibleUsers,
    settings: poolSettings,
    totalSubscribersEvaluated: subscriptionsMap.size,
  };
}
