import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminCaller } from '@/lib/engine/admin-auth';
import { loadEligibleUsersAndScores } from '@/lib/engine/data-loader';
import { runDraw } from '@/lib/engine/draw';
import { createAdminClient } from '@/lib/supabase/admin';

const simulateSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, 'Invalid month format (YYYY-MM or YYYY-MM-DD)'),
  mode: z.enum(['random', 'algorithm']).default('random'),
});

export async function POST(request: Request) {
  // 1. Verify admin authorization
  const auth = await verifyAdminCaller();
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const body = await request.json();
    const parsed = simulateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid simulation parameters', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { month, mode } = parsed.data;

    // Normalize month to 1st of month: YYYY-MM-01
    const parts = month.split('-');
    const normalizedMonth = `${parts[0]}-${parts[1].padStart(2, '0')}-01`;

    const adminClient = createAdminClient();

    // 2. Resolve carried-in jackpot from the immediately previous published draw
    let jackpotCarriedInPence = 0;
    const { data: previousDraw } = await adminClient
      .from('draws')
      .select('draw_month, jackpot_rolled_over')
      .eq('status', 'published')
      .lt('draw_month', normalizedMonth)
      .order('draw_month', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previousDraw && previousDraw.jackpot_rolled_over) {
      jackpotCarriedInPence = Math.round(Number(previousDraw.jackpot_rolled_over) * 100);
    }

    // 3. Load all eligible subscribers and their 5 scores via paginated loader
    const { eligibleUsers, settings, totalSubscribersEvaluated } =
      await loadEligibleUsersAndScores();

    // 4. Run the draw engine
    const result = runDraw({
      eligibleUsers,
      mode,
      jackpotCarriedInPence,
      settings,
    });

    const summary = {
      winningNumbers: result.winningNumbers,
      mode: result.mode,
      poolTotal: result.poolTotalPounds,
      jackpotCarriedIn: result.jackpotCarriedInPounds,
      jackpotRolledOver: result.jackpotRolledOverPounds,
      tier5Pool: Number((result.tiers.tier5Pence / 100).toFixed(2)),
      tier4Pool: Number((result.tiers.tier4Pence / 100).toFixed(2)),
      tier3Pool: Number((result.tiers.tier3Pence / 100).toFixed(2)),
      tier5Winners: result.allocation.tier5.winnerCount,
      tier4Winners: result.allocation.tier4.winnerCount,
      tier3Winners: result.allocation.tier3.winnerCount,
      tier5PrizePerWinner: Number(
        (result.allocation.tier5.prizePerWinnerPence / 100).toFixed(2)
      ),
      tier4PrizePerWinner: Number(
        (result.allocation.tier4.prizePerWinnerPence / 100).toFixed(2)
      ),
      tier3PrizePerWinner: Number(
        (result.allocation.tier3.prizePerWinnerPence / 100).toFixed(2)
      ),
      eligibleCount: result.eligibleCount,
      totalSubscribersEvaluated,
      unallocatedPounds: Number(
        (result.allocation.totalUnallocatedPence / 100).toFixed(2)
      ),
    };

    // 5. Save record into draw_simulations
    const { data: simulationRow, error: simErr } = await adminClient
      .from('draw_simulations')
      .insert({
        draw_month: normalizedMonth,
        mode: result.mode,
        winning_numbers: result.winningNumbers,
        result_summary: summary,
      })
      .select('id, created_at')
      .single();

    if (simErr) {
      console.error('Failed to persist simulation row:', simErr);
    }

    return NextResponse.json({
      success: true,
      simulationId: simulationRow?.id,
      month: normalizedMonth,
      summary,
      entriesCount: result.entries.length,
      winnersCount: result.winners.length,
      simulatedAt: simulationRow?.created_at || new Date().toISOString(),
      isOfficial: false,
    });
  } catch (err: any) {
    console.error('Error running draw simulation:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error running simulation' },
      { status: 500 }
    );
  }
}
