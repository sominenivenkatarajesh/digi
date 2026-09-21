export type DrawMode = 'random' | 'algorithm';

export interface EligibleUser {
  userId: string;
  plan: 'monthly' | 'yearly';
  scores: number[]; // exactly 5 scores
}

export interface UserSubscriptionCandidate {
  userId: string;
  role?: string;
  hasActiveSubscriptionRow: boolean;
  status: 'active' | 'inactive' | 'cancelled' | 'lapsed';
  currentPeriodEnd: string | null;
  scoresCount: number;
}

export interface PoolSettings {
  monthlyPricePence: number; // e.g. 1000 for £10
  yearlyPricePence: number;  // e.g. 9900 for £99
  prizePoolPercent: number;  // e.g. 45 for 45%
}

export interface TierPoolsPence {
  tier5Pence: number; // 40% + carried-in jackpot
  tier4Pence: number; // 35%
  tier3Pence: number; // 25% + rounding remainder
  jackpotCarriedInPence: number;
  poolTotalPence: number; // base pool without carry-in
}

export interface TierWinnerAllocation {
  winnerCount: number;
  prizePerWinnerPence: number;
  totalAwardedPence: number;
  unallocatedPence: number; // leftover pence from uneven splits
}

export interface PrizeAllocationResult {
  tier5: TierWinnerAllocation;
  tier4: TierWinnerAllocation;
  tier3: TierWinnerAllocation;
  jackpotRolledOverPence: number;
  totalAwardedPence: number;
  totalUnallocatedPence: number;
}

export interface DrawEntryResult {
  userId: string;
  scoresSnapshot: number[];
  matchCount: number;
  tier: '5' | '4' | '3' | null;
  prizeAmountPence: number;
}

export interface DrawWinnerResult {
  userId: string;
  tier: '5' | '4' | '3';
  prizeAmountPence: number;
  prizeAmountPounds: number;
}

export interface DrawResult {
  winningNumbers: number[];
  mode: DrawMode;
  poolTotalPence: number;
  poolTotalPounds: number;
  jackpotCarriedInPence: number;
  jackpotCarriedInPounds: number;
  tiers: TierPoolsPence;
  allocation: PrizeAllocationResult;
  jackpotRolledOverPence: number;
  jackpotRolledOverPounds: number;
  entries: DrawEntryResult[];
  winners: DrawWinnerResult[];
  eligibleCount: number;
}

export interface SimulationSummary {
  winningNumbers: number[];
  mode: DrawMode;
  poolTotal: number; // in pounds
  jackpotCarriedIn: number;
  jackpotRolledOver: number;
  tier5Pool: number;
  tier4Pool: number;
  tier3Pool: number;
  tier5Winners: number;
  tier4Winners: number;
  tier3Winners: number;
  tier5PrizePerWinner: number;
  tier4PrizePerWinner: number;
  tier3PrizePerWinner: number;
  eligibleCount: number;
  totalSubscribersEvaluated: number;
}
