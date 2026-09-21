import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireActiveSubscription } from '@/lib/subscription';
import { getUserScores, createScore, ScoreServiceError } from '@/lib/scores/service';
import { createScoreSchema } from '@/lib/validations/scores';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/scores
 * Returns the current authenticated user's scores, sorted newest played_on first.
 * Readable by any logged-in member (including non-subscribers in read-only mode).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: You must be logged in to view scores.' },
        { status: 401 }
      );
    }

    const scores = await getUserScores(supabase, user.id);
    return NextResponse.json({ scores });
  } catch (err: any) {
    console.error('Error fetching scores:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to retrieve scores.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scores
 * Creates a new Stableford score (1-45, one per date).
 * Strictly requires an active subscription or admin bypass.
 */
export async function POST(req: Request) {
  try {
    // 1. Enforce active subscription on write actions
    const check = await requireActiveSubscription({ isApi: true });
    if (check instanceof NextResponse) {
      return check;
    }

    const supabase = await createClient();
    const body = await req.json();

    // 2. Validate payload with Zod
    const validation = createScoreSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid score data.' },
        { status: 400 }
      );
    }

    // 3. Create score (business rules + database trigger prune)
    const newScore = await createScore(supabase, check.user.id, validation.data);

    return NextResponse.json(
      {
        score: newScore,
        message: 'Score recorded successfully.',
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err instanceof ScoreServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('Error creating score:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to create score.' },
      { status: 500 }
    );
  }
}
