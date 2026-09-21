import { z } from 'zod';

export const checkoutSchema = z.object({
  plan: z.enum(['monthly', 'yearly'], {
    message: "Plan must be either 'monthly' or 'yearly'",
  }),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
