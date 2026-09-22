import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// 1. Zod schemas mirroring the API endpoints
const proofSchema = z.object({
  proof_url: z
    .string()
    .min(1, 'Proof storage path cannot be empty')
    .max(500, 'Proof storage path is too long'),
});

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

const paySchema = z
  .object({
    note: z.string().optional(),
  })
  .strict();

// 2. Pure magic bytes and content validation logic
function isAllowedImageBytes(buffer: Uint8Array, reportedType?: string): boolean {
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

  return false;
}

// 3. User folder prefix guard
function isPathInUserFolder(proofUrl: string, userId: string): boolean {
  return proofUrl.startsWith(`${userId}/`);
}

// 4. Payout eligibility guard
function canMarkAsPaid(winner: { verification_status: string; payment_status: string }): {
  allowed: boolean;
  error?: string;
} {
  if (winner.verification_status !== 'approved') {
    return {
      allowed: false,
      error: `Cannot mark as paid: Winner verification status is '${winner.verification_status}'. Score proof must be verified and approved first.`,
    };
  }
  if (winner.payment_status === 'paid') {
    return {
      allowed: false,
      error: 'Winner has already been marked as paid.',
    };
  }
  return { allowed: true };
}

// 5. Proof replacement guard
function canReplaceProof(winner: { verification_status: string; payment_status: string }): {
  allowed: boolean;
  error?: string;
} {
  if (winner.payment_status === 'paid') {
    return {
      allowed: false,
      error: 'Cannot replace proof: Payout has already been completed.',
    };
  }
  if (winner.verification_status === 'approved') {
    return {
      allowed: false,
      error: 'Cannot replace proof: Your submission has already been verified and approved.',
    };
  }
  return { allowed: true };
}

