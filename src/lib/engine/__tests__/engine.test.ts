import { describe, it, expect } from 'vitest';
import {
  isEligible,
  generateRandomNumbers,
  generateWeightedNumbers,
  countMatches,
  calculatePool,
  splitTiers,
  allocatePrizes,
  runDraw,
  UserSubscriptionCandidate,
  PoolSettings,
} from '../index';

describe('Draw Engine - Eligibility (isEligible)', () => {
  const baseCandidate: UserSubscriptionCandidate = {
    userId: 'user-1',
    hasActiveSubscriptionRow: true,
    status: 'active',
    currentPeriodEnd: new Date(Date.now() + 86400000 * 30).toISOString(),
    scoresCount: 5,
  };

  it('approves user with active subscription and exactly 5 scores', () => {
    expect(isEligible(baseCandidate)).toBe(true);
  });

  it('rejects user with 4 scores', () => {
    expect(isEligible({ ...baseCandidate, scoresCount: 4 })).toBe(false);
  });

  it('rejects user with 6 scores', () => {
    expect(isEligible({ ...baseCandidate, scoresCount: 6 })).toBe(false);
  });

  it('rejects user without a subscription row', () => {
    expect(isEligible({ ...baseCandidate, hasActiveSubscriptionRow: false })).toBe(false);
  });

  it('rejects user with lapsed subscription', () => {
    expect(isEligible({ ...baseCandidate, status: 'lapsed' })).toBe(false);
  });

  it('approves cancelled user whose paid period is still valid in the future', () => {
    const futureDate = new Date(Date.now() + 86400000 * 10).toISOString();
    expect(isEligible({ ...baseCandidate, status: 'cancelled', currentPeriodEnd: futureDate })).toBe(true);
  });

  it('rejects cancelled user whose paid period has expired in the past', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    expect(isEligible({ ...baseCandidate, status: 'cancelled', currentPeriodEnd: pastDate })).toBe(false);
  });

  it('strictly rejects admin users without a real active subscription row (admin bypass does not grant draw eligibility)', () => {
    const adminWithoutSub: UserSubscriptionCandidate = {
      userId: 'admin-1',
      role: 'admin',
      hasActiveSubscriptionRow: false,
      status: 'inactive',
      currentPeriodEnd: null,
      scoresCount: 5,
    };
    expect(isEligible(adminWithoutSub)).toBe(false);
  });
});

describe('Draw Engine - Number Generation & Matching', () => {
  it('generates 5 distinct numbers between 1 and 45 sorted ascending', () => {
    for (let trial = 0; trial < 20; trial++) {
      const numbers = generateRandomNumbers();
      expect(numbers).toHaveLength(5);
      // All within 1-45
      expect(numbers.every((n) => n >= 1 && n <= 45)).toBe(true);
      // Strictly unique
      const set = new Set(numbers);
      expect(set.size).toBe(5);
      // Strictly sorted
      for (let i = 0; i < 4; i++) {
        expect(numbers[i]).toBeLessThan(numbers[i + 1]);
      }
    }
  });

  it('generates weighted numbers correctly even when allScores is empty', () => {
    const numbers = generateWeightedNumbers([]);
    expect(numbers).toHaveLength(5);
    expect(new Set(numbers).size).toBe(5);
  });

  it('weighted generation favors highly frequent numbers with deterministic RNG', () => {
    // Scores heavily populated with 41, 42, 43, 44, 45
    const heavyScores = Array.from({ length: 50 }, () => [41, 42, 43, 44, 45]);
    
    // Simple pseudo-random generator
    let seed = 42;
    const deterministicRng = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    let frequentHitCount = 0;
    const trials = 100;
    for (let t = 0; t < trials; t++) {
      const res = generateWeightedNumbers(heavyScores, deterministicRng);
      for (const n of res) {
        if (n >= 41 && n <= 45) {
          frequentHitCount++;
        }
      }
    }

    // Heavy numbers (41-45) should make up a massive percentage of selections compared to uniform 5/45
    expect(frequentHitCount).toBeGreaterThan(150);
  });

  it('counts matches correctly (0 to 5)', () => {
    const winning = [7, 14, 21, 28, 35];
    expect(countMatches(winning, [1, 2, 3, 4, 5])).toBe(0);
    expect(countMatches(winning, [7, 2, 3, 4, 5])).toBe(1);
    expect(countMatches(winning, [7, 14, 3, 4, 5])).toBe(2);
    expect(countMatches(winning, [7, 14, 21, 4, 5])).toBe(3);
    expect(countMatches(winning, [7, 14, 21, 28, 5])).toBe(4);
    expect(countMatches(winning, [7, 14, 21, 28, 35])).toBe(5);
  });

  it('is order-independent in match counting', () => {
    const winning = [10, 20, 30, 40, 45];
    expect(countMatches(winning, [45, 40, 30, 20, 10])).toBe(5);
  });

  it('prevents duplicate score values from matching a single winning number multiple times', () => {
    const winning = [36, 1, 2, 3, 4];
    // User has 36 entered three times (e.g. Stableford score 36 on different rounds)
    const userScores = [36, 36, 36, 10, 15];
    expect(countMatches(winning, userScores)).toBe(1);
  });
});

