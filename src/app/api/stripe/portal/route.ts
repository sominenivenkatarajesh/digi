import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripeClient } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe/portal
 * Creates a Stripe Customer Portal session allowing subscribers to manage billing, update cards, or cancel.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to manage your billing.' },
        { status: 401 }
      );
    }

    // Lookup subscriber's Stripe customer id
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No active Stripe billing profile found for this account.' },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();
    const rawOrigin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      req.headers.get('origin') ||
      'http://localhost:3000';
    const origin = rawOrigin.replace(/\/$/, '');

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/dashboard`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err: any) {
    console.error('Customer portal creation error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to open billing management portal.' },
      { status: 500 }
    );
  }
}
