import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();

    // 1. Fetch latest published draw (publicly readable via RLS)
    const { data: latestDraw, error: drawError } = await supabase
      .from('draws')
      .select('id, draw_month, mode, winning_numbers, pool_total, tier5_pool, tier4_pool, tier3_pool, jackpot_carried_in, jackpot_rolled_over, published_at')
      .eq('status', 'published')
      .order('draw_month', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (drawError) {
      console.error('Error fetching latest draw:', drawError);
      return NextResponse.json({ error: 'Failed to fetch latest draw' }, { status: 500 });
    }

    if (!latestDraw) {
      return NextResponse.json({
        draw: null,
        userEntry: null,
        userWin: null,
      });
    }

    // 2. Identify caller from session (optional auth)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let userEntry = null;
    let userWin = null;

    if (user) {
      // Query caller's OWN entry only (RLS also enforces auth.uid() = user_id)
      const { data: entryData } = await supabase
        .from('draw_entries')
        .select('id, scores_snapshot, match_count')
        .eq('draw_id', latestDraw.id)
        .eq('user_id', user.id)
        .maybeSingle();

      userEntry = entryData || null;

      // Query caller's OWN winning record if any
      const { data: winData } = await supabase
        .from('winners')
        .select('id, tier, prize_amount, verification_status, payment_status')
        .eq('draw_id', latestDraw.id)
        .eq('user_id', user.id)
        .maybeSingle();

      userWin = winData || null;
    }

    return NextResponse.json({
      draw: latestDraw,
      userEntry,
      userWin,
    });
  } catch (err: unknown) {
    console.error('Unexpected error in /api/draws/latest:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