describe('Draw Engine - Pool & Tiers Math', () => {
  const settings: PoolSettings = {
    monthlyPricePence: 1000, // £10
    yearlyPricePence: 9900,  // £99 (monthly equivalent = 825p)
    prizePoolPercent: 45,    // 45%
  };

  it('calculates pool correctly based on monthly equivalents and 45% ratio', () => {
    // 2 monthly (1000 + 1000 = 2000p) + 1 yearly (825p) = 2825p base
    // 45% of 2825 = 1271.25 -> 1271p
    const pool = calculatePool(
      [{ plan: 'monthly' }, { plan: 'monthly' }, { plan: 'yearly' }],
      settings
    );
    expect(pool).toBe(1271);
  });

  it('splitTiers parts sum EXACTLY to poolTotal across various awkward values', () => {
    const awkwardPoolValues = [0, 1, 2, 3, 7, 100, 1001, 1003, 7777, 99999, 1234567];

    for (const pool of awkwardPoolValues) {
      const carryIn = 500;
      const tiers = splitTiers(pool, carryIn);

      // Base tiers must equal pool exactly
      const baseTierSum = (tiers.tier5Pence - carryIn) + tiers.tier4Pence + tiers.tier3Pence;
      expect(baseTierSum).toBe(pool);

      // Total including carry-in must equal pool + carryIn
      const totalTierSum = tiers.tier5Pence + tiers.tier4Pence + tiers.tier3Pence;
      expect(totalTierSum).toBe(pool + carryIn);
    }
  });

  it('routes carry-in jackpot strictly to tier 5 only', () => {
    const pool = 10000;
    const carryIn = 25000;
    const tiersWithout = splitTiers(pool, 0);
    const tiersWith = splitTiers(pool, carryIn);

    expect(tiersWith.tier5Pence).toBe(tiersWithout.tier5Pence + carryIn);
    expect(tiersWith.tier4Pence).toBe(tiersWithout.tier4Pence);
    expect(tiersWith.tier3Pence).toBe(tiersWithout.tier3Pence);
  });

  it('allocates prizes equally among winners and computes remainder', () => {
    const tiers = splitTiers(10000, 0); // tier5=4000p, tier4=3500p, tier3=2500p

    // 1 winner in tier 5, 2 in tier 4, 3 in tier 3
    const alloc = allocatePrizes(tiers, { tier5: 1, tier4: 2, tier3: 3 });

    expect(alloc.tier5.prizePerWinnerPence).toBe(4000);
    expect(alloc.tier5.totalAwardedPence).toBe(4000);
    expect(alloc.tier5.unallocatedPence).toBe(0);

    expect(alloc.tier4.prizePerWinnerPence).toBe(1750);
    expect(alloc.tier4.totalAwardedPence).toBe(3500);
    expect(alloc.tier4.unallocatedPence).toBe(0);

    // 2500 / 3 = 833 with 1p remainder
    expect(alloc.tier3.prizePerWinnerPence).toBe(833);
    expect(alloc.tier3.totalAwardedPence).toBe(2499);
    expect(alloc.tier3.unallocatedPence).toBe(1);

    expect(alloc.jackpotRolledOverPence).toBe(0);
  });

  it('rolls over entire Tier 5 (including carry-in) if there are 0 Tier 5 winners', () => {
    const carryIn = 15000;
    const tiers = splitTiers(10000, carryIn); // tier5 = 4000 + 15000 = 19000p
    const alloc = allocatePrizes(tiers, { tier5: 0, tier4: 1, tier3: 2 });

    expect(alloc.tier5.winnerCount).toBe(0);
    expect(alloc.tier5.prizePerWinnerPence).toBe(0);
    expect(alloc.jackpotRolledOverPence).toBe(19000); // Rolls over completely
  });

  it('never rolls over Tier 4 or Tier 3 when there are 0 winners', () => {
    const tiers = splitTiers(10000, 0);
    const alloc = allocatePrizes(tiers, { tier5: 1, tier4: 0, tier3: 0 });

    expect(alloc.tier4.winnerCount).toBe(0);
    expect(alloc.tier3.winnerCount).toBe(0);
    expect(alloc.jackpotRolledOverPence).toBe(0); // Only Tier 5 rolls over
  });
});

