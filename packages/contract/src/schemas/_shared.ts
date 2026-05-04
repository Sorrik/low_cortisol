// Общие zod-схемы для всех metric-DTO. Вынесены, чтобы валидация даты и
// времени была одинаковой по всем 6 метрикам — иначе слишком легко
// разойтись и пропустить, например, дату 2099 в один эндпоинт.

import { z } from 'zod'

const ONE_DAY_MS  = 24 * 60 * 60 * 1000
const ONE_YEAR_MS = 365 * ONE_DAY_MS

/**
 * `YYYY-MM-DD`. Не в будущем, не старше 365 дней.
 *
 * Зачем границы:
 *   - будущее → ML-пайплайн получит «событие завтра», ломает временные ряды;
 *   - >1 года → редактирование старых записей задним числом портит train-set
 *     (в reasonable use-case пользователь не вводит сегодня данные за прошлый
 *     год; если очень надо — отдельный admin-flow).
 */
export const RecentDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате YYYY-MM-DD')
  .refine(
    (s) => {
      const d = new Date(s + 'T00:00:00')
      if (Number.isNaN(d.getTime())) return false
      const now = Date.now()
      // Конец сегодняшнего дня в локальном TZ — допускаем «сегодня».
      const endOfToday = new Date()
      endOfToday.setHours(23, 59, 59, 999)
      if (d.getTime() > endOfToday.getTime()) return false
      if (now - d.getTime() > ONE_YEAR_MS) return false
      return true
    },
    'Дата должна быть от сегодня и не старше 365 дней',
  )

/**
 * `HH:MM` или `HH:MM:SS`. БД может хранить с секундами — допускаем оба.
 */
export const TimeOfDaySchema = z
  .string()
  .regex(
    /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/,
    'Время должно быть в формате HH:MM или HH:MM:SS',
  )
