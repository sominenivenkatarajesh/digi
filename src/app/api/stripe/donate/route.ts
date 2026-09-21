import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getStripeClient } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const donateSchema = z.object({
  charityId: z.string().min(1, 'Charity ID is required'),
  amount: z
    .number({ error: 'Donation amount must be a number' })
    .min(1, 'Minimum donation amount is £1.00')
    .max(10000, 'Maximum single donation amount is £10,000'),
});

/**
 * POST /api/stripe/donate
 * Creates a one-off Stripe Checkout Session in 'payment' mode for direct charitable giving.
 * Independent of draws and subscriptions. Open to both logged-in members and guests.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validation = donateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid donation parameters.' },
        { status: 400 }
      );
    }

    const { charityId, amount } = validation.data;
    const supabase = await createClient();

    // Check optional authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Verify charity is active
    const { data: charity, error: charityError } = await supabase
      .from('charities')
      .select('id, name, slug, is_active')
      .or(`id.eq.${charityId},slug.eq.${charityId}`)
      .maybeSingle();

    if (charityError || !charity || !charity.is_active) {
      return NextResponse.json(
        { error: 'Selected charity was not found or is currently inactive.' },
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

    // Create Stripe Checkout Session in payment mode (one-off)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: `Direct Donation: ${charity.name}`,
              description: 'Independent charitable contribution via Digital Heroes',
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'donation',
        charity_id: charity.id,
        user_id: user?.id || null,
      },
      customer_email: user?.email || undefined,
      success_url: `${origin}/donate/success?session_id={CHECKOUT_SESSION_ID}&charity=${charity.slug || charity.id}`,
      cancel_url: `${origin}/charities/${charity.slug || charity.id}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Donation checkout session error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to initiate donation checkout.' },
      { status: 500 }
    );
  }
}
