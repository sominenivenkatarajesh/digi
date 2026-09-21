import {
  EligibleUser,
  PoolSettings,
  DrawMode,
  DrawResult,
  DrawEntryResult,
  DrawWinnerResult,
} from './types';
import {
  generateRandomNumbers,
  generateWeightedNumbers,
  countMatches,
} from './numbers';
import { calculatePool, splitTiers, allocatePrizes } from './pool';

export interface RunDrawInput {
  eligibleUsers: EligibleUser[];
  mode: DrawMode;
  jackpotCarriedInPence?: number;
  settings: PoolSettings;
  rng?: () => number;
  manualWinningNumbers?: number[]; // Used when publishing from an existing simulation
}

/**
 * Executes a deterministic draw given eligible users, platform pricing, and settings.
 * Can be run for simulations or official publication.
 */
export function runDraw(input: RunDrawInput): DrawResult {
  const {
    eligibleUsers,
    mode,
    jackpotCarriedInPence = 0,
    settings,
    rng = Math.random,
    manualWinningNumbers,
  } = input;

  // 1. Determine winning numbers
  let winningNumbers: number[];
  if (manualWinningNumbers && manualWinningNumbers.length === 5) {
    winningNumbers = [...manualWinningNumbers].sort((a, b) => a - b);
  } else if (mode === 'algorithm') {
    const allScores = eligibleUsers.map((u) => u.scores);
    winningNumbers = generateWeightedNumbers(allScores, rng);
  } else {
    winningNumbers = generateRandomNumbers(rng);
  }

  // 2. Calculate pool in integer pence
  const poolTotalPence = calculatePool(eligibleUsers, settings);
  const tiers = splitTiers(poolTotalPence, jackpotCarriedInPence);

  // 3. Match each user and track winners
  const entries: DrawEntryResult[] = [];
  const tier5Winners: string[] = [];
  const tier4Winners: string[] = [];
  const tier3Winners: string[] = [];

  for (const user of eligibleUsers) {
    const matchCount = countMatches(winningNumbers, user.scores);
    let tier: '5' | '4' | '3' | null = null;

    if (matchCount === 5) {
      tier = '5';
      tier5Winners.push(user.userId);
    } else if (matchCount === 4) {
      tier = '4';
      tier4Winners.push(user.userId);
    } else if (matchCount === 3) {
      tier = '3';
      tier3Winners.push(user.userId);
    }

    entries.push({
      userId: user.userId,
      scoresSnapshot: [...user.scores],
      matchCount,
      tier,
      prizeAmountPence: 0, // Assigned after allocation
    });
  }

  // 4. Allocate prizes across tiers
  const winnersPerTier = {
    tier5: tier5Winners.length,
    tier4: tier4Winners.length,
    tier3: tier3Winners.length,
  };

  const allocation = allocatePrizes(tiers, winnersPerTier);

  // 5. Update entries with prize amount and build winners list
  const winners: DrawWinnerResult[] = [];

  for (const entry of entries) {
    if (entry.tier === '5') {
      entry.prizeAmountPence = allocation.tier5.prizePerWinnerPence;
      winners.push({
        userId: entry.userId,
        tier: '5',
        prizeAmountPence: entry.prizeAmountPence,
        prizeAmountPounds: Number((entry.prizeAmountPence / 100).toFixed(2)),
      });
    } else if (entry.tier === '4') {
      entry.prizeAmountPence = allocation.tier4.prizePerWinnerPence;
      winners.push({
        userId: entry.userId,
        tier: '4',
        prizeAmountPence: entry.prizeAmountPence,
        prizeAmountPounds: Number((entry.prizeAmountPence / 100).toFixed(2)),
      });
    } else if (entry.tier === '3') {
      entry.prizeAmountPence = allocation.tier3.prizePerWinnerPence;
      winners.push({
        userId: entry.userId,
        tier: '3',
        prizeAmountPence: entry.prizeAmountPence,
        prizeAmountPounds: Number((entry.prizeAmountPence / 100).toFixed(2)),
      });
    }
  }

  return {
    winningNumbers,
    mode,
    poolTotalPence,
    poolTotalPounds: Number((poolTotalPence / 100).toFixed(2)),
    jackpotCarriedInPence,
    jackpotCarriedInPounds: Number((jackpotCarriedInPence / 100).toFixed(2)),
    tiers,
    allocation,
    jackpotRolledOverPence: allocation.jackpotRolledOverPence,
    jackpotRolledOverPounds: Number(
      (allocation.jackpotRolledOverPence / 100).toFixed(2)
    ),
    entries,
    winners,
    eligibleCount: eligibleUsers.length,
  };
}
