import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminCaller } from '@/lib/engine/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const charitySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens'),
  category: z.string().min(2, 'Category is required'),
  tagline: z.string().optional().nullable(),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  short_description: z.string().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  is_featured: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

/**
 * GET /api/admin/charities
 * Lists all charities (both active and inactive) with event count and totals.
 */
export async function GET() {
  const auth = await verifyAdminCaller();
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const adminClient = createAdminClient();

    // Fetch all charities
    const { data: charities, error: charityError } = await adminClient
      .from('charities')
      .select(`
        *,
        charity_events (
          id
        )
      `)
      .order('is_active', { ascending: false })
      .order('name', { ascending: true });

    if (charityError) {
      return NextResponse.json({ error: charityError.message }, { status: 500 });
    }

    const formatted = (charities || []).map((c: any) => ({
      ...c,
      event_count: c.charity_events?.length || 0,
    }));

    return NextResponse.json({ charities: formatted });
  } catch (err: unknown) {
    console.error('Error fetching admin charities:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/charities
 * Creates a new charity.
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAdminCaller();
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const body = await req.json().catch(() => null);
    const parsed = charitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid charity data' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Check slug uniqueness
    const { data: existing } = await adminClient
      .from('charities')
      .select('id')
      .eq('slug', parsed.data.slug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `A charity with slug '${parsed.data.slug}' already exists.` },
        { status: 409 }
      );
    }

    // Insert charity (trigger ensures only one is_featured at a time)
    const { data: newCharity, error: insertError } = await adminClient
      .from('charities')
      .insert(parsed.data)
      .select('*')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      charity: newCharity,
    });
  } catch (err: unknown) {
    console.error('Error creating charity:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
