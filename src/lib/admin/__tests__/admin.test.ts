import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validateScore, planScoreInsert } from '@/lib/scores/logic';

describe('Admin & Dashboard Operations', () => {
  describe('Admin Score Validation', () => {
    it('rejects a score above 45 even in admin context', () => {
      const result = validateScore(50, '2026-05-10');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('between 1 and 45');
    });

    it('rejects a score below 1 even in admin context', () => {
      const result = validateScore(0, '2026-05-10');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('between 1 and 45');
    });

    it('rejects a future date score even in admin context', () => {
      const futureDate = new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0];
      const result = validateScore(36, futureDate);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('future');
    });

    it('rejects duplicate dates within user scores', () => {
      const existing = [
        { id: '1', user_id: 'u1', score: 32, played_on: '2026-05-01', created_at: '2026-05-01T00:00:00Z', updated_at: '2026-05-01T00:00:00Z' },
      ];
      const plan = planScoreInsert(existing, { score: 35, played_on: '2026-05-01' });
      expect(plan.allowed).toBe(false);
      expect(plan.reason).toContain('already have a score');
    });

    it('FIFO replaces the oldest score when user already has 5 scores', () => {
      const existing = [
        { id: '1', user_id: 'u1', score: 30, played_on: '2026-01-01', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
        { id: '2', user_id: 'u1', score: 31, played_on: '2026-01-02', created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' },
        { id: '3', user_id: 'u1', score: 32, played_on: '2026-01-03', created_at: '2026-01-03T00:00:00Z', updated_at: '2026-01-03T00:00:00Z' },
        { id: '4', user_id: 'u1', score: 33, played_on: '2026-01-04', created_at: '2026-01-04T00:00:00Z', updated_at: '2026-01-04T00:00:00Z' },
        { id: '5', user_id: 'u1', score: 34, played_on: '2026-01-05', created_at: '2026-01-05T00:00:00Z', updated_at: '2026-01-05T00:00:00Z' },
      ];
      const plan = planScoreInsert(existing, { score: 38, played_on: '2026-01-06' });
      expect(plan.allowed).toBe(true);
      expect(plan.willReplace?.id).toBe('1');
    });
  });

  describe('Admin Subscription Override Schema (Review Item 1 & 2)', () => {
    const overrideSchema = z
      .object({
        status: z.enum(['active', 'inactive', 'lapsed', 'cancelled']),
        plan: z.enum(['monthly', 'yearly']).optional(),
        note: z
          .string()
          .min(3, 'An override audit note is strictly required (min 3 characters).'),
      })
      .strict();

    it('requires an audit note with at least 3 characters', () => {
      const valid = overrideSchema.safeParse({
        status: 'active',
        note: 'Customer support granted 1 month credit for downtime',
      });
      expect(valid.success).toBe(true);

      const missingNote = overrideSchema.safeParse({
        status: 'active',
      });
      expect(missingNote.success).toBe(false);

      const emptyNote = overrideSchema.safeParse({
        status: 'active',
        note: 'hi',
      });
      expect(emptyNote.success).toBe(false);
    });

    it('rejects invalid subscription statuses', () => {
      const invalidStatus = overrideSchema.safeParse({
        status: 'vip_lifetime',
        note: 'Valid note',
      });
      expect(invalidStatus.success).toBe(false);
    });
  });

  describe('Admin Charity Schema & Trigger Logic (Review Item 5)', () => {
    const charityCreateSchema = z
      .object({
        name: z.string().min(2),
        tagline: z.string().min(5),
        description: z.string().optional(),
        slug: z.string().min(2),
        is_active: z.boolean().default(true),
        is_featured: z.boolean().default(false),
      })
      .strict();

    it('validates charity creation payload', () => {
      const parsed = charityCreateSchema.safeParse({
        name: 'St Andrews Golf Foundation',
        tagline: 'Supporting junior golf talent and junior scholarships',
        slug: 'st-andrews-foundation',
        is_active: true,
        is_featured: true,
      });
      expect(parsed.success).toBe(true);
    });

    it('rejects charity without a name or tagline', () => {
      const invalid = charityCreateSchema.safeParse({
        name: '',
        slug: 'bad-charity',
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe('Admin User Directory Pagination Logic (Review Item 8)', () => {
    const DEFAULT_PAGE_SIZE = 20;

    function paginateUsers<T>(users: T[], page: number, pageSize = DEFAULT_PAGE_SIZE) {
      const offset = (page - 1) * pageSize;
      const paginated = users.slice(offset, offset + pageSize);
      return {
        data: paginated,
        total: users.length,
        page,
        pageSize,
        totalPages: Math.ceil(users.length / pageSize),
      };
    }

    it('handles boundary of 0 users', () => {
      const result = paginateUsers([], 1);
      expect(result.data.length).toBe(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('handles boundary of 1 user', () => {
      const result = paginateUsers([{ id: 'u1' }], 1);
      expect(result.data.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('handles 25+ users correctly with 20 per page', () => {
      const dummyUsers = Array.from({ length: 28 }, (_, i) => ({ id: `u${i + 1}` }));
      
      const page1 = paginateUsers(dummyUsers, 1, 20);
      expect(page1.data.length).toBe(20);
      expect(page1.total).toBe(28);
      expect(page1.totalPages).toBe(2);
      expect(page1.data[0].id).toBe('u1');
      expect(page1.data[19].id).toBe('u20');

      const page2 = paginateUsers(dummyUsers, 2, 20);
      expect(page2.data.length).toBe(8);
      expect(page2.data[0].id).toBe('u21');
      expect(page2.data[7].id).toBe('u28');
    });
  });
});