describe('Winner Verification & Payout Workflow', () => {
  describe('Proof Submission Schema & Security', () => {
    it('accepts valid proof path', () => {
      const parsed = proofSchema.safeParse({
        proof_url: 'usr_123/win_456-1727000000000.png',
      });
      expect(parsed.success).toBe(true);
    });

    it('rejects missing or empty proof path', () => {
      expect(proofSchema.safeParse({}).success).toBe(false);
      expect(proofSchema.safeParse({ proof_url: '' }).success).toBe(false);
    });

    it('enforces user folder isolation', () => {
      const userId = 'user-uuid-1111';
      const validPath = `${userId}/winner-uuid-2222-123456.jpg`;
      const invalidOtherUserPath = `user-uuid-9999/winner-uuid-2222-123456.jpg`;
      const sneakyPrefixPath = `${userId}_attacker/winner-uuid-2222.jpg`;

      expect(isPathInUserFolder(validPath, userId)).toBe(true);
      expect(isPathInUserFolder(invalidOtherUserPath, userId)).toBe(false);
      expect(isPathInUserFolder(sneakyPrefixPath, userId)).toBe(false);
    });
  });

  describe('File Type & Magic Bytes Validation (Fake Extension Detection)', () => {
    it('recognizes valid JPEG magic bytes (FF D8 FF)', () => {
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      expect(isAllowedImageBytes(jpegBytes)).toBe(true);
    });

    it('recognizes valid PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)', () => {
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
      expect(isAllowedImageBytes(pngBytes)).toBe(true);
    });

    it('recognizes valid WebP magic bytes (RIFF .... WEBP)', () => {
      const webpBytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x20, 0x00, 0x00, 0x00, // Size
        0x57, 0x45, 0x42, 0x50, // WEBP
        0x56, 0x50, 0x38, // VP8
      ]);
      expect(isAllowedImageBytes(webpBytes)).toBe(true);
    });

    it('rejects text file disguised with .jpg extension', () => {
      const textDisguised = new TextEncoder().encode('Hello, this is a plain text score proof');
      expect(isAllowedImageBytes(textDisguised)).toBe(false);
    });

    it('rejects PDF file disguised with .png extension', () => {
      const pdfBytes = new TextEncoder().encode('%PDF-1.4 header contents...');
      expect(isAllowedImageBytes(pdfBytes)).toBe(false);
    });
  });

  describe('Admin Verification Route Validation', () => {
    it('allows approval with optional note', () => {
      const parsed = verifySchema.safeParse({
        decision: 'approved',
        note: 'Scores verified against golf club scorecard.',
      });
      expect(parsed.success).toBe(true);
    });

    it('allows approval with no note', () => {
      const parsed = verifySchema.safeParse({
        decision: 'approved',
      });
      expect(parsed.success).toBe(true);
    });

    it('allows rejection when valid non-empty reason is provided', () => {
      const parsed = verifySchema.safeParse({
        decision: 'rejected',
        reason: 'Handicap card does not match Stableford entry for round 3.',
      });
      expect(parsed.success).toBe(true);
    });

    it('STRICTLY rejects rejection when reason is missing or empty', () => {
      const missingReason = verifySchema.safeParse({
        decision: 'rejected',
      });
      expect(missingReason.success).toBe(false);

      const emptyReason = verifySchema.safeParse({
        decision: 'rejected',
        reason: '   ',
      });
      expect(emptyReason.success).toBe(false);
    });

    it('rejects invalid decision values', () => {
      const parsed = verifySchema.safeParse({
        decision: 'maybe',
        reason: 'some reason',
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe('Admin Payout Route Validation & Rules', () => {
    it('accepts valid empty or noted pay payload', () => {
      expect(paySchema.safeParse({}).success).toBe(true);
      expect(paySchema.safeParse({ note: 'Transferred via Barclays Bank Ref #12345' }).success).toBe(
        true
      );
    });

    it('strictly rejects unexpected fields in pay payload', () => {
      const invalid = paySchema.safeParse({
        note: 'Note',
        hack: 'malicious_extra_field',
      });
      expect(invalid.success).toBe(false);
    });

    it('strictly blocks payout if verification_status is pending or rejected', () => {
      const pendingWinner = { verification_status: 'pending', payment_status: 'pending' };
      const rejectedWinner = { verification_status: 'rejected', payment_status: 'pending' };
      const approvedWinner = { verification_status: 'approved', payment_status: 'pending' };

      expect(canMarkAsPaid(pendingWinner).allowed).toBe(false);
      expect(canMarkAsPaid(pendingWinner).error).toContain('verified and approved first');

      expect(canMarkAsPaid(rejectedWinner).allowed).toBe(false);
      expect(canMarkAsPaid(approvedWinner).allowed).toBe(true);
    });

    it('strictly blocks double payout if already paid', () => {
      const alreadyPaid = { verification_status: 'approved', payment_status: 'paid' };
      expect(canMarkAsPaid(alreadyPaid).allowed).toBe(false);
      expect(canMarkAsPaid(alreadyPaid).error).toContain('already been marked as paid');
    });
  });

  describe('Winner State Transitions & Replacement Rules', () => {
    it('allows proof replacement when status is pending and payment is pending', () => {
      const pendingWinner = { verification_status: 'pending', payment_status: 'pending' };
      expect(canReplaceProof(pendingWinner).allowed).toBe(true);
    });

    it('blocks proof replacement once winner is approved', () => {
      const approvedWinner = { verification_status: 'approved', payment_status: 'pending' };
      expect(canReplaceProof(approvedWinner).allowed).toBe(false);
      expect(canReplaceProof(approvedWinner).error).toContain('already been verified and approved');
    });

    it('blocks proof replacement once winner is paid', () => {
      const paidWinner = { verification_status: 'approved', payment_status: 'paid' };
      expect(canReplaceProof(paidWinner).allowed).toBe(false);
      expect(canReplaceProof(paidWinner).error).toContain('Payout has already been completed');
    });

    it('simulates state reset when user re-submits proof after rejection', () => {
      const currentWinner = {
        verification_status: 'rejected',
        rejection_reason: 'Image too blurry',
        reviewed_by: 'admin-uuid',
        reviewed_at: '2026-09-20T10:00:00Z',
      };

      // Resubmission payload logic from PATCH /api/winners/[id]/proof
      const updatePayload: Record<string, any> = {
        proof_url: 'user-1/proof-2.jpg',
      };
      if (currentWinner.verification_status === 'rejected') {
        updatePayload.verification_status = 'pending';
        updatePayload.rejection_reason = null;
        updatePayload.reviewed_by = null;
        updatePayload.reviewed_at = null;
      }

      expect(updatePayload.verification_status).toBe('pending');
      expect(updatePayload.rejection_reason).toBeNull();
      expect(updatePayload.reviewed_by).toBeNull();
      expect(updatePayload.reviewed_at).toBeNull();
    });
  });
});
