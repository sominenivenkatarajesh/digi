import { NextResponse } from 'next/server';
import { verifyAdminCaller } from '@/lib/engine/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const auth = await verifyAdminCaller();
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const adminClient = createAdminClient();

    // 1. Fetch official published draws
    const { data: draws, error: drawsErr } = await adminClient
      .from('draws')
      .select('*')
      .order('draw_month', { ascending: false });

    if (drawsErr) {
      return NextResponse.json({ error: drawsErr.message }, { status: 500 });
    }

    // 2. Fetch recent simulations
    const { data: simulations, error: simErr } = await adminClient
      .from('draw_simulations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (simErr) {
      return NextResponse.json({ error: simErr.message }, { status: 500 });
    }

    return NextResponse.json({
      draws: draws || [],
      simulations: simulations || [],
    });
  } catch (err: any) {
    console.error('Error fetching admin draws:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
