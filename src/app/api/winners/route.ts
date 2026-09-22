import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/winners
 * Fetches all winning records for the authenticated user across all monthly draws.
 *
 * Security & RLS:
 * - Uses the session client (createClient from @/lib/supabase/server) so Postgres RLS
 *   strictly guarantees only rows where auth.uid() = user_id can ever be queried.
 * - Never uses service role to query the winners list.
 * - Generates short-lived signed URLs for user's uploaded proof images.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // 1. Authenticate user from session
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    // 2. Query winnings using SESSION CLIENT (RLS enforces auth.uid() = user_id)
    const { data: winnings, error: winError } = await supabase
      .from('winners')
      .select(`
        id,
        draw_id,
        user_id,
        tier,
        prize_amount,
        proof_url,
        verification_status,
        payment_status,
        rejection_reason,
        admin_note,
        reviewed_at,
        paid_at,
        created_at,
        draws (
          id,
          draw_month,
          mode,
          winning_numbers,
          published_at
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (winError) {
      console.error('Error fetching user winnings:', winError);
      return NextResponse.json(
        { error: 'Failed to retrieve winnings records.' },
        { status: 500 }
      );
    }

    const adminClient = createAdminClient();

    // 3. For any winner with a proof_url, generate a temporary signed preview URL (15 mins)
    const winningsWithSignedUrls = await Promise.all(
      (winnings || []).map(async (w) => {
        let signedProofUrl: string | null = null;
        if (w.proof_url) {
          try {
            const { data: signedData } = await adminClient.storage
              .from('winner-proofs')
              .createSignedUrl(w.proof_url, 900); // 15 minutes
            signedProofUrl = signedData?.signedUrl || null;
          } catch (storageErr) {
            console.error('Error generating signed URL for user proof:', storageErr);
          }
        }
        return {
          ...w,
          signed_proof_url: signedProofUrl,
        };
      })
    );

    // 4. Compute lightweight notification flags
    const actionRequiredCount = winningsWithSignedUrls.filter(
      (w) =>
        (w.verification_status === 'pending' && !w.proof_url) ||
        w.verification_status === 'rejected'
    ).length;

    const approvedPendingPayoutCount = winningsWithSignedUrls.filter(
      (w) => w.verification_status === 'approved' && w.payment_status === 'pending'
    ).length;

    const paidCount = winningsWithSignedUrls.filter(
      (w) => w.payment_status === 'paid'
    ).length;

    return NextResponse.json({
      winnings: winningsWithSignedUrls,
      notifications: {
        actionRequiredCount,
        approvedPendingPayoutCount,
        paidCount,
      },
    });
  } catch (err: unknown) {
    console.error('Unexpected error in GET /api/winners:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
