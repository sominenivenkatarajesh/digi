/**
 * Pure number generation and matching engine for Digital Heroes draws.
 */

/**
 * Generates 5 distinct random numbers between 1 and 45 (inclusive) sorted ascending.
 * Uses an injectable RNG function for deterministic testing.
 */
export function generateRandomNumbers(rng: () => number = Math.random): number[] {
  const pool = Array.from({ length: 45 }, (_, i) => i + 1);
  const selected: number[] = [];

  for (let i = 0; i < 5; i++) {
    const index = Math.floor(rng() * pool.length);
    selected.push(pool[index]);
    pool.splice(index, 1);
  }

  return selected.sort((a, b) => a - b);
}

/**
 * Generates 5 distinct numbers between 1 and 45 weighted by their frequency across
 * all eligible subscribers' scores.
 *
 * Algorithm Definition:
 * 1. Build a frequency distribution map for all numbers 1 through 45.
 * 2. Every number 1-45 begins with a base weight of 1, ensuring no number ever has a 0% chance.
 * 3. Add 1 to the weight for every time a number appears across any eligible user's scores.
 * 4. Sample 5 distinct numbers WITHOUT replacement:
 *    - Calculate total weight of remaining candidates.
 *    - Pick a random threshold: `r = rng() * totalWeight`.
 *    - Select the candidate whose cumulative weight exceeds `r`.
 *    - Remove the selected candidate from the remaining pool and repeat for 5 numbers.
 * 5. Return the 5 numbers sorted in ascending order.
 *
 * @param allScores - Array of score arrays from all eligible users (each user has 5 scores)
 * @param rng - Injectable RNG returning [0, 1)
 */
export function generateWeightedNumbers(
  allScores: number[][],
  rng: () => number = Math.random
): number[] {
  // Candidate pool: 1 to 45
  interface Candidate {
    number: number;
    weight: number;
  }

  const weights = new Map<number, number>();
  for (let n = 1; n <= 45; n++) {
    weights.set(n, 1); // Baseline weight of 1
  }

  for (const userScoreSet of allScores) {
    for (const val of userScoreSet) {
      if (val >= 1 && val <= 45) {
        weights.set(val, (weights.get(val) || 1) + 1);
      }
    }
  }

  const pool: Candidate[] = [];
  for (let n = 1; n <= 45; n++) {
    pool.push({ number: n, weight: weights.get(n) || 1 });
  }

  const selected: number[] = [];

  for (let drawIndex = 0; drawIndex < 5; drawIndex++) {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    const target = rng() * totalWeight;

    let cumulative = 0;
    let selectedIndex = 0;

    for (let i = 0; i < pool.length; i++) {
      cumulative += pool[i].weight;
      if (cumulative > target || i === pool.length - 1) {
        selectedIndex = i;
        break;
      }
    }

    selected.push(pool[selectedIndex].number);
    pool.splice(selectedIndex, 1);
  }

  return selected.sort((a, b) => a - b);
}

/**
 * Counts the number of winning numbers that match a user's stored Stableford scores (0 to 5).
 *
 * Rule:
 * A user with duplicate score values (e.g. scores [36, 36, 38, 40, 42]) cannot match a single
 * winning number (e.g. 36) multiple times. Matching checks set intersection of unique winning numbers
 * and unique user scores.
 */
export function countMatches(winningNumbers: number[], userScores: number[]): number {
  const winningSet = new Set(winningNumbers);
  const userUniqueScores = new Set(userScores);

  let matches = 0;
  for (const score of userUniqueScores) {
    if (winningSet.has(score)) {
      matches++;
    }
  }

  return matches;
}
