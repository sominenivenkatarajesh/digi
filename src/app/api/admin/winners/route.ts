import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminCaller } from '@/lib/engine/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/winners
 * Admin-only endpoint to retrieve all winners across all draws with user profiles,
 * draw details, and short-lived signed URLs for proof verification.
 *
 * Security:
 * - verifyAdminCaller(): Reads session cookie, queries profiles.role in DB,
 *   rejects if unauthenticated (401) or not admin (403).
 */
export async function GET(req: NextRequest) {
  const auth = await verifyAdminCaller();
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');

    const adminClient = createAdminClient();

    let query = adminClient
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
        reviewed_by,
        reviewed_at,
        paid_at,
        created_at,
        profiles:user_id (
          id,
          full_name,
          email
        ),
        reviewer:reviewed_by (
          id,
          full_name,
          email
        ),
        draws (
          id,
          draw_month,
          mode,
          status,
          winning_numbers,
          published_at
        )
      `)
      .order('created_at', { ascending: false });

    // Optional status filtering: 'pending', 'approved', 'rejected', 'paid'
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'paid') {
        query = query.eq('payment_status', 'paid');
      } else if (statusFilter === 'pending') {
        query = query.eq('verification_status', 'pending');
      } else if (statusFilter === 'approved') {
        query = query.eq('verification_status', 'approved').neq('payment_status', 'paid');
      } else if (statusFilter === 'rejected') {
        query = query.eq('verification_status', 'rejected');
      }
    }

    const { data: winners, error: winnersError } = await query;

    if (winnersError) {
      console.error('Error fetching admin winners:', winnersError);
      return NextResponse.json({ error: winnersError.message }, { status: 500 });
    }

    // Generate short-lived signed URLs (5 minutes = 300 seconds) for private proof files
    const winnersWithSignedUrls = await Promise.all(
      (winners || []).map(async (w) => {
        let signedUrl: string | null = null;
        if (w.proof_url) {
          try {
            const { data } = await adminClient.storage
              .from('winner-proofs')
              .createSignedUrl(w.proof_url, 300); // 5 minutes
            signedUrl = data?.signedUrl || null;
          } catch (storageErr) {
            console.error(`Error creating signed URL for winner ${w.id}:`, storageErr);
          }
        }
        return {
          ...w,
          signed_proof_url: signedUrl,
        };
      })
    );

    return NextResponse.json({ winners: winnersWithSignedUrls });
  } catch (err: unknown) {
    console.error('Error in GET /api/admin/winners:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
