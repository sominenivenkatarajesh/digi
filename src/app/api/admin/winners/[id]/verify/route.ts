import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminCaller } from '@/lib/engine/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const verifySchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    reason: z.string().optional(),
    note: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.decision === 'rejected') {
        return typeof data.reason === 'string' && data.reason.trim().length > 0;
      }
      return true;
    },
    {
      message: 'A rejection reason is strictly required when rejecting winner proof.',
      path: ['reason'],
    }
  );

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/winners/[id]/verify
 * Admin review endpoint: approves or rejects a winner's score proof submission.
 *
 * Rules:
 * - Admin authorization enforced via session and profiles.role check in DB.
 * - Rejection requires a non-empty reason.
 * - Sets reviewed_by (admin's user id) and reviewed_at.
 * - Returns the updated winner record for audit-friendly logging.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await verifyAdminCaller();
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const { id: winnerId } = await params;

    // Validate request body
    const body = await req.json().catch(() => null);
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid verification payload' },
        { status: 400 }
      );
    }

    const { decision, reason, note } = parsed.data;
    const adminClient = createAdminClient();

    // Check winner existence
    const { data: existingWinner, error: checkError } = await adminClient
      .from('winners')
      .select('*')
      .eq('id', winnerId)
      .maybeSingle();

    if (checkError || !existingWinner) {
      return NextResponse.json({ error: 'Winning record not found' }, { status: 404 });
    }

    // Build update payload
    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      verification_status: decision,
      reviewed_by: auth.userId,
      reviewed_at: now,
    };

    if (decision === 'rejected') {
      updatePayload.rejection_reason = reason!.trim();
      // If rejected, payment_status must remain 'pending'
      updatePayload.payment_status = 'pending';
    } else {
      // Approved
      updatePayload.rejection_reason = null;
      if (note && note.trim()) {
        updatePayload.admin_note = note.trim();
      }
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
      console.error('Error updating winner verification status:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Failed to update verification status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      winner: updatedWinner,
    });
  } catch (err: unknown) {
    console.error('Error in PATCH /api/admin/winners/[id]/verify:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
