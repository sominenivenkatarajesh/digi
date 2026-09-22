import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const proofSchema = z.object({
  proof_url: z
    .string()
    .min(1, 'Proof storage path cannot be empty')
    .max(500, 'Proof storage path is too long'),
});

/**
 * Validates actual file content bytes to ensure it is genuinely an image (JPEG, PNG, WebP)
 * and not an executable, text file, or PDF disguised with an image extension.
 */
function isAllowedImageBytes(buffer: Uint8Array, reportedType?: string): boolean {
  // Check magic bytes
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true; // JPEG
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return true; // PNG
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 && // 'RIFF'
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50 // 'WEBP'
  ) {
    return true; // WebP
  }

  // Also check reported mimetype if magic bytes passed or if standard
  const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (reportedType && validMimes.includes(reportedType.toLowerCase())) {
    // Check if it's text or HTML disguised
    const textSample = new TextDecoder('utf-8', { fatal: false }).decode(buffer.slice(0, 64));
    if (textSample.includes('<!DOCTYPE') || textSample.includes('<html') || textSample.includes('<?php')) {
      return false;
    }
    // Only accept if headers matched known signatures
    return false;
  }

  return false;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/winners/[id]/proof
 * Winner submits storage path of their uploaded score proof.
 *
 * Security:
 * - Requires active session.
 * - Caller must be the owner of the winning record.
 * - Path must be in the caller's dedicated storage folder ({user_id}/...).
 * - Server validates the actual stored object's metadata and magic bytes.
 * - Rejects replacement if already approved or paid.
 * - Automatically resets status to 'pending' if previously rejected.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: winnerId } = await params;

    // 1. Authenticate caller from session
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }

    // 2. Validate request body with Zod
    const body = await req.json().catch(() => null);
    const parsed = proofSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid proof payload' },
        { status: 400 }
      );
    }

    const { proof_url: proofUrl } = parsed.data;

    // 3. Folder isolation check: proof_url must start with user.id + '/'
    const expectedPrefix = `${user.id}/`;
    if (!proofUrl.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: 'Unauthorized path: You may only reference files in your personal storage folder.' },
        { status: 403 }
      );
    }

    // 4. Fetch the winner row to verify ownership and current state
    const adminClient = createAdminClient();
    const { data: winner, error: winnerError } = await adminClient
      .from('winners')
      .select('*')
      .eq('id', winnerId)
      .maybeSingle();

    if (winnerError || !winner) {
      return NextResponse.json(
        { error: 'Winning record not found.' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (winner.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Access forbidden. You can only submit proof for your own winnings.' },
        { status: 403 }
      );
    }

    // Disallow edits if already paid
    if (winner.payment_status === 'paid') {
      return NextResponse.json(
        { error: 'Cannot replace proof: Payout has already been completed.' },
        { status: 400 }
      );
    }

    // Disallow edits if already approved
    if (winner.verification_status === 'approved') {
      return NextResponse.json(
        { error: 'Cannot replace proof: Your submission has already been verified and approved.' },
        { status: 400 }
      );
    }

    // 5. Inspect the uploaded file in Supabase Storage:
    // Download first 1KB to inspect magic bytes & metadata
    const { data: fileBlob, error: downloadError } = await adminClient.storage
      .from('winner-proofs')
      .download(proofUrl);

    if (downloadError || !fileBlob) {
      console.error('Failed to locate storage file for verification:', downloadError);
      return NextResponse.json(
        { error: 'Uploaded file could not be verified in storage. Please upload again.' },
        { status: 400 }
      );
    }

    // Verify size: maximum 5MB (~5,242,880 bytes)
    if (fileBlob.size > 5 * 1024 * 1024) {
      // Delete oversized file
      await adminClient.storage.from('winner-proofs').remove([proofUrl]);
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit. Please upload an image under 5MB.' },
        { status: 400 }
      );
    }

    // Read first bytes to verify authentic image structure (not fake .txt renamed to .jpg)
    const arrayBuffer = await fileBlob.slice(0, 1024).arrayBuffer();
    const headerBytes = new Uint8Array(arrayBuffer);

    const isAuthenticImage = isAllowedImageBytes(headerBytes, fileBlob.type);
    if (!isAuthenticImage) {
      // Remove invalid file from storage to prevent junk retention
      await adminClient.storage.from('winner-proofs').remove([proofUrl]);
      return NextResponse.json(
        {
          error:
            'Invalid file format. The file content does not match a supported image type (JPEG, PNG, or WebP). Renamed non-image files are rejected.',
        },
        { status: 400 }
      );
    }

    // 6. Update database record:
    // If status was 'rejected', reset to 'pending' and clear rejection reason.
    // If status was 'pending', keep as 'pending'.
    const updatePayload: Record<string, any> = {
      proof_url: proofUrl,
    };

    if (winner.verification_status === 'rejected') {
      updatePayload.verification_status = 'pending';
      updatePayload.rejection_reason = null;
      updatePayload.reviewed_by = null;
      updatePayload.reviewed_at = null;
    }

    const { data: updatedWinner, error: updateError } = await adminClient
      .from('winners')
      .update(updatePayload)
      .eq('id', winnerId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Failed to update winner proof_url:', updateError);
      return NextResponse.json(
        { error: 'Failed to update winning record with proof path.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      winner: updatedWinner,
    });
  } catch (err: unknown) {
    console.error('Error in PATCH /api/winners/[id]/proof:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
