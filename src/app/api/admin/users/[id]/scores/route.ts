import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminCaller } from '@/lib/engine/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createScore, updateScore, deleteScore, ScoreServiceError } from '@/lib/scores/service';

export const dynamic = 'force-dynamic';

const scoreInputSchema = z.object({
  score: z.number().int().min(1).max(45),
  played_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  scoreId: z.string().uuid().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/users/[id]/scores
 * Admin creates a score on behalf of a user.
 * Validates input and calculates rolling history plan using validateScore & planScoreInsert.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await verifyAdminCaller();
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const { id: userId } = await params;
    const body = await req.json().catch(() => null);

    const parsed = scoreInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid score parameters' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const newScore = await createScore(adminClient, userId, {
      score: parsed.data.score,
      played_on: parsed.data.played_on,
    });

    return NextResponse.json({
      success: true,
      score: newScore,
    });
  } catch (err: unknown) {
    if (err instanceof ScoreServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('Error adding score by admin:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users/[id]/scores
 * Admin updates an existing score on behalf of a user.
 * Validates input using validateScore.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await verifyAdminCaller();
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const { id: userId } = await params;
    const body = await req.json().catch(() => null);

    const parsed = scoreInputSchema.safeParse(body);
    if (!parsed.success || !parsed.data.scoreId) {
      return NextResponse.json(
        { error: parsed.error?.issues[0]?.message || 'Score ID is required for editing' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const updated = await updateScore(adminClient, userId, parsed.data.scoreId, {
      score: parsed.data.score,
      played_on: parsed.data.played_on,
    });

    return NextResponse.json({
      success: true,
      score: updated,
    });
  } catch (err: unknown) {
    if (err instanceof ScoreServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('Error updating score by admin:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id]/scores?scoreId=...
 * Admin deletes a score on behalf of a user.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await verifyAdminCaller();
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const { id: userId } = await params;
    const { searchParams } = new URL(req.url);
    const scoreId = searchParams.get('scoreId');

    if (!scoreId) {
      return NextResponse.json({ error: 'scoreId parameter is required' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    await deleteScore(adminClient, userId, scoreId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof ScoreServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('Error deleting score by admin:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
