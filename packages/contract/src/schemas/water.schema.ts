import { z } from 'zod'
import { RecentDateSchema, TimeOfDaySchema } from './_shared'

export const WaterSchema = z.object({
  id:       z.string().uuid().optional(),
  date:     RecentDateSchema,
  time:     TimeOfDaySchema,
  // Один приём — не более 5 литров (физиологически опасно за раз);
  // суточная норма ~2-3 л.
  amountMl: z.number().int().min(0).max(5_000),
})
