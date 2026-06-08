import { z } from 'zod';

export const NextActionSchema = z.enum([
  'continue',
  'qualify',
  'offer_visit',
  'handoff',
  'close_lost',
  'nurture',
]);

export const QualificationUpdateSchema = z.object({
  intent: z.enum(['buy', 'rent', 'unknown']).optional(),
  propertyType: z.enum(['apartment', 'villa', 'plot', 'commercial', 'unknown']).optional(),
  bhk: z.number().int().min(1).max(10).optional(),
  budgetMin: z.number().nonnegative().optional(),
  budgetMax: z.number().nonnegative().optional(),
  preferredLocations: z.array(z.string()).optional(),
  timeline: z.enum(['immediate', '1_3_months', '3_6_months', 'exploring', 'unknown']).optional(),
  financing: z.enum(['loan', 'cash', 'unknown']).optional(),
  name: z.string().optional(),
  notes: z.string().optional(),
});

export const LLMOutputSchema = z.object({
  reply: z.string().min(1, 'reply must not be empty'),
  next_action: NextActionSchema,
  qualification_update: QualificationUpdateSchema,
});

export type LLMOutput = z.infer<typeof LLMOutputSchema>;
export type QualificationUpdateInput = z.infer<typeof QualificationUpdateSchema>;
