/**
 * Pure function to calculate charity contribution amount in integer pence.
 *
 * @param amountPence - The payment amount in integer pence (e.g. 1000p for £10.00)
 * @param percent - The chosen charity percentage (must be between minPercent and 100)
 * @param minPercent - The minimum platform percentage (defaults to 10)
 * @returns The contribution in integer pence, rounded, and capped at amountPence
 */
export function calculateContribution(
  amountPence: number,
  percent: number,
  minPercent: number = 10
): number {
  if (typeof amountPence !== 'number' || isNaN(amountPence) || amountPence <= 0) {
    return 0;
  }

  if (typeof percent !== 'number' || isNaN(percent)) {
    throw new Error('Contribution percent must be a valid number.');
  }

  if (percent < minPercent) {
    throw new Error(
      `Charity contribution percent cannot be less than the platform minimum of ${minPercent}%.`
    );
  }

  if (percent > 100) {
    throw new Error('Charity contribution percent cannot exceed 100%.');
  }

  // Calculate safely rounded integer pence
  const contributionPence = Math.round((amountPence * percent) / 100);

  // Guarantee never more than amountPence and never negative
  return Math.min(Math.round(amountPence), Math.max(0, contributionPence));
}

/**
 * Calculates charity contribution in decimal pounds with 2 decimal places.
 *
 * @param amountPounds - The payment amount in pounds (e.g. 10.00)
 * @param percent - The chosen percentage (10 to 100)
 * @param minPercent - Minimum percentage (default 10)
 * @returns Pounds with 2 decimals
 */
export function calculateContributionPounds(
  amountPounds: number,
  percent: number,
  minPercent: number = 10
): number {
  const amountPence = Math.round(amountPounds * 100);
  const contributionPence = calculateContribution(amountPence, percent, minPercent);
  return Number((contributionPence / 100).toFixed(2));
}
