import { z } from 'zod'

export const MoodSchema = z.object({
  id:        z.string().uuid().optional(),
  date:      z.string(),
  time:      z.string(),          // ← без regex (БД хранит HH:MM:SS)
  moodScore: z.number().int().min(1).max(10),
  emotions:  z.string().nullable().optional(),   // ← добавить nullable
  triggers:  z.string().nullable().optional(),   // ← добавить nullable
  notes:     z.string().nullable().optional(),
})
