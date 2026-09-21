import { describe, it, expect } from 'vitest';
import {
  validateScore,
  sortScores,
  planScoreInsert,
  formatScoreDate,
  getMaxAllowedDateString,
} from '../logic';
import { Score } from '../types';

describe('Score Business Logic', () => {
  describe('validateScore', () => {
    // Fixed reference date: 2026-09-21 12:00:00 UTC
    const refDate = new Date(Date.UTC(2026, 8, 21, 12, 0, 0));

    it('rejects score of 0', () => {
      const res = validateScore(0, '2026-09-20', refDate);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Score must be between 1 and 45 in Stableford format.');
    });

    it('rejects score of 46', () => {
      const res = validateScore(46, '2026-09-20', refDate);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Score must be between 1 and 45 in Stableford format.');
    });

    it('rejects decimal score of 12.5', () => {
      const res = validateScore(12.5, '2026-09-20', refDate);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Score must be a whole number between 1 and 45.');
    });

    it('accepts minimum valid score of 1', () => {
      const res = validateScore(1, '2026-09-20', refDate);
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('accepts maximum valid score of 45', () => {
      const res = validateScore(45, '2026-09-20', refDate);
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('accepts score of 36 on current date', () => {
      const res = validateScore(36, '2026-09-21', refDate);
      expect(res.isValid).toBe(true);
    });

    it('allows (UTC today + 1 day) to tolerate eastern time zones like IST (India)', () => {
      // 2026-09-22 is UTC tomorrow, which is valid under our timezone tolerance
      const res = validateScore(36, '2026-09-22', refDate);
      expect(res.isValid).toBe(true);
    });

    it('rejects future date beyond UTC tomorrow (e.g. 2 days ahead)', () => {
      const res = validateScore(36, '2026-09-23', refDate);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Score date cannot be in the future.');
    });

    it('rejects malformed dates and invalid calendar dates', () => {
      expect(validateScore(30, 'invalid-date', refDate).isValid).toBe(false);
      expect(validateScore(30, '2026-02-31', refDate).isValid).toBe(false); // Feb 31 does not exist
      expect(validateScore(30, null, refDate).isValid).toBe(false);
    });
  });

  describe('formatScoreDate', () => {
    it('formats plain YYYY-MM-DD string without timezone conversion', () => {
      expect(formatScoreDate('2026-09-21')).toBe('21 Sep 2026');
      expect(formatScoreDate('2026-01-01')).toBe('1 Jan 2026');
      expect(formatScoreDate('2026-12-31')).toBe('31 Dec 2026');
    });

    it('returns original input for invalid formats gracefully', () => {
      expect(formatScoreDate('')).toBe('');
      expect(formatScoreDate('invalid')).toBe('invalid');
    });
  });

  describe('sortScores', () => {
    it('sorts scores newest played_on first', () => {
      const scores = [
        { id: '1', user_id: 'u1', score: 32, played_on: '2026-09-10', created_at: '2026-09-10T10:00:00Z' },
        { id: '2', user_id: 'u1', score: 38, played_on: '2026-09-18', created_at: '2026-09-18T10:00:00Z' },
        { id: '3', user_id: 'u1', score: 35, played_on: '2026-09-15', created_at: '2026-09-15T10:00:00Z' },
      ];

      const sorted = sortScores(scores);
      expect(sorted.map((s) => s.played_on)).toEqual([
        '2026-09-18',
        '2026-09-15',
        '2026-09-10',
      ]);
    });
  });

  describe('planScoreInsert', () => {
    const existingScores: Score[] = [
      { id: 's1', user_id: 'u1', score: 30, played_on: '2026-09-01', created_at: '2026-09-01T00:00:00Z' },
      { id: 's2', user_id: 'u1', score: 32, played_on: '2026-09-05', created_at: '2026-09-05T00:00:00Z' },
      { id: 's3', user_id: 'u1', score: 34, played_on: '2026-09-10', created_at: '2026-09-10T00:00:00Z' },
      { id: 's4', user_id: 'u1', score: 36, played_on: '2026-09-15', created_at: '2026-09-15T00:00:00Z' },
      { id: 's5', user_id: 'u1', score: 38, played_on: '2026-09-20', created_at: '2026-09-20T00:00:00Z' },
    ];

    it('rejects duplicate date with specific edit guidance', () => {
      const plan = planScoreInsert(existingScores, { score: 40, played_on: '2026-09-10' });
      expect(plan.allowed).toBe(false);
      expect(plan.reason).toBe('You already have a score for this date. Edit it instead.');
    });

    it('allows insertion when user has fewer than 5 scores', () => {
      const fourScores = existingScores.slice(0, 4);
      const plan = planScoreInsert(fourScores, { score: 40, played_on: '2026-09-18' });
      expect(plan.allowed).toBe(true);
      expect(plan.willReplace).toBeUndefined();
    });

    it('allows insertion when 5 exist and new date is newer than oldest, identifying oldest for replacement', () => {
      // Oldest is 2026-09-01 (s1). New date is 2026-09-12 (newer than 2026-09-01).
      const plan = planScoreInsert(existingScores, { score: 42, played_on: '2026-09-12' });
      expect(plan.allowed).toBe(true);
      expect(plan.willReplace).toBeDefined();
      expect(plan.willReplace?.id).toBe('s1');
      expect(plan.willReplace?.played_on).toBe('2026-09-01');
    });

    it('rejects insertion when 5 exist and new date is strictly older than all 5', () => {
      // Oldest is 2026-09-01. New date is 2026-08-25.
      const plan = planScoreInsert(existingScores, { score: 40, played_on: '2026-08-25' });
      expect(plan.allowed).toBe(false);
      expect(plan.reason).toBe(
        'This score date is older than all 5 of your stored scores and would be immediately replaced.'
      );
    });
  });
});
