import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminCaller } from '@/lib/engine/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const overrideSchema = z
  .object({
    status: z.enum(['active', 'inactive', 'lapsed', 'cancelled']),
    plan: z.enum(['monthly', 'yearly']).optional(),
    note: z
      .string()
      .min(3, 'An override audit note is strictly required (min 3 characters).'),
  })
  .strict();

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/users/[id]/subscription
 * Manual subscription status override for customer support cases.
 *
 * Rules:
 * - Admin authorization enforced.
 * - Requires a non-empty audit note explaining why manual override was performed.
 * - Stores admin_override_note, admin_overridden_by, and admin_overridden_at.
 * - Note: This does NOT modify Stripe billing. The next Stripe webhook event
 *   will overwrite the subscription status, preserving the audit trail fields.
 * - Rejects any attempt to modify the user's role.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await verifyAdminCaller();
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const { id: userId } = await params;
    const body = await req.json().catch(() => null);

    const parsed = overrideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid override parameters' },
        { status: 400 }
      );
    }

    const { status, plan, note } = parsed.data;
    const adminClient = createAdminClient();

    // Verify user profile exists
    const { data: userProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if subscription already exists
    const { data: existingSub } = await adminClient
      .from('subscriptions')
      .select('id, plan, status')
      .eq('user_id', userId)
      .maybeSingle();

    const now = new Date().toISOString();
    const futurePeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const updatePayload: Record<string, any> = {
      user_id: userId,
      status,
      admin_override_note: note.trim(),
      admin_overridden_by: auth.userId,
      admin_overridden_at: now,
    };

    if (plan) {
      updatePayload.plan = plan;
    }

    // If activating and period_end is null or past, extend by 30 days
    if (status === 'active') {
      updatePayload.current_period_end = futurePeriodEnd;
    }

    let result;
    if (existingSub) {
      const { data, error } = await adminClient
        .from('subscriptions')
        .update(updatePayload)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error) throw error;
      result = data;
    } else {
      updatePayload.plan = plan || 'monthly';
      const { data, error } = await adminClient
        .from('subscriptions')
        .insert(updatePayload)
        .select('*')
        .single();

      if (error) throw error;
      result = data;
    }

    return NextResponse.json({
      success: true,
      subscription: result,
      warning: 'Notice: This manual status is temporary and will be updated by any subsequent Stripe webhook event.',
    });
  } catch (err: unknown) {
    console.error('Error in subscription override:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
