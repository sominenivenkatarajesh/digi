import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireActiveSubscription } from '@/lib/subscription';
import { updateScore, deleteScore, ScoreServiceError } from '@/lib/scores/service';
import { updateScoreSchema } from '@/lib/validations/scores';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/scores/[id]
 * Updates an existing score and/or played_on date.
 * Excludes current score id from duplicate check.
 */
export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Score ID is required' }, { status: 400 });
    }

    const check = await requireActiveSubscription({ isApi: true });
    if (check instanceof NextResponse) {
      return check;
    }

    const supabase = await createClient();
    const body = await req.json();

    const validation = updateScoreSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid update data.' },
        { status: 400 }
      );
    }

    const updated = await updateScore(supabase, check.user.id, id, validation.data);

    return NextResponse.json({
      score: updated,
      message: 'Score updated successfully.',
    });
  } catch (err: any) {
    if (err instanceof ScoreServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('Error updating score:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to update score.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/scores/[id]
 * Deletes a score.
 */
export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Score ID is required' }, { status: 400 });
    }

    const check = await requireActiveSubscription({ isApi: true });
    if (check instanceof NextResponse) {
      return check;
    }

    const supabase = await createClient();
    await deleteScore(supabase, check.user.id, id);

    return NextResponse.json({
      success: true,
      message: 'Score removed successfully.',
    });
  } catch (err: any) {
    if (err instanceof ScoreServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('Error deleting score:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to delete score.' },
      { status: 500 }
    );
  }
}
