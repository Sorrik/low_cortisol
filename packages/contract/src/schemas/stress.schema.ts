import { z } from 'zod'
import { RecentDateSchema, TimeOfDaySchema } from './_shared'

export const StressSchema = z.object({
  id:             z.string().uuid().optional(),
  date:           RecentDateSchema,
  time:           TimeOfDaySchema,
  level:          z.number().int().min(1).max(10),
  cause:          z.string().max(200).nullable().optional(),
  copingStrategy: z.string().max(200).nullable().optional(),
  notes:          z.string().max(2000).nullable().optional(),
})
