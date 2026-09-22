import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminCaller } from '@/lib/engine/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const eventSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  event_date: z.string().min(1, 'Event date is required'),
  location: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/charities/[id]/events
 * Lists all events for a charity.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await verifyAdminCaller();
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const { id: charityId } = await params;
    const adminClient = createAdminClient();

    const { data: events, error } = await adminClient
      .from('charity_events')
      .select('*')
      .eq('charity_id', charityId)
      .order('event_date', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ events: events || [] });
  } catch (err: unknown) {
    console.error('Error fetching charity events:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/charities/[id]/events
 * Creates a new event for the charity.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await verifyAdminCaller();
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const { id: charityId } = await params;
    const body = await req.json().catch(() => null);

    const parsed = eventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid event parameters' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const { data: newEvent, error: insertError } = await adminClient
      .from('charity_events')
      .insert({
        charity_id: charityId,
        title: parsed.data.title,
        event_date: parsed.data.event_date,
        location: parsed.data.location || null,
        description: parsed.data.description || null,
      })
      .select('*')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      event: newEvent,
    });
  } catch (err: unknown) {
    console.error('Error adding charity event:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
