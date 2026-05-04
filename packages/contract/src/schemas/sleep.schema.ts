import { z } from 'zod'
import { RecentDateSchema, TimeOfDaySchema } from './_shared'

export const SleepSchema = z.object({
  id:            z.string().uuid().optional(),
  date:          RecentDateSchema,
  bedTime:       TimeOfDaySchema,
  wakeTime:      TimeOfDaySchema,
  // Длительность сна — реальный максимум 18ч (медицинский экстрим);
  // выше — явная ошибка ввода или баг расчёта.
  durationHours: z.number().min(0).max(18).nullable().optional(),
  quality:       z.number().int().min(1).max(10),
  // Большее число пробуждений за ночь физически нереально (≥30 — каждые 16мин).
  interruptions: z.number().int().min(0).max(30).optional().nullable(),
  notes:         z.string().max(2000).optional().nullable(),
})
