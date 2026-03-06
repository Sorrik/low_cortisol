import { z } from 'zod'

export const SleepSchema = z.object({
  id:           z.string().uuid().optional(),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bedTime:      z.string(),  // ← убрать строгий regex, БД хранит HH:MM:SS
  wakeTime:     z.string(),  // ← убрать строгий regex
  durationHours: z.number().nullable().optional(),  // ← добавить!
  quality:      z.number().int().min(1).max(10),
  interruptions: z.number().int().min(0).optional().nullable(),
  notes:        z.string().optional().nullable(),
})
