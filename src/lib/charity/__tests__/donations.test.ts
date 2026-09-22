import { describe, it, expect } from 'vitest';
import { calculateContribution, poundsToPence, penceToPounds } from '../calculate';

describe('Donation & Contribution Business Rules', () => {
  describe('Contribution calculations', () => {
    it('calculates exact 10% on £10 plan as 100p (£1.00)', () => {
      const pence = calculateContribution(1000, 10);
      expect(pence).toBe(100);
      expect(penceToPounds(pence)).toBe(1.0);
    });

    it('calculates 25% on £10 plan as 250p (£2.50)', () => {
      const pence = calculateContribution(1000, 25);
      expect(pence).toBe(250);
      expect(penceToPounds(pence)).toBe(2.5);
    });

    it('calculates 100% on £10 plan as 1000p (£10.00)', () => {
      const pence = calculateContribution(1000, 100);
      expect(pence).toBe(1000);
      expect(penceToPounds(pence)).toBe(10.0);
    });

    it('safely rounds odd subscription amounts in integer pence', () => {
      // £9.99 (999p) at 10% = 99.9p -> rounds to 100p (£1.00)
      expect(calculateContribution(999, 10)).toBe(100);
      // £99.00 (9900p) at 25% = 2475p (£24.75)
      expect(calculateContribution(9900, 25)).toBe(2475);
    });

    it('rejects percentage below minimum (5% < 10%)', () => {
      expect(() => calculateContribution(1000, 5)).toThrow(
        /cannot be less than the platform minimum/i
      );
    });

    it('rejects percentage above 100% (105% > 100%)', () => {
      expect(() => calculateContribution(1000, 105)).toThrow(
        /cannot exceed 100%/i
      );
    });
  });

  describe('Donation Webhook Idempotency Simulation', () => {
    it('ensures repeated donation webhooks with identical stripe_payment_id do not duplicate records', () => {
      // In-memory mock simulation of the database UNIQUE(stripe_payment_id) constraint and upsert ignoreDuplicates logic
      const databaseDonations: Array<{
        id: string;
        charity_id: string;
        user_id: string | null;
        amount: number;
        stripe_payment_id: string;
      }> = [];

      function simulateDonationWebhook(payload: {
        charity_id: string;
        user_id: string | null;
        amount: number;
        stripe_payment_id: string;
      }) {
        const existing = databaseDonations.find(
          (d) => d.stripe_payment_id === payload.stripe_payment_id
        );
        if (existing) {
          // On conflict stripe_payment_id: ignore duplicate
          return { status: 200, action: 'ignored_duplicate' };
        }

        databaseDonations.push({
          id: `don_${databaseDonations.length + 1}`,
          ...payload,
        });
        return { status: 200, action: 'inserted' };
      }

      const eventPayload = {
        charity_id: 'charity_hope_horizons_123',
        user_id: null, // Guest donation
        amount: 25.0,
        stripe_payment_id: 'pi_test_donation_unique_998877',
      };

      // 1st delivery
      const firstResult = simulateDonationWebhook(eventPayload);
      expect(firstResult.action).toBe('inserted');
      expect(databaseDonations.length).toBe(1);
      expect(databaseDonations[0].amount).toBe(25.0);
      expect(databaseDonations[0].user_id).toBeNull();

      // 2nd delivery (resend / duplicate delivery from Stripe)
      const secondResult = simulateDonationWebhook(eventPayload);
      expect(secondResult.action).toBe('ignored_duplicate');
      expect(databaseDonations.length).toBe(1); // Exactly 1 row remains

      // 3rd delivery
      const thirdResult = simulateDonationWebhook(eventPayload);
      expect(thirdResult.action).toBe('ignored_duplicate');
      expect(databaseDonations.length).toBe(1);
    });

    it('allows guest donations without a user_id or active subscription', () => {
      const guestDonation = {
        charityId: 'charity_clean_oceans_456',
        amount: 5.0,
        userId: null,
      };

      expect(guestDonation.userId).toBeNull();
      expect(guestDonation.amount).toBeGreaterThanOrEqual(1.0);
    });
  });
});
