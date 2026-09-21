import { SupabaseClient } from '@supabase/supabase-js';
import { Score, ScoreInput } from './types';
import { validateScore, planScoreInsert } from './logic';

export class ScoreServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'ScoreServiceError';
    this.statusCode = statusCode;
  }
}

/**
 * Retrieves all scores for a user, sorted newest played_on first.
 */
export async function getUserScores(
  supabase: SupabaseClient,
  userId: string
): Promise<Score[]> {
  const { data, error } = await supabase
    .from('scores')
    .select('id, user_id, score, played_on, created_at')
    .eq('user_id', userId)
    .order('played_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new ScoreServiceError(`Failed to fetch scores: ${error.message}`, 500);
  }

  return (data as Score[]) || [];
}

/**
 * Creates a new score for the user.
 * Validates score & date, checks duplicate date / replacement rules,
 * and executes insert with user session client so RLS applies.
 */
export async function createScore(
  supabase: SupabaseClient,
  userId: string,
  input: ScoreInput
): Promise<Score> {
  const validation = validateScore(input.score, input.played_on);
  if (!validation.isValid) {
    throw new ScoreServiceError(validation.error || 'Invalid score submission', 400);
  }

  // Fetch existing scores for planning
  const existingScores = await getUserScores(supabase, userId);

  const plan = planScoreInsert(existingScores, {
    score: input.score,
    played_on: input.played_on,
  });

  if (!plan.allowed) {
    const isDuplicate = existingScores.some((s) => s.played_on === input.played_on);
    throw new ScoreServiceError(plan.reason || 'Score insert not allowed', isDuplicate ? 409 : 400);
  }

  const { data, error } = await supabase
    .from('scores')
    .insert({
      user_id: userId,
      score: input.score,
      played_on: input.played_on,
    })
    .select('id, user_id, score, played_on, created_at')
    .single();

  if (error) {
    // Catch Postgres unique constraint violation (code 23505)
    if (error.code === '23505') {
      throw new ScoreServiceError('You already have a score recorded for this date.', 409);
    }
    // Catch RLS policy violation
    if (error.code === '42501') {
      throw new ScoreServiceError('An active subscription is required to add scores.', 403);
    }
    throw new ScoreServiceError(`Failed to save score: ${error.message}`, 500);
  }

  return data as Score;
}

/**
 * Updates an existing score.
 * Excludes the score's own ID from duplicate-date verification.
 */
export async function updateScore(
  supabase: SupabaseClient,
  userId: string,
  scoreId: string,
  input: Partial<ScoreInput>
): Promise<Score> {
  // Fetch existing score to verify ownership and baseline values
  const { data: existing, error: fetchErr } = await supabase
    .from('scores')
    .select('id, user_id, score, played_on, created_at')
    .eq('id', scoreId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr || !existing) {
    throw new ScoreServiceError('Score not found or you do not have permission to edit it.', 404);
  }

  const updatedScoreVal = input.score !== undefined ? input.score : existing.score;
  const updatedPlayedOn = input.played_on !== undefined ? input.played_on : existing.played_on;

  // Validate resulting values
  const validation = validateScore(updatedScoreVal, updatedPlayedOn);
  if (!validation.isValid) {
    throw new ScoreServiceError(validation.error || 'Invalid score values', 400);
  }

  // If played_on changed, verify not duplicate against OTHER scores of this user
  if (updatedPlayedOn !== existing.played_on) {
    const userScores = await getUserScores(supabase, userId);
    const hasDuplicate = userScores.some(
      (s) => s.id !== scoreId && s.played_on === updatedPlayedOn
    );
    if (hasDuplicate) {
      throw new ScoreServiceError('You already have a score for this date. Edit it instead.', 409);
    }
  }

  const { data, error } = await supabase
    .from('scores')
    .update({
      score: updatedScoreVal,
      played_on: updatedPlayedOn,
    })
    .eq('id', scoreId)
    .eq('user_id', userId)
    .select('id, user_id, score, played_on, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new ScoreServiceError('You already have a score recorded for this date.', 409);
    }
    if (error.code === '42501') {
      throw new ScoreServiceError('An active subscription is required to edit scores.', 403);
    }
    throw new ScoreServiceError(`Failed to update score: ${error.message}`, 500);
  }

  return data as Score;
}

/**
 * Deletes a score by ID.
 */
export async function deleteScore(
  supabase: SupabaseClient,
  userId: string,
  scoreId: string
): Promise<void> {
  const { error } = await supabase
    .from('scores')
    .delete()
    .eq('id', scoreId)
    .eq('user_id', userId);

  if (error) {
    if (error.code === '42501') {
      throw new ScoreServiceError('An active subscription is required to delete scores.', 403);
    }
    throw new ScoreServiceError(`Failed to delete score: ${error.message}`, 500);
  }
}
