import { z } from 'zod'
import { RecentDateSchema, TimeOfDaySchema } from './_shared'

export const MoodSchema = z.object({
  id:        z.string().uuid().optional(),
  date:      RecentDateSchema,
  time:      TimeOfDaySchema,
  moodScore: z.number().int().min(1).max(10),
  emotions:  z.string().max(200).nullable().optional(),
  triggers:  z.string().max(200).nullable().optional(),
  notes:     z.string().max(2000).nullable().optional(),
})
