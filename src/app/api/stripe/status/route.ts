import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSubscriptionStatus } from '@/lib/subscription';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/stripe/status
 * Returns real-time subscription status for the current authenticated user.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subDetails = await getSubscriptionStatus(user.id);
    return NextResponse.json(subDetails);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch subscription status' },
      { status: 500 }
    );
  }
}
