import { z } from 'zod'
import { RecentDateSchema, TimeOfDaySchema } from './_shared'

export const ActivitySchema = z.object({
  id:              z.string().optional(),
  date:            RecentDateSchema,
  time:            TimeOfDaySchema.optional(),
  type:            z.enum(["walk", "run", "yoga", "gym", "sport", "other"]),
  // 24 часа = 1440 мин — физический максимум за сутки.
  durationMinutes: z.number().int().min(1).max(1440),
  intensity:       z.enum(["light", "moderate", "vigorous"]).default("moderate"),
  // 10000 ккал — крайняя верхняя граница (марафонцы); выше — мусор.
  caloriesBurned:  z.number().int().min(0).max(10_000).optional(),
  notes:           z.string().max(2000).optional(),
})
