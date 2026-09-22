import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminCaller } from '@/lib/engine/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/winners/[id]/proof-url
 * Generates an on-demand, short-lived (5-minute) signed URL for an admin to view
 * a winner's score screenshot from the private winner-proofs bucket.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await verifyAdminCaller();
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const { id: winnerId } = await params;
    const adminClient = createAdminClient();

    const { data: winner, error: winnerError } = await adminClient
      .from('winners')
      .select('id, proof_url')
      .eq('id', winnerId)
      .maybeSingle();

    if (winnerError || !winner) {
      return NextResponse.json({ error: 'Winning record not found' }, { status: 404 });
    }

    if (!winner.proof_url) {
      return NextResponse.json(
        { error: 'No proof file has been submitted for this winner' },
        { status: 400 }
      );
    }

    const { data: signedData, error: signedError } = await adminClient.storage
      .from('winner-proofs')
      .createSignedUrl(winner.proof_url, 300); // 5 minutes

    if (signedError || !signedData?.signedUrl) {
      return NextResponse.json(
        { error: 'Failed to generate signed URL for proof image' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: signedData.signedUrl,
      expiresInSeconds: 300,
    });
  } catch (err: unknown) {
    console.error('Error generating proof signed URL:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
