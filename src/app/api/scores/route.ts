import { NextResponse } from 'next/server';
import { requireActiveSubscription } from '@/lib/subscription';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Temporary Stub: GET /api/scores
 * NOTE: Phase 3 will replace this with full 5-score submission & retrieval.
 * Used in Phase 2 to verify server-side 403 access control for non-subscribers.
 */
export async function GET() {
  const check = await requireActiveSubscription({ isApi: true });
  if (check instanceof NextResponse) {
    return check;
  }

  return NextResponse.json({
    message: 'Active subscription verified. Score system ready for Phase 3.',
    userId: check.user.id,
    plan: check.subscription.plan,
  });
}

/**
 * Temporary Stub: POST /api/scores
 * Enforces active subscription check on score submission attempts.
 */
export async function POST() {
  const check = await requireActiveSubscription({ isApi: true });
  if (check instanceof NextResponse) {
    return check;
  }

  return NextResponse.json({
    message: 'Active subscription verified. Score submission will be implemented in Phase 3.',
  });
}
