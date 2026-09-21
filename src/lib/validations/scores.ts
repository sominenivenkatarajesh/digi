import { z } from 'zod';

export const createScoreSchema = z.object({
  score: z
    .number({ error: 'Score must be a number' })
    .int('Score must be a whole number')
    .min(1, 'Score must be between 1 and 45')
    .max(45, 'Score must be between 1 and 45'),
  played_on: z
    .string({ error: 'Date is required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

export const updateScoreSchema = z
  .object({
    score: z
      .number()
      .int('Score must be a whole number')
      .min(1, 'Score must be between 1 and 45')
      .max(45, 'Score must be between 1 and 45')
      .optional(),
    played_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional(),
  })
  .refine((data) => data.score !== undefined || data.played_on !== undefined, {
    message: 'At least one field (score or played_on) must be provided for update',
  });

export type CreateScoreInput = z.infer<typeof createScoreSchema>;
export type UpdateScoreInput = z.infer<typeof updateScoreSchema>;
