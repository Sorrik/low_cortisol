import { z } from 'zod';

export const ActivitySchema = z.object({
  id:              z.string().optional(),
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type:            z.enum(["walking", "running", "gym", "cycling", "other"]),
  durationMinutes: z.number().int().min(1),
  intensity:       z.enum(["light", "moderate", "vigorous"]).default("moderate"),
  steps:           z.number().int().min(0).optional(),
  notes:           z.string().optional(),
});