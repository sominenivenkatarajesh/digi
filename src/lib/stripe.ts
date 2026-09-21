import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

/**
 * Returns the server-side Stripe client singleton.
 * Validates existence of STRIPE_SECRET_KEY at request time so Next.js build is not broken if keys are absent.
 */
export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      'Missing STRIPE_SECRET_KEY in environment variables. Please add your Stripe Secret Key to .env.local'
    );
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2026-08-26.dahlia' as any,
      typescript: true,
      appInfo: {
        name: 'Digital Heroes',
        version: '1.0.0',
      },
    });
  }

  return stripeClient;
}

/**
 * Retrieves the Stripe Price ID for a chosen subscription plan.
 */
export function getStripePriceId(plan: 'monthly' | 'yearly'): string {
  const priceId =
    plan === 'yearly'
      ? process.env.STRIPE_PRICE_YEARLY
      : process.env.STRIPE_PRICE_MONTHLY;

  if (!priceId) {
    throw new Error(
      `Missing ${plan === 'yearly' ? 'STRIPE_PRICE_YEARLY' : 'STRIPE_PRICE_MONTHLY'} in environment variables. Please configure your Stripe recurring prices.`
    );
  }

  return priceId;
}
