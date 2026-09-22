import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/summary
 * Unified dashboard data endpoint returning all member state in ONE call.
 *
 * Security & RLS:
 * - Uses session client (createClient from @/lib/supabase/server) so Postgres RLS
 *   strictly enforces that callers can only access their own user_id records.
 * - Never returns other members' scores, winnings, or draw entries.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // 1. Session verification
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    // 2. Query in parallel using session client (RLS applies)
    const [
      profileRes,
      subscriptionRes,
      scoresRes,
      drawEntriesRes,
      winningsRes,
      activeCharitiesRes,
      settingsRes,
      latestDrawRes,
    ] = await Promise.all([
      // Profile
      supabase
        .from('profiles')
        .select('id, email, full_name, role, charity_id, charity_percent')
        .eq('id', user.id)
        .maybeSingle(),

      // Subscription
      supabase
        .from('subscriptions')
        .select('plan, status, current_period_end, cancel_at_period_end, stripe_customer_id, admin_override_note, admin_overridden_at')
        .eq('user_id', user.id)
        .maybeSingle(),

      // 5 Stableford Scores
      supabase
        .from('scores')
        .select('id, score, played_on, created_at')
        .eq('user_id', user.id)
        .order('played_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5),

      // Draws entered count
      supabase
        .from('draw_entries')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),

      // Winnings across all draws
      supabase
        .from('winners')
        .select(`
          id,
          draw_id,
          user_id,
          tier,
          prize_amount,
          proof_url,
          verification_status,
          payment_status,
          rejection_reason,
          admin_note,
          reviewed_at,
          paid_at,
          created_at,
          draws (
            id,
            draw_month,
            mode,
            winning_numbers,
            published_at
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      // Active charities for change dropdown
      supabase
        .from('charities')
        .select('id, name, slug, tagline, is_active')
        .eq('is_active', true)
        .order('name', { ascending: true }),

      // Platform Settings
      supabase
        .from('platform_settings')
        .select('min_charity_percent, monthly_price, yearly_price, monthly_subscription_price, annual_subscription_price')
        .limit(1)
        .maybeSingle(),

      // Latest published official draw
      supabase
        .from('draws')
        .select('id, draw_month, mode, winning_numbers, pool_total, tier5_pool, tier4_pool, tier3_pool, jackpot_carried_in, jackpot_rolled_over, published_at')
        .eq('status', 'published')
        .order('draw_month', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // Check charity info
    const profile = profileRes.data || {
      id: user.id,
      email: user.email || '',
      full_name: user.user_metadata?.full_name || '',
      role: 'subscriber',
      charity_id: null,
      charity_percent: 10,
    };

    let userCharity = null;
    if (profile.charity_id) {
      const { data: cData } = await supabase
        .from('charities')
        .select('id, name, tagline, is_active')
        .eq('id', profile.charity_id)
        .maybeSingle();
      if (cData) {
        userCharity = {
          ...cData,
          percent: Number(profile.charity_percent || 10),
        };
      }
    }

    if (!userCharity) {
      // Fallback default
      userCharity = {
        id: '',
        name: "Hope Horizons Children's Foundation",
        tagline: 'Transforming pediatric healthcare & critical care access',
        percent: Number(profile.charity_percent || 10),
        isActive: true,
      };
    }

    // Subscription status
    const subData = subscriptionRes.data;
    const isSubActive = subData?.status === 'active';
    const subscriptionDetails = {
      plan: (subData?.plan as 'monthly' | 'yearly') || 'monthly',
      status: (subData?.status as 'active' | 'inactive' | 'lapsed' | 'cancelled') || 'inactive',
      isActive: isSubActive,
      isAdmin: profile.role === 'admin',
      renewalDate: subData?.current_period_end || null,
      cancelAtPeriodEnd: Boolean(subData?.cancel_at_period_end),
      stripeCustomerId: subData?.stripe_customer_id || null,
      adminOverrideNote: subData?.admin_override_note || null,
      adminOverriddenAt: subData?.admin_overridden_at || null,
    };

    // User scores
    const userScores = (scoresRes.data || []).map((s) => ({
      id: s.id,
      score: s.score,
      played_on: s.played_on,
    }));

    // Participation summary
    const drawsEnteredCount = drawEntriesRes.count ?? 0;
    const isEligibleForNextDraw = isSubActive && userScores.length === 5;
    let eligibilityReason = '';
    if (!isSubActive) {
      eligibilityReason = 'An active subscription is required to participate in monthly draws.';
    } else if (userScores.length < 5) {
      eligibilityReason = `Exactly 5 Stableford scores required (currently ${userScores.length}/5 submitted).`;
    } else {
      eligibilityReason = 'You are fully qualified for the 1st of next month draw!';
    }

    // Next draw date (1st of next month)
    const now = new Date();
    const nextDrawDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const nextDrawMonthStr = nextDrawDate.toISOString().slice(0, 10);

    // Latest draw entry & win for this user
    let latestUserEntry = null;
    let latestUserWin = null;
    const latestDraw = latestDrawRes.data || null;

    if (latestDraw) {
      const [entryData, winData] = await Promise.all([
        supabase
          .from('draw_entries')
          .select('id, scores_snapshot, match_count')
          .eq('draw_id', latestDraw.id)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('winners')
          .select('id, tier, prize_amount, verification_status, payment_status')
          .eq('draw_id', latestDraw.id)
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);
      latestUserEntry = entryData.data || null;
      latestUserWin = winData.data || null;
    }

    // Process winnings and generate signed URLs
    const adminClient = createAdminClient();
    const rawWinnings = (winningsRes.data || []) as any[];
    const winningsWithSignedUrls = await Promise.all(
      rawWinnings.map(async (w) => {
        let signedUrl: string | null = null;
        if (w.proof_url) {
          try {
            const { data } = await adminClient.storage
              .from('winner-proofs')
              .createSignedUrl(w.proof_url, 900);
            signedUrl = data?.signedUrl || null;
          } catch (e) {
            console.error('Error generating user signed preview URL:', e);
          }
        }
        return {
          ...w,
          signed_proof_url: signedUrl,
        };
      })
    );

    // Winnings totals
    let totalWon = 0;
    let totalPaid = 0;
    let totalPending = 0;

    for (const win of winningsWithSignedUrls) {
      const amt = Number(win.prize_amount || 0);
      totalWon += amt;
      if (win.payment_status === 'paid') {
        totalPaid += amt;
      } else {
        totalPending += amt;
      }
    }

    // Action notification flags
    const actionRequiredCount = winningsWithSignedUrls.filter(
      (w) =>
        (w.verification_status === 'pending' && !w.proof_url) ||
        w.verification_status === 'rejected'
    ).length;

    const approvedPendingPayoutCount = winningsWithSignedUrls.filter(
      (w) => w.verification_status === 'approved' && w.payment_status === 'pending'
    ).length;

    const paidCount = winningsWithSignedUrls.filter(
      (w) => w.payment_status === 'paid'
    ).length;

    // Platform pricing
    const settings = settingsRes.data;
    const minPercent = Number(settings?.min_charity_percent || 10);
    const monthlyPrice = Number(settings?.monthly_price ?? settings?.monthly_subscription_price ?? 10);
    const yearlyPrice = Number(settings?.yearly_price ?? settings?.annual_subscription_price ?? 99);

    return NextResponse.json({
      profile: {
        id: profile.id,
        email: profile.email || user.email || '',
        full_name: profile.full_name || '',
        role: profile.role || 'subscriber',
      },
      subscription: subscriptionDetails,
      charity: userCharity,
      activeCharities: activeCharitiesRes.data || [],
      pricing: {
        minPercent,
        monthlyPrice,
        yearlyPrice,
      },
      scores: userScores,
      participation: {
        drawsEnteredCount,
        nextDrawMonth: nextDrawMonthStr,
        isEligibleForNextDraw,
        eligibilityReason,
      },
      winnings: winningsWithSignedUrls,
      winningsSummary: {
        totalWon,
        totalPaid,
        totalPending,
        count: winningsWithSignedUrls.length,
      },
      notifications: {
        actionRequiredCount,
        approvedPendingPayoutCount,
        paidCount,
      },
      latestDrawInfo: {
        draw: latestDraw,
        userEntry: latestUserEntry,
        userWin: latestUserWin,
      },
    });
  } catch (err: unknown) {
    console.error('Error in GET /api/dashboard/summary:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
