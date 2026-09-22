import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminCaller } from '@/lib/engine/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/users/[id]
 * Retrieves complete detail for a specific user: profile, current subscription,
 * full override audit history, 5 stored Stableford scores, and win history.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await verifyAdminCaller();
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const { id: userId } = await params;
    const adminClient = createAdminClient();

    // 1. Fetch Auth user
    const { data: authUserData } = await adminClient.auth.admin.getUserById(userId);
    const authEmail = authUserData?.user?.email || null;

    // 2. Fetch Profile, Subscription, Scores, Winnings in parallel
    const [profileRes, subRes, scoresRes, winnersRes] = await Promise.all([
      adminClient
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          role,
          charity_id,
          charity_percent,
          created_at,
          charities (
            id,
            name,
            slug,
            is_active
          )
        `)
        .eq('id', userId)
        .maybeSingle(),

      adminClient
        .from('subscriptions')
        .select(`
          id,
          plan,
          status,
          stripe_customer_id,
          stripe_subscription_id,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          admin_override_note,
          admin_overridden_by,
          admin_overridden_at
        `)
        .eq('user_id', userId)
        .maybeSingle(),

      adminClient
        .from('scores')
        .select('id, score, played_on, created_at')
        .eq('user_id', userId)
        .order('played_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5),

      adminClient
        .from('winners')
        .select(`
          id,
          tier,
          prize_amount,
          verification_status,
          payment_status,
          proof_url,
          paid_at,
          created_at,
          draws (
            id,
            draw_month,
            mode,
            published_at
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ]);

    if (profileRes.error || !profileRes.data) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const p = profileRes.data;
    const charity = Array.isArray(p.charities) ? p.charities[0] : p.charities;

    // Fetch admin who performed the override if applicable
    let overrideAdmin = null;
    if (subRes.data?.admin_overridden_by) {
      const { data: admProfile } = await adminClient
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', subRes.data.admin_overridden_by)
        .maybeSingle();
      overrideAdmin = admProfile || null;
    }

    return NextResponse.json({
      user: {
        id: p.id,
        email: authEmail || p.email || 'No email',
        full_name: p.full_name || 'Anonymous User',
        role: p.role || 'subscriber',
        created_at: p.created_at,
        charity_percent: Number(p.charity_percent || 10),
        charity: charity ? { id: charity.id, name: charity.name, is_active: charity.is_active } : null,
        subscription: subRes.data ? {
          ...subRes.data,
          override_admin: overrideAdmin,
        } : null,
        scores: scoresRes.data || [],
        winners: winnersRes.data || [],
      },
    });
  } catch (err: unknown) {
    console.error('Error fetching admin user detail:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
