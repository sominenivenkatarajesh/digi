import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminCaller } from '@/lib/engine/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const updateEventSchema = z.object({
  title: z.string().min(2).optional(),
  event_date: z.string().min(1).optional(),
  location: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

interface RouteParams {
  params: Promise<{ id: string; eventId: string }>;
}

/**
 * PATCH /api/admin/charities/[id]/events/[eventId]
 * Updates an existing charity event.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await verifyAdminCaller();
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const { id: charityId, eventId } = await params;
    const body = await req.json().catch(() => null);

    const parsed = updateEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid event data' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const { data: updated, error } = await adminClient
      .from('charity_events')
      .update(parsed.data)
      .eq('id', eventId)
      .eq('charity_id', charityId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, event: updated });
  } catch (err: unknown) {
    console.error('Error updating charity event:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/charities/[id]/events/[eventId]
 * Deletes a charity event.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await verifyAdminCaller();
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const { id: charityId, eventId } = await params;
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from('charity_events')
      .delete()
      .eq('id', eventId)
      .eq('charity_id', charityId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting charity event:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