describe('Draw Engine - runDraw Integration', () => {
  const settings: PoolSettings = {
    monthlyPricePence: 1000,
    yearlyPricePence: 9900,
    prizePoolPercent: 45,
  };

  it('runs full draw with deterministic manual numbers and splits prizes equally between identical-score winners', () => {
    const user1 = { userId: 'u1', plan: 'monthly' as const, scores: [10, 20, 30, 40, 45] };
    const user2 = { userId: 'u2', plan: 'monthly' as const, scores: [10, 20, 30, 40, 45] }; // Identical scores!
    const user3 = { userId: 'u3', plan: 'yearly' as const, scores: [10, 20, 30, 40, 1] };    // 4 matches
    const user4 = { userId: 'u4', plan: 'monthly' as const, scores: [10, 20, 30, 2, 3] };     // 3 matches
    const user5 = { userId: 'u5', plan: 'monthly' as const, scores: [1, 2, 3, 4, 5] };        // 0 matches

    const result = runDraw({
      eligibleUsers: [user1, user2, user3, user4, user5],
      mode: 'random',
      manualWinningNumbers: [10, 20, 30, 40, 45],
      settings,
      jackpotCarriedInPence: 5000, // £50 carry-in
    });

    expect(result.winningNumbers).toEqual([10, 20, 30, 40, 45]);
    expect(result.eligibleCount).toBe(5);

    // Two 5-match winners: u1 and u2
    const tier5Winners = result.winners.filter((w) => w.tier === '5');
    expect(tier5Winners).toHaveLength(2);
    expect(tier5Winners[0].prizeAmountPence).toBe(tier5Winners[1].prizeAmountPence);
    expect(tier5Winners[0].prizeAmountPence + tier5Winners[1].prizeAmountPence).toBeLessThanOrEqual(
      result.tiers.tier5Pence
    );

    // One 4-match winner: u3
    const tier4Winners = result.winners.filter((w) => w.tier === '4');
    expect(tier4Winners).toHaveLength(1);
    expect(tier4Winners[0].userId).toBe('u3');

    // One 3-match winner: u4
    const tier3Winners = result.winners.filter((w) => w.tier === '3');
    expect(tier3Winners).toHaveLength(1);
    expect(tier3Winners[0].userId).toBe('u4');

    // Rollover is 0 because tier 5 had winners
    expect(result.jackpotRolledOverPence).toBe(0);
  });
});
