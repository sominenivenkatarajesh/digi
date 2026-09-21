/**
 * Pure contribution calculation logic.
 *
 * STORAGE & CURRENCY SPECIFICATION:
 * - Stripe Invoices / Charges operate in integer pence (e.g. 1000 pence = £10.00).
 * - The Supabase `payments` table stores monetary columns (`amount`, `charity_amount`, `pool_amount`)
 *   in decimal Pounds (NUMERIC, e.g. 10.00 for £10).
 * - All core arithmetic is performed in whole integer pence to avoid floating-point drift,
 *   and converted consistently using `penceToPounds`.
 */

export function poundsToPence(pounds: number): number {
  return Math.round(pounds * 100);
}

export function penceToPounds(pence: number): number {
  return Math.round(pence) / 100;
}

/**
 * Pure function to calculate charity contribution amount in whole integer pence.
 *
 * @param amountPence - The total payment amount in whole integer pence (e.g. 1000 for £10.00)
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

  // Integer pence rounded to nearest whole penny
  const contributionPence = Math.round((amountPence * percent) / 100);

  // Guarantee never more than amountPence and never negative
  return Math.min(Math.round(amountPence), Math.max(0, contributionPence));
}
