import { z } from 'zod'

export const StressSchema = z.object({
  id:             z.string().uuid().optional(),
  date:           z.string(),
  time:           z.string(),                         // HH:MM:SS из БД
  level:          z.number().int().min(1).max(10),
  cause:          z.string().nullable().optional(),   // ← добавить
  copingStrategy: z.string().nullable().optional(),   // ← добавить
  notes:          z.string().nullable().optional(),
})
