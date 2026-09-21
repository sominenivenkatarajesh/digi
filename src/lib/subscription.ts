import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export type SubscriptionStatus = 'active' | 'inactive' | 'lapsed' | 'cancelled';

export interface UserSubscriptionDetails {
  userId: string;
  isActive: boolean;
  isAdmin: boolean;
  status: SubscriptionStatus;
  plan: 'monthly' | 'yearly';
  renewalDate: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
}

/**
 * Evaluates real-time subscription status for a given user from the database.
 * Active means status = 'active' AND current_period_end is in the future.
 * Also active if cancel_at_period_end is true but current_period_end has not yet expired.
 * Admin users automatically receive isActive = true.
 */
export async function getSubscriptionStatus(userId: string): Promise<UserSubscriptionDetails> {
  const supabase = await createClient();

  // Check if user is an admin (bypasses subscription requirement)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  const isAdmin = profile?.role === 'admin';

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status, plan, current_period_end, cancel_at_period_end, stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!sub) {
    return {
      userId,
      isActive: isAdmin,
      isAdmin,
      status: 'inactive',
      plan: 'monthly',
      renewalDate: null,
      cancelAtPeriodEnd: false,
      stripeCustomerId: null,
    };
  }

  const rawStatus = (sub.status as SubscriptionStatus) || 'inactive';
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
  const isPeriodValid = periodEnd ? periodEnd.getTime() > Date.now() : true;

  // Active status requires status === 'active' AND valid future date
  // Also active if cancel_at_period_end is true but period has not ended
  const isActive = isAdmin || (rawStatus === 'active' && isPeriodValid);

  return {
    userId,
    isActive,
    isAdmin,
    status: rawStatus,
    plan: (sub.plan as 'monthly' | 'yearly') || 'monthly',
    renewalDate: sub.current_period_end || null,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    stripeCustomerId: sub.stripe_customer_id || null,
  };
}

/**
 * Server-side helper that enforces an active subscription on every authenticated request.
 * - In API routes: returns a 403 response if inactive or 401 if unauthenticated.
 * - In Pages / Server Components: redirects to /dashboard?subscribe=true if inactive.
 * - Admin users always bypass this check.
 */
export async function requireActiveSubscription(options?: { isApi?: boolean }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (options?.isApi) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }
    redirect('/login');
  }

  const subDetails = await getSubscriptionStatus(user.id);

  if (!subDetails.isActive) {
    if (options?.isApi) {
      return NextResponse.json(
        {
          error:
            'Forbidden: An active Digital Heroes subscription is required to perform this action.',
          code: 'SUBSCRIPTION_REQUIRED',
        },
        { status: 403 }
      );
    }
    redirect('/dashboard?subscribe=true');
  }

  return { user, subscription: subDetails };
}
