import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeClient } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateContributionPounds } from '@/lib/charity/calculate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mapStripeStatus(stripeStatus: string): 'active' | 'inactive' | 'cancelled' | 'lapsed' {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'lapsed';
    case 'canceled':
      return 'cancelled';
    default:
      return 'inactive';
  }
}

/**
 * POST /api/stripe/webhook
 * Handles incoming Stripe webhooks idempotently using the Supabase Service Role client.
 */
export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('Webhook error: Missing STRIPE_WEBHOOK_SECRET');
    return NextResponse.json(
      { error: 'STRIPE_WEBHOOK_SECRET is not configured.' },
      { status: 500 }
    );
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    console.error('Webhook error: Missing stripe-signature header');
    return NextResponse.json(
      { error: 'Missing stripe-signature header.' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  const rawBody = await req.text();

  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err.message}` },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      // 1. Checkout Session Completed
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // Branch 1: Independent Donation Session (mode = 'payment')
        if (session.mode === 'payment' && session.metadata?.type === 'donation') {
          const charityId = session.metadata.charity_id;
          const userId = session.metadata.user_id || null;
          const amountTotal = (session.amount_total || 0) / 100;
          const stripePaymentId =
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.id;

          if (charityId && amountTotal > 0) {
            const { error: donationError } = await supabase.from('donations').upsert(
              {
                charity_id: charityId,
                user_id: userId,
                amount: amountTotal,
                stripe_payment_id: stripePaymentId,
                created_at: new Date().toISOString(),
              },
              { onConflict: 'stripe_payment_id', ignoreDuplicates: true }
            );

            if (donationError) {
              console.error('[Stripe Webhook] Error recording donation:', donationError);
              throw donationError;
            }
          }
          break;
        }

        // Branch 2: Membership Subscription Session (Phase 2)
        const userId = session.metadata?.user_id;
        const plan = (session.metadata?.plan as 'monthly' | 'yearly') || 'monthly';
        const customerId =
          typeof session.customer === 'string'
            ? session.customer
            : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id;

        if (!userId) {
          console.warn(
            '[Stripe Webhook] checkout.session.completed missing user_id metadata; skipping session:',
            session.id
          );
          break;
        }

        // Upsert subscription record for this user
        const { error: upsertError } = await supabase.from('subscriptions').upsert(
          {
            user_id: userId,
            stripe_customer_id: customerId || null,
            stripe_subscription_id: subscriptionId || null,
            plan: plan,
            status: 'active',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

        if (upsertError) {
          console.error(
            '[Stripe Webhook] Error linking subscription on checkout.session.completed:',
            upsertError
          );
          throw upsertError;
        }
        break;
      }

      // 2. Subscription Created or Updated
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id;

        // Try user_id from metadata first, fallback to customer_id lookup
        let userId = subscription.metadata?.user_id;

        if (!userId && customerId) {
          const { data: subLookup } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();
          userId = subLookup?.user_id;
        }

        if (!userId) {
          console.warn(
            `[Stripe Webhook] ${event.type}: Could not resolve user for subscription ${subscription.id} (customer ${customerId})`
          );
          break;
        }

        // In newer Stripe API versions, period dates live on subscription.items.data[0]
        const firstItem = subscription.items?.data?.[0];
        const startSec =
          (firstItem as any)?.current_period_start ??
          (subscription as any).current_period_start;
        const endSec =
          (firstItem as any)?.current_period_end ??
          (subscription as any).current_period_end;

        const periodStart = startSec ? new Date(startSec * 1000).toISOString() : null;
        const periodEnd = endSec ? new Date(endSec * 1000).toISOString() : null;

        const mappedStatus = mapStripeStatus(subscription.status);
        const plan =
          (subscription.metadata?.plan as 'monthly' | 'yearly') ||
          (firstItem?.price?.recurring?.interval === 'year' ? 'yearly' : 'monthly');
        const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;

        const { error: syncError } = await supabase.from('subscriptions').upsert(
          {
            user_id: userId,
            stripe_customer_id: customerId || null,
            stripe_subscription_id: subscription.id,
            plan: plan,
            status: mappedStatus,
            current_period_start: periodStart,
            current_period_end: periodEnd,
            cancel_at_period_end: cancelAtPeriodEnd,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

        if (syncError) {
          console.error(
            `[Stripe Webhook] Error updating subscription ${subscription.id}:`,
            syncError
          );
          throw syncError;
        }
        break;
      }

      // 3. Subscription Deleted (Cancelled)
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id;

        let userId = subscription.metadata?.user_id;
        if (!userId && customerId) {
          const { data: subLookup } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();
          userId = subLookup?.user_id;
        }

        if (userId) {
          const { error: cancelError } = await supabase
            .from('subscriptions')
            .update({
              status: 'cancelled',
              cancel_at_period_end: false,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

          if (cancelError) {
            console.error(
              `[Stripe Webhook] Error cancelling subscription for user ${userId}:`,
              cancelError
            );
            throw cancelError;
          }
        }
        break;
      }

      // 4. Invoice Paid
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const amountPaid = (invoice.amount_paid || 0) / 100;

        // Skip zero-amount invoices as instructed
        if (amountPaid <= 0) {
          console.log('[Stripe Webhook] Skipping zero-amount invoice:', invoice.id);
          break;
        }

        // Read subscription id from invoice.parent.subscription_details with fallback to older invoice.subscription
        const subDetails = (invoice as any)?.parent?.subscription_details;
        const subscriptionId =
          subDetails?.id ||
          subDetails?.subscription ||
          (invoice as any).subscription ||
          null;

        const customerId =
          typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer?.id;

        // Locate subscription in Supabase
        let query = supabase.from('subscriptions').select('id, user_id, plan');
        if (subscriptionId) {
          query = query.eq('stripe_subscription_id', subscriptionId);
        } else if (customerId) {
          query = query.eq('stripe_customer_id', customerId);
        }

        const { data: subRecord, error: subFetchErr } = await query.maybeSingle();
        if (subFetchErr) {
          console.error('[Stripe Webhook] Error fetching subscription for invoice:', subFetchErr);
          throw subFetchErr;
        }

        if (!subRecord) {
          console.warn(
            `[Stripe Webhook] invoice.paid: No subscription record found for sub ${subscriptionId} or customer ${customerId}`
          );
          break;
        }

        // Fetch user profile for charity allocation (minimum 10% from PRD)
        const { data: profile } = await supabase
          .from('profiles')
          .select('charity_id, charity_percent')
          .eq('id', subRecord.user_id)
          .maybeSingle();

        // Fetch platform settings for prize pool percent (default 45%) and min charity percent
        const { data: settings } = await supabase
          .from('platform_settings')
          .select('prize_pool_percent, min_charity_percent')
          .limit(1)
          .maybeSingle();

        const prizePoolPercent = Number(settings?.prize_pool_percent ?? 45);
        const minCharityPercent = Number(settings?.min_charity_percent ?? 10);
        const charityPercent = Number(profile?.charity_percent ?? minCharityPercent);
        const charityId = profile?.charity_id || null;

        const poolAmount = Number(((amountPaid * prizePoolPercent) / 100).toFixed(2));
        const charityAmount = calculateContributionPounds(amountPaid, charityPercent, minCharityPercent);
        const paidAt = invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
          : new Date().toISOString();

        // Idempotently insert into payments using unique stripe_invoice_id
        const { error: paymentError } = await supabase.from('payments').upsert(
          {
            user_id: subRecord.user_id,
            subscription_id: subRecord.id,
            amount: amountPaid,
            stripe_invoice_id: invoice.id,
            pool_amount: poolAmount,
            charity_amount: charityAmount,
            charity_id: charityId,
            paid_at: paidAt,
          },
          { onConflict: 'stripe_invoice_id', ignoreDuplicates: true }
        );

        if (paymentError) {
          console.error('[Stripe Webhook] Error inserting payments row:', paymentError);
          throw paymentError;
        }

        // Mark subscription status active
        const { error: activateErr } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', subRecord.id);

        if (activateErr) {
          console.error('[Stripe Webhook] Error setting subscription active:', activateErr);
          throw activateErr;
        }
        break;
      }

      // 5. Invoice Payment Failed
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subDetails = (invoice as any)?.parent?.subscription_details;
        const subscriptionId =
          subDetails?.id ||
          subDetails?.subscription ||
          (invoice as any).subscription ||
          null;

        const customerId =
          typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer?.id;

        if (subscriptionId || customerId) {
          let updateQuery = supabase
            .from('subscriptions')
            .update({
              status: 'lapsed',
              updated_at: new Date().toISOString(),
            });

          if (subscriptionId) {
            updateQuery = updateQuery.eq('stripe_subscription_id', subscriptionId);
          } else {
            updateQuery = updateQuery.eq('stripe_customer_id', customerId);
          }

          const { error: failError } = await updateQuery;
          if (failError) {
            console.error('[Stripe Webhook] Error setting status to lapsed:', failError);
            throw failError;
          }
        }
        break;
      }

      default:
        // Safely log and ignore unhandled events
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        break;
    }

    // All DB operations succeeded before returning 200
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error(`[Stripe Webhook] Database or processing error for ${event.type}:`, err);
    // Return 500 so Stripe automatically retries the webhook delivery
    return NextResponse.json(
      { error: err?.message || 'Database write failed during webhook processing.' },
      { status: 500 }
    );
  }
}
