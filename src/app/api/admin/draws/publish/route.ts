import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminCaller } from '@/lib/engine/admin-auth';
import { loadEligibleUsersAndScores } from '@/lib/engine/data-loader';
import { runDraw } from '@/lib/engine/draw';
import { createAdminClient } from '@/lib/supabase/admin';

const publishSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, 'Invalid month format (YYYY-MM or YYYY-MM-DD)'),
  mode: z.enum(['random', 'algorithm']).default('random'),
  simulationId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  // 1. Verify admin authorization
  const auth = await verifyAdminCaller();
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const body = await request.json();
    const parsed = publishSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid publish parameters', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { month, simulationId } = parsed.data;
    let mode = parsed.data.mode;

    // 2. Normalize month to 1st of the month: YYYY-MM-01
    const parts = month.split('-');
    const normalizedMonth = `${parts[0]}-${parts[1].padStart(2, '0')}-01`;

    const adminClient = createAdminClient();

    // 3. Pre-flight check: Is this month already published?
    const { data: existingPublished } = await adminClient
      .from('draws')
      .select('id, published_at')
      .eq('draw_month', normalizedMonth)
      .eq('status', 'published')
      .maybeSingle();

    if (existingPublished) {
      return NextResponse.json(
        {
          error: `Draw for ${normalizedMonth} has already been published on ${existingPublished.published_at}. Duplicate publishing is rejected.`,
        },
        { status: 409 }
      );
    }

    // 4. Chronology check: Refuse a month earlier than the latest published draw
    const { data: latestDraw } = await adminClient
      .from('draws')
      .select('draw_month, jackpot_rolled_over')
      .eq('status', 'published')
      .order('draw_month', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestDraw && normalizedMonth < latestDraw.draw_month) {
      return NextResponse.json(
        {
          error: `Cannot publish draw for ${normalizedMonth} because a newer draw (${latestDraw.draw_month}) is already published. Publishing older months breaks the jackpot chain.`,
        },
        { status: 400 }
      );
    }

    // 5. Carry-in jackpot comes ONLY from the immediately previous published draw, and only if rolled over
    let jackpotCarriedInPence = 0;
    if (latestDraw && latestDraw.jackpot_rolled_over) {
      jackpotCarriedInPence = Math.round(Number(latestDraw.jackpot_rolled_over) * 100);
    }

    // 6. Handle optional simulationId: if provided, reuse that simulation's winning numbers & mode
    let manualWinningNumbers: number[] | undefined;
    if (simulationId) {
      const { data: simData, error: simErr } = await adminClient
        .from('draw_simulations')
        .select('winning_numbers, mode')
        .eq('id', simulationId)
        .maybeSingle();

      if (simErr || !simData) {
        return NextResponse.json(
          { error: `Simulation with ID ${simulationId} not found.` },
          { status: 404 }
        );
      }

      manualWinningNumbers = simData.winning_numbers;
      if (simData.mode) {
        mode = simData.mode as 'random' | 'algorithm';
      }
    }

    // 7. Load all current live eligible users and scores via paginated loader
    const { eligibleUsers, settings, totalSubscribersEvaluated } =
      await loadEligibleUsersAndScores();

    // 8. Recompute the draw with the current eligible users
    const result = runDraw({
      eligibleUsers,
      mode,
      jackpotCarriedInPence,
      settings,
      manualWinningNumbers,
    });

    // 9. Format entries and winners payloads for atomic database function
    const entriesPayload = result.entries.map((e) => ({
      user_id: e.userId,
      scores_snapshot: e.scoresSnapshot,
      match_count: e.matchCount,
    }));

    const winnersPayload = result.winners.map((w) => ({
      user_id: w.userId,
      tier: w.tier,
      prize_amount: w.prizeAmountPounds,
    }));

    // 10. Call atomic public.publish_draw(...) via Service Role
    const { data: drawId, error: publishErr } = await adminClient.rpc(
      'publish_draw',
      {
        p_draw_month: normalizedMonth,
        p_mode: result.mode,
        p_winning_numbers: result.winningNumbers,
        p_pool_total: result.poolTotalPounds,
        p_tier5_pool: Number((result.tiers.tier5Pence / 100).toFixed(2)),
        p_tier4_pool: Number((result.tiers.tier4Pence / 100).toFixed(2)),
        p_tier3_pool: Number((result.tiers.tier3Pence / 100).toFixed(2)),
        p_jackpot_carried_in: result.jackpotCarriedInPounds,
        p_jackpot_rolled_over: result.jackpotRolledOverPounds,
        p_entries: entriesPayload,
        p_winners: winnersPayload,
      }
    );

    if (publishErr) {
      console.error('publish_draw database function error:', publishErr);
      // Map unique violation / duplicate check from inside the lock to 409
      if (
        publishErr.code === '23505' ||
        publishErr.message?.toLowerCase().includes('already published')
      ) {
        return NextResponse.json(
          { error: `Draw for ${normalizedMonth} is already published.` },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: publishErr.message || 'Database error while publishing draw' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      drawId,
      month: normalizedMonth,
      mode: result.mode,
      winningNumbers: result.winningNumbers,
      poolTotal: result.poolTotalPounds,
      jackpotCarriedIn: result.jackpotCarriedInPounds,
      jackpotRolledOver: result.jackpotRolledOverPounds,
      eligibleCount: result.eligibleCount,
      totalSubscribersEvaluated,
      entriesRecorded: entriesPayload.length,
      winnersRecorded: winnersPayload.length,
      publishedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Unexpected error publishing draw:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error while publishing draw' },
      { status: 500 }
    );
  }
}
