import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripeClient, getStripePriceId } from '@/lib/stripe';
import { checkoutSchema } from '@/lib/validations/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session in subscription mode for the authenticated user.
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
        { error: 'You must be logged in to start a subscription.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validation = checkoutSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid plan selection' },
        { status: 400 }
      );
    }

    const { plan } = validation.data;

    // Block users who already have an active subscription
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('status, current_period_end, stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingSub && existingSub.status === 'active') {
      const isPeriodValid =
        !existingSub.current_period_end ||
        new Date(existingSub.current_period_end) > new Date();
      if (isPeriodValid) {
        return NextResponse.json(
          {
            error:
              'You already have an active Digital Heroes membership. Manage your billing from the dashboard.',
          },
          { status: 400 }
        );
      }
    }

    const stripe = getStripeClient();
    const priceId = getStripePriceId(plan);

    // Reuse existing Stripe customer or create a new one
    let customerId = existingSub?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name:
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          'Hero Member',
        metadata: {
          user_id: user.id,
        },
      });
      customerId = customer.id;
    }

    // Determine site origin for redirects (prioritize NEXT_PUBLIC_SITE_URL, fallback to localhost:3000)
    const rawOrigin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      req.headers.get('origin') ||
      'http://localhost:3000';
    const origin = rawOrigin.replace(/\/$/, '');

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        user_id: user.id,
        plan,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan,
        },
      },
      success_url: `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/subscribe/cancelled`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Checkout session creation error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to initiate checkout session.' },
      { status: 500 }
    );
  }
}
