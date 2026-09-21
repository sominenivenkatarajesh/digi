import { describe, it, expect } from 'vitest';
import { calculateContribution, calculateContributionPounds } from '../calculate';

describe('Charity Contribution Calculation', () => {
  it('calculates 10% contribution on £10 (1000p) exactly as 100p', () => {
    expect(calculateContribution(1000, 10)).toBe(100);
    expect(calculateContributionPounds(10.0, 10)).toBe(1.0);
  });

  it('calculates 25% contribution on £10 (1000p) exactly as 250p', () => {
    expect(calculateContribution(1000, 25)).toBe(250);
    expect(calculateContributionPounds(10.0, 25)).toBe(2.5);
  });

  it('calculates 100% contribution on £10 (1000p) exactly as 1000p', () => {
    expect(calculateContribution(1000, 100)).toBe(1000);
    expect(calculateContributionPounds(10.0, 100)).toBe(10.0);
  });

  it('safely rounds odd amounts to nearest integer pence', () => {
    // 999p * 10% = 99.9p -> rounds to 100p (£1.00)
    expect(calculateContribution(999, 10)).toBe(100);
    // 999p * 33% = 329.67p -> rounds to 330p (£3.30)
    expect(calculateContribution(999, 33)).toBe(330);
    // 1000p * 15% = 150p
    expect(calculateContribution(1000, 15)).toBe(150);
  });

  it('never returns more than the total payment amount', () => {
    expect(calculateContribution(500, 100)).toBe(500);
  });

  it('rejects contribution percentages below the platform minimum (10%)', () => {
    expect(() => calculateContribution(1000, 5)).toThrow(
      'Charity contribution percent cannot be less than the platform minimum of 10%.'
    );
    expect(() => calculateContribution(1000, 0)).toThrow(
      'Charity contribution percent cannot be less than the platform minimum of 10%.'
    );
    expect(() => calculateContribution(1000, -5)).toThrow(
      'Charity contribution percent cannot be less than the platform minimum of 10%.'
    );
  });

  it('rejects contribution percentages above 100%', () => {
    expect(() => calculateContribution(1000, 105)).toThrow(
      'Charity contribution percent cannot exceed 100%.'
    );
  });

  it('supports custom minimum percentage parameters from platform settings', () => {
    expect(calculateContribution(1000, 15, 15)).toBe(150);
    expect(() => calculateContribution(1000, 12, 15)).toThrow(
      'Charity contribution percent cannot be less than the platform minimum of 15%.'
    );
  });
});
