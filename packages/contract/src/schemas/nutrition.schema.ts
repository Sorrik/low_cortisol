import { z } from 'zod'

export const NutritionSchema = z.object({
  id:           z.string().uuid().optional(),
  date:         z.string(),
  time:         z.string(),
  mealType:     z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  description:  z.string(),
  calories:     z.number().int().min(0),
  proteinGrams: z.number().min(0),
  carbsGrams:   z.number().min(0),
  fatGrams:     z.number().min(0),
})