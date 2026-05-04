import { z } from 'zod'
import { RecentDateSchema, TimeOfDaySchema } from './_shared'

export const NutritionSchema = z.object({
  id:           z.string().uuid().optional(),
  date:         RecentDateSchema,
  time:         TimeOfDaySchema,
  mealType:     z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  // 500 символов — достаточно для развёрнутого описания блюда.
  description:  z.string().min(1).max(500),
  // Один приём пищи — крайняя верхняя граница 5000 ккал
  // (огромный буфет, всё равно за рамки реальности).
  calories:     z.number().int().min(0).max(5_000),
  // Макронутриенты — по 1000г макс на приём (физически нереально больше).
  proteinGrams: z.number().min(0).max(1_000),
  carbsGrams:   z.number().min(0).max(1_000),
  fatGrams:     z.number().min(0).max(1_000),
})
