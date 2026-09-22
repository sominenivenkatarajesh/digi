import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminCaller } from '@/lib/engine/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const updateCharitySchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/).optional(),
  category: z.string().min(2).optional(),
  tagline: z.string().optional().nullable(),
  description: z.string().min(10).optional(),
  short_description: z.string().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  is_featured: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/charities/[id]
 * Updates charity info, handles soft deactivation and featured toggling.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await verifyAdminCaller();
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const { id: charityId } = await params;
    const body = await req.json().catch(() => null);

    const parsed = updateCharitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid update data' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Check slug uniqueness if slug is being updated
    if (parsed.data.slug) {
      const { data: existing } = await adminClient
        .from('charities')
        .select('id')
        .eq('slug', parsed.data.slug)
        .neq('id', charityId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: `Slug '${parsed.data.slug}' is already taken by another charity.` },
          { status: 409 }
        );
      }
    }

    const { data: updated, error: updateError } = await adminClient
      .from('charities')
      .update(parsed.data)
      .eq('id', charityId)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      charity: updated,
    });
  } catch (err: unknown) {
    console.error('Error updating charity:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
