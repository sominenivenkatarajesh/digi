import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminCaller } from '@/lib/engine/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const paySchema = z
  .object({
    note: z.string().optional(),
  })
  .strict();

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/winners/[id]/pay
 * Admin records manual outside-application payout confirmation.
 *
 * Requirements:
 * - Admin authorization checked via server session -> profiles.role in database.
 * - Strictly allowed only when verification_status = 'approved' AND payment_status = 'pending'.
 * - Sets payment_status = 'paid' and paid_at = now().
 * - Rejects malformed payload via strict Zod validation.
 * - Manual confirmation: Does not trigger automatic bank transfers.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await verifyAdminCaller();
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const { id: winnerId } = await params;

    // Validate request body
    const body = await req.json().catch(() => ({}));
    const parsed = paySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid payout payload' },
        { status: 400 }
      );
    }

    const { note } = parsed.data;
    const adminClient = createAdminClient();

    // Fetch existing winner record
    const { data: winner, error: winnerError } = await adminClient
      .from('winners')
      .select('*')
      .eq('id', winnerId)
      .maybeSingle();

    if (winnerError || !winner) {
      return NextResponse.json({ error: 'Winning record not found' }, { status: 404 });
    }

    // 1. Guard: Must be approved
    if (winner.verification_status !== 'approved') {
      return NextResponse.json(
        {
          error: `Cannot mark as paid: Winner verification status is '${winner.verification_status}'. Score proof must be verified and approved first.`,
        },
        { status: 400 }
      );
    }

    // 2. Guard: Must not already be paid
    if (winner.payment_status === 'paid') {
      return NextResponse.json(
        {
          error: `Winner has already been marked as paid on ${
            winner.paid_at ? new Date(winner.paid_at).toLocaleDateString() : 'earlier'
          }.`,
        },
        { status: 400 }
      );
    }

    // 3. Update payment status to paid
    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      payment_status: 'paid',
      paid_at: now,
    };

    if (note && note.trim()) {
      updatePayload.admin_note = note.trim();
    }

    const { data: updatedWinner, error: updateError } = await adminClient
      .from('winners')
      .update(updatePayload)
      .eq('id', winnerId)
      .select(`
        *,
        profiles:user_id (
          id,
          full_name,
          email
        ),
        reviewer:reviewed_by (
          id,
          full_name,
          email
        )
      `)
      .single();

    if (updateError) {
      console.error('Error updating payment status:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Failed to record payment' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      winner: updatedWinner,
    });
  } catch (err: unknown) {
    console.error('Error in PATCH /api/admin/winners/[id]/pay:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
