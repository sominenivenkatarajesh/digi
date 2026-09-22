import { NextResponse } from 'next/server';
import { verifyAdminCaller } from '@/lib/engine/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/reports
 * Aggregated platform analytics and reporting endpoint.
 *
 * Rules:
 * - Admin authorization checked via server session -> profiles.role in DB.
 * - Executes unified get_admin_reports() SQL function or aggregate queries.
 * - Powers BOTH /admin overview metrics and /admin/reports analytics so totals
 *   are strictly identical across both surfaces.
 */
export async function GET() {
  const auth = await verifyAdminCaller();
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const adminClient = createAdminClient();

    // 1. Attempt database RPC get_admin_reports()
    const { data: rpcData, error: rpcError } = await adminClient.rpc('get_admin_reports');

    if (!rpcError && rpcData) {
      return NextResponse.json({ reports: rpcData });
    }

    // 2. Infallible fallback: perform direct aggregate queries if RPC is not yet executed in Supabase SQL editor
    const [
      profilesCountRes,
      activeSubsCountRes,
      monthlySubsCountRes,
      yearlySubsCountRes,
      publishedDrawsRes,
      winnersRes,
      charitiesRes,
      donationsRes,
      paymentsRes,
    ] = await Promise.all([
      adminClient.from('profiles').select('id', { count: 'exact', head: true }),
      adminClient.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      adminClient.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('plan', 'monthly'),
      adminClient.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('plan', 'yearly'),
      adminClient.from('draws').select('id, pool_total, jackpot_rolled_over, draw_month').eq('status', 'published').order('draw_month', { ascending: false }),
      adminClient.from('winners').select('id, tier, prize_amount, payment_status'),
      adminClient.from('charities').select('id, name, slug, category, is_active'),
      adminClient.from('donations').select('charity_id, amount'),
      adminClient.from('payments').select('charity_id, charity_amount'),
    ]);

    const totalUsers = profilesCountRes.count ?? 0;
    const activeSubscribers = activeSubsCountRes.count ?? 0;
    const monthlySubscribers = monthlySubsCountRes.count ?? 0;
    const yearlySubscribers = yearlySubsCountRes.count ?? 0;

    const publishedDraws = publishedDrawsRes.data || [];
    let totalPrizePool = 0;
    for (const d of publishedDraws) {
      totalPrizePool += Number(d.pool_total || 0);
    }
    const jackpotPending = publishedDraws.length > 0 ? Number(publishedDraws[0].jackpot_rolled_over || 0) : 0;

    const winners = winnersRes.data || [];
    let tier5Winners = 0;
    let tier4Winners = 0;
    let tier3Winners = 0;
    let totalAwarded = 0;
    let totalPaid = 0;
    let totalPendingPayout = 0;

    for (const w of winners) {
      const amt = Number(w.prize_amount || 0);
      totalAwarded += amt;
      if (w.tier === '5') tier5Winners++;
      else if (w.tier === '4') tier4Winners++;
      else if (w.tier === '3') tier3Winners++;

      if (w.payment_status === 'paid') {
        totalPaid += amt;
      } else {
        totalPendingPayout += amt;
      }
    }

    // Charity aggregations
    const donations = donationsRes.data || [];
    const payments = paymentsRes.data || [];
    const donationsMap = new Map<string, number>();
    for (const don of donations) {
      if (don.charity_id) {
        donationsMap.set(don.charity_id, (donationsMap.get(don.charity_id) || 0) + Number(don.amount || 0));
      }
    }
    const paymentsMap = new Map<string, number>();
    for (const p of payments) {
      if (p.charity_id) {
        paymentsMap.set(p.charity_id, (paymentsMap.get(p.charity_id) || 0) + Number(p.charity_amount || 0));
      }
    }

    let totalCharityImpact = 0;
    const charities = charitiesRes.data || [];
    const charityBreakdown = charities.map((c: any) => {
      const donTotal = donationsMap.get(c.id) || 0;
      const subTotal = paymentsMap.get(c.id) || 0;
      const raised = donTotal + subTotal;
      totalCharityImpact += raised;
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        category: c.category,
        is_active: c.is_active,
        total_donations: donTotal,
        total_subscription_contributions: subTotal,
        total_raised: raised,
      };
    }).sort((a, b) => b.total_raised - a.total_raised);

    const fallbackReports = {
      users: {
        total_users: totalUsers,
        active_subscribers: activeSubscribers,
        monthly_subscribers: monthlySubscribers,
        yearly_subscribers: yearlySubscribers,
      },
      prize_pool: {
        total_prize_pool: totalPrizePool,
        jackpot_pending_carry_in: jackpotPending,
        effective_total_pool: totalPrizePool + jackpotPending,
      },
      draws: {
        published_draws_count: publishedDraws.length,
        tier5_winners: tier5Winners,
        tier4_winners: tier4Winners,
        tier3_winners: tier3Winners,
        total_winners: winners.length,
        total_prize_awarded: totalAwarded,
        total_paid_out: totalPaid,
        total_pending_payout: totalPendingPayout,
      },
      charities: {
        total_charity_impact: totalCharityImpact,
        breakdown: charityBreakdown,
      },
    };

    return NextResponse.json({ reports: fallbackReports });
  } catch (err: unknown) {
    console.error('Error generating admin reports:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
