import { z } from 'zod'

export const WaterSchema = z.object({
  id:       z.string().uuid().optional(),
  date:     z.string(),
  time:     z.string(),           // HH:MM:SS из БД
  amountMl: z.number().int().min(0),
})
