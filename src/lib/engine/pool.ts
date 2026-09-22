import {
  EligibleUser,
  PoolSettings,
  TierPoolsPence,
  PrizeAllocationResult,
  TierWinnerAllocation,
} from './types';

/**
 * Calculates the total modeled prize pool in integer pence based on eligible subscribers.
 *
 * Prize pool calculation:
 * This pool is modeled based on the active subscriber count:
 * - Monthly plans contribute: monthlyPricePence
 * - Yearly plans contribute: Math.round(yearlyPricePence / 12) (monthly equivalent)
 * Pool total = Math.round((sum of monthly equivalents * prizePoolPercent) / 100)
 *
 * Note: This is a modeled pool derived from active subscriptions participating that month,
 * not strictly cash settled through Stripe in that calendar month.
 */
export function calculatePool(
  eligibleUsers: Pick<EligibleUser, 'plan'>[],
  settings: PoolSettings
): number {
  if (eligibleUsers.length === 0) {
    return 0;
  }

  let totalMonthlyEquivalentPence = 0;
  for (const user of eligibleUsers) {
    if (user.plan === 'yearly') {
      totalMonthlyEquivalentPence += Math.round(settings.yearlyPricePence / 12);
    } else {
      totalMonthlyEquivalentPence += settings.monthlyPricePence;
    }
  }

  return Math.round((totalMonthlyEquivalentPence * settings.prizePoolPercent) / 100);
}

/**
 * Splits the base pool into the 3 tiers according to configured tier ratios:
 * - 5-match: 40% of base pool + any carried-in jackpot
 * - 4-match: 35% of base pool
 * - 3-match: 25% of base pool + any rounding remainder pence
 *
 * Exact Sum Guarantee:
 * Integer division can produce a remainder of 1-2 pence. This remainder is placed
 * into the 3-match tier so that:
 * (tier5Pence - jackpotCarriedInPence) + tier4Pence + tier3Pence === poolTotalPence exactly.
 */
export function splitTiers(
  poolTotalPence: number,
  jackpotCarriedInPence: number = 0
): TierPoolsPence {
  const safePool = Math.max(0, Math.floor(poolTotalPence));
  const safeCarryIn = Math.max(0, Math.floor(jackpotCarriedInPence));

  const tier5Base = Math.floor(safePool * 0.4);
  const tier4Pence = Math.floor(safePool * 0.35);
  // Any fractional penny remainder goes to Tier 3
  const tier3Pence = safePool - tier5Base - tier4Pence;
  const tier5Pence = tier5Base + safeCarryIn;

  return {
    tier5Pence,
    tier4Pence,
    tier3Pence,
    jackpotCarriedInPence: safeCarryIn,
    poolTotalPence: safePool,
  };
}

/**
 * Allocates prize pools across winners for each tier.
 *
 * Rules:
 * 1. Winners in the same tier split that tier's pool equally in integer pence.
 * 2. Leftover pence from an uneven split (e.g. £10.00 / 3 winners = £3.33 each with 1p leftover)
 *    remains unallocated in the pool.
 * 3. 5-match rollover: If there are 0 winners in Tier 5, the ENTIRE Tier 5 pool (including
 *    carried-in jackpot) becomes jackpot_rolled_over for the next month's draw.
 * 4. Tiers 4 and 3 NEVER roll over. If there are 0 winners, their pools remain in platform funds.
 */
export function allocatePrizes(
  tiers: TierPoolsPence,
  winnersPerTier: { tier5: number; tier4: number; tier3: number }
): PrizeAllocationResult {
  function allocateTier(
    tierPoolPence: number,
    winnerCount: number
  ): TierWinnerAllocation {
    if (winnerCount <= 0) {
      return {
        winnerCount: 0,
        prizePerWinnerPence: 0,
        totalAwardedPence: 0,
        unallocatedPence: tierPoolPence,
      };
    }

    const prizePerWinnerPence = Math.floor(tierPoolPence / winnerCount);
    const totalAwardedPence = prizePerWinnerPence * winnerCount;
    const unallocatedPence = tierPoolPence - totalAwardedPence;

    return {
      winnerCount,
      prizePerWinnerPence,
      totalAwardedPence,
      unallocatedPence,
    };
  }

  const tier5Alloc = allocateTier(tiers.tier5Pence, winnersPerTier.tier5);
  const tier4Alloc = allocateTier(tiers.tier4Pence, winnersPerTier.tier4);
  const tier3Alloc = allocateTier(tiers.tier3Pence, winnersPerTier.tier3);

  // Jackpot rollover: entire Tier 5 rolls over if no winners
  const jackpotRolledOverPence =
    winnersPerTier.tier5 === 0 ? tiers.tier5Pence : 0;

  const totalAwardedPence =
    tier5Alloc.totalAwardedPence +
    tier4Alloc.totalAwardedPence +
    tier3Alloc.totalAwardedPence;

  // Unallocated pence from uneven splits
  const totalUnallocatedPence =
    tier5Alloc.unallocatedPence +
    tier4Alloc.unallocatedPence +
    tier3Alloc.unallocatedPence;

  return {
    tier5: tier5Alloc,
    tier4: tier4Alloc,
    tier3: tier3Alloc,
    jackpotRolledOverPence,
    totalAwardedPence,
    totalUnallocatedPence,
  };
}
