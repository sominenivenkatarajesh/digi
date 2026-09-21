import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const userCharitySchema = z.object({
  charityId: z.string().min(1, 'Charity selection is required'),
  charityPercent: z
    .number({ error: 'Percentage must be a number' })
    .int('Percentage must be a whole number')
    .min(10, 'Minimum charity contribution is 10%')
    .max(100, 'Maximum charity contribution is 100%'),
});

/**
 * PATCH /api/user/charity
 * Updates the user's supported charity and contribution percentage.
 * Enforces session client authentication so RLS applies.
 */
export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to update your charity settings.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validation = userCharitySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid parameters.' },
        { status: 400 }
      );
    }

    const { charityId, charityPercent } = validation.data;

    // Verify charity is active
    const { data: charity, error: charityErr } = await supabase
      .from('charities')
      .select('id, name, is_active')
      .eq('id', charityId)
      .maybeSingle();

    if (charityErr || !charity || !charity.is_active) {
      return NextResponse.json(
        { error: 'Selected charity was not found or is currently inactive.' },
        { status: 400 }
      );
    }

    // Update profiles row (subject to trigger_check_charity_percent)
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        charity_id: charity.id,
        charity_percent: charityPercent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateErr) {
      console.error('Error updating user charity preference:', updateErr);
      return NextResponse.json(
        { error: updateErr.message || 'Failed to update charity settings.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Preferences saved. ${charityPercent}% of future subscription fees will support ${charity.name}.`,
    });
  } catch (err: any) {
    console.error('API charity update error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to update charity settings.' },
      { status: 500 }
    );
  }
}
